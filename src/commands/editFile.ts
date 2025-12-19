import * as vscode from "vscode";
import apiClient from "../api/apiClient";
import { SidebarProvider } from "../panels/sidebarProvider";
import { showDiffInEditor, closeDiffEditor } from "../utils/diffEditor";

interface EditFileResponse {
  success: boolean;
  original_content: string;
  new_content: string;
  diff: string;
  tokens_used: {
    context: number;
    total: number;
  };
}

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

    console.log(`🟡 [editFile] File: ${filePath}, Project: ${projectId}`);

    // 3. Get instruction from user
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

    // 4. Show progress while calling API
    const response = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "AI is editing your file...",
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Building context..." });

        const axiosResponse = await apiClient.post<EditFileResponse>(
          "/vscode/edit-file",
          {
            project_id: projectId,
            file_path: filePath,
            instruction: instruction,
            current_content: document.getText(),
          },
          {
            timeout: 90000, // 90 seconds for AI operations
          }
        );

        return axiosResponse.data;
      }
    );

    if (!response.success) {
      vscode.window.showErrorMessage(
        "Failed to generate changes. Please try again."
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
          cost: (response.tokens_used.total / 1000000) * 10, // Rough estimate: $10 per 1M tokens
        },
        smartContext: response.tokens_used.context,
        instruction: instruction,
        fileName: filePath.split("/").pop() || filePath,
        filePath: filePath,
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

      // Find the original file editor (should still be open in background)
      const originalFilePath = editor.document.uri.fsPath;
      let targetEditor = vscode.window.visibleTextEditors.find(
        (ed) => ed.document.uri.fsPath === originalFilePath
      );

      // If not visible, open it
      if (!targetEditor) {
        const doc = await vscode.workspace.openTextDocument(
          vscode.Uri.file(originalFilePath)
        );
        targetEditor = await vscode.window.showTextDocument(
          doc,
          vscode.ViewColumn.One
        );
      } else {
        // Make it active
        await vscode.window.showTextDocument(
          targetEditor.document,
          vscode.ViewColumn.One
        );
      }

      // Apply changes
      await applyChanges(targetEditor, response.new_content);

      vscode.window.showInformationMessage(
        `✅ Changes applied! Used ${response.tokens_used.total.toLocaleString()} tokens.`
      );
    } else if (approvalResponse.action === "edit") {
      console.log("🔄 [editFile] User wants to edit instruction");

      await closeDiffEditor(filePath); // Close diff editor

      // Show original file
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

      await closeDiffEditor(filePath); // Close diff editor

      // Show original file
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
