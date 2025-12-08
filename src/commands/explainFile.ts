import * as vscode from "vscode";
import { get, post } from "../api/apiClient";
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

export async function explainFile(projectId: number | null): Promise<void> {
  // 1. Check if we have a project selected
  if (!projectId) {
    vscode.window.showWarningMessage(
      "Please select a project first to explain file."
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
  const lineCount = document.lineCount;

  // 3. Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Analyzing file...",
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: "Finding related files..." });

        // 4. Find related files for context
        let relatedFilesContext = "";
        try {
          const searchResponse = ((await get(
            `/file-indexer/search/${projectId}?q=${encodeURIComponent(
              fileName
            )}&limit=3`
          )) as unknown) as SearchResponse;

          if (searchResponse.results && searchResponse.results.length > 0) {
            const relatedFiles = searchResponse.results
              .filter((r) => !filePath.includes(r.file_path))
              .slice(0, 3);

            if (relatedFiles.length > 0) {
              relatedFilesContext = `\n\nRelated files in codebase: ${relatedFiles
                .map((f) => f.file_path)
                .join(", ")}`;
            }
          }
        } catch (e) {
          logger.warn(`Could not fetch related files: ${e}`);
        }

        progress.report({ message: "Generating explanation..." });

        // 5. Build the prompt
        const prompt = `Please analyze and explain this file in detail.

**File:** ${fileName}
**Language:** ${language}
**Lines:** ${lineCount}
${relatedFilesContext}

Provide:
1. **Purpose**: What is the main purpose of this file?
2. **Key Components**: List main classes, functions, or exports
3. **Dependencies**: What does this file import/depend on?
4. **How it works**: Brief explanation of the logic flow
5. **Integration**: How does it fit in the overall project?
6. **Potential improvements**: Any suggestions (optional)

Be concise but comprehensive.`;

        // 6. Call AI via /vscode/chat - use type assertion
        const response = ((await post("/vscode/chat", {
          message: prompt,
          project_id: projectId,
          filePath: filePath,
          fileContent: fileContent.substring(0, 10000),
        } as any)) as unknown) as { message: string };

        // 7. Show result in new document
        const explanation = response.message || "No explanation generated.";

        // Create output document
        const outputDoc = await vscode.workspace.openTextDocument({
          content: `# 📄 File Explanation: ${fileName}\n\n${explanation}`,
          language: "markdown",
        });

        await vscode.window.showTextDocument(outputDoc, {
          viewColumn: vscode.ViewColumn.Beside,
          preserveFocus: false,
          preview: true,
        });

        logger.info(`File explanation generated for: ${fileName}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("Explain file error", error as Error);
        vscode.window.showErrorMessage(`Failed to explain file: ${errorMsg}`);
      }
    }
  );
}
