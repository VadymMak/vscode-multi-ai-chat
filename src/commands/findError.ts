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

export async function findError(projectId: number | null): Promise<void> {
  // 1. Check project
  if (!projectId) {
    vscode.window.showWarningMessage(
      "Please select a project first to analyze error."
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
  const language = document.languageId;

  // 3. Get error text - from selection or ask user
  let errorText = "";
  const selection = editor.selection;

  if (!selection.isEmpty) {
    // Use selected text
    errorText = document.getText(selection);
  } else {
    // Ask user to paste error
    const input = await vscode.window.showInputBox({
      prompt: "Paste the error message",
      placeHolder: "e.g., TypeError: Cannot read property 'x' of undefined",
      ignoreFocusOut: true,
    });

    if (!input) {
      return; // User cancelled
    }
    errorText = input;
  }

  // 4. Get context around cursor
  const cursorLine = selection.active.line;
  const startLine = Math.max(0, cursorLine - 10);
  const endLine = Math.min(document.lineCount - 1, cursorLine + 10);
  const contextRange = new vscode.Range(startLine, 0, endLine, 1000);
  const codeContext = document.getText(contextRange);

  // 5. Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Analyzing error...",
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: "Finding related files..." });

        // 6. Search for related files using error text
        let relatedFiles: SearchResult[] = [];
        try {
          const searchResponse = ((await get(
            `/file-indexer/search/${projectId}?q=${encodeURIComponent(
              errorText.substring(0, 200)
            )}&limit=5`
          )) as unknown) as SearchResponse;

          if (searchResponse.results) {
            relatedFiles = searchResponse.results
              .filter((r) => !filePath.includes(r.file_path))
              .slice(0, 3);
          }
        } catch (e) {
          logger.warn(`Could not search for related files: ${e}`);
        }

        progress.report({ message: "AI analyzing error..." });

        // 7. Build prompt for AI
        const relatedFilesInfo =
          relatedFiles.length > 0
            ? `\n\nRelated files that might be involved:\n${relatedFiles
                .map((f) => `- ${f.file_path}`)
                .join("\n")}`
            : "";

        const prompt = `Analyze this error and help me fix it.

**Error:**
\`\`\`
${errorText}
\`\`\`

**File:** ${fileName}
**Language:** ${language}

**Code context around error:**
\`\`\`${language}
${codeContext}
\`\`\`
${relatedFilesInfo}

Please provide:
1. **Root Cause**: What is causing this error?
2. **Location**: Where exactly is the problem?
3. **Fix**: Show the corrected code
4. **Explanation**: Why does this fix work?
5. **Prevention**: How to avoid this in the future?

Be specific and show actual code fixes.`;

        // 8. Call AI
        const response = ((await post("/vscode/chat", {
          message: prompt,
          project_id: projectId,
          filePath: filePath,
          fileContent: document.getText().substring(0, 10000),
        } as any)) as unknown) as { message: string };

        // 9. Show result
        const analysis = response.message || "No analysis generated.";

        const outputDoc = await vscode.workspace.openTextDocument({
          content: `# 🔍 Error Analysis: ${fileName}\n\n**Error:** \`${errorText.substring(
            0,
            100
          )}${errorText.length > 100 ? "..." : ""}\`\n\n${analysis}`,
          language: "markdown",
        });

        await vscode.window.showTextDocument(outputDoc, {
          viewColumn: vscode.ViewColumn.Beside,
          preserveFocus: false,
          preview: true,
        });

        logger.info(`Error analyzed for: ${fileName}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("Find error analysis failed", error as Error);
        vscode.window.showErrorMessage(`Failed to analyze error: ${errorMsg}`);
      }
    }
  );
}
