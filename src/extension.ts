import * as vscode from "vscode";
import { AppController } from "./controllers/appController";
import { MainPanel } from "./panels/mainPanel"; // ✅ ДОБАВЬ
import logger from "./utils/logger";

export function activate(context: vscode.ExtensionContext) {
  logger.info("Activating the VS Code Multi AI Chat extension.");

  // Initialize controller
  const appController = AppController.getInstance();
  appController.initialize(context);

  // ✅ ДОБАВЬ регистрацию команды openMainPanel:
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
