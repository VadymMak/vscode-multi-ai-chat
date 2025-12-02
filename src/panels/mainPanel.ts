// src/panels/mainPanel.ts

import * as vscode from "vscode";
import { AppController } from "../controllers/appController";
import logger from "../utils/logger";

/**
 * MainPanel manages the webview panel for the Multi-AI Chat extension
 */
export class MainPanel {
  public static currentPanel: MainPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private readonly _appController: AppController;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    appController: AppController
  ) {
    this._panel = panel;
    this._appController = appController;

    // Set the webview's initial html content
    this._panel.webview.html = this._getWebviewContent();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message: any) => {
        this._handleMessage(message);
      },
      null,
      this._disposables
    );

    logger.info("MainPanel created successfully");
  }

  /**
   * Create or show the main panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    appController: AppController
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (MainPanel.currentPanel) {
      MainPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      "multiAiChat",
      "Multi-AI Chat",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    MainPanel.currentPanel = new MainPanel(panel, extensionUri, appController);
  }

  /**
   * Handle messages from the webview
   */
  private async _handleMessage(message: any): Promise<void> {
    try {
      switch (message.command) {
        case "login":
          logger.info("Login requested from webview");
          const user = await this._appController.login(
            message.email,
            message.password
          );
          this._panel.webview.postMessage({
            command: "loginSuccess",
            user: user,
          });
          break;

        case "sendMessage":
          logger.info("Send message requested from webview");
          const result = await this._appController.sendMessage(message.content);
          this._panel.webview.postMessage({
            command: "messageReceived",
            message: result,
          });
          break;

        case "logout":
          logger.info("Logout requested from webview");
          await this._appController.logout();
          this._panel.webview.postMessage({
            command: "logoutSuccess",
          });
          break;

        default:
          logger.warn("Unknown message command:", message.command);
      }
    } catch (error) {
      logger.error("Error handling webview message:", error);

      // ✅ Safely extract error message with type guard
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";

      this._panel.webview.postMessage({
        command: "error",
        error: errorMessage,
      });
    }
  }

  /**
   * Get the HTML content for the webview
   */
  private _getWebviewContent(): string {
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Multi-AI Chat</title>
            <style>
                body {
                    padding: 20px;
                    color: var(--vscode-foreground);
                    font-family: var(--vscode-font-family);
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 {
                    color: var(--vscode-foreground);
                }
                .status {
                    padding: 10px;
                    margin: 10px 0;
                    border-radius: 4px;
                    background: var(--vscode-editor-background);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Multi-AI Chat</h1>
                <div class="status">
                    <p>✅ Extension is running!</p>
                    <p>Webview panel is working correctly.</p>
                    <p>TODO: Add React UI here (from webview-ui/)</p>
                </div>
            </div>
        </body>
        </html>`;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    MainPanel.currentPanel = undefined;

    // Clean up resources
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }

    logger.info("MainPanel disposed");
  }
}
