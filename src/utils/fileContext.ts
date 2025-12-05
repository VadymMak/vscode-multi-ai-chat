import * as vscode from "vscode";
import logger from "./logger";

export interface FileContext {
  filePath?: string;
  fileName?: string;
  fileContent?: string;
  selectedText?: string;
  language?: string;
  lineCount?: number;
}

// ✅ Track last active editor (before webview took focus)
let lastActiveEditor: vscode.TextEditor | undefined;

/**
 * Call this when extension activates to start tracking editors
 */
export function initFileContextTracking(
  context: vscode.ExtensionContext
): void {
  // Track when active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        lastActiveEditor = editor;
        logger.info(
          `📄 [FileContext] Tracking editor: ${editor.document.fileName}`
        );
      }
    })
  );

  // Initialize with current editor if exists
  if (vscode.window.activeTextEditor) {
    lastActiveEditor = vscode.window.activeTextEditor;
    logger.info(
      `📄 [FileContext] Initial editor: ${lastActiveEditor.document.fileName}`
    );
  }
}

/**
 * Get context from active or last active editor
 */
export function getFileContext(): FileContext {
  const context: FileContext = {};

  // Try current active editor first, then fall back to last tracked
  const editor = vscode.window.activeTextEditor || lastActiveEditor;

  if (!editor) {
    logger.info("📭 [FileContext] No active editor found");
    return context;
  }

  try {
    const document = editor.document;

    // File path (full)
    context.filePath = document.fileName;

    // File name (just the name)
    context.fileName = document.fileName.split(/[/\\]/).pop();

    // Language ID (typescript, python, etc)
    context.language = document.languageId;

    // Line count
    context.lineCount = document.lineCount;

    // Selected text (priority over full content)
    const selection = editor.selection;
    if (!selection.isEmpty) {
      context.selectedText = document.getText(selection);
      logger.info(
        `📝 [FileContext] Selected text: ${context.selectedText.length} chars`
      );
    }

    // File content (limit to 10000 chars to avoid huge payloads)
    const fullContent = document.getText();
    context.fileContent = fullContent.substring(0, 10000);

    if (fullContent.length > 10000) {
      logger.info(
        `📄 [FileContext] File truncated: ${fullContent.length} → 10000 chars`
      );
    }

    logger.info(
      `✅ [FileContext] Got context: ${context.fileName} (${context.language})`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [FileContext] Error: ${errorMessage}`);
  }

  return context;
}

/**
 * Get only selected text (for quick actions)
 */
export function getSelectedText(): string | undefined {
  const editor = vscode.window.activeTextEditor || lastActiveEditor;

  if (!editor || editor.selection.isEmpty) {
    return undefined;
  }

  return editor.document.getText(editor.selection);
}
