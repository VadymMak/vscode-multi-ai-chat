import * as vscode from "vscode";
import AuthManager from "./auth/authManager"; // ✅ ДОБАВЛЕНО
import { AppController } from "./controllers/appController";
import { MainPanel } from "./panels/mainPanel";
import logger from "./utils/logger";

export function activate(context: vscode.ExtensionContext) {
  logger.info("Activating the VS Code Multi AI Chat extension.");

  // ✅ ДОБАВЛЕНО - Initialize AuthManager with context FIRST
  const authManager = AuthManager.initialize(context);
  logger.info("AuthManager initialized with context");

  // Initialize controller
  const appController = AppController.getInstance();
  appController.initialize(context);

  // Register command to open main panel
  const openPanelCommand = vscode.commands.registerCommand(
    "vscode-multi-ai-chat.openMainPanel",
    () => {
      MainPanel.createOrShow(context.extensionUri);
    }
  );

  context.subscriptions.push(openPanelCommand);

  logger.info("VS Code Multi AI Chat extension activated successfully.");
}

export function deactivate() {
  logger.info("Deactivating the VS Code Multi AI Chat extension.");
}
