// src/extension.ts

import * as vscode from "vscode";
import appController from "./controllers/appController";
import logger from "./utils/logger";

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
  logger.info('Extension "multi-ai-chat" is now active!');

  // Initialize the app controller
  appController.initialize().catch((error: any) => {
    logger.error("Failed to initialize app controller:", error);
  });

  // Register the command to open chat panel
  const openChatCommand = vscode.commands.registerCommand(
    "multi-ai-chat.openChat",
    () => {
      try {
        // TODO: Create main panel when we implement it
        vscode.window.showInformationMessage(
          "Multi-AI Chat panel will open here!"
        );
        logger.info("Open chat command executed");
      } catch (error) {
        logger.error("Failed to open chat panel:", error);
        vscode.window.showErrorMessage(
          "Failed to open chat panel. Check logs for details."
        );
      }
    }
  );

  context.subscriptions.push(openChatCommand);

  // Register hello world command (from template)
  const helloWorldCommand = vscode.commands.registerCommand(
    "multi-ai-chat.helloWorld",
    () => {
      vscode.window.showInformationMessage("Hello World from Multi-AI Chat!");
    }
  );

  context.subscriptions.push(helloWorldCommand);

  logger.info("Extension commands registered successfully");
}

// This method is called when your extension is deactivated
export function deactivate() {
  logger.info('Extension "multi-ai-chat" is now deactivated.');
}
