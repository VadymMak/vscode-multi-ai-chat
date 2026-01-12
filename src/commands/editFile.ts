import * as vscode from "vscode";
import apiClient from "../api/apiClient";
import { SidebarProvider } from "../panels/sidebarProvider";
import { showDiffInEditor, closeDiffEditor } from "../utils/diffEditor";

// ============================================================
// FILE SIZE LIMITS
// ============================================================
const MAX_FILE_SIZE_WARNING = 20000;    // 20K chars - show info
const MAX_FILE_SIZE_LARGE = 50000;      // 50K chars - show warning
const MAX_FILE_SIZE_ABSOLUTE = 100000;  // 100K chars - reject

interface EditFileResponse {
  success: boolean;
  original_content: string;
  new_content: string;
  diff: string;
  tokens_used: {
    context: number;
    total: number;
  };
  // NEW: Retry-related fields
  error?: string;
  error_type?: string;
  failed_search_block?: string;
  attempt?: number;
}

interface LastError {
  attempt: number;
  error: string;
  error_type: string;
  failed_search_block?: string;
  hint: string;
}

const MAX_RETRIES = 3;

export async function editFile(projectId: number | null): Promise<void> {
  console.log("🔴 [DEBUG] EDIT FILE COMMAND TRIGGERED!");

  try {
    // 1. Validate project ID
    if (!projectId) {
      vscode.window.showErrorMessage(
        "No project selected. Please select a project first using the panel (Ctrl+Shift+M)."
      );
      return;
    }

    // 2. Get active editor
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No file is currently open.");
      return;
    }

    const document = editor.document;
    const filePath = vscode.workspace.asRelativePath(document.uri);
    const currentContent = document.getText();

    console.log(`🟡 [editFile] File: ${filePath}, Project: ${projectId}`);
    console.log(`🟡 [editFile] File size: ${currentContent.length} chars`);

    // 3. Check file size limits
    if (currentContent.length > MAX_FILE_SIZE_ABSOLUTE) {
      vscode.window.showErrorMessage(
        `❌ File is too large (${Math.round(currentContent.length / 1000)}K chars). ` +
        `Maximum supported size is ${MAX_FILE_SIZE_ABSOLUTE / 1000}K chars. ` +
        `Please select a specific section to edit or split the file.`
      );
      return;
    }

    if (currentContent.length > MAX_FILE_SIZE_LARGE) {
      const choice = await vscode.window.showWarningMessage(
        `⚠️ File is large (${Math.round(currentContent.length / 1000)}K chars). ` +
        `AI will focus on relevant sections. This may take longer and be less accurate.`,
        "Continue Anyway",
        "Cancel"
      );
      if (choice !== "Continue Anyway") {
        return;
      }
    } else if (currentContent.length > MAX_FILE_SIZE_WARNING) {
      vscode.window.showInformationMessage(
        `📄 File is ${Math.round(currentContent.length / 1000)}K chars. Processing...`
      );
    }

    // 4. Get instruction from user
    const instruction = await vscode.window.showInputBox({
      prompt: "What changes do you want to make to this file?",
      placeHolder: 'e.g., "Add error handling", "Refactor to use async/await"',
      validateInput: (value) => {
        return value.length < 10
          ? "Please provide more detailed instructions (at least 10 characters)"
          : null;
      },
    });

    if (!instruction) {
      return; // User cancelled
    }

    console.log(`🟡 [editFile] Instruction: ${instruction}`);

    // 4. Call API with retry logic
    const response = await editFileWithRetry(
      projectId,
      filePath,
      instruction,
      currentContent
    );

    if (!response || !response.success) {
      vscode.window.showErrorMessage(
        "Failed to generate changes after multiple attempts. Please try with a different instruction."
      );
      return;
    }

    console.log(
      "🟢 [editFile] API response received, tokens:",
      response.tokens_used.total
    );

    // 5. Show diff preview in editor
    console.log("🟡 [editFile] Showing diff preview...");
    await showDiffInEditor(
      filePath,
      response.original_content,
      response.new_content
    );

    // 6. Request approval through MainPanel
    const approvalRequest = {
      id: `edit-${Date.now()}`,
      type: "editFile" as const,
      title: "Review AI Changes",
      message:
        "AI has prepared changes to your file. Review the diff in the editor above.",
      metadata: {
        tokensUsed: {
          context: response.tokens_used.context,
          total: response.tokens_used.total,
          cost: (response.tokens_used.total / 1000000) * 10,
        },
        smartContext: response.tokens_used.context,
        instruction: instruction,
        fileName: filePath.split("/").pop() || filePath,
        filePath: filePath,
        fileSize: currentContent.length, // ✅ NEW: Show file size
        attempt: response.attempt || 1, // Show which attempt succeeded
      },
      actions: [
        {
          id: "apply",
          label: "Apply Changes",
          variant: "primary" as const,
          icon: "✅",
        },
        {
          id: "reject",
          label: "Reject",
          variant: "secondary" as const,
          icon: "❌",
        },
        {
          id: "edit",
          label: "Edit Instruction",
          variant: "secondary" as const,
          icon: "✏️",
        },
      ],
    };

    console.log("🟡 [editFile] Requesting approval...");

    const approvalResponse = await SidebarProvider.requestApproval(
      approvalRequest
    );

    console.log("🟢 [editFile] Approval response:", approvalResponse.action);

    // 7. Handle user's decision
    if (approvalResponse.action === "apply") {
      console.log("🟢 [editFile] Applying changes...");

      // ✅ Close diff editor FIRST before applying
      console.log("🟢 [editFile] Closing diff editor...");
      await closeDiffEditor(filePath);

      const originalFilePath = editor.document.uri.fsPath;
      let targetEditor = vscode.window.visibleTextEditors.find(
        (ed) => ed.document.uri.fsPath === originalFilePath
      );

      if (!targetEditor) {
        const doc = await vscode.workspace.openTextDocument(
          vscode.Uri.file(originalFilePath)
        );
        targetEditor = await vscode.window.showTextDocument(
          doc,
          vscode.ViewColumn.One
        );
      } else {
        await vscode.window.showTextDocument(
          targetEditor.document,
          vscode.ViewColumn.One
        );
      }

      await applyChanges(targetEditor, response.new_content);

      vscode.window.showInformationMessage(
        `✅ Changes applied! Used ${response.tokens_used.total.toLocaleString()} tokens.`
      );
    } else if (approvalResponse.action === "edit") {
      console.log("🔄 [editFile] User wants to edit instruction");

      await closeDiffEditor(filePath);

      const originalFilePath = editor.document.uri.fsPath;
      const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.file(originalFilePath)
      );
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

      vscode.window.showInformationMessage(
        "Please run the command again with your new instruction."
      );
    } else {
      console.log("🟡 [editFile] Changes rejected");

      await closeDiffEditor(filePath);

      const originalFilePath = editor.document.uri.fsPath;
      const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.file(originalFilePath)
      );
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

      vscode.window.showInformationMessage("❌ Changes rejected.");
    }
  } catch (error) {
    console.error("❌ [editFile] Error:", error);

    if (error instanceof Error) {
      vscode.window.showErrorMessage(`Failed to edit file: ${error.message}`);
    } else if (
      typeof error === "object" &&
      error !== null &&
      "response" in error
    ) {
      const axiosError = error as any;
      const detail = axiosError.response?.data?.detail || "Unknown error";
      vscode.window.showErrorMessage(`Failed to edit file: ${detail}`);
    } else {
      vscode.window.showErrorMessage(
        "Failed to edit file: An unexpected error occurred"
      );
    }
  }
}

