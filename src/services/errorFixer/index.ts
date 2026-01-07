/**
 * Error Fixer - Main Orchestrator (v2)
 *
 * Simplified flow:
 * - NO popup spam
 * - Status bar shows error count
 * - Quick Fix menu (Ctrl+.) for fixes
 * - Auto-learning after save
 *
 * File: src/services/errorFixer/index.ts
 */

import * as vscode from "vscode";
import logger from "../../utils/logger";
import {
  DetectedError,
  ErrorClassification,
  FixResult,
  ErrorFixerConfig,
  DEFAULT_ERROR_FIXER_CONFIG,
} from "../../types";
import { errorClassifier } from "./errorClassifier";
import { fixGenerator } from "./fixGenerator";
import { fixApplier } from "./fixApplier";
import { registerCodeActionProvider } from "./codeActionProvider";
import { statusBarManager } from "./statusBarManager";
import { autoLearningService } from "./autoLearning";

// ============================================
// ERROR FIXER ORCHESTRATOR (v2 - Simplified)
// ============================================

class ErrorFixer {
  private config: ErrorFixerConfig;
  private initialized: boolean = false;

  constructor(config?: Partial<ErrorFixerConfig>) {
    this.config = {
      ...DEFAULT_ERROR_FIXER_CONFIG,
      ...config,
      // Override: disable auto-fix popups
      showDetectionNotification: false,
      autoFixSimpleErrors: false,
    };
  }

  /**
   * Initialize all error fixer components
   * Call this from extension.ts activate()
   */
  public initialize(context: vscode.ExtensionContext): void {
    if (this.initialized) {
      logger.warn("ErrorFixer already initialized");
      return;
    }

    logger.info("🔧 Initializing ErrorFixer v2...");

    // 1. Register Code Action Provider (Quick Fix menu)
    registerCodeActionProvider(context);
    logger.info("  ✅ CodeActionProvider registered");

    // 2. Initialize Status Bar
    statusBarManager.initialize(context);
    logger.info("  ✅ StatusBarManager initialized");

    // 3. Initialize Auto Learning (reports errors after save)
    autoLearningService.initialize(context);
    logger.info("  ✅ AutoLearningService initialized");

    this.initialized = true;
    logger.info("🔧 ErrorFixer v2 initialized successfully!");
  }

  /**
   * Handle detected error (from terminal watcher)
   * v2: Only logs, no popup. User uses Ctrl+. to fix.
   */
  public async handleError(
    error: DetectedError,
    projectId: number | null
  ): Promise<FixResult> {
    try {
      // Classify error
      const classification = errorClassifier.classify(error);

      logger.info(
        `🔍 Error detected: ${classification.type} - ${error.text.substring(
          0,
          50
        )}...`
      );

      // v2: NO popup, NO auto-fix
      // Just log and let user use Ctrl+. when ready

      // If error has file location, we could navigate there
      // But don't force it - user might be busy

      return {
        success: true,
        applied: false,
        message: "Error logged. Use Ctrl+. on the error to see fix options.",
      };
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
   * Generate fix for an error (called from codeActionProvider)
   */
  public async generateFix(
    error: DetectedError,
    classification: ErrorClassification,
    projectId: number,
    fileContent: string,
    filePath: string
  ) {
    return fixGenerator.generateFix(
      error,
      classification,
      projectId,
      fileContent,
      filePath
    );
  }

  /**
   * Apply fix with review (called from codeActionProvider)
   */
  public async applyFixWithReview(fix: any): Promise<FixResult> {
    return fixApplier.applyWithReview(fix);
  }

  /**
   * Quick apply fix (called from codeActionProvider for learned fixes)
   */
  public async quickApplyFix(fix: any): Promise<FixResult> {
    return fixApplier.quickApply(fix);
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ErrorFixerConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("ErrorFixer config updated");
  }

  /**
   * Get current config
   */
  public getConfig(): ErrorFixerConfig {
    return { ...this.config };
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    statusBarManager.dispose();
    autoLearningService.dispose();
    this.initialized = false;
    logger.info("ErrorFixer disposed");
  }
}

// Export singleton
export const errorFixer = new ErrorFixer();
export default ErrorFixer;

// Re-export components
export { errorClassifier } from "./errorClassifier";
export { fixGenerator } from "./fixGenerator";
export { fixApplier } from "./fixApplier";
export { registerCodeActionProvider } from "./codeActionProvider";
export { statusBarManager } from "./statusBarManager";
export { autoLearningService } from "./autoLearning";
