import * as vscode from "vscode";
import AuthManager from "./auth/authManager";

import logger from "./utils/logger";
import { initFileContextTracking } from "./utils/fileContext";
import { initDiffProvider } from "./utils/diffEditor"; // ✅ NEW
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
import {
  copyContextForAI,
  copyCurrentFileForAI,
} from "./commands/copyContextForAI";

// Store selected project ID
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

  // Initialize core services
  initFileContextTracking(context);
  initDiffProvider(context); // ✅ NEW: Initialize diff provider (Cline-style)
  setupFileWatcher(context);
  
  // Initialize AuthManager
  AuthManager.initialize(context);

  // Register sidebar provider
  const sidebarProvider = new SidebarProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "multi-ai-chat.mainView",
      sidebarProvider
    )
  );

  // Initialize ErrorFixer v2
  errorFixer.initialize(context);

  // Initialize Terminal Watcher
  const terminalWatcher = TerminalWatcher.getInstance();
  terminalWatcher.startWatching(context);

  // Register error detection callback
  const errorDetectionDisposable = terminalWatcher.onErrorDetected(
    async (detectedError) => {
      console.log("🔴 [DEBUG] Error detected:", detectedError.text.substring(0, 100));

      const error = {
        text: detectedError.text,
        filePath: null as string | null,
        line: null as number | null,
        source: detectedError.terminalName === "Diagnostics"
          ? ("diagnostics" as const)
          : ("terminal" as const),
        timestamp: detectedError.timestamp,
        sourceName: detectedError.terminalName,
      };

      await errorFixer.handleError(error, currentProjectId);
    }
  );
  context.subscriptions.push(errorDetectionDisposable);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-multi-ai-chat.indexWorkspace", async () => {
      const projectIdStr = await vscode.window.showInputBox({
        prompt: "Enter Project ID to index files into",
        placeHolder: "e.g., 42",
        validateInput: (value) => {
          const num = parseInt(value);
          return (isNaN(num) || num <= 0) ? "Please enter a valid positive number" : null;
        },
      });

      if (!projectIdStr) return;

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
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`❌ Indexing failed: ${errorMsg}`);
          }
        }
      );
    }),

    vscode.commands.registerCommand("multi-ai-chat.findRelatedFiles", () => {
      findRelatedFiles(currentProjectId);
    }),

    vscode.commands.registerCommand("multi-ai-chat.explainFile", () => {
      explainFile(currentProjectId);
    }),

    vscode.commands.registerCommand("multi-ai-chat.showDependencies", () => {
      showDependencies(currentProjectId);
    }),

    vscode.commands.registerCommand("multi-ai-chat.findError", () => {
      findError(currentProjectId);
    }),

    vscode.commands.registerCommand("multi-ai-chat.editFile", () => {
      editFile(currentProjectId);
    }),

    vscode.commands.registerCommand("multi-ai-chat.copyContextForAI", () => {
      copyContextForAI(currentProjectId);
    }),

    vscode.commands.registerCommand("multi-ai-chat.copyCurrentFileForAI", () => {
      copyCurrentFileForAI();
    })
  );

  logger.info("VS Code Multi AI Chat extension activated successfully.");
}

export function deactivate() {
  logger.info("Deactivating the VS Code Multi AI Chat extension.");
  errorFixer.dispose();
}