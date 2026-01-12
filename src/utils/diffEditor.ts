import * as vscode from "vscode";
import * as path from "path";

// Store current diff session for cleanup
let currentDiffSessionId: string | null = null;
let currentOriginalUri: vscode.Uri | null = null;
let currentModifiedUri: vscode.Uri | null = null;

/**
 * Get file extension from path
 */
function getExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext || ".txt";
}

/**
 * Get filename without extension
 */
function getBaseName(filePath: string): string {
  const ext = path.extname(filePath);
  const base = path.basename(filePath);
  return ext ? base.slice(0, -ext.length) : base;
}

export async function showDiffInEditor(
  filePath: string,
  originalContent: string,
  modifiedContent: string
): Promise<void> {
  // Generate unique session ID
  currentDiffSessionId = Date.now().toString();
  
  const baseName = getBaseName(filePath);
  const ext = getExtension(filePath);
  
  // Build unique URIs
  const originalName = `${baseName}.original.${currentDiffSessionId}${ext}`;
  const modifiedName = `${baseName}.modified.${currentDiffSessionId}${ext}`;
  
  currentOriginalUri = vscode.Uri.parse(`untitled:${originalName}`);
  currentModifiedUri = vscode.Uri.parse(`untitled:${modifiedName}`);

  console.log(`📄 [Diff] Session: ${currentDiffSessionId}`);
  console.log(`📄 [Diff] Original: ${originalName}`);
  console.log(`📄 [Diff] Modified: ${modifiedName}`);

  // Create and fill documents
  const originalDoc = await vscode.workspace.openTextDocument(currentOriginalUri);
  const modifiedDoc = await vscode.workspace.openTextDocument(currentModifiedUri);

  const originalEdit = new vscode.WorkspaceEdit();
  originalEdit.insert(currentOriginalUri, new vscode.Position(0, 0), originalContent);
  await vscode.workspace.applyEdit(originalEdit);

  const modifiedEdit = new vscode.WorkspaceEdit();
  modifiedEdit.insert(currentModifiedUri, new vscode.Position(0, 0), modifiedContent);
  await vscode.workspace.applyEdit(modifiedEdit);

  // Show ONLY the diff view
  await vscode.commands.executeCommand(
    "vscode.diff",
    originalDoc.uri,
    modifiedDoc.uri,
    `AI Changes: ${path.basename(filePath)}`
  );
}

export async function closeDiffEditor(_filePath: string): Promise<void> {
  if (!currentDiffSessionId) {
    console.log(`[Diff] No active session to close`);
    return;
  }

  const sessionId = currentDiffSessionId;
  const origUri = currentOriginalUri;
  const modUri = currentModifiedUri;
  
  // Clear session state immediately
  currentDiffSessionId = null;
  currentOriginalUri = null;
  currentModifiedUri = null;

  console.log(`📄 [Diff] Closing session: ${sessionId}`);

  // Close tabs by iterating through all tab groups
  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      let shouldClose = false;
      
      // Check if it's a diff tab
      if (tab.input instanceof vscode.TabInputTextDiff) {
        const diffInput = tab.input as vscode.TabInputTextDiff;
        if (
          (origUri && diffInput.original.toString() === origUri.toString()) ||
          (modUri && diffInput.modified.toString() === modUri.toString())
        ) {
          shouldClose = true;
        }
      }
      // Check if it's a text tab (original or modified)
      else if (tab.input instanceof vscode.TabInputText) {
        const textInput = tab.input as vscode.TabInputText;
        const uriStr = textInput.uri.toString();
        if (
          (origUri && uriStr === origUri.toString()) ||
          (modUri && uriStr === modUri.toString())
        ) {
          shouldClose = true;
        }
      }
      // Fallback: check label
      else if (tab.label) {
        if (
          tab.label.includes(`.original.${sessionId}`) ||
          tab.label.includes(`.modified.${sessionId}`) ||
          tab.label.startsWith("AI Changes:")
        ) {
          shouldClose = true;
        }
      }
      
      if (shouldClose) {
        console.log(`📄 [Diff] Closing tab: ${tab.label}`);
        try {
          await vscode.window.tabGroups.close(tab);
        } catch (err) {
          // Ignore errors - tab might already be closed
          console.log(`[Diff] Tab close warning: ${err}`);
        }
      }
    }
  }
}