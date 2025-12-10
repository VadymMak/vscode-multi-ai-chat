// src/services/incrementalIndexer.ts
import * as vscode from "vscode";
import * as path from "path";
import { reindexFile } from "./fileIndexerService";
import { getCurrentProjectId } from "../extension";
import logger from "../utils/logger";

// Supported file extensions (same as backend)
const SUPPORTED_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".py",
  ".html",
  ".css",
  ".scss",
  ".vue",
  ".svelte",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".rb",
  ".php",
  ".sql",
  ".sh",
  ".md",
  ".mdx",
];

// Patterns to skip
const SKIP_PATTERNS = [
  "node_modules",
  "__pycache__",
  ".git",
  ".venv",
  "venv",
  "dist",
  "build",
  ".next",
  "coverage",
  ".pytest_cache",
  ".mypy_cache",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

// Queue for files to re-index
let reindexQueue: Set<string> = new Set();
let debounceTimer: NodeJS.Timeout | null = null;
let workspaceFolderPath: string | null = null;

/**
 * Check if file should be skipped
 */
function shouldSkipFile(filePath: string): boolean {
  for (const pattern of SKIP_PATTERNS) {
    if (filePath.includes(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if file extension is supported
 */
function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Get relative path from workspace root
 */
function getRelativePath(absolutePath: string): string {
  if (!workspaceFolderPath) {
    return absolutePath;
  }
  return path.relative(workspaceFolderPath, absolutePath).replace(/\\/g, "/");
}

/**
 * Setup file watcher for incremental re-indexing
 */
export function setupFileWatcher(context: vscode.ExtensionContext): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    logger.info("⚠️ No workspace folder - file watcher not initialized");
    return;
  }

  workspaceFolderPath = workspaceFolders[0].uri.fsPath;
  logger.info(`🔍 File watcher initialized for: ${workspaceFolderPath}`);

  // Create file watcher pattern
  const pattern = `**/*{${SUPPORTED_EXTENSIONS.join(",")}}`;

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceFolders[0], pattern)
  );

  // File changed
  watcher.onDidChange(async (uri) => {
    const relativePath = getRelativePath(uri.fsPath);

    if (shouldSkipFile(relativePath)) {
      return;
    }

    logger.info(`📝 File changed: ${relativePath}`);
    await queueForReindex(uri.fsPath, relativePath);
  });

  // File created
  watcher.onDidCreate(async (uri) => {
    const relativePath = getRelativePath(uri.fsPath);

    if (shouldSkipFile(relativePath)) {
      return;
    }

    logger.info(`➕ File created: ${relativePath}`);
    await queueForReindex(uri.fsPath, relativePath);
  });

  // File deleted
  watcher.onDidDelete(async (uri) => {
    const relativePath = getRelativePath(uri.fsPath);

    if (shouldSkipFile(relativePath)) {
      return;
    }

    logger.info(`🗑️ File deleted: ${relativePath}`);
    // TODO: Add delete endpoint when backend supports it
    // For now, just log it
  });

  context.subscriptions.push(watcher);
  logger.info("✅ File watcher registered");
}

/**
 * Queue file for re-indexing (with debounce)
 */
async function queueForReindex(
  absolutePath: string,
  relativePath: string
): Promise<void> {
  // Check if file is supported
  if (!isSupportedFile(absolutePath)) {
    return;
  }

  // Add to queue
  reindexQueue.add(absolutePath);

  // Clear existing timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Set new timer (2 seconds debounce)
  debounceTimer = setTimeout(async () => {
    await processReindexQueue();
  }, 2000);
}

/**
 * Process queued files for re-indexing
 */
async function processReindexQueue(): Promise<void> {
  if (reindexQueue.size === 0) {
    return;
  }

  const projectId = getCurrentProjectId();
  if (!projectId) {
    logger.warn("⚠️ No project selected - skipping re-index");
    reindexQueue.clear();
    return;
  }

  const files = Array.from(reindexQueue);
  reindexQueue.clear();

  logger.info(`🔄 Re-indexing ${files.length} file(s)...`);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Re-indexing ${files.length} file(s)...`,
      cancellable: false,
    },
    async (progress) => {
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < files.length; i++) {
        const absolutePath = files[i];
        const relativePath = getRelativePath(absolutePath);

        progress.report({
          message: `${path.basename(absolutePath)} (${i + 1}/${files.length})`,
          increment: 100 / files.length,
        });

        try {
          // Read file content
          const uri = vscode.Uri.file(absolutePath);
          const content = await vscode.workspace.fs.readFile(uri);
          const textContent = Buffer.from(content).toString("utf-8");

          // Re-index via API
          await reindexFile(projectId, relativePath, textContent);
          successCount++;
        } catch (error) {
          logger.error(`Failed to re-index ${relativePath}`, error as Error);
          errorCount++;
        }
      }

      // Show result
      if (errorCount === 0) {
        vscode.window.showInformationMessage(
          `✅ Index updated (${successCount} files)`
        );
      } else {
        vscode.window.showWarningMessage(
          `⚠️ Index updated: ${successCount} succeeded, ${errorCount} failed`
        );
      }

      logger.info(
        `✅ Re-indexing complete: ${successCount} succeeded, ${errorCount} failed`
      );
    }
  );
}
