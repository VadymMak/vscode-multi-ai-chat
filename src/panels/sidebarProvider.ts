// src/panels/sidebarProvider.ts

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import logger from "../utils/logger";
import AuthManager from "../auth/authManager";
import { getFileContext } from "../utils/fileContext";

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private readonly _authManager: AuthManager;
  private _currentProjectId: number | null = null;

  private static approvalCallbacks: Map<
    string,
    (response: any) => void
  > = new Map();

  constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._extensionUri = extensionUri;
    this._context = context;
    this._authManager = AuthManager.getInstance();
  }

  private async _showProjectSelectionNotification(webview: vscode.Webview) {
    try {
      setTimeout(async () => {
        if (this._currentProjectId) {
          console.log(
            "📂 [SidebarProvider] Project already selected:",
            this._currentProjectId
          );
          return;
        }

        console.log(
          "📢 [SidebarProvider] Showing project selection notification"
        );

        const choice = await vscode.window.showInformationMessage(
          "📂 Select a project to continue",
          "Select Project",
          "Create New",
          "Cancel"
        );

        if (choice === "Select Project") {
          console.log("✅ [SidebarProvider] User chose: Select Project");
          await this._showProjectQuickPick(webview);
        } else if (choice === "Create New") {
          console.log("✅ [SidebarProvider] User chose: Create New");
          vscode.env.openExternal(
            vscode.Uri.parse("https://multi-ai-chat-production.up.railway.app")
          );
        }
      }, 1000);
    } catch (e) {
      logger.error("Failed to show project notification", e as Error);
    }
  }

  // File: vscode-extension/src/panels/sidebarProvider.ts

  private async _showProjectQuickPick(webview: vscode.Webview) {
    try {
      const axios = require("axios");

      // ✅ FIXED: Get token from secrets directly (same as _handleApiRequest)
      const token = await this._context.secrets.get("authToken");

      console.log(
        `🔑 [SidebarProvider] Token for projects:`,
        token ? token.substring(0, 30) + "..." : "NO TOKEN"
      );

      if (!token) {
        vscode.window.showErrorMessage("Not authenticated");
        return;
      }

      const response = await axios({
        method: "GET",
        url: "https://multi-ai-chat-production.up.railway.app/api/projects",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const projects = response.data;

      if (!projects || projects.length === 0) {
        vscode.window.showWarningMessage("No projects found");
        return;
      }

      interface ProjectQuickPickItem extends vscode.QuickPickItem {
        projectId: number;
      }

      const items: ProjectQuickPickItem[] = projects.map((p: any) => ({
        label: `📂 ${p.name}`,
        description: p.description || "",
        detail: `ID: ${p.id}`,
        projectId: p.id,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a project",
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (selected) {
        console.log(
          "✅ [SidebarProvider] Project selected:",
          selected.projectId
        );
        this._currentProjectId = selected.projectId;

        const { setCurrentProjectId } = await import("../extension");
        setCurrentProjectId(selected.projectId);

        webview.postMessage({
          command: "projectUpdated",
          projectId: selected.projectId,
        });

        vscode.window.showInformationMessage(
          `✅ Project selected: ${selected.label.replace("📂 ", "")}`
        );
      }
    } catch (error) {
      console.error(
        "❌ [SidebarProvider] Failed to show project picker:",
        error
      );
      vscode.window.showErrorMessage("Failed to load projects");
    }
  }

  public static async requestApproval(approval: any): Promise<any> {
    console.log("🟡 [SidebarProvider] Requesting approval:", approval.id);

    if (!SidebarProvider._instance?._view) {
      throw new Error("SidebarProvider not initialized");
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        SidebarProvider.approvalCallbacks.delete(approval.id);
        reject(new Error("Approval request timed out after 5 minutes"));
      }, 5 * 60 * 1000);

      SidebarProvider.approvalCallbacks.set(approval.id, (response) => {
        clearTimeout(timeoutId);
        resolve(response);
      });

      SidebarProvider._instance?._view?.webview.postMessage({
        type: "requestApproval",
        approval: approval,
      });
      console.log("🟢 [SidebarProvider] Approval request sent to webview");
    });
  }

  private static _instance?: SidebarProvider;

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    SidebarProvider._instance = this;
    (webviewView as any).retainContextWhenHidden = true;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "webview-ui", "dist"),
      ],
      portMapping: [
        {
          webviewPort: 5173,
          extensionHostPort: 5173,
        },
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        console.log(
          "🟡 [SidebarProvider] Message:",
          message.command || message.type
        );

        switch (message.command || message.type) {
          case "webviewReady":
            console.log("✅ [SidebarProvider] Webview ready");
            await this._sendStoredToken();
            break;

          case "apiRequest":
            console.log(
              "📤 [SidebarProvider] API request:",
              message.data.endpoint
            );
            await this._handleApiRequest(message, webviewView.webview);
            break;

          case "tokenValidated":
            console.log("✅ [SidebarProvider] Token validated");
            if (message.token) {
              await this._context.secrets.store("authToken", message.token);
            }
            await this._showProjectSelectionNotification(webviewView.webview);
            break;

          case "tokenUpdated":
            console.log("🔑 [SidebarProvider] Token update");
            if (message.token) {
              // Login - save token and show project selection
              await this._context.secrets.store("authToken", message.token);
              console.log("✅ [SidebarProvider] Token saved");
              await this._showProjectSelectionNotification(webviewView.webview);
            } else {
              // Logout - just clear token (already done in logout case)
              console.log("🚪 [SidebarProvider] Token cleared (logout)");
            }
            break;

          case "logout":
            console.log("🚪 [SidebarProvider] Clearing token");
            await this._context.secrets.delete("authToken");
            this._currentProjectId = null;
            break;

          case "getFileContext":
            console.log("📄 [SidebarProvider] Sending file context");
            try {
              const context = getFileContext();
              webviewView.webview.postMessage({
                command: "fileContext",
                data: context,
              });
            } catch (error) {
              webviewView.webview.postMessage({
                command: "fileContext",
                data: {},
              });
            }
            break;

          case "approvalResponse":
            console.log("🟢 [SidebarProvider] Approval response received");
            this._handleApprovalResponse(message.response);
            break;

          case "sendMessage":
            logger.info(`Message from webview: ${message.text}`);
            break;

          case "indexWorkspace":
            logger.info(`📂 Index workspace for project ${message.projectId}`);
            try {
              const { indexWorkspace } = await import(
                "../services/fileIndexerService"
              );
              const result = await indexWorkspace(message.projectId);

              webviewView.webview.postMessage({
                type: "indexingComplete",
                success: true,
                result: result,
              });

              vscode.window.showInformationMessage(
                `✅ Indexed ${result.indexed} files, skipped ${result.skipped}, errors ${result.errors}`
              );
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);

              webviewView.webview.postMessage({
                type: "indexingComplete",
                success: false,
                error: errorMessage,
              });

              vscode.window.showErrorMessage(
                `❌ Indexing failed: ${errorMessage}`
              );
            }
            break;

          case "projectSelected":
            logger.info(`📂 Project selected: ${message.projectId}`);
            this._currentProjectId = message.projectId;
            try {
              const { setCurrentProjectId } = await import("../extension");
              setCurrentProjectId(message.projectId);
            } catch (e) {
              logger.error("Failed to set project ID", e as Error);
            }
            break;

          case "alert":
            vscode.window.showErrorMessage(message.text);
            break;

          case "writeFile":
            console.log("✏️ [SidebarProvider] Writing file:", message.filePath);
            try {
              const absolutePath = path.isAbsolute(message.filePath)
                ? message.filePath
                : path.join(
                    vscode.workspace.workspaceFolders![0].uri.fsPath,
                    message.filePath
                  );

              fs.writeFileSync(absolutePath, message.content, "utf-8");

              const { closeDiffEditor } = await import("../commands/viewDiff");
              await closeDiffEditor(message.filePath);

              const fileUri = vscode.Uri.file(absolutePath);
              const doc = await vscode.workspace.openTextDocument(fileUri);
              await vscode.window.showTextDocument(doc, {
                preview: false,
                preserveFocus: false,
              });

              vscode.window.showInformationMessage(
                `✅ File edited: ${path.basename(message.filePath)}`
              );
              console.log(
                "✅ [SidebarProvider] File written and opened successfully"
              );
            } catch (err) {
              const error = err as Error;
              console.error("❌ [SidebarProvider] Write failed:", error);
              vscode.window.showErrorMessage(
                `Failed to write file: ${error.message}`
              );
            }
            break;

          case "createFile":
            console.log(
              "📝 [SidebarProvider] Creating file:",
              message.filePath
            );
            try {
              const absolutePath = path.isAbsolute(message.filePath)
                ? message.filePath
                : path.join(
                    vscode.workspace.workspaceFolders![0].uri.fsPath,
                    message.filePath
                  );

              const dirPath = path.dirname(absolutePath);
              if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
              }

              fs.writeFileSync(absolutePath, message.content, "utf-8");

              vscode.workspace.openTextDocument(absolutePath).then((doc) => {
                vscode.window.showTextDocument(doc);
              });

              vscode.window.showInformationMessage(
                `✅ File created: ${path.basename(message.filePath)}`
              );
              console.log("✅ [SidebarProvider] File created successfully");
            } catch (err) {
              const error = err as Error;
              console.error("❌ [SidebarProvider] Create failed:", error);
              vscode.window.showErrorMessage(
                `Failed to create file: ${error.message}`
              );
            }
            break;

          case "viewDiff":
            console.log("📊 [SidebarProvider] Opening diff view");
            try {
              const { showDiffInEditor } = await import("../commands/viewDiff");
              await showDiffInEditor(
                message.filePath,
                message.originalContent,
                message.newContent
              );
              console.log("✅ [SidebarProvider] Diff view opened");
            } catch (err) {
              const error = err as Error;
              console.error("❌ [SidebarProvider] Diff view failed:", error);
              vscode.window.showErrorMessage(
                `Failed to open diff view: ${error.message}`
              );
            }
            break;

          default:
            console.log(
              `⚠️ [SidebarProvider] Unknown command: ${
                message.command || message.type
              }`
            );
        }
      },
      undefined,
      this._context.subscriptions
    );

    logger.info("🚀 [SidebarProvider] Sidebar webview initialized");

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this._currentProjectId) {
        console.log(
          "👁️ [SidebarProvider] Webview became visible, restoring project:",
          this._currentProjectId
        );
        webviewView.webview.postMessage({
          command: "projectUpdated",
          projectId: this._currentProjectId,
        });
      }
    });

    setTimeout(() => {
      this._sendStoredToken();
    }, 500);
  }

  private _handleApprovalResponse(response: any): void {
    console.log(
      "🟡 [SidebarProvider] Handling approval response:",
      response.requestId
    );

    const callback = SidebarProvider.approvalCallbacks.get(response.requestId);
    if (callback) {
      console.log("🟢 [SidebarProvider] Callback found, executing...");
      callback(response);
      SidebarProvider.approvalCallbacks.delete(response.requestId);
    } else {
      console.warn(
        "⚠️ [SidebarProvider] No callback found for:",
        response.requestId
      );
    }
  }

  private async _sendStoredToken() {
    if (!this._view) {
      console.log("⚠️ [SidebarProvider] No view available");
      return;
    }

    try {
      const token = await this._context.secrets.get("authToken");
      console.log("🔑 [SidebarProvider] Token:", token ? "EXISTS" : "NULL");

      if (token) {
        // ✅ NEW: Check if token is expired
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          const now = Math.floor(Date.now() / 1000);

          if (payload.exp && payload.exp < now) {
            console.log("❌ [SidebarProvider] Token expired, clearing...");
            await this._context.secrets.delete("authToken");

            // Tell webview token expired
            this._view.webview.postMessage({
              command: "tokenExpired",
            });
            return;
          }

          console.log(
            "✅ [SidebarProvider] Token valid until:",
            new Date(payload.exp * 1000)
          );
        } catch (e) {
          console.log("⚠️ [SidebarProvider] Failed to parse token:", e);
          // If we can't parse, delete it
          await this._context.secrets.delete("authToken");
          return;
        }

        this._view.webview.postMessage({
          command: "token",
          token: token,
        });
        console.log("✅ [SidebarProvider] Valid token sent to webview");
      }
    } catch (error) {
      console.error("❌ [SidebarProvider] Error sending token:", error);
    }
  }

  private async _handleApiRequest(message: any, webview: vscode.Webview) {
    const { requestId, data } = message;
    const { method, endpoint, data: requestData } = data;

    try {
      const axios = require("axios");
      console.log(`📤 [SidebarProvider] API ${method} ${endpoint}`);

      // ✅ CRITICAL FIX: Get token from secrets (not AuthManager!)
      const authToken = await this._context.secrets.get("authToken");
      console.log(
        `🔑 [SidebarProvider] Using token from secrets:`,
        authToken ? authToken.substring(0, 30) + "..." : "NO TOKEN"
      );

      const config: any = {
        method: method,
        url: `https://multi-ai-chat-production.up.railway.app/api${endpoint}`,
        headers: {},
      };

      if (endpoint === "/auth/login" && requestData) {
        const formData = new URLSearchParams();
        formData.append("grant_type", "password");
        formData.append("username", requestData.username);
        formData.append("password", requestData.password);

        config.data = formData.toString();
        config.headers["Content-Type"] = "application/x-www-form-urlencoded";
        console.log(`🔐 [SidebarProvider] Login request (no token needed)`);
      } else {
        config.headers["Content-Type"] = "application/json";

        if (authToken) {
          config.headers.Authorization = `Bearer ${authToken}`;
          console.log(`🔑 [SidebarProvider] Added Authorization header`);
        } else {
          console.warn(
            `⚠️ [SidebarProvider] No token available for ${endpoint}`
          );
        }

        if (requestData) {
          config.data = requestData;
        }
      }

      console.log(`📡 [SidebarProvider] Making request...`);
      const response = await axios(config);
      console.log(`✅ [SidebarProvider] Response: ${response.status}`);

      if (endpoint === "/auth/login" && response.data.access_token) {
        const newToken = response.data.access_token;
        console.log(`🔐 [SidebarProvider] Login successful!`);
        console.log(
          `🔑 [SidebarProvider] New token:`,
          newToken.substring(0, 30) + "..."
        );

        await this._context.secrets.store("authToken", newToken);
        console.log(`✅ [SidebarProvider] Token saved to secrets`);

        // ✅ Verify
        const savedToken = await this._context.secrets.get("authToken");
        console.log(
          `✅ [SidebarProvider] Token verification:`,
          savedToken === newToken ? "✅ MATCH" : "❌ MISMATCH"
        );
        // ✅ NEW: Send fresh token to webview immediately
        webview.postMessage({
          command: "token",
          token: newToken,
        });
        console.log(`✅ [SidebarProvider] Fresh token sent to webview`);
      }

      webview.postMessage({
        command: "apiResponse",
        requestId: requestId,
        response: { success: true, data: response.data },
      });
    } catch (err) {
      const error = err as any;
      console.error("❌ [SidebarProvider] API error:", error.message || error);

      if (error.response?.status === 401) {
        console.log(`🔓 [SidebarProvider] 401 - clearing token`);
        await this._context.secrets.delete("authToken");
      }

      let errorMessage = "Request failed";
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }

      webview.postMessage({
        command: "apiResponse",
        requestId: requestId,
        response: { success: false, error: errorMessage },
      });
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
    const metaTag = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src https://multi-ai-chat-production.up.railway.app; img-src ${webview.cspSource} https:; font-src ${webview.cspSource}; frame-src 'self' https://multi-ai-chat-production.up.railway.app;">`;

    html = html.replace("<head>", `<head>${metaTag}`);
    html = html.replace(/<script/g, `<script nonce="${nonce}"`);

    return html;
  }
}
