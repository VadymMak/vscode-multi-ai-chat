import * as vscode from "vscode";

export interface FileContext {
  filePath?: string;
  fileContent?: string;
  selectedText?: string;
}

export function getFileContext(): FileContext {
  const context: FileContext = {};

  const activeEditor = vscode.window.activeTextEditor;

  if (activeEditor) {
    const document = activeEditor.document;

    // File path
    context.filePath = document.fileName;

    // File content (ограничить до 10000 символов)
    context.fileContent = document.getText().substring(0, 10000);

    // Selected text
    const selection = activeEditor.selection;
    if (!selection.isEmpty) {
      context.selectedText = document.getText(selection);
    }
  }

  return context;
}
