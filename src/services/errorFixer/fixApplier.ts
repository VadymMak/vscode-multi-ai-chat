/**
 * Fix Applier
 * Applies generated fixes to files with diff preview
 *
 * Uses Virtual Documents for diff preview - no "Save?" prompts!
 */

import * as vscode from "vscode";
import logger from "../../utils/logger";
import { GeneratedFix, FixResult, FixOptions } from "../../types";

// ============================================
// VIRTUAL DOCUMENT PROVIDER (for clean diff)
// ============================================

const SCHEME_ORIGINAL = "smartcline-original";
const SCHEME_MODIFIED = "smartcline-modified";

// Store content for virtual documents
const virtualDocuments = new Map<string, string>();

class VirtualDocProvider implements vscode.TextDocumentContentProvider {
  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    return virtualDocuments.get(uri.toString()) || "";
  }
}

// Singleton providers
let providersRegistered = false;

function registerVirtualProviders(context?: vscode.ExtensionContext): void {
  if (providersRegistered) return;

  const provider = new VirtualDocProvider();

  // Register for both schemes
  const sub1 = vscode.workspace.registerTextDocumentContentProvider(
    SCHEME_ORIGINAL,
    provider
  );
  const sub2 = vscode.workspace.registerTextDocumentContentProvider(
    SCHEME_MODIFIED,
    provider
  );

  if (context) {
    context.subscriptions.push(sub1, sub2);
  }

  providersRegistered = true;
  logger.debug("Virtual document providers registered");
}

// ============================================
// FIX APPLIER CLASS
// ============================================

class FixApplier {
  private diffTabId: string | null = null;

  constructor() {
    // Register providers on first use
    registerVirtualProviders();
  }

  /**
   * Initialize with extension context (call from extension.ts)
   */
  public initialize(context: vscode.ExtensionContext): void {
    registerVirtualProviders(context);
  }

