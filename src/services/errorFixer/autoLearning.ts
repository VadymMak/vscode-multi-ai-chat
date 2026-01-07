/**
 * Auto Learning Service
 *
 * Reports errors to backend for learning after file save.
 * Fetches learned patterns to suggest recommended fixes.
 *
 * File: src/services/errorFixer/autoLearning.ts
 */

import * as vscode from "vscode";
import { get, post } from "../../api/apiClient";
import logger from "../../utils/logger";
import { getCurrentProjectId } from "../../extension";
import { errorClassifier } from "./errorClassifier";
import { DetectedError, LearnedWarning } from "../../types";

// ============================================
// AUTO LEARNING SERVICE
// ============================================

class AutoLearningService {
  private saveListener: vscode.Disposable | null = null;
  private pendingErrors: Map<string, vscode.Diagnostic[]> = new Map();
  private reportedInSession: Set<string> = new Set(); // Avoid duplicates in same session

  /**
   * Initialize auto learning - listen to file saves
   */
  public initialize(context: vscode.ExtensionContext): void {
    // Listen to file save events
    this.saveListener = vscode.workspace.onDidSaveTextDocument((document) =>
      this.onFileSaved(document)
    );
    context.subscriptions.push(this.saveListener);

    // Listen to diagnostics changes to track errors
    const diagnosticsListener = vscode.languages.onDidChangeDiagnostics(
      (event) => this.onDiagnosticsChanged(event)
    );
    context.subscriptions.push(diagnosticsListener);

    logger.info("✅ AutoLearningService initialized");
  }

