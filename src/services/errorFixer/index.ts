/**
 * Error Fixer - Main Orchestrator
 * Coordinates detection → classification → fix → apply
 */

import * as vscode from "vscode";
import logger from "../../utils/logger";
import {
  DetectedError,
  ErrorClassification,
  GeneratedFix,
  FixResult,
  ErrorFixerConfig,
  DEFAULT_ERROR_FIXER_CONFIG,
} from "../../types";
import { errorClassifier } from "./errorClassifier";
import { fixGenerator } from "./fixGenerator";
import { fixApplier } from "./fixApplier";

// ============================================
// ERROR FIXER ORCHESTRATOR
// ============================================

class ErrorFixer {
  private config: ErrorFixerConfig;
  private lastErrorHash: string = "";
  private lastErrorTime: number = 0;
  private readonly DEBOUNCE_MS = 3000; // 3 seconds
  private lastFixTime: number = 0;
  private lastFixedFile: string = "";
  private readonly FIX_COOLDOWN_MS = 10000; // 10 seconds after fix - no new fixes for same file
  constructor(config?: Partial<ErrorFixerConfig>) {
    this.config = { ...DEFAULT_ERROR_FIXER_CONFIG, ...config };
  }

  /**
   * Main entry point: Handle detected error
   */
  public async handleError(
    error: DetectedError,
    projectId: number | null
  ): Promise<FixResult> {
    try {
      // Check if user is logged in
      const AuthManager = (await import("../../auth/authManager")).default;
      const authManager = AuthManager.getInstance();
      const token = await authManager.getToken();

      if (!token) {
        logger.info("⏭️ Error detection skipped - user not logged in");
        return {
          success: false,
          applied: false,
          message: "User not logged in",
        };
      }

      // Debounce: skip if same error within 3 seconds
      const errorHash = this.hashError(error);
      const now = Date.now();
      if (
        errorHash === this.lastErrorHash &&
        now - this.lastErrorTime < this.DEBOUNCE_MS
      ) {
        logger.info("⏭️ Skipping duplicate error (debounced)");
        return {
          success: true,
          applied: false,
          message: "Duplicate error skipped",
        };
      }
      this.lastErrorHash = errorHash;
      this.lastErrorTime = now;

      // Cooldown: skip if we just fixed this file
      const currentFile = error.filePath || "";
      if (
        currentFile &&
        currentFile === this.lastFixedFile &&
        now - this.lastFixTime < this.FIX_COOLDOWN_MS
      ) {
        logger.info(`⏭️ Skipping error (fix cooldown for ${currentFile})`);
        return {
          success: true,
          applied: false,
          message: "Fix cooldown active for this file",
        };
      }

      logger.info(`🔍 Processing error: ${error.text.substring(0, 100)}...`);

      // Step 1: Classify error
      const classification = errorClassifier.classify(error);
      logger.info(
        `📋 Classified as: ${classification.type} (${classification.severity}, confidence: ${classification.confidence})`
      );

      // Step 2: Check if we should ignore
      if (classification.suggestedAction === "ignore") {
        logger.info("⏭️ Error ignored based on classification");
        return {
          success: true,
          applied: false,
          message: "Error ignored - low confidence or unknown type",
        };
      }

      // Step 3: Check project ID
      if (!projectId) {
        logger.warn("No project ID - showing notification only");
        await this.showErrorNotification(error, classification);
        return {
          success: true,
          applied: false,
          message: "No project selected - cannot generate fix",
        };
      }

      // Step 4: Decide auto-fix or manual
      const shouldAutoFix =
        this.config.autoFixSimpleErrors &&
        errorClassifier.shouldAutoFix(classification) &&
        this.config.autoFixTypes.includes(classification.type);

      if (shouldAutoFix) {
        return await this.autoFix(error, classification, projectId);
      } else {
        return await this.manualFix(error, classification, projectId);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("Error handling failed", err as Error);
      return {
        success: false,
        applied: false,
        message: `Error handling failed: ${errorMsg}`,
        error: errorMsg,
      };
    }
  }

  /**
   * Auto-fix flow (for simple errors)
   */
  private async autoFix(
    error: DetectedError,
    classification: ErrorClassification,
    projectId: number
  ): Promise<FixResult> {
    logger.info("🤖 Starting auto-fix flow...");

    // Get active file
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return await this.manualFix(error, classification, projectId);
    }

    let document = editor.document;
    let filePath = document.uri.fsPath;

    // Check cooldown for this specific file
    const now = Date.now();
    if (
      filePath === this.lastFixedFile &&
      now - this.lastFixTime < this.FIX_COOLDOWN_MS
    ) {
      logger.info(
        `⏭️ Skipping auto-fix (cooldown for ${filePath.split(/[/\\]/).pop()})`
      );
      return {
        success: true,
        applied: false,
        message: "Fix cooldown active for this file",
      };
    }
    const fileContent = document.getText();

    // Update error with file info if missing
    if (!error.filePath) {
      error.filePath = filePath;
    }
    if (!error.line) {
      const location = errorClassifier.extractLocation(error.text);
      error.line = location.line;
    }

    // Generate fix
    const fix = await fixGenerator.generateFix(
      error,
      classification,
      projectId,
      fileContent,
      filePath
    );

    if (!fix) {
      logger.warn("Could not generate fix - falling back to manual");
      return await this.manualFix(error, classification, projectId);
    }

    // Check confidence
    if (fix.confidence < this.config.autoFixMinConfidence) {
      logger.info("Fix confidence too low - asking user");
      return await this.applyWithConfirmation(fix, error, classification);
    }

    // Apply fix automatically
    logger.info("✨ Auto-applying fix...");
    const result = await fixApplier.quickApply(fix);

    if (result.applied) {
      // Set cooldown for this file
      this.lastFixTime = Date.now();
      this.lastFixedFile = filePath;
      vscode.window.showInformationMessage(
        `🤖 Auto-fixed: ${classification.type} in ${filePath
          .split(/[/\\]/)
          .pop()}`
      );
    }

    return result;
  }

