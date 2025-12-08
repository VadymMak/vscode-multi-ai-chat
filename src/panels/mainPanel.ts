import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import logger from "../utils/logger";
import { getFileContext } from "../utils/fileContext";
import { ApiProxy } from "../services/apiProxy";

export class MainPanel {
  public static currentPanel: MainPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];
  private _isInitialized: boolean = false; // ✅ NEW: Track initialization

  public static createOrShow(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (MainPanel.currentPanel) {
      MainPanel.currentPanel._panel.reveal(column);
      MainPanel.currentPanel._sendStoredToken();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "mainPanel",
      "Multi AI Chat",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "webview-ui", "dist"),
        ],
      }
    );

    MainPanel.currentPanel = new MainPanel(panel, extensionUri, context);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._context = context;

    // ✅ Only set HTML once during initialization
    this._initializeWebview();

    this._sendStoredToken();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // ✅ FIXED: Don't recreate HTML when panel becomes visible
    this._panel.onDidChangeViewState(
      (e) => {
        if (this._panel.visible) {
          // ✅ Only send token, DON'T update HTML!
          this._sendStoredToken();
        }
      },
      null,
      this._disposables
    );

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "login":
            logger.info(`Login attempt: ${message.username}`);
            break;

          case "tokenUpdated":
            logger.info("🔑 Token received from webview");
            if (message.token) {
              await this._saveToken(message.token);
              // ✅ ADD: Also update AuthManager
              try {
                const authManager = (await import("../auth/authManager"))
                  .default;
                await authManager.getInstance().saveToken(message.token);
                logger.info("💾 Token saved in AuthManager");
              } catch (e) {
                logger.error("Failed to save token to AuthManager", e as Error);
              }
              logger.info("💾 Token saved in extension storage");
            } else {
              // ✅ Handle logout - clear token
              await this._clearToken();
              logger.info("🗑️ Token cleared from extension storage");
            }
            break;

          case "apiRequest":
            logger.info(
              `🔄 [MainPanel] API Proxy request: ${message.data.method} ${message.data.endpoint}`
            );
            try {
              const response = await ApiProxy.request(message.data);

              this._panel.webview.postMessage({
                command: "apiResponse",
                requestId: message.requestId,
                response,
              });
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              logger.error(`❌ [MainPanel] API Proxy error: ${errorMessage}`);

              this._panel.webview.postMessage({
                command: "apiResponse",
                requestId: message.requestId,
                response: {
                  success: false,
                  error: errorMessage,
                },
              });
            }
            break;

          case "sendMessage":
            logger.info(`Message from webview: ${message.text}`);
            break;

          case "getFileContext":
            logger.info("Webview requested file context");
            try {
              const context = getFileContext();
              logger.info(
                `Sending file context to webview: ${JSON.stringify(context)}`
              );

              this._panel.webview.postMessage({
                command: "fileContext",
                data: context,
              });
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              logger.error(`Error getting file context: ${errorMessage}`);

              this._panel.webview.postMessage({
                command: "fileContext",
                data: {},
              });
            }
            break;

          case "indexWorkspace":
            logger.info(
              `📂 Index workspace request for project ${message.projectId}`
            );
            try {
              const { indexWorkspace } = await import(
                "../services/fileIndexerService"
              );
              const result = await indexWorkspace(message.projectId);

              // Send result back to webview
              this._panel.webview.postMessage({
                type: "indexingComplete",
                success: true,
                result: result,
              });

              // Show VS Code notification
              vscode.window.showInformationMessage(
                `✅ Indexed ${result.indexed} files, skipped ${result.skipped}, errors ${result.errors}`
              );
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              logger.error(`❌ Indexing failed: ${errorMessage}`);

              this._panel.webview.postMessage({
                type: "indexingComplete",
                success: false,
                error: errorMessage,
              });

              vscode.window.showErrorMessage(
                `❌ Indexing failed: ${errorMessage}`
              );
            }
            break;

          case "alert":
            vscode.window.showErrorMessage(message.text);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  // ✅ NEW: Initialize webview only once
  private _initializeWebview(): void {
    if (this._isInitialized) {
      return;
    }

    const webview = this._panel.webview;
    this._panel.title = "Multi AI Chat";
    this._panel.webview.html = this._getHtmlForWebview(webview);
    this._isInitialized = true;

    logger.info("🚀 Webview initialized");
  }

  private async _saveToken(token: string): Promise<void> {
    await this._context.globalState.update("authToken", token);
  }

  // ✅ NEW: Clear token method
  private async _clearToken(): Promise<void> {
    await this._context.globalState.update("authToken", undefined);
  }

  private async _getToken(): Promise<string | undefined> {
    return this._context.globalState.get<string>("authToken");
  }

  private async _sendStoredToken(): Promise<void> {
    try {
      const token = await this._getToken();
      if (token) {
        logger.info("📤 Sending stored token to webview");
        this._panel.webview.postMessage({
          command: "tokenUpdated",
          token: token,
        });
      } else {
        logger.info("📭 No stored token found");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Error sending token: ${errorMessage}`);
    }
  }

  public dispose() {
    MainPanel.currentPanel = undefined;
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const distPath = path.join(this._extensionUri.fsPath, "webview-ui", "dist");
    const htmlPath = path.join(distPath, "index.html");

    let html = fs.readFileSync(htmlPath, "utf8");

    const assetPath = vscode.Uri.joinPath(
      this._extensionUri,
      "webview-ui",
      "dist",
      "assets"
    );
    const assetUri = webview.asWebviewUri(assetPath);

    html = html.replace(/\/assets\//g, `${assetUri.toString()}/`);

    const nonce = getNonce();

    html = html.replace(
      "<head>",
      `<head>
      <meta http-equiv="Content-Security-Policy" 
            content="default-src 'none'; 
                     style-src ${webview.cspSource} 'unsafe-inline'; 
                     script-src 'nonce-${nonce}' ${webview.cspSource}; 
                     connect-src https://multi-ai-chat-production.up.railway.app;
                     img-src ${webview.cspSource} https: data:;">`
    );

    html = html.replace(/<script/g, `<script nonce="${nonce}"`);

    return html;
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
