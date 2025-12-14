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

  // ✅ NEW: Approval callback system (from MainPanel)
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

          // ✅ Fetch projects and show QuickPick
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

  // ✅ ADD THIS NEW METHOD:
  // ✅ FIXED VERSION:
  private async _showProjectQuickPick(webview: vscode.Webview) {
    try {
      const axios = require("axios");
      const token = await this._authManager.getToken();

      if (!token) {
        vscode.window.showErrorMessage("Not authenticated");
        return;
      }

      // Fetch projects from backend
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

      // ✅ FIXED: Define interface for QuickPick items
      interface ProjectQuickPickItem extends vscode.QuickPickItem {
        projectId: number;
      }

      // Show QuickPick with proper typing
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

        // Store project ID
        this._currentProjectId = selected.projectId;

        // Update extension state
        const { setCurrentProjectId } = await import("../extension");
        setCurrentProjectId(selected.projectId);

        // Notify webview
        webview.postMessage({
          command: "projectUpdated",
          projectId: selected.projectId,
        });

        // ✅ ADD THIS: Show confirmation notification
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

  // ✅ NEW: Request approval (from MainPanel)
  public static async requestApproval(approval: any): Promise<any> {
    console.log("🟡 [SidebarProvider] Requesting approval:", approval.id);

    // Find the active sidebar instance
    // Note: We'll need to store the instance
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

  // ✅ Store singleton instance for static methods
  private static _instance?: SidebarProvider;

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    SidebarProvider._instance = this; // Store instance
    (webviewView as any).retainContextWhenHidden = true;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "webview-ui", "dist"),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
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
            // ✅ REPLACE THIS LINE:
            // Note: Project selection now handled by webview UI
            // WITH:
            await this._showProjectSelectionNotification(webviewView.webview);
            break;

          case "tokenUpdated":
            console.log("🔑 [SidebarProvider] Storing token");
            if (message.token) {
              await this._context.secrets.store("authToken", message.token);
            }
            // ✅ REPLACE THIS LINE:
            // Note: Project selection now handled by webview UI
            // WITH:
            await this._showProjectSelectionNotification(webviewView.webview);
            break;

          case "logout":
            console.log("🚪 [SidebarProvider] Clearing token");
            await this._context.secrets.delete("authToken");
            this._currentProjectId = null; // ✅ ADD THIS LINE
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

          // ✅ NEW: From MainPanel
          case "approvalResponse":
            console.log("🟢 [SidebarProvider] Approval response received");
            this._handleApprovalResponse(message.response);
            break;

          // ✅ NEW: From MainPanel
          case "sendMessage":
            logger.info(`Message from webview: ${message.text}`);
            break;

          // ✅ NEW: From MainPanel
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

          // ✅ NEW: From MainPanel
          case "projectSelected":
            logger.info(`📂 Project selected: ${message.projectId}`);
            this._currentProjectId = message.projectId; // ✅ ADD THIS LINE
            try {
              const { setCurrentProjectId } = await import("../extension");
              setCurrentProjectId(message.projectId);
            } catch (e) {
              logger.error("Failed to set project ID", e as Error);
            }
            break;

          // ✅ NEW: From MainPanel
          case "alert":
            vscode.window.showErrorMessage(message.text);
            break;

          case "writeFile":
            console.log("✏️ [SidebarProvider] Writing file:", message.filePath);
            try {
              // Resolve absolute path
              const absolutePath = path.isAbsolute(message.filePath)
                ? message.filePath
                : path.join(
                    vscode.workspace.workspaceFolders![0].uri.fsPath,
                    message.filePath
                  );

              // Write file
              fs.writeFileSync(absolutePath, message.content, "utf-8");

              // ✅ Close diff editor
              const { closeDiffEditor } = await import("../commands/viewDiff");
              await closeDiffEditor(message.filePath);

              // ✅ NEW: Open the real (updated) file
              const fileUri = vscode.Uri.file(absolutePath);
              const doc = await vscode.workspace.openTextDocument(fileUri);
              await vscode.window.showTextDocument(doc, {
                preview: false, // Don't use preview mode
                preserveFocus: false, // Focus on the file
              });

              // Show success notification
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
              // Resolve absolute path
              const absolutePath = path.isAbsolute(message.filePath)
                ? message.filePath
                : path.join(
                    vscode.workspace.workspaceFolders![0].uri.fsPath,
                    message.filePath
                  );

              // Create directory if needed
              const dirPath = path.dirname(absolutePath);
              if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
              }

              // Write file
              fs.writeFileSync(absolutePath, message.content, "utf-8");

              // Open file in editor
              vscode.workspace.openTextDocument(absolutePath).then((doc) => {
                vscode.window.showTextDocument(doc);
              });

              // Show success notification
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

        // Re-send project selection to webview
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

  // ✅ NEW: Handle approval response (from MainPanel)
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
      const token = await this._authManager.getToken();
      console.log("🔑 [SidebarProvider] Token:", token ? "EXISTS" : "NULL");

      if (token) {
        this._view.webview.postMessage({
          command: "token",
          token: token,
        });
        console.log("✅ [SidebarProvider] Token sent to webview");
      }
    } catch (error) {
      console.error("❌ [SidebarProvider] Error sending token:", error);
    }
  }

  private async _handleApiRequest(message: any, webview: vscode.Webview) {
    const { requestId, data } = message;
    const { method, endpoint, data: requestData, token } = data;

    try {
      const axios = require("axios");

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
      } else {
        config.headers["Content-Type"] = "application/json";
        if (requestData) {
          config.data = requestData;
        }
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios(config);

      webview.postMessage({
        command: "apiResponse",
        requestId: requestId,
        response: { success: true, data: response.data },
      });
    } catch (err) {
      const error = err as any;
      console.error("❌ [SidebarProvider] API error:", error.message || error);

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
    const metaTag = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src https://multi-ai-chat-production.up.railway.app; img-src ${webview.cspSource} https:; font-src ${webview.cspSource};">`;

    html = html.replace("<head>", `<head>${metaTag}`);
    html = html.replace(/<script/g, `<script nonce="${nonce}"`);

    return html;
  }
}
