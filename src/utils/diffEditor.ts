import * as vscode from "vscode";
import * as path from "path";

// ============================================================
// CLINE-STYLE DIFF VIEW PROVIDER
// Uses registerTextDocumentContentProvider for readonly virtual documents
// No save prompts, clean closing!
// ============================================================

const DIFF_SCHEME = "multi-ai-diff";

// Store content for virtual documents
const documentContents = new Map<string, string>();

// Current diff session
let currentDiffSession: {
  sessionId: string;
  filePath: string;
  originalUri: vscode.Uri;
  modifiedUri: vscode.Uri;
} | null = null;

// Content provider for readonly virtual documents
class DiffContentProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    const content = documentContents.get(uri.toString());
    return content || "";
  }

  update(uri: vscode.Uri): void {
    this._onDidChange.fire(uri);
  }
}

// Singleton provider instance
let diffProvider: DiffContentProvider | null = null;
let providerDisposable: vscode.Disposable | null = null;

/**
 * Initialize the diff content provider (call this in extension activate)
 */
export function initDiffProvider(context: vscode.ExtensionContext): void {
  if (diffProvider) return;
  
  diffProvider = new DiffContentProvider();
  providerDisposable = vscode.workspace.registerTextDocumentContentProvider(
    DIFF_SCHEME,
    diffProvider
  );
  context.subscriptions.push(providerDisposable);
  
  console.log(`📄 [Diff] Provider registered with scheme: ${DIFF_SCHEME}`);
}

/**
 * Get file extension from path
 */
function getExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext || ".txt";
}

/**
 * Get filename without extension
 */
function getBaseName(filePath: string): string {
  const ext = path.extname(filePath);
  const base = path.basename(filePath);
  return ext ? base.slice(0, -ext.length) : base;
}

/**
 * Build URI for diff content provider
 * Format: multi-ai-diff:/original/{sessionId}/{filename}
 */
function buildDiffUri(filePath: string, type: "original" | "modified", sessionId: string): vscode.Uri {
  const fileName = path.basename(filePath);
  return vscode.Uri.parse(`${DIFF_SCHEME}:/${type}/${sessionId}/${fileName}`);
}

/**
 * Show diff in editor using virtual readonly documents
 */
export async function showDiffInEditor(
  filePath: string,
  originalContent: string,
  modifiedContent: string
): Promise<void> {
  // Initialize provider if not done
  if (!diffProvider) {
    console.error("❌ [Diff] Provider not initialized! Call initDiffProvider first.");
    throw new Error("Diff provider not initialized");
  }

  // Close any existing diff session
  if (currentDiffSession) {
    await closeDiffEditor(currentDiffSession.filePath);
  }

  // Generate unique session ID
  const sessionId = Date.now().toString();
  
  // Build URIs
  const originalUri = buildDiffUri(filePath, "original", sessionId);
  const modifiedUri = buildDiffUri(filePath, "modified", sessionId);

  console.log(`📄 [Diff] Session: ${sessionId}`);
  console.log(`📄 [Diff] Original URI: ${originalUri.toString()}`);
  console.log(`📄 [Diff] Modified URI: ${modifiedUri.toString()}`);

  // Store content for provider
  documentContents.set(originalUri.toString(), originalContent);
  documentContents.set(modifiedUri.toString(), modifiedContent);

  // Save session info
  currentDiffSession = {
    sessionId,
    filePath,
    originalUri,
    modifiedUri,
  };

  // Open diff view
  await vscode.commands.executeCommand(
    "vscode.diff",
    originalUri,
    modifiedUri,
    `AI Changes: ${path.basename(filePath)}`
  );
}

/**
 * Close diff editor - clean up virtual documents
 */
export async function closeDiffEditor(_filePath: string): Promise<void> {
  if (!currentDiffSession) {
    console.log(`[Diff] No active session to close`);
    return;
  }

  const { sessionId, originalUri, modifiedUri } = currentDiffSession;
  
  console.log(`📄 [Diff] Closing session: ${sessionId}`);

  // Clear session first
  currentDiffSession = null;

  // Remove content from storage
  documentContents.delete(originalUri.toString());
  documentContents.delete(modifiedUri.toString());

  // Close all related tabs
  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      let shouldClose = false;
      
      // Check if it's a diff tab
      if (tab.input instanceof vscode.TabInputTextDiff) {
        const diffInput = tab.input as vscode.TabInputTextDiff;
        if (
          diffInput.original.scheme === DIFF_SCHEME ||
          diffInput.modified.scheme === DIFF_SCHEME
        ) {
          shouldClose = true;
        }
      }
      // Check if it's a text tab with our scheme
      else if (tab.input instanceof vscode.TabInputText) {
        const textInput = tab.input as vscode.TabInputText;
        if (textInput.uri.scheme === DIFF_SCHEME) {
          shouldClose = true;
        }
      }
      
      if (shouldClose) {
        console.log(`📄 [Diff] Closing tab: ${tab.label}`);
        try {
          // Virtual documents don't need saving - just close
          await vscode.window.tabGroups.close(tab);
        } catch (err) {
          // Ignore - tab might already be closed
        }
      }
    }
  }
  
  console.log(`✅ [Diff] Session ${sessionId} closed`);
}

/**
 * Check if a file is a diff virtual document
 */
export function isDiffDocument(uri: vscode.Uri): boolean {
  return uri.scheme === DIFF_SCHEME;
}

/**
 * Get the current diff session info
 */
export function getCurrentDiffSession() {
  return currentDiffSession;
}