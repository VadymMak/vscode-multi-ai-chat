import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import logger from "../utils/logger";

export class MainPanel {
  public static currentPanel: MainPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (MainPanel.currentPanel) {
      MainPanel.currentPanel._panel.reveal(column);
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

    MainPanel.currentPanel = new MainPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.onDidChangeViewState(
      (e) => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // ✅ Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "login":
            logger.info(`Login attempt: ${message.username}`);
            // TODO: Handle login through AuthManager
            break;
          case "sendMessage":
            logger.info(`Message from webview: ${message.text}`);
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

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = "Multi AI Chat";
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // ✅ Path to React build
    const distPath = path.join(this._extensionUri.fsPath, "webview-ui", "dist");
    const htmlPath = path.join(distPath, "index.html");

    // ✅ Read the built HTML
    let html = fs.readFileSync(htmlPath, "utf8");

    // ✅ Replace asset paths with webview URIs
    const assetPath = vscode.Uri.joinPath(
      this._extensionUri,
      "webview-ui",
      "dist",
      "assets"
    );
    const assetUri = webview.asWebviewUri(assetPath);

    // ✅ Replace /assets/ with webview URI
    html = html.replace(/\/assets\//g, `${assetUri.toString()}/`);

    // ✅ Add CSP
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

    // ✅ Add nonce to scripts
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
