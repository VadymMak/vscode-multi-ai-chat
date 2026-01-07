/**
 * Code Action Provider for Quick Fix Menu (Ctrl+.)
 *
 * Integrates our AI fixes into VS Code native Quick Fix menu.
 * Shows learned patterns from DB as recommended fixes.
 *
 * File: src/services/errorFixer/codeActionProvider.ts
 */

import * as vscode from "vscode";
import { get, post } from "../../api/apiClient";
import logger from "../../utils/logger";
import { errorClassifier } from "./errorClassifier";
import { fixGenerator } from "./fixGenerator";
import { fixApplier } from "./fixApplier";
import { getCurrentProjectId } from "../../extension";
import {
  DetectedError,
  ErrorClassification,
  LearnedWarning,
} from "../../types";

// ============================================
// CODE ACTION PROVIDER
// ============================================

export class SmartFixCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  /**
   * Provide code actions for diagnostics at current position
   */
  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeAction[]> {
    // Get diagnostics (errors) at current position
    const diagnostics = context.diagnostics.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error
    );

    if (diagnostics.length === 0) {
      return [];
    }

    const actions: vscode.CodeAction[] = [];
    const projectId = getCurrentProjectId();

    for (const diagnostic of diagnostics) {
      // Create detected error object
      const detectedError: DetectedError = {
        text: diagnostic.message,
        filePath: document.uri.fsPath,
        line: diagnostic.range.start.line + 1,
        source: "diagnostics",
        timestamp: new Date(),
        sourceName: diagnostic.source || "unknown",
      };

      // Classify error
      const classification = errorClassifier.classify(detectedError);

      // 1. Check for learned patterns from DB (recommended)
      if (projectId) {
        const learnedFix = await this.getLearnedFix(
          projectId,
          diagnostic.message,
          classification.type
        );

        if (learnedFix) {
          const recommendedAction = this.createLearnedFixAction(
            document,
            diagnostic,
            learnedFix
          );
          if (recommendedAction) {
            actions.push(recommendedAction);
          }
        }
      }

      // 2. Add AI Fix option
      const aiFixAction = this.createAIFixAction(
        document,
        diagnostic,
        detectedError,
        classification,
        projectId
      );
      actions.push(aiFixAction);
    }

    return actions;
  }

  /**
   * Get learned fix from database
   */
  private async getLearnedFix(
    projectId: number,
    errorPattern: string,
    errorType: string
  ): Promise<LearnedWarning | null> {
    try {
      const response = (await get(
        `/vscode/learned-warnings/${projectId}?error_type=${errorType}&limit=1`
      )) as any;

      if (response.warnings && response.warnings.length > 0) {
        const warning = response.warnings[0];

        // Check if this warning matches current error
        if (this.isPatternMatch(errorPattern, warning.error_pattern)) {
          return warning;
        }
      }

      return null;
    } catch (error) {
      logger.debug(`[CodeAction] Failed to get learned fix: ${error}`);
      return null;
    }
  }

  /**
   * Check if error matches learned pattern
   */
  private isPatternMatch(
    currentError: string,
    learnedPattern: string
  ): boolean {
    // Normalize both strings
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/'.+?'/g, "'X'") // Replace quoted strings
        .replace(/\d+/g, "N") // Replace numbers
        .trim();

    return normalize(currentError).includes(
      normalize(learnedPattern).substring(0, 30)
    );
  }

  /**
   * Create code action for learned fix (recommended)
   */
  private createLearnedFixAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    learnedFix: LearnedWarning
  ): vscode.CodeAction | null {
    if (!learnedFix.solution_pattern) {
      return null;
    }

    const action = new vscode.CodeAction(
      `⭐ Recommended: ${learnedFix.solution_pattern} (worked ${learnedFix.occurrence_count}x)`,
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];
    action.isPreferred = true; // Show as preferred/recommended

    // Store data for execution
    action.command = {
      command: "smartCline.applyLearnedFix",
      title: "Apply Learned Fix",
      arguments: [document.uri, diagnostic.range, learnedFix],
    };

    return action;
  }

  /**
   * Create code action for AI fix
   */
  private createAIFixAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    error: DetectedError,
    classification: ErrorClassification,
    projectId: number | null
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `🤖 AI Fix: ${classification.type}`,
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];

    action.command = {
      command: "smartCline.generateAIFix",
      title: "Generate AI Fix",
      arguments: [
        document.uri,
        diagnostic.range,
        error,
        classification,
        projectId,
      ],
    };

    return action;
  }
}

// ============================================
// COMMAND HANDLERS
// ============================================

/**
 * Register code action provider and commands
 */
export function registerCodeActionProvider(
  context: vscode.ExtensionContext
): void {
  // Register the provider for all languages
  const provider = vscode.languages.registerCodeActionsProvider(
    { scheme: "file" }, // All files
    new SmartFixCodeActionProvider(),
    {
      providedCodeActionKinds:
        SmartFixCodeActionProvider.providedCodeActionKinds,
    }
  );

  context.subscriptions.push(provider);
  logger.info("✅ SmartFix CodeActionProvider registered");

  // Register command: Apply Learned Fix
  const applyLearnedFixCmd = vscode.commands.registerCommand(
    "smartCline.applyLearnedFix",
    async (
      uri: vscode.Uri,
      range: vscode.Range,
      learnedFix: LearnedWarning
    ) => {
      await applyLearnedFix(uri, range, learnedFix);
    }
  );
  context.subscriptions.push(applyLearnedFixCmd);

  // Register command: Generate AI Fix
  const generateAIFixCmd = vscode.commands.registerCommand(
    "smartCline.generateAIFix",
    async (
      uri: vscode.Uri,
      range: vscode.Range,
      error: DetectedError,
      classification: ErrorClassification,
      projectId: number | null
    ) => {
      await generateAndApplyAIFix(uri, range, error, classification, projectId);
    }
  );
  context.subscriptions.push(generateAIFixCmd);

  logger.info("✅ SmartFix commands registered");
}

