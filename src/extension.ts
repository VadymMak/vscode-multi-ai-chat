import * as vscode from "vscode";
import AuthManager from "./auth/authManager";
import { AppController } from "./controllers/appController";
import { MainPanel } from "./panels/mainPanel";
import logger from "./utils/logger";
import { initFileContextTracking } from "./utils/fileContext"; // ✅ UPDATED

export function activate(context: vscode.ExtensionContext) {
  logger.info("Activating the VS Code Multi AI Chat extension.");

  // ✅ Initialize file context tracking FIRST
  initFileContextTracking(context);
  logger.info("FileContext tracking initialized");

  const authManager = AuthManager.initialize(context);
  logger.info("AuthManager initialized with context");

  const appController = AppController.getInstance();
  appController.initialize(context);

  const openPanelCommand = vscode.commands.registerCommand(
    "vscode-multi-ai-chat.openMainPanel",
    () => {
      MainPanel.createOrShow(context.extensionUri, context);
    }
  );

  context.subscriptions.push(openPanelCommand);

  logger.info("VS Code Multi AI Chat extension activated successfully.");
}

export function deactivate() {
  logger.info("Deactivating the VS Code Multi AI Chat extension.");
}