  /**
   * Apply fix to file
   */
  public async applyFix(
    fix: GeneratedFix,
    options: FixOptions
  ): Promise<FixResult> {
    try {
      logger.info(`🔧 Applying fix to ${fix.filePath}...`);

      // Find the file
      const fileUri = await this.findFileUri(fix.filePath);
      if (!fileUri) {
        return {
          success: false,
          applied: false,
          message: `File not found: ${fix.filePath}`,
          error: "FILE_NOT_FOUND",
        };
      }

      // Show diff if requested
      if (options.showDiff && !options.autoApply) {
        const userApproved = await this.showDiffAndConfirm(fix, fileUri);
        if (!userApproved) {
          return {
            success: true,
            applied: false,
            message: "Fix rejected by user",
          };
        }
      }

      // Apply the fix
      const applied = await this.applyToFile(fix, fileUri);

      if (applied) {
        // Show notification if requested
        if (options.showNotification) {
          vscode.window.showInformationMessage(
            `✅ Fixed: ${fix.fixType} in ${fix.filePath.split(/[/\\]/).pop()}`
          );
        }

        return {
          success: true,
          applied: true,
          message: `Fix applied successfully to ${fix.filePath}`,
        };
      } else {
        return {
          success: false,
          applied: false,
          message: "Failed to apply fix",
          error: "APPLY_FAILED",
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("Fix application failed", err as Error);
      return {
        success: false,
        applied: false,
        message: `Error applying fix: ${errorMsg}`,
        error: errorMsg,
      };
    }
  }

  /**
   * Find file URI in workspace
   */
  private async findFileUri(filePath: string): Promise<vscode.Uri | null> {
    // Try as absolute path first
    try {
      const uri = vscode.Uri.file(filePath);
      await vscode.workspace.fs.stat(uri);
      return uri;
    } catch {
      // Not absolute, try relative to workspace
    }

    // Try relative to workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return null;
    }

    for (const folder of workspaceFolders) {
      try {
        const uri = vscode.Uri.joinPath(folder.uri, filePath);
        await vscode.workspace.fs.stat(uri);
        return uri;
      } catch {
        continue;
      }
    }

    // Try to find by filename
    const fileName = filePath.split(/[/\\]/).pop();
    if (fileName) {
      const files = await vscode.workspace.findFiles(`**/${fileName}`, null, 1);
      if (files.length > 0) {
        return files[0];
      }
    }

    return null;
  }

  /**
   * Show diff preview and ask for confirmation
   * Uses virtual documents - no "Save?" prompts!
   */
  private async showDiffAndConfirm(
    fix: GeneratedFix,
    fileUri: vscode.Uri
  ): Promise<boolean> {
    // Read current file content
    const document = await vscode.workspace.openTextDocument(fileUri);
    const fullContent = document.getText();

    // Create preview of changes
    const previewContent = this.createPreviewContent(fullContent, fix);

    // Create unique ID for this diff
    const diffId = Date.now().toString();
    this.diffTabId = diffId;

    // Store content in virtual documents
    const originalUri = vscode.Uri.parse(
      `${SCHEME_ORIGINAL}:/${diffId}/original.${document.languageId}`
    );
    const modifiedUri = vscode.Uri.parse(
      `${SCHEME_MODIFIED}:/${diffId}/modified.${document.languageId}`
    );

    virtualDocuments.set(originalUri.toString(), fullContent);
    virtualDocuments.set(modifiedUri.toString(), previewContent);

    // Show diff
    const fileName = fix.filePath.split(/[/\\]/).pop() || "file";
    await vscode.commands.executeCommand(
      "vscode.diff",
      originalUri,
      modifiedUri,
      `🔧 Fix Preview: ${fileName}`
    );

    // Ask user with modal dialog
    const choice = await vscode.window.showInformationMessage(
      `Apply this fix? (${fix.fixType})`,
      { modal: true },
      "✅ Apply",
      "❌ Reject",
      "👁️ View Explanation"
    );

    // Close diff tab (virtual docs close without prompts!)
    await this.closeDiffTab();

    // Clean up virtual documents
    virtualDocuments.delete(originalUri.toString());
    virtualDocuments.delete(modifiedUri.toString());

    if (choice === "👁️ View Explanation") {
      await vscode.window.showInformationMessage(fix.explanation, {
        modal: true,
      });
      // Ask again
      const secondChoice = await vscode.window.showInformationMessage(
        `Apply this fix?`,
        { modal: true },
        "✅ Apply",
        "❌ Reject"
      );
      return secondChoice === "✅ Apply";
    }

    return choice === "✅ Apply";
  }

  /**
   * Close the diff tab
   */
  private async closeDiffTab(): Promise<void> {
    try {
      // Find and close tabs with our virtual scheme
      const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);

      for (const tab of tabs) {
        const input = tab.input as any;

        // Check if it's our diff tab (has our scheme in URI)
        if (
          input?.original?.scheme === SCHEME_ORIGINAL ||
          input?.modified?.scheme === SCHEME_MODIFIED ||
          tab.label.includes("Fix Preview")
        ) {
          await vscode.window.tabGroups.close(tab);
        }
      }
    } catch (err) {
      // Fallback: close active editor
      try {
        await vscode.commands.executeCommand(
          "workbench.action.closeActiveEditor"
        );
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Create preview content with fix applied
   */
  private createPreviewContent(fullContent: string, fix: GeneratedFix): string {
    const lines = fullContent.split("\n");

    // Replace lines from lineStart to lineEnd with fixed code
    const beforeLines = lines.slice(0, fix.lineStart - 1);
    const afterLines = lines.slice(fix.lineEnd);
    const fixedLines = fix.fixedCode.split("\n");

    return [...beforeLines, ...fixedLines, ...afterLines].join("\n");
  }

  /**
   * Apply fix to actual file
   */
  private async applyToFile(
    fix: GeneratedFix,
    fileUri: vscode.Uri
  ): Promise<boolean> {
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document);

      // Calculate range to replace
      const startPos = new vscode.Position(fix.lineStart - 1, 0);
      const endLine = Math.min(fix.lineEnd - 1, document.lineCount - 1);
      const endPos = new vscode.Position(
        endLine,
        document.lineAt(endLine).text.length
      );
      const range = new vscode.Range(startPos, endPos);

      // Apply edit
      const success = await editor.edit((editBuilder) => {
        editBuilder.replace(range, fix.fixedCode);
      });

      if (success) {
        // Save file
        await document.save();
        logger.info(`✅ Fix applied and saved: ${fix.filePath}`);
      }

      return success;
    } catch (err) {
      logger.error("Failed to apply fix to file", err as Error);
      return false;
    }
  }

  /**
   * Quick apply without diff (for auto-fix)
   */
  public async quickApply(fix: GeneratedFix): Promise<FixResult> {
    return this.applyFix(fix, {
      autoApply: true,
      showDiff: false,
      showNotification: true,
    });
  }

  /**
   * Apply with diff preview (for manual review)
   */
  public async applyWithReview(fix: GeneratedFix): Promise<FixResult> {
    return this.applyFix(fix, {
      autoApply: false,
      showDiff: true,
      showNotification: true,
    });
  }
}

// Export singleton
export const fixApplier = new FixApplier();
export default FixApplier;