/**
 * Apply a learned fix from database
 */
async function applyLearnedFix(
  uri: vscode.Uri,
  range: vscode.Range,
  learnedFix: LearnedWarning
): Promise<void> {
  try {
    logger.info(`🔧 Applying learned fix: ${learnedFix.solution_pattern}`);

    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);

    // For learned fixes, we need to generate the actual code
    // based on the solution pattern
    const projectId = getCurrentProjectId();

    if (!projectId) {
      vscode.window.showWarningMessage("Please select a project first");
      return;
    }

    // Get context around error
    const line = range.start.line;
    const startLine = Math.max(0, line - 5);
    const endLine = Math.min(document.lineCount - 1, line + 5);
    const contextRange = new vscode.Range(startLine, 0, endLine, 1000);
    const codeContext = document.getText(contextRange);

    // Ask AI to apply the learned solution pattern
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Applying fix...",
        cancellable: false,
      },
      async () => {
        const response = (await post("/vscode/chat", {
          message: `Apply this fix pattern: "${learnedFix.solution_pattern}"
                
Error: ${learnedFix.error_pattern}

Code context:
\`\`\`
${codeContext}
\`\`\`

Return ONLY the fixed code block.`,
          project_id: projectId,
          filePath: uri.fsPath,
          fileContent: document.getText().substring(0, 10000),
        } as any)) as any;

        if (response.response_type === "edit" && response.new_content) {
          // Apply the edit
          const fullRange = new vscode.Range(0, 0, document.lineCount, 0);
          await editor.edit((editBuilder) => {
            editBuilder.replace(fullRange, response.new_content);
          });

          await document.save();

          vscode.window.showInformationMessage(
            `✅ Applied: ${learnedFix.solution_pattern}`
          );

          // Report successful fix to backend
          await reportFixApplied(projectId, learnedFix.id, true);
        }
      }
    );
  } catch (error) {
    logger.error("Failed to apply learned fix", error as Error);
    vscode.window.showErrorMessage(`Failed to apply fix: ${error}`);
  }
}

/**
 * Generate and apply AI fix
 */
async function generateAndApplyAIFix(
  uri: vscode.Uri,
  range: vscode.Range,
  error: DetectedError,
  classification: ErrorClassification,
  projectId: number | null
): Promise<void> {
  try {
    if (!projectId) {
      vscode.window.showWarningMessage("Please select a project first");
      return;
    }

    logger.info(`🤖 Generating AI fix for: ${classification.type}`);

    const document = await vscode.workspace.openTextDocument(uri);
    const fileContent = document.getText();
    const filePath = uri.fsPath;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `🤖 Generating fix for ${classification.type}...`,
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
          vscode.window.showErrorMessage("Could not generate fix");
          return;
        }

        // Show diff and apply
        const result = await fixApplier.applyWithReview(fix);

        if (result.applied) {
          vscode.window.showInformationMessage(
            `✅ Fixed: ${classification.type}`
          );

          // Report fix to backend for learning
          await reportErrorFixed(
            projectId,
            error.text,
            classification.type,
            fix.originalCode,
            fix.fixedCode
          );
        }
      }
    );
  } catch (error) {
    logger.error("Failed to generate AI fix", error as Error);
    vscode.window.showErrorMessage(`Failed to generate fix: ${error}`);
  }
}

/**
 * Report that a learned fix was applied
 */
async function reportFixApplied(
  projectId: number,
  errorId: number,
  successful: boolean
): Promise<void> {
  try {
    await post("/vscode/report-fix", {
      error_id: errorId,
      fix_method: "learned",
      fix_successful: successful,
    } as any);

    logger.debug(`[AutoLearn] Reported learned fix applied: ${errorId}`);
  } catch (error) {
    logger.debug(`[AutoLearn] Failed to report fix: ${error}`);
  }
}

/**
 * Report error fixed for learning
 */
async function reportErrorFixed(
  projectId: number,
  errorPattern: string,
  errorType: string,
  originalCode?: string,
  fixedCode?: string
): Promise<void> {
  try {
    // First report the error
    const errorResponse = (await post("/vscode/report-error", {
      project_id: projectId,
      error_pattern: errorPattern,
      error_type: errorType,
    } as any)) as any;

    // Then report the fix
    if (errorResponse.error_id) {
      await post("/vscode/report-fix", {
        error_id: errorResponse.error_id,
        original_code: originalCode?.substring(0, 1000),
        fixed_code: fixedCode?.substring(0, 1000),
        fix_method: "ai_fix",
        fix_successful: true,
      } as any);
    }

    logger.debug(`[AutoLearn] Reported error and fix`);
  } catch (error) {
    logger.debug(`[AutoLearn] Failed to report: ${error}`);
  }
}
