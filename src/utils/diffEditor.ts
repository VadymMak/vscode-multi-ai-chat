import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export async function showDiffInEditor(
  filePath: string,
  originalContent: string,
  modifiedContent: string
): Promise<void> {
  const originalUri = vscode.Uri.parse(`untitled:${filePath}.original`);
  const modifiedUri = vscode.Uri.parse(`untitled:${filePath}.modified`);

  const originalDoc = await vscode.workspace.openTextDocument(originalUri);
  const modifiedDoc = await vscode.workspace.openTextDocument(modifiedUri);

  const originalEdit = new vscode.WorkspaceEdit();
  originalEdit.insert(originalUri, new vscode.Position(0, 0), originalContent);
  await vscode.workspace.applyEdit(originalEdit);

  const modifiedEdit = new vscode.WorkspaceEdit();
  modifiedEdit.insert(modifiedUri, new vscode.Position(0, 0), modifiedContent);
  await vscode.workspace.applyEdit(modifiedEdit);

  await vscode.window.showTextDocument(originalDoc, vscode.ViewColumn.One);
  await vscode.window.showTextDocument(modifiedDoc, vscode.ViewColumn.Two);

  await vscode.commands.executeCommand(
    "vscode.diff",
    originalDoc.uri,
    modifiedDoc.uri,
    `AI Changes: ${path.basename(filePath)}`
  );
}

export async function closeDiffEditor(filePath: string): Promise<void> {
  const originalUri = vscode.Uri.parse(`untitled:${filePath}.original`);
  const modifiedUri = vscode.Uri.parse(`untitled:${filePath}.modified`);

  const originalDoc = await vscode.workspace.openTextDocument(originalUri);
  const modifiedDoc = await vscode.workspace.openTextDocument(modifiedUri);

  await vscode.window.showTextDocument(originalDoc);
  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");

  await vscode.window.showTextDocument(modifiedDoc);
  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");

  try {
    await vscode.workspace.fs.delete(originalUri);
    await vscode.workspace.fs.delete(modifiedUri);
  } catch (err) {
    console.error("Error deleting temporary diff files:", err);
  }
}
