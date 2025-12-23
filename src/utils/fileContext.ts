import * as vscode from "vscode";
import logger from "./logger";

// ✅ File transfer modes
export type FileTransferMode = "chat" | "edit" | "create";

// ✅ Options for file context retrieval
export interface FileContextOptions {
  mode?: FileTransferMode;
  maxLength?: number;
}

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
export function getFileContext(options?: FileContextOptions): FileContext {
  const context: FileContext = {};
  const mode = options?.mode || "chat";

  // Try current active editor first, then fall back to last tracked
  const editor = vscode.window.activeTextEditor || lastActiveEditor;

  if (!editor) {
    logger.info("📭 [FileContext] No active editor found");
    return context;
  }

  try {
    const document = editor.document;
    const fullContent = document.getText();
    const originalLength = fullContent.length;

    // File metadata
    context.filePath = document.fileName;
    context.fileName = document.fileName.split(/[/\\]/).pop();
    context.language = document.languageId;
    context.lineCount = document.lineCount;

    // Selected text (highest priority - always full)
    const selection = editor.selection;
    if (!selection.isEmpty) {
      context.selectedText = document.getText(selection);
      logger.info(
        `📝 [FileContext] Selected text: ${context.selectedText.length} chars`
      );
    }

    // ✅ SMART LIMITS based on mode
    let maxContentLength: number;

    if (options?.maxLength) {
      // Custom limit provided
      maxContentLength = options.maxLength;
    } else if (mode === "edit" || mode === "create") {
      // EDIT/CREATE: Send full file up to 500KB
      maxContentLength = 500_000;
    } else {
      // CHAT: Smart limits based on file size
      if (originalLength <= 50_000) {
        maxContentLength = originalLength; // Small files: send full
      } else {
        maxContentLength = 50_000; // Large files: truncate
      }
    }

    // Apply content limit
    if (originalLength <= maxContentLength) {
      context.fileContent = fullContent;
      logger.info(
        `✅ [FileContext] Full file: ${context.fileName} (${originalLength} chars, mode: ${mode})`
      );
    } else {
      context.fileContent = fullContent.substring(0, maxContentLength);
      logger.info(
        `📄 [FileContext] File truncated: ${originalLength} → ${maxContentLength} chars (mode: ${mode})`
      );
    }
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