/**
 * Call edit API with retry logic.
 * If SEARCH/REPLACE fails, retry with error context.
 */
async function editFileWithRetry(
  projectId: number,
  filePath: string,
  instruction: string,
  currentContent: string
): Promise<EditFileResponse | null> {
  let lastError: LastError | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`🔄 [editFile] Attempt ${attempt}/${MAX_RETRIES}`);

    try {
      const response = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `AI is editing your file${attempt > 1 ? ` (Retry ${attempt}/${MAX_RETRIES})` : ""}...`,
          cancellable: false,
        },
        async (progress) => {
          if (attempt === 1) {
            progress.report({ message: "Building context..." });
          } else {
            progress.report({ message: `Retrying with error feedback...` });
          }

          const axiosResponse = await apiClient.post<EditFileResponse>(
            "/vscode/edit-file",
            {
              project_id: projectId,
              file_path: filePath,
              instruction: instruction,
              current_content: currentContent,
              // NEW: Pass last error for retry context
              last_error: lastError,
              attempt: attempt,
            },
            {
              timeout: 90000,
            }
          );

          return axiosResponse.data;
        }
      );

      // Success!
      if (response.success) {
        if (attempt > 1) {
          console.log(`✅ [editFile] Succeeded on attempt ${attempt}`);
          vscode.window.showInformationMessage(
            `✅ Edit succeeded on retry ${attempt}/${MAX_RETRIES}`
          );
        }
        return { ...response, attempt };
      }

      // Failed - prepare error context for next attempt
      console.log(`⚠️ [editFile] Attempt ${attempt} failed: ${response.error}`);

      lastError = {
        attempt: attempt,
        error: response.error || "SEARCH block not found in file",
        error_type: response.error_type || "search_not_found",
        failed_search_block: response.failed_search_block,
        hint: getRetryHint(attempt, response.error_type),
      };

    } catch (error: any) {
      console.error(`❌ [editFile] Attempt ${attempt} exception:`, error);

      // Check if it's a 400 error
      if (error.response?.status === 400) {
        const errorData = error.response?.data || {};
        const errorType = errorData.error_type || "unknown";
        const detail = errorData.message || errorData.detail || "Unknown error";
        
        // ✅ NEW: Handle file_too_large - don't retry
        if (errorType === "file_too_large") {
          console.log(`❌ [editFile] File too large, not retrying`);
          vscode.window.showErrorMessage(
            `❌ ${detail}`
          );
          return null;
        }
        
        // SEARCH not found - retry with context
        lastError = {
          attempt: attempt,
          error: detail,
          error_type: errorType,
          failed_search_block: errorData.failed_search_block,
          hint: getRetryHint(attempt, errorType),
        };

        console.log(`⚠️ [editFile] Will retry. Error: ${detail}`);
        continue;
      }

      // Other errors - don't retry
      throw error;
    }
  }

  // All retries failed
  console.error(`❌ [editFile] All ${MAX_RETRIES} attempts failed`);
  
  if (lastError) {
    vscode.window.showErrorMessage(
      `Failed after ${MAX_RETRIES} attempts. Last error: ${lastError.error}`
    );
  }

  return null;
}

/**
 * Get hint message for retry based on attempt number
 */
function getRetryHint(attempt: number, errorType?: string): string {
  const hints: Record<number, string> = {
    1: "SEARCH blocks must match file EXACTLY. Check whitespace and indentation.",
    2: "Try using smaller, more unique code sections. Include distinctive lines.",
    3: "Copy the EXACT text from the file, character-for-character. Check for hidden characters.",
  };

  return hints[attempt] || hints[1];
}

async function applyChanges(
  editor: vscode.TextEditor,
  newContent: string
): Promise<void> {
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    editor.document.positionAt(0),
    editor.document.positionAt(editor.document.getText().length)
  );

  edit.replace(editor.document.uri, fullRange, newContent);
  await vscode.workspace.applyEdit(edit);
  await editor.document.save();
}