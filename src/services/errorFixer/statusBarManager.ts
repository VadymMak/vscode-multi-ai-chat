/**
 * Status Bar Manager for Error Display
 *
 * Shows error count in VS Code status bar.
 * Clickable to show list of fixable errors.
 *
 * File: src/services/errorFixer/statusBarManager.ts
 */

import * as vscode from "vscode";
import logger from "../../utils/logger";
import { errorClassifier } from "./errorClassifier";
import { getCurrentProjectId } from "../../extension";
import { DetectedError } from "../../types";

// ============================================
// STATUS BAR MANAGER
// ============================================

class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private currentErrors: Map<string, vscode.Diagnostic[]> = new Map();
  private diagnosticsListener: vscode.Disposable | null = null;

  constructor() {
    // Create status bar item (left side, high priority)
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    this.statusBarItem.command = "smartCline.showErrorList";
    this.statusBarItem.tooltip = "Click to see fixable errors";

    this.updateDisplay();
  }

  /**
   * Initialize the status bar manager
   */
  public initialize(context: vscode.ExtensionContext): void {
    // Add to subscriptions
    context.subscriptions.push(this.statusBarItem);

    // Listen to diagnostics changes
    this.diagnosticsListener = vscode.languages.onDidChangeDiagnostics(
      (event) => this.handleDiagnosticsChange(event)
    );
    context.subscriptions.push(this.diagnosticsListener);

    // Register command to show error list
    const showErrorListCmd = vscode.commands.registerCommand(
      "smartCline.showErrorList",
      () => this.showErrorList()
    );
    context.subscriptions.push(showErrorListCmd);

    // Initial scan of all open documents
    this.scanAllDocuments();

    logger.info("✅ StatusBarManager initialized");
  }

  /**
   * Handle diagnostics change event
   */
  private handleDiagnosticsChange(event: vscode.DiagnosticChangeEvent): void {
    for (const uri of event.uris) {
      if (uri.scheme !== "file") continue;

      const diagnostics = vscode.languages.getDiagnostics(uri);
      const errors = diagnostics.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Error
      );

      if (errors.length > 0) {
        this.currentErrors.set(uri.toString(), errors);
      } else {
        this.currentErrors.delete(uri.toString());
      }
    }

    this.updateDisplay();
  }

  /**
   * Scan all open documents for errors
   */
  private scanAllDocuments(): void {
    this.currentErrors.clear();

    for (const document of vscode.workspace.textDocuments) {
      if (document.uri.scheme !== "file") continue;

      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      const errors = diagnostics.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Error
      );

      if (errors.length > 0) {
        this.currentErrors.set(document.uri.toString(), errors);
      }
    }

    this.updateDisplay();
  }

  /**
   * Update status bar display
   */
  private updateDisplay(): void {
    const totalErrors = this.getTotalErrorCount();
    const fixableErrors = this.getFixableErrorCount();

    if (totalErrors === 0) {
      this.statusBarItem.hide();
      return;
    }

    // Show status bar
    this.statusBarItem.show();

    if (fixableErrors > 0) {
      this.statusBarItem.text = `$(error) ${fixableErrors} fixable`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
      this.statusBarItem.tooltip = `${fixableErrors} errors can be fixed with AI. Click to see list.`;
    } else {
      this.statusBarItem.text = `$(error) ${totalErrors} errors`;
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.tooltip = `${totalErrors} errors found. Click to see list.`;
    }
  }

  /**
   * Get total error count
   */
  private getTotalErrorCount(): number {
    let count = 0;
    for (const errors of this.currentErrors.values()) {
      count += errors.length;
    }
    return count;
  }

  /**
   * Get count of fixable errors (simple errors we can auto-fix)
   */
  private getFixableErrorCount(): number {
    let count = 0;

    for (const errors of this.currentErrors.values()) {
      for (const error of errors) {
        const detectedError: DetectedError = {
          text: error.message,
          filePath: null,
          line: error.range.start.line + 1,
          source: "diagnostics",
          timestamp: new Date(),
          sourceName: error.source || "unknown",
        };

        const classification = errorClassifier.classify(detectedError);

        if (
          classification.severity === "simple" &&
          classification.confidence >= 0.7
        ) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Show error list in Quick Pick
   */
  private async showErrorList(): Promise<void> {
    const items: vscode.QuickPickItem[] = [];
    const errorMap = new Map<
      string,
      { uri: vscode.Uri; diagnostic: vscode.Diagnostic }
    >();

    // Build list of errors
    for (const [uriString, errors] of this.currentErrors.entries()) {
      const uri = vscode.Uri.parse(uriString);
      const fileName = uri.fsPath.split(/[/\\]/).pop() || "unknown";

      for (const error of errors) {
        const detectedError: DetectedError = {
          text: error.message,
          filePath: uri.fsPath,
          line: error.range.start.line + 1,
          source: "diagnostics",
          timestamp: new Date(),
          sourceName: error.source || "unknown",
        };

        const classification = errorClassifier.classify(detectedError);
        const isFixable =
          classification.severity === "simple" &&
          classification.confidence >= 0.7;

        const icon = isFixable ? "$(lightbulb)" : "$(error)";
        const label = `${icon} ${fileName}:${error.range.start.line + 1}`;
        const description =
          error.message.substring(0, 60) +
          (error.message.length > 60 ? "..." : "");
        const detail = isFixable
          ? `${classification.type} - AI can fix this`
          : `${classification.type}`;

        const itemId = `${uriString}:${
          error.range.start.line
        }:${error.message.substring(0, 20)}`;

        items.push({
          label,
          description,
          detail,
        });

        errorMap.set(label, { uri, diagnostic: error });
      }
    }

    if (items.length === 0) {
      vscode.window.showInformationMessage("No errors found!");
      return;
    }

    // Add "Fix All" option at top if there are fixable errors
    const fixableCount = this.getFixableErrorCount();
    if (fixableCount > 0) {
      items.unshift({
        label: "$(tools) Fix All Fixable Errors",
        description: `${fixableCount} errors`,
        detail: "Generate AI fixes for all simple errors",
      });
    }

    // Show Quick Pick
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select error to navigate or fix",
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!selected) return;

    // Handle selection
    if (selected.label.includes("Fix All")) {
      await this.fixAllErrors();
    } else {
      const errorInfo = errorMap.get(selected.label);
      if (errorInfo) {
        await this.navigateToError(errorInfo.uri, errorInfo.diagnostic);
      }
    }
  }

  /**
   * Navigate to error location
   */
  private async navigateToError(
    uri: vscode.Uri,
    diagnostic: vscode.Diagnostic
  ): Promise<void> {
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);

    // Move cursor to error location
    const position = diagnostic.range.start;
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(diagnostic.range, vscode.TextEditorRevealType.InCenter);

    // Show hint about Quick Fix
    vscode.window
      .showInformationMessage(
        "Press Ctrl+. (Cmd+. on Mac) to see fix options",
        "Show Fixes"
      )
      .then((choice) => {
        if (choice === "Show Fixes") {
          vscode.commands.executeCommand("editor.action.quickFix");
        }
      });
  }

  /**
   * Fix all fixable errors
   */
  private async fixAllErrors(): Promise<void> {
    const projectId = getCurrentProjectId();

    if (!projectId) {
      vscode.window.showWarningMessage("Please select a project first");
      return;
    }

    vscode.window.showInformationMessage(
      "Fix All is coming soon! For now, use Ctrl+. on each error.",
      "OK"
    );

    // TODO: Implement batch fixing
    // This would iterate through all fixable errors and apply fixes
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.statusBarItem.dispose();
    if (this.diagnosticsListener) {
      this.diagnosticsListener.dispose();
    }
    this.currentErrors.clear();
    logger.info("StatusBarManager disposed");
  }
}

// Export singleton
export const statusBarManager = new StatusBarManager();
export default StatusBarManager;
