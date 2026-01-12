import * as vscode from "vscode";
import * as path from "path";

// ✅ Store current diff session ID for cleanup
let currentDiffSessionId: string | null = null;

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

/**
 * Build URI that preserves file extension for proper syntax highlighting
 * Example: "src/components/App.tsx" → "untitled:App.original.12345.tsx"
 */
function buildDiffUri(filePath: string, suffix: string, sessionId: string): vscode.Uri {
  const baseName = getBaseName(filePath);
  const ext = getExtension(filePath);
  
  // Build: basename.suffix.sessionId.ext (unique per session)
  const newName = `${baseName}.${suffix}.${sessionId}${ext}`;
  
  return vscode.Uri.parse(`untitled:${newName}`);
}

export async function showDiffInEditor(
  filePath: string,
  originalContent: string,
  modifiedContent: string
): Promise<void> {
  // ✅ Generate unique session ID
  currentDiffSessionId = Date.now().toString();
  
  // Build URIs with proper extensions and unique session ID
  const originalUri = buildDiffUri(filePath, "original", currentDiffSessionId);
  const modifiedUri = buildDiffUri(filePath, "modified", currentDiffSessionId);

  console.log(`📄 [Diff] Session: ${currentDiffSessionId}`);
  console.log(`📄 [Diff] Original URI: ${originalUri.toString()}`);
  console.log(`📄 [Diff] Modified URI: ${modifiedUri.toString()}`);

  const originalDoc = await vscode.workspace.openTextDocument(originalUri);
  const modifiedDoc = await vscode.workspace.openTextDocument(modifiedUri);

  const originalEdit = new vscode.WorkspaceEdit();
  originalEdit.insert(originalUri, new vscode.Position(0, 0), originalContent);
  await vscode.workspace.applyEdit(originalEdit);

  const modifiedEdit = new vscode.WorkspaceEdit();
  modifiedEdit.insert(modifiedUri, new vscode.Position(0, 0), modifiedContent);
  await vscode.workspace.applyEdit(modifiedEdit);

  // ✅ Only show diff view, not individual documents
  await vscode.commands.executeCommand(
    "vscode.diff",
    originalDoc.uri,
    modifiedDoc.uri,
    `AI Changes: ${path.basename(filePath)}`
  );
}

export async function closeDiffEditor(filePath: string): Promise<void> {
  if (!currentDiffSessionId) {
    console.log(`[Diff] No active session to close`);
    return;
  }

  const sessionId = currentDiffSessionId;
  currentDiffSessionId = null; // Clear session

  console.log(`📄 [Diff] Closing session: ${sessionId}`);

  // ✅ Close ALL diff-related tabs without saving
  const allTabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
  
  for (const tab of allTabs) {
    const label = tab.label || "";
    
    // Check if this tab is part of our diff session
    if (label.includes(`.original.${sessionId}`) || 
        label.includes(`.modified.${sessionId}`) ||
        label.includes("AI Changes:")) {
      
      console.log(`📄 [Diff] Closing tab: ${label}`);
      
      try {
        // ✅ Close without saving (important for untitled files!)
        await vscode.window.tabGroups.close(tab, false);
      } catch (err) {
        console.log(`[Diff] Could not close tab ${label}: ${err}`);
      }
    }
  }
}