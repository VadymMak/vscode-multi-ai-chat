import * as vscode from "vscode";
import AuthManager from "./auth/authManager";

import logger from "./utils/logger";
import { initFileContextTracking } from "./utils/fileContext";
import { indexWorkspace } from "./services/fileIndexerService";
import { findRelatedFiles } from "./commands/findRelatedFiles";
import { explainFile } from "./commands/explainFile";
import { showDependencies } from "./commands/showDependencies";
import { findError } from "./commands/findError";
import { setupFileWatcher } from "./services/incrementalIndexer";
import { editFile } from "./commands/editFile";
import TerminalWatcher from "./services/terminalWatcher";
import { errorFixer } from "./services/errorFixer";
import { SidebarProvider } from "./panels/sidebarProvider";

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
  console.log("🟡 [DEBUG] ========== ACTIVATION STARTED ==========");

  logger.info("Activating the VS Code Multi AI Chat extension.");

  console.log("🟡 [DEBUG] Initializing file context tracking...");
  initFileContextTracking(context);
  logger.info("FileContext tracking initialized");

  console.log("🟡 [DEBUG] Setting up file watcher...");
  setupFileWatcher(context);
  logger.info("File watcher initialized for incremental re-indexing");

  console.log("🟡 [DEBUG] Initializing AuthManager...");
  const authManager = AuthManager.initialize(context);
  logger.info("AuthManager initialized with context");

  console.log("🟡 [DEBUG] Registering sidebar provider...");
  const sidebarProvider = new SidebarProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "multi-ai-chat.mainView",
      sidebarProvider
    )
  );
  logger.info("✅ Sidebar provider registered");

  // Initialize Terminal Watcher for auto error detection
  console.log("🟡 [DEBUG] Setting up Terminal Watcher...");
  const terminalWatcher = TerminalWatcher.getInstance();
  terminalWatcher.startWatching(context);

  // Register error detection callback - uses new ErrorFixer system
  const errorDetectionDisposable = terminalWatcher.onErrorDetected(
    async (detectedError) => {
      console.log(
        "🔴 [DEBUG] Error detected:",
        detectedError.text.substring(0, 100)
      );

      // Convert to DetectedError format
      const error = {
        text: detectedError.text,
        filePath: null as string | null,
        line: null as number | null,
        source:
          detectedError.terminalName === "Diagnostics"
            ? ("diagnostics" as const)
            : ("terminal" as const),
        timestamp: detectedError.timestamp,
        sourceName: detectedError.terminalName,
      };

      // Use ErrorFixer to handle
      await errorFixer.handleError(error, currentProjectId);
    }
  );
  context.subscriptions.push(errorDetectionDisposable);
  logger.info("✅ Terminal Watcher initialized");

  console.log("🟡 [DEBUG] About to register openPanelCommand");

  console.log("🟡 [DEBUG] openPanelCommand registered successfully!");

  console.log("🟡 [DEBUG] About to register indexWorkspaceCommand");

  const indexWorkspaceCommand = vscode.commands.registerCommand(
    "vscode-multi-ai-chat.indexWorkspace",
    async () => {
      console.log("🔵 [DEBUG] INDEX WORKSPACE COMMAND TRIGGERED!");

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
        return;
      }

      const projectId = parseInt(projectIdStr);

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

  console.log("🟡 [DEBUG] indexWorkspaceCommand registered successfully!");

  console.log("🟡 [DEBUG] About to register findRelatedFilesCommand");

  const findRelatedFilesCommand = vscode.commands.registerCommand(
    "multi-ai-chat.findRelatedFiles",
    () => {
      console.log("🔵 [DEBUG] FIND RELATED FILES COMMAND TRIGGERED!");
      findRelatedFiles(currentProjectId);
    }
  );

  console.log("🟡 [DEBUG] findRelatedFilesCommand registered successfully!");

  console.log("🟡 [DEBUG] About to register explainFileCommand");

  const explainFileCommand = vscode.commands.registerCommand(
    "multi-ai-chat.explainFile",
    () => {
      console.log("🔵 [DEBUG] EXPLAIN FILE COMMAND TRIGGERED!");
      explainFile(currentProjectId);
    }
  );

  console.log("🟡 [DEBUG] explainFileCommand registered successfully!");

  console.log("🟡 [DEBUG] About to register showDependenciesCommand");

  const showDependenciesCommand = vscode.commands.registerCommand(
    "multi-ai-chat.showDependencies",
    () => {
      console.log("🔵 [DEBUG] SHOW DEPENDENCIES COMMAND TRIGGERED!");
      showDependencies(currentProjectId);
    }
  );

  console.log("🟡 [DEBUG] showDependenciesCommand registered successfully!");

  console.log("🟡 [DEBUG] About to register findErrorCommand");

  const findErrorCommand = vscode.commands.registerCommand(
    "multi-ai-chat.findError",
    () => {
      console.log("🔵 [DEBUG] FIND ERROR COMMAND TRIGGERED!");
      findError(currentProjectId);
    }
  );

  console.log("🟡 [DEBUG] findErrorCommand registered successfully!");

  console.log("🟡 [DEBUG] About to register editFileCommand");

  const editFileCommand = vscode.commands.registerCommand(
    "multi-ai-chat.editFile",
    () => {
      console.log("🔴 [DEBUG] EDIT FILE COMMAND TRIGGERED!");
      editFile(currentProjectId);
    }
  );

  console.log("🟡 [DEBUG] editFileCommand registered successfully!");

  console.log("🟡 [DEBUG] About to push all commands to subscriptions");

  context.subscriptions.push(indexWorkspaceCommand);
  console.log("🟡 [DEBUG] ✅ Pushed indexWorkspaceCommand");

  context.subscriptions.push(findRelatedFilesCommand);
  console.log("🟡 [DEBUG] ✅ Pushed findRelatedFilesCommand");

  context.subscriptions.push(explainFileCommand);
  console.log("🟡 [DEBUG] ✅ Pushed explainFileCommand");

  context.subscriptions.push(showDependenciesCommand);
  console.log("🟡 [DEBUG] ✅ Pushed showDependenciesCommand");

  context.subscriptions.push(findErrorCommand);
  console.log("🟡 [DEBUG] ✅ Pushed findErrorCommand");

  context.subscriptions.push(editFileCommand);
  console.log("🟡 [DEBUG] ✅ Pushed editFileCommand");

  console.log("🟡 [DEBUG] All commands pushed to subscriptions successfully!");

  logger.info("VS Code Multi AI Chat extension activated successfully.");

  console.log("🟡 [DEBUG] ========== ACTIVATION COMPLETE ==========");
}

export function deactivate() {
  console.log("🟡 [DEBUG] Extension deactivating...");
  logger.info("Deactivating the VS Code Multi AI Chat extension.");
}
