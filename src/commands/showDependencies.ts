import * as vscode from "vscode";
import { get } from "../api/apiClient";
import logger from "../utils/logger";

interface SearchResult {
  file_path: string;
  file_name: string;
  language: string;
  similarity: number;
}

interface SearchResponse {
  results: SearchResult[];
}

// Parse imports from TypeScript/JavaScript file
function parseTypeScriptImports(content: string): string[] {
  const imports: string[] = [];

  // Match: import ... from "..."  or import ... from '...'
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

// Parse imports from Python file
function parsePythonImports(content: string): string[] {
  const imports: string[] = [];

  // Match: import module or import module.submodule
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

export async function showDependencies(
  projectId: number | null
): Promise<void> {
  // 1. Check project
  if (!projectId) {
    vscode.window.showWarningMessage(
      "Please select a project first to show dependencies."
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
  const fileName = filePath.split(/[/\\]/).pop() || "";
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

  // 4. Show progress and find who imports this file
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Analyzing dependencies...",
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: "Finding importers..." });

        // Find files that might import this file
        let importedBy: SearchResult[] = [];
        try {
          const searchResponse = ((await get(
            `/file-indexer/search/${projectId}?q=${encodeURIComponent(
              fileName
            )}&limit=10`
          )) as unknown) as SearchResponse;

          if (searchResponse.results) {
            importedBy = searchResponse.results
              .filter((r) => !filePath.includes(r.file_path))
              .slice(0, 5);
          }
        } catch (e) {
          logger.warn(`Could not search for importers: ${e}`);
        }

        // 5. Build markdown output
        let output = `# 🔗 Dependencies: ${fileName}\n\n`;

        // Section: What this file imports
        output += `## 📥 IMPORTS (what this file uses)\n\n`;
        if (imports.length > 0) {
          imports.forEach((imp) => {
            const icon = imp.startsWith(".") ? "📁" : "📦";
            output += `- ${icon} \`${imp}\`\n`;
          });
        } else {
          output += `_No imports found_\n`;
        }

        // Section: Who might import this file
        output += `\n## 📤 POSSIBLY IMPORTED BY (related files)\n\n`;
        if (importedBy.length > 0) {
          importedBy.forEach((file) => {
            const score = (file.similarity * 100).toFixed(1);
            output += `- 📄 \`${file.file_path}\` (${score}% related)\n`;
          });
        } else {
          output += `_No related files found_\n`;
        }

        // Section: Summary
        output += `\n## 📊 Summary\n\n`;
        output += `| Metric | Count |\n`;
        output += `|--------|-------|\n`;
        output += `| Direct imports | ${imports.length} |\n`;
        output += `| Local imports | ${
          imports.filter((i) => i.startsWith(".")).length
        } |\n`;
        output += `| Package imports | ${
          imports.filter((i) => !i.startsWith(".")).length
        } |\n`;
        output += `| Related files | ${importedBy.length} |\n`;

        // 6. Show result
        const outputDoc = await vscode.workspace.openTextDocument({
          content: output,
          language: "markdown",
        });

        await vscode.window.showTextDocument(outputDoc, {
          viewColumn: vscode.ViewColumn.Beside,
          preserveFocus: false,
          preview: true,
        });

        logger.info(`Dependencies shown for: ${fileName}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("Show dependencies error", error as Error);
        vscode.window.showErrorMessage(
          `Failed to show dependencies: ${errorMsg}`
        );
      }
    }
  );
}