  /**
   * Track diagnostics changes
   */
  private onDiagnosticsChanged(event: vscode.DiagnosticChangeEvent): void {
    for (const uri of event.uris) {
      if (uri.scheme !== "file") continue;

      const diagnostics = vscode.languages.getDiagnostics(uri);
      const errors = diagnostics.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Error
      );

      if (errors.length > 0) {
        this.pendingErrors.set(uri.toString(), errors);
      } else {
        // Errors cleared - file might have been fixed
        this.pendingErrors.delete(uri.toString());
      }
    }
  }

  /**
   * Handle file save - batch report errors
   */
  private async onFileSaved(document: vscode.TextDocument): Promise<void> {
    const projectId = getCurrentProjectId();
    if (!projectId) return;

    const uriString = document.uri.toString();
    const errors = this.pendingErrors.get(uriString);

    if (!errors || errors.length === 0) {
      return; // No errors to report
    }

    // Report errors in batch (background, no notification)
    await this.batchReportErrors(projectId, document.uri, errors);
  }

  /**
   * Batch report errors to backend
   */
  private async batchReportErrors(
    projectId: number,
    uri: vscode.Uri,
    errors: vscode.Diagnostic[]
  ): Promise<void> {
    const filePath = this.normalizeFilePath(uri.fsPath);

    for (const error of errors) {
      // Create unique key to avoid duplicates
      const errorKey = `${filePath}:${
        error.range.start.line
      }:${error.message.substring(0, 50)}`;

      if (this.reportedInSession.has(errorKey)) {
        continue; // Already reported in this session
      }

      try {
        // Classify error
        const detectedError: DetectedError = {
          text: error.message,
          filePath: filePath,
          line: error.range.start.line + 1,
          source: "diagnostics",
          timestamp: new Date(),
          sourceName: error.source || "unknown",
        };

        const classification = errorClassifier.classify(detectedError);

        // Get code snippet
        const codeSnippet = await this.getCodeSnippet(uri, error.range);

        // Report to backend
        await post("/vscode/report-error", {
          project_id: projectId,
          error_pattern: error.message,
          error_type: classification.type,
          error_code: this.getErrorCode(error),
          file_path: filePath,
          line_number: error.range.start.line + 1,
          code_snippet: codeSnippet,
        } as any);

        // Mark as reported
        this.reportedInSession.add(errorKey);

        logger.debug(
          `[AutoLearn] Reported: ${
            classification.type
          } - ${error.message.substring(0, 40)}...`
        );
      } catch (err) {
        // Silent fail - don't bother user
        logger.debug(`[AutoLearn] Failed to report error: ${err}`);
      }
    }
  }

  /**
   * Get learned warnings for a project
   */
  public async getLearnedWarnings(
    projectId: number,
    filePath?: string,
    limit: number = 5
  ): Promise<LearnedWarning[]> {
    try {
      let url = `/vscode/learned-warnings/${projectId}?limit=${limit}`;
      if (filePath) {
        url += `&file_path=${encodeURIComponent(filePath)}`;
      }

      const response = (await get(url)) as any;

      if (response.warnings) {
        return response.warnings;
      }

      return [];
    } catch (error) {
      logger.debug(`[AutoLearn] Failed to get warnings: ${error}`);
      return [];
    }
  }

  /**
   * Get recommended fix for an error pattern
   */
  public async getRecommendedFix(
    projectId: number,
    errorPattern: string,
    errorType: string
  ): Promise<LearnedWarning | null> {
    try {
      const warnings = await this.getLearnedWarnings(projectId);

      // Find matching warning
      for (const warning of warnings) {
        if (
          warning.error_type === errorType &&
          this.isPatternMatch(errorPattern, warning.error_pattern)
        ) {
          return warning;
        }
      }

      return null;
    } catch (error) {
      logger.debug(`[AutoLearn] Failed to get recommended fix: ${error}`);
      return null;
    }
  }

  /**
   * Report that an error was fixed
   */
  public async reportFix(
    errorId: number,
    originalCode?: string,
    fixedCode?: string,
    fixMethod: string = "manual"
  ): Promise<boolean> {
    try {
      await post("/vscode/report-fix", {
        error_id: errorId,
        original_code: originalCode?.substring(0, 1000),
        fixed_code: fixedCode?.substring(0, 1000),
        fix_method: fixMethod,
        fix_successful: true,
      } as any);

      logger.debug(`[AutoLearn] Reported fix for error ${errorId}`);
      return true;
    } catch (error) {
      logger.debug(`[AutoLearn] Failed to report fix: ${error}`);
      return false;
    }
  }

  /**
   * Get learning statistics for display
   */
  public async getStats(
    projectId: number
  ): Promise<{
    totalErrors: number;
    resolvedErrors: number;
    topErrors: Array<{ pattern: string; count: number }>;
  } | null> {
    try {
      const response = (await get(
        `/vscode/learning-stats/${projectId}`
      )) as any;

      return {
        totalErrors: response.errors?.total_occurrences || 0,
        resolvedErrors: response.errors?.total_resolved || 0,
        topErrors: response.top_errors || [],
      };
    } catch (error) {
      logger.debug(`[AutoLearn] Failed to get stats: ${error}`);
      return null;
    }
  }

  // ==================== HELPERS ====================

  /**
   * Normalize file path for database matching
   */
  private normalizeFilePath(fsPath: string): string {
    let normalized = fsPath.replace(/\\/g, "/");

    // Extract relative path from project markers
    const markers = ["backend/", "frontend/", "src/", "app/"];

    for (const marker of markers) {
      const idx = normalized.indexOf(marker);
      if (idx !== -1) {
        return normalized.substring(idx);
      }
    }

    // Fallback: return last 4 parts
    const parts = normalized.split("/");
    if (parts.length > 4) {
      return parts.slice(-4).join("/");
    }

    return normalized;
  }

  /**
   * Get error code from diagnostic
   */
  private getErrorCode(diagnostic: vscode.Diagnostic): string | undefined {
    if (!diagnostic.code) return undefined;

    if (
      typeof diagnostic.code === "string" ||
      typeof diagnostic.code === "number"
    ) {
      return String(diagnostic.code);
    }

    if (typeof diagnostic.code === "object" && "value" in diagnostic.code) {
      return String(diagnostic.code.value);
    }

    return undefined;
  }

  /**
   * Get code snippet around error
   */
  private async getCodeSnippet(
    uri: vscode.Uri,
    range: vscode.Range
  ): Promise<string | undefined> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);

      const startLine = Math.max(0, range.start.line - 2);
      const endLine = Math.min(document.lineCount - 1, range.end.line + 2);

      const snippetRange = new vscode.Range(startLine, 0, endLine, 1000);
      const snippet = document.getText(snippetRange);

      return snippet.length > 500 ? snippet.substring(0, 500) + "..." : snippet;
    } catch {
      return undefined;
    }
  }

  /**
   * Check if error matches learned pattern
   */
  private isPatternMatch(
    currentError: string,
    learnedPattern: string
  ): boolean {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/'.+?'/g, "'X'")
        .replace(/".+?"/g, '"X"')
        .replace(/\d+/g, "N")
        .trim();

    const normalizedCurrent = normalize(currentError);
    const normalizedLearned = normalize(learnedPattern);

    // Check if patterns are similar (at least 50% match)
    return (
      normalizedCurrent.includes(normalizedLearned.substring(0, 30)) ||
      normalizedLearned.includes(normalizedCurrent.substring(0, 30))
    );
  }

  /**
   * Clear session cache (call when project changes)
   */
  public clearSessionCache(): void {
    this.reportedInSession.clear();
    this.pendingErrors.clear();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.saveListener) {
      this.saveListener.dispose();
    }
    this.clearSessionCache();
    logger.info("AutoLearningService disposed");
  }
}

// Export singleton
export const autoLearningService = new AutoLearningService();
export default AutoLearningService;
