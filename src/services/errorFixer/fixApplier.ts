/**
 * Fix Applier
 * Applies generated fixes to files with diff preview
 */

import * as vscode from "vscode";
import logger from "../../utils/logger";
import { GeneratedFix, FixResult, FixOptions } from "../../types";

// ============================================
// FIX APPLIER CLASS
// ============================================

class FixApplier {
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
        // ✅ NEW: Close diff preview tabs
        await this.closeDiffPreviews();

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
   * Close all diff preview tabs
   */
  private async closeDiffPreviews(): Promise<void> {
    const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);

    for (const tab of tabs) {
      // Close tabs that are diff previews (Untitled documents)
      if (tab.label.includes("Fix Preview") || tab.label.includes("Untitled")) {
        try {
          await vscode.window.tabGroups.close(tab);
        } catch {
          // Ignore errors
        }
      }
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

    // Create temp documents for diff
    const originalDoc = await vscode.workspace.openTextDocument({
      content: fullContent,
      language: document.languageId,
    });

    const modifiedDoc = await vscode.workspace.openTextDocument({
      content: previewContent,
      language: document.languageId,
    });

    // Show diff
    const fileName = fix.filePath.split(/[/\\]/).pop() || "file";
    await vscode.commands.executeCommand(
      "vscode.diff",
      originalDoc.uri,
      modifiedDoc.uri,
      `🔧 Fix Preview: ${fileName}`
    );

    // Ask user
    const choice = await vscode.window.showInformationMessage(
      `Apply this fix? (${fix.fixType})`,
      { modal: true },
      "✅ Apply",
      "❌ Reject",
      "👁️ View Explanation"
    );

    if (choice === "👁️ View Explanation") {
      await vscode.window.showInformationMessage(fix.explanation, {
        modal: true,
      });
      // Ask again
      const secondChoice = await vscode.window.showInformationMessage(
        `Apply this fix?`,
        "✅ Apply",
        "❌ Reject"
      );
      return secondChoice === "✅ Apply";
    }

    return choice === "✅ Apply";
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
