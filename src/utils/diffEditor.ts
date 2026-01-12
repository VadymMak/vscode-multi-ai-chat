import * as vscode from "vscode";
import * as path from "path";

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
 * Example: "src/components/App.tsx" → "untitled:src/components/App.original.tsx"
 */
function buildDiffUri(filePath: string, suffix: string): vscode.Uri {
  const dir = path.dirname(filePath);
  const baseName = getBaseName(filePath);
  const ext = getExtension(filePath);
  
  // Build: dir/basename.suffix.ext
  const newName = `${baseName}.${suffix}${ext}`;
  const fullPath = dir !== "." ? `${dir}/${newName}` : newName;
  
  return vscode.Uri.parse(`untitled:${fullPath}`);
}

export async function showDiffInEditor(
  filePath: string,
  originalContent: string,
  modifiedContent: string
): Promise<void> {
  // Build URIs with proper extensions
  const originalUri = buildDiffUri(filePath, "original");
  const modifiedUri = buildDiffUri(filePath, "modified");

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

  // ✅ DON'T show documents separately - only show diff view
  // await vscode.window.showTextDocument(originalDoc, vscode.ViewColumn.One);
  // await vscode.window.showTextDocument(modifiedDoc, vscode.ViewColumn.Two);

  await vscode.commands.executeCommand(
    "vscode.diff",
    originalDoc.uri,
    modifiedDoc.uri,
    `AI Changes: ${path.basename(filePath)}`
  );
}

export async function closeDiffEditor(filePath: string): Promise<void> {
  // Use same URI building logic
  const originalUri = buildDiffUri(filePath, "original");
  const modifiedUri = buildDiffUri(filePath, "modified");

  try {
    const originalDoc = await vscode.workspace.openTextDocument(originalUri);
    await vscode.window.showTextDocument(originalDoc);
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  } catch (err) {
    console.log(`[Diff] Original doc already closed or not found`);
  }

  try {
    const modifiedDoc = await vscode.workspace.openTextDocument(modifiedUri);
    await vscode.window.showTextDocument(modifiedDoc);
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  } catch (err) {
    console.log(`[Diff] Modified doc already closed or not found`);
  }
}