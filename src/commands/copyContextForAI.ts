import * as vscode from "vscode";
import {
  copyContextForAI as copyContextAPI,
  CopyContextResponse,
} from "../api/apiClient";
import logger from "../utils/logger";

/**
 * Parse imports from TypeScript/JavaScript file
 */
function parseTypeScriptImports(content: string): string[] {
  const imports: string[] = [];

  // Match: import ... from "..." or import ... from '...'
  const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Match: require("...") or require('...')
  const requireRegex = /require\s*\(\s*['"](.*?)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Parse imports from Python file
 */
function parsePythonImports(content: string): string[] {
  const imports: string[] = [];

  // Match: import module
  const importRegex = /^import\s+([\w.]+)/gm;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Match: from module import ...
  const fromRegex = /^from\s+([\w.]+)\s+import/gm;
  while ((match = fromRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Main command: Copy Context for AI Chat
 *
 * 1. Gets current file + parses imports
 * 2. Calls backend to resolve dependencies
 * 3. Formats as markdown
 * 4. Copies to clipboard
 */
export async function copyContextForAI(
  projectId: number | null
): Promise<void> {
  // 1. Check project
  if (!projectId) {
    vscode.window.showWarningMessage(
      "Please select a project first to copy context."
    );
    return;
  }

  // 2. Get active editor
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No file is currently open.");
    return;
  }

  const document = editor.document;
  const filePath = document.uri.fsPath;
  const fileContent = document.getText();
  const language = document.languageId;

  // 3. Parse imports based on language
  let imports: string[] = [];

  if (
    ["typescript", "typescriptreact", "javascript", "javascriptreact"].includes(
      language
    )
  ) {
    imports = parseTypeScriptImports(fileContent);
  } else if (language === "python") {
    imports = parsePythonImports(fileContent);
  }

  logger.info(`[CopyContext] File: ${filePath}, Imports: ${imports.length}`);

  // 4. Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Building context for AI...",
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: "Resolving dependencies..." });

        // 5. Call backend API
        const response = await copyContextAPI(
          projectId,
          filePath,
          fileContent,
          imports,
          5, // maxFiles
          4000 // maxTokens
        );

        if (!response.success) {
          throw new Error("Backend returned unsuccessful response");
        }

        progress.report({ message: "Copying to clipboard..." });

        // 6. Copy to clipboard
        await vscode.env.clipboard.writeText(response.context_markdown);

        // 7. Show success notification
        const filesInfo = response.dependencies
          .map((d) => `${d.file_path.split("/").pop()}`)
          .join(", ");

        vscode.window
          .showInformationMessage(
            `✅ Context copied! ${response.files_included} files, ~${response.estimated_tokens} tokens`,
            "Show Details"
          )
          .then((selection) => {
            if (selection === "Show Details") {
              // Show details in output channel
              const outputChannel = vscode.window.createOutputChannel(
                "Smart Cline Context"
              );
              outputChannel.clear();
              outputChannel.appendLine("=== COPIED CONTEXT SUMMARY ===\n");
              outputChannel.appendLine(
                `Files included: ${response.files_included}`
              );
              outputChannel.appendLine(
                `Estimated tokens: ~${response.estimated_tokens}`
              );
              outputChannel.appendLine(`\nDependencies:`);
              response.dependencies.forEach((d, i) => {
                const source = d.source === "import" ? "📦" : "🔗";
                const similarity = d.similarity
                  ? ` (${(d.similarity * 100).toFixed(0)}%)`
                  : "";
                outputChannel.appendLine(
                  `  ${i + 1}. ${source} ${d.file_path}${similarity}`
                );
              });
              outputChannel.appendLine(
                "\n=== PASTE THIS INTO CLAUDE/CHATGPT ==="
              );
              outputChannel.show();
            }
          });

        logger.info(
          `[CopyContext] Success: ${response.files_included} files, ~${response.estimated_tokens} tokens`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("[CopyContext] Error:", error as Error);
        vscode.window.showErrorMessage(`Failed to copy context: ${errorMsg}`);
      }
    }
  );
}

/**
 * Quick copy - just current file, no dependencies
 */
export async function copyCurrentFileForAI(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No file is currently open.");
    return;
  }

  const document = editor.document;
  const filePath = document.uri.fsPath;
  const fileName = filePath.split(/[/\\]/).pop() || "file";
  const fileContent = document.getText();
  const language = document.languageId;

  // Map VS Code language to markdown language
  const langMap: Record<string, string> = {
    typescript: "typescript",
    typescriptreact: "typescript",
    javascript: "javascript",
    javascriptreact: "javascript",
    python: "python",
    css: "css",
    html: "html",
    json: "json",
  };
  const mdLang = langMap[language] || language;

  const markdown = `# 📄 ${fileName}

\`\`\`${mdLang}
${fileContent}
\`\`\`

---
*File: ${filePath}*
*Characters: ${fileContent.length.toLocaleString()}*
*Estimated tokens: ~${Math.round(fileContent.length / 4).toLocaleString()}*
`;

  await vscode.env.clipboard.writeText(markdown);

  const tokens = Math.round(fileContent.length / 4);
  vscode.window.showInformationMessage(
    `✅ File copied! ~${tokens.toLocaleString()} tokens`
  );

  logger.info(`[CopyContext] Quick copy: ${fileName}, ~${tokens} tokens`);
}