  /**
   * Manual fix flow (for complex errors)
   */
  private async manualFix(
    error: DetectedError,
    classification: ErrorClassification,
    projectId: number
  ): Promise<FixResult> {
    logger.info("👤 Starting manual fix flow...");

    // Show notification with options
    const choice = await vscode.window.showWarningMessage(
      `🔴 ${classification.type}: ${error.text.substring(0, 60)}...`,
      "🔧 Generate Fix",
      "📋 Copy Error",
      "❌ Dismiss"
    );

    if (choice === "📋 Copy Error") {
      await vscode.env.clipboard.writeText(error.text);
      vscode.window.showInformationMessage("Error copied to clipboard");
      return { success: true, applied: false, message: "Error copied" };
    }

    if (choice !== "🔧 Generate Fix") {
      return { success: true, applied: false, message: "Dismissed by user" };
    }

    // Get active file
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("Please open the file with the error");
      return { success: false, applied: false, message: "No file open" };
    }

    const document = editor.document;
    const filePath = document.uri.fsPath;
    const fileContent = document.getText();

    // Update error info
    if (!error.filePath) {
      error.filePath = filePath;
    }
    if (!error.line) {
      const location = errorClassifier.extractLocation(error.text);
      error.line = location.line || editor.selection.active.line + 1;
    }

    // Show progress
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "🔧 Generating fix...",
        cancellable: false,
      },
      async () => {
        // Generate fix
        const fix = await fixGenerator.generateFix(
          error,
          classification,
          projectId,
          fileContent,
          filePath
        );

        if (!fix) {
          vscode.window.showErrorMessage(
            "Could not generate fix. Try manual analysis."
          );
          return {
            success: false,
            applied: false,
            message: "Fix generation failed",
          };
        }

        // Apply with review
        return await fixApplier.applyWithReview(fix);
      }
    );
  }

  /**
   * Apply fix with user confirmation
   */
  private async applyWithConfirmation(
    fix: GeneratedFix,
    error: DetectedError,
    classification: ErrorClassification
  ): Promise<FixResult> {
    const choice = await vscode.window.showInformationMessage(
      `🔧 Fix ready for ${classification.type}. Apply?`,
      "✅ Apply",
      "👁️ Review",
      "❌ Cancel"
    );

    if (choice === "✅ Apply") {
      return await fixApplier.quickApply(fix);
    } else if (choice === "👁️ Review") {
      return await fixApplier.applyWithReview(fix);
    }

    return { success: true, applied: false, message: "Cancelled by user" };
  }

  /**
   * Show error notification only
   */
  private async showErrorNotification(
    error: DetectedError,
    classification: ErrorClassification
  ): Promise<void> {
    if (!this.config.showDetectionNotification) {
      return;
    }

    await vscode.window.showWarningMessage(
      `🔴 ${classification.type}: ${error.text.substring(0, 80)}...`,
      "📋 Copy",
      "❌ Dismiss"
    );
  }

  private hashError(error: DetectedError): string {
    return `${error.text.substring(0, 100)}_${error.filePath || ""}_${
      error.line || 0
    }`;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ErrorFixerConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("ErrorFixer config updated");
  }
}

// Export singleton
export const errorFixer = new ErrorFixer();
export default ErrorFixer;

// Re-export components
export { errorClassifier } from "./errorClassifier";
export { fixGenerator } from "./fixGenerator";
export { fixApplier } from "./fixApplier";
