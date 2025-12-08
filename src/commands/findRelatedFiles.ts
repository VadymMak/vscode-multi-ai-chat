import * as vscode from "vscode";
import { get } from "../api/apiClient";
import logger from "../utils/logger";

interface SearchResult {
  id: number;
  file_path: string;
  file_name: string;
  language: string;
  line_count: number;
  similarity: number;
  metadata: {
    imports?: string[];
    exports?: string[];
    classes?: string[];
    functions?: string[];
  };
}

interface SearchResponse {
  project_id: number;
  query: string;
  results: SearchResult[];
  total_results: number;
}

export async function findRelatedFiles(
  projectId: number | null
): Promise<void> {
  // 1. Check if we have a project selected
  if (!projectId) {
    vscode.window.showWarningMessage(
      "Please select a project first to find related files."
    );
    return;
  }

  // 2. Get active editor
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No file is currently open.");
    return;
  }

  const currentFilePath = editor.document.uri.fsPath;
  const currentFileName = currentFilePath.split(/[/\\]/).pop() || "";

  // 3. Build search query from file name and content
  const fileContent = editor.document.getText();
  const contentPreview = fileContent.substring(0, 500); // First 500 chars for context

  // Use file name + first part of content as search query
  const searchQuery = `${currentFileName} ${contentPreview}`.substring(0, 300);

  try {
    // 4. Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Finding related files...",
        cancellable: false,
      },
      async () => {
        // 5. Call API - GET endpoint with query params
        // Use just filename for cleaner search (avoid special chars issues)
        const response = ((await get(
          `/file-indexer/search/${projectId}`,
          { q: currentFileName, limit: 10 } as Record<string, unknown> // ✅ FIXED: 'q' not 'query'
        )) as unknown) as SearchResponse;

        logger.info(`Found ${response.total_results} related files`);

        if (!response.results || response.results.length === 0) {
          vscode.window.showInformationMessage(
            "No related files found. Try indexing your project first."
          );
          return;
        }

        // 6. Filter out current file from results
        const filteredResults = response.results.filter(
          (r) => !currentFilePath.includes(r.file_path)
        );

        if (filteredResults.length === 0) {
          vscode.window.showInformationMessage("No other related files found.");
          return;
        }

        // 7. Show QuickPick
        const items: (vscode.QuickPickItem & {
          file_path: string;
        })[] = filteredResults.map((result) => {
          const similarity = (result.similarity * 100).toFixed(1);
          const functions =
            result.metadata?.functions?.slice(0, 3).join(", ") || "";
          const classes =
            result.metadata?.classes?.slice(0, 2).join(", ") || "";

          let description = `${similarity}% match`;
          if (result.language) {
            description += ` • ${result.language}`;
          }
          if (result.line_count) {
            description += ` • ${result.line_count} lines`;
          }

          let detail = "";
          if (classes) {
            detail += `Classes: ${classes}`;
          }
          if (functions) {
            detail += detail
              ? ` | Functions: ${functions}`
              : `Functions: ${functions}`;
          }

          return {
            label: `$(file-code) ${result.file_name}`,
            description: description,
            detail: detail || result.file_path,
            file_path: result.file_path,
          };
        });

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: `Related files for ${currentFileName}`,
          matchOnDescription: true,
          matchOnDetail: true,
        });

        if (selected) {
          // 8. Open selected file
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (workspaceFolders) {
            for (const folder of workspaceFolders) {
              const fullPath = vscode.Uri.joinPath(
                folder.uri,
                selected.file_path
              );
              try {
                await vscode.workspace.fs.stat(fullPath);
                const doc = await vscode.workspace.openTextDocument(fullPath);
                await vscode.window.showTextDocument(doc);
                return;
              } catch {
                // File not found in this folder, try next
              }
            }
          }

          // If not found by exact path, try to find by file name
          const files = await vscode.workspace.findFiles(
            `**/${selected.file_path}`,
            "**/node_modules/**"
          );

          if (files.length > 0) {
            const doc = await vscode.workspace.openTextDocument(files[0]);
            await vscode.window.showTextDocument(doc);
          } else {
            vscode.window.showWarningMessage(
              `Could not find file: ${selected.file_path}`
            );
          }
        }
      }
    );
  } catch (error) {
    logger.error("Find related files error", error as Error);
    vscode.window.showErrorMessage(
      `Failed to find related files: ${(error as Error).message}`
    );
  }
}

export function registerFindRelatedFilesCommand(
  context: vscode.ExtensionContext,
  getProjectId: () => number | null
): vscode.Disposable {
  return vscode.commands.registerCommand("multi-ai-chat.findRelatedFiles", () =>
    findRelatedFiles(getProjectId())
  );
}
