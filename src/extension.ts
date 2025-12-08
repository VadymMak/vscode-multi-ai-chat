import * as vscode from "vscode";
import AuthManager from "./auth/authManager";
import { AppController } from "./controllers/appController";
import { MainPanel } from "./panels/mainPanel";
import logger from "./utils/logger";
import { initFileContextTracking } from "./utils/fileContext";
import { indexWorkspace } from "./services/fileIndexerService";
import { findRelatedFiles } from "./commands/findRelatedFiles";
import { explainFile } from "./commands/explainFile";
import { showDependencies } from "./commands/showDependencies";
import { findError } from "./commands/findError";

// Store selected project ID (will be updated from MainPanel)
let currentProjectId: number | null = null;

export function setCurrentProjectId(projectId: number | null) {
  currentProjectId = projectId;
  logger.info(`Project ID updated: ${projectId}`);
}

export function getCurrentProjectId(): number | null {
  return currentProjectId;
}

export function activate(context: vscode.ExtensionContext) {
  logger.info("Activating the VS Code Multi AI Chat extension.");

  // Initialize file context tracking FIRST
  initFileContextTracking(context);
  logger.info("FileContext tracking initialized");

  const authManager = AuthManager.initialize(context);
  logger.info("AuthManager initialized with context");

  const appController = AppController.getInstance();
  appController.initialize(context);

  // Command: Open Main Panel
  const openPanelCommand = vscode.commands.registerCommand(
    "vscode-multi-ai-chat.openMainPanel",
    () => {
      MainPanel.createOrShow(context.extensionUri, context);
    }
  );

  // Command: Index Current Workspace
  const indexWorkspaceCommand = vscode.commands.registerCommand(
    "vscode-multi-ai-chat.indexWorkspace",
    async () => {
      // Get project ID from user
      const projectIdStr = await vscode.window.showInputBox({
        prompt: "Enter Project ID to index files into",
        placeHolder: "e.g., 42",
        validateInput: (value) => {
          const num = parseInt(value);
          if (isNaN(num) || num <= 0) {
            return "Please enter a valid positive number";
          }
          return null;
        },
      });

      if (!projectIdStr) {
        return; // User cancelled
      }

      const projectId = parseInt(projectIdStr);

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Indexing workspace files...",
          cancellable: false,
        },
        async (progress) => {
          try {
            progress.report({ message: "Scanning files..." });

            const result = await indexWorkspace(projectId);

            vscode.window.showInformationMessage(
              `✅ Indexed ${result.indexed} files, skipped ${result.skipped}, errors ${result.errors}`
            );
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`❌ Indexing failed: ${errorMsg}`);
          }
        }
      );
    }
  );

  // ========== NEW COMMAND: Find Related Files ==========
  const findRelatedFilesCommand = vscode.commands.registerCommand(
    "multi-ai-chat.findRelatedFiles",
    () => findRelatedFiles(currentProjectId)
  );
  // =====================================================

  // ========== NEW COMMAND: Explain File ==========
  const explainFileCommand = vscode.commands.registerCommand(
    "multi-ai-chat.explainFile",
    () => explainFile(currentProjectId)
  );
  // ===============================================

  // ========== NEW COMMAND: Show Dependencies ==========
  const showDependenciesCommand = vscode.commands.registerCommand(
    "multi-ai-chat.showDependencies",
    () => showDependencies(currentProjectId)
  );
  // ====================================================

  // ========== NEW COMMAND: Find Error ==========
  const findErrorCommand = vscode.commands.registerCommand(
    "multi-ai-chat.findError",
    () => findError(currentProjectId)
  );
  // =============================================

  context.subscriptions.push(openPanelCommand);
  context.subscriptions.push(indexWorkspaceCommand);
  context.subscriptions.push(findRelatedFilesCommand);
  context.subscriptions.push(explainFileCommand);
  context.subscriptions.push(showDependenciesCommand);
  context.subscriptions.push(findErrorCommand);

  logger.info("VS Code Multi AI Chat extension activated successfully.");
}

export function deactivate() {
  logger.info("Deactivating the VS Code Multi AI Chat extension.");
}
