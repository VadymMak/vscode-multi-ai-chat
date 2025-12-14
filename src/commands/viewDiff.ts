import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

// ✅ Store active diff editors
const activeDiffEditors: Map<
  string,
  {
    originalUri: vscode.Uri;
    modifiedUri: vscode.Uri;
  }
> = new Map();

export async function showDiffInEditor(
  filePath: string,
  originalContent: string,
  newContent: string
): Promise<void> {
  try {
    console.log("📊 [ViewDiff] Opening diff editor for:", filePath);

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found");
      return;
    }

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(workspaceFolder.uri.fsPath, filePath);

    const tempDir = path.join(workspaceFolder.uri.fsPath, ".vscode-temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempOriginalPath = path.join(
      tempDir,
      `${path.basename(filePath)}.original`
    );
    const tempModifiedPath = path.join(
      tempDir,
      `${path.basename(filePath)}.modified`
    );

    fs.writeFileSync(tempOriginalPath, originalContent, "utf-8");
    fs.writeFileSync(tempModifiedPath, newContent, "utf-8");

    const originalUri = vscode.Uri.file(tempOriginalPath);
    const modifiedUri = vscode.Uri.file(tempModifiedPath);

    // ✅ Store URIs for cleanup
    activeDiffEditors.set(filePath, { originalUri, modifiedUri });

    await vscode.commands.executeCommand(
      "vscode.diff",
      originalUri,
      modifiedUri,
      `${path.basename(filePath)} - AI Proposed Changes`,
      {
        preview: true,
        preserveFocus: false,
      }
    );

    console.log("✅ [ViewDiff] Diff editor opened successfully");
  } catch (error) {
    const err = error as Error;
    console.error("❌ [ViewDiff] Failed to show diff:", err);
    vscode.window.showErrorMessage(`Failed to show diff: ${err.message}`);
  }
}

/// ✅ UPDATED: Close diff editor for a specific file
export async function closeDiffEditor(filePath: string): Promise<void> {
  try {
    console.log("🔒 [ViewDiff] Closing diff editor for:", filePath);

    const diffEditor = activeDiffEditors.get(filePath);
    if (!diffEditor) {
      console.log("⚠️ [ViewDiff] No active diff editor found for:", filePath);
      return;
    }

    // Close ONLY diff tabs (not regular file tabs)
    const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);

    for (const tab of tabs) {
      // ✅ ONLY close diff tabs (TabInputTextDiff)
      if (tab.input instanceof vscode.TabInputTextDiff) {
        const original = tab.input.original.toString();
        const modified = tab.input.modified.toString();

        // Check if this is OUR diff
        if (
          original === diffEditor.originalUri.toString() ||
          modified === diffEditor.modifiedUri.toString()
        ) {
          await vscode.window.tabGroups.close(tab);
          console.log("✅ [ViewDiff] Closed diff tab");
        }
      }
    }

    // Clean up temp files
    const originalPath = diffEditor.originalUri.fsPath;
    const modifiedPath = diffEditor.modifiedUri.fsPath;

    if (fs.existsSync(originalPath)) {
      fs.unlinkSync(originalPath);
    }
    if (fs.existsSync(modifiedPath)) {
      fs.unlinkSync(modifiedPath);
    }

    activeDiffEditors.delete(filePath);
    console.log("✅ [ViewDiff] Cleanup complete");
  } catch (error) {
    const err = error as Error;
    console.error("❌ [ViewDiff] Failed to close diff:", err);
  }
}
