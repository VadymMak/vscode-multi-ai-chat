import * as vscode from "vscode";
import * as path from "path";

// Store current diff session for cleanup
let currentDiffSessionId: string | null = null;
let currentOriginalUri: vscode.Uri | null = null;
let currentModifiedUri: vscode.Uri | null = null;

function getExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext || ".txt";
}

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
  
  // Clear session state immediately
  currentDiffSessionId = null;
  currentOriginalUri = null;
  currentModifiedUri = null;

  console.log(`📄 [Diff] Closing session: ${sessionId}`);

  // ✅ Close ALL editors and revert without save prompt
  // Use executeCommand which handles dirty files better
  
  // First, close the diff view
  await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  
  // Small delay to let VS Code process
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Close any remaining tabs with our session ID
  const tabsToClose: vscode.Tab[] = [];
  
  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      if (tab.label && (
        tab.label.includes(`.original.${sessionId}`) ||
        tab.label.includes(`.modified.${sessionId}`)
      )) {
        tabsToClose.push(tab);
      }
    }
  }
  
  // Close collected tabs - use closeAll which doesn't prompt for untitled
  for (const tab of tabsToClose) {
    console.log(`📄 [Diff] Closing remaining tab: ${tab.label}`);
    try {
      // Focus the tab first
      if (tab.input instanceof vscode.TabInputText) {
        const doc = await vscode.workspace.openTextDocument(tab.input.uri);
        await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: false });
        // Revert and close - this command doesn't show save dialog for untitled
        await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
      }
    } catch (err) {
      console.log(`[Diff] Tab close warning: ${err}`);
    }
  }
}