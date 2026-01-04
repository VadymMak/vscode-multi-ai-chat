// src/services/fileIndexerService.ts
import * as vscode from "vscode";
import * as path from "path";
import { post, saveDependencies } from "../api/apiClient";
import logger from "../utils/logger";
import { dependencyExtractor } from "./dependencyExtractor";
import { FileDependency } from "../types";

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

// Max file size (100KB)
const MAX_FILE_SIZE = 100000;

interface LocalFile {
  path: string;
  content: string;
}

interface IndexResult {
  success: boolean;
  indexed: number;
  skipped: number;
  errors: number;
  message: string;
}

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
 * Get all files in workspace recursively
 */
async function getWorkspaceFiles(
  workspaceFolder: vscode.Uri
): Promise<LocalFile[]> {
  const files: LocalFile[] = [];

  // Find all supported files
  const pattern = `**/*{${SUPPORTED_EXTENSIONS.join(",")}}`;
  const excludePattern = `{${SKIP_PATTERNS.map((p) => `**/${p}/**`).join(
    ","
  )}}`;

  const uris = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspaceFolder, pattern),
    new vscode.RelativePattern(workspaceFolder, excludePattern),
    500 // Max files
  );

  for (const uri of uris) {
    try {
      // Check file size
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.size > MAX_FILE_SIZE) {
        logger.info(
          `⏭️ Skipping large file: ${uri.fsPath} (${stat.size} bytes)`
        );
        continue;
      }

      // Read content
      const content = await vscode.workspace.fs.readFile(uri);
      const textContent = Buffer.from(content).toString("utf-8");

      // Get relative path
      const relativePath = path
        .relative(workspaceFolder.fsPath, uri.fsPath)
        .replace(/\\/g, "/"); // Normalize to forward slashes

      files.push({
        path: relativePath,
        content: textContent,
      });
    } catch (error) {
      logger.error(`Failed to read file: ${uri.fsPath}`, error as Error);
    }
  }

  return files;
}

/**
 * Index all files in current workspace (with batching)
 */
export async function indexWorkspace(projectId: number): Promise<IndexResult> {
  logger.info(`📂 Starting workspace indexing for project ${projectId}`);

  // Get workspace folder
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error("No workspace folder open");
  }

  const workspaceFolder = workspaceFolders[0].uri;
  logger.info(`📁 Workspace: ${workspaceFolder.fsPath}`);

  // Get all files
  const files = await getWorkspaceFiles(workspaceFolder);
  logger.info(`📄 Found ${files.length} files to index`);

  if (files.length === 0) {
    return {
      success: true,
      indexed: 0,
      skipped: 0,
      errors: 0,
      message: "No files found to index",
    };
  }

  // Batch settings
  const BATCH_SIZE = 30;
  const batches: LocalFile[][] = [];

  // Split into batches
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    batches.push(files.slice(i, i + BATCH_SIZE));
  }

  logger.info(
    `📦 Split into ${batches.length} batches of ~${BATCH_SIZE} files`
  );

  // Aggregate results
  let totalIndexed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Send batches
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    logger.info(
      `📤 Sending batch ${i + 1}/${batches.length} (${batch.length} files)`
    );

    try {
      const response = (await post("/file-indexer/index-local", {
        project_id: projectId,
        files: batch,
      } as any)) as any;

      totalIndexed += response.indexed || 0;
      totalSkipped += response.skipped || 0;
      totalErrors += response.errors || 0;

      logger.info(
        `✅ Batch ${i + 1} done: indexed=${response.indexed}, skipped=${
          response.skipped
        }`
      );
    } catch (error) {
      logger.error(`❌ Batch ${i + 1} failed`, error as Error);
      totalErrors += batch.length;
    }
  }

  const result: IndexResult = {
    success: totalErrors === 0,
    indexed: totalIndexed,
    skipped: totalSkipped,
    errors: totalErrors,
    message: `Indexed ${totalIndexed} files, skipped ${totalSkipped}, errors ${totalErrors}`,
  };

  logger.info(`✅ Indexing complete: ${result.message}`);
  // Extract and save dependencies
  logger.info(`🔗 Extracting dependencies...`);
  const allDependencies: FileDependency[] = [];

  for (const file of files) {
    try {
      const analysis = dependencyExtractor.analyzeFile(file.content, file.path);

      for (const imp of analysis.imports) {
        // Only save relative imports (project files)
        if (dependencyExtractor.isRelativeImport(imp.targetModule)) {
          allDependencies.push({
            projectId: projectId,
            sourceFile: file.path,
            targetFile: imp.targetModule,
            dependencyType: imp.importType,
            importsWhat: imp.importsWhat,
          });
        }
      }
    } catch (err) {
      logger.warn(`Failed to extract deps from ${file.path}`);
    }
  }

  if (allDependencies.length > 0) {
    // Deduplicate dependencies (same source+target)
    const uniqueDeps = Array.from(
      new Map(
        allDependencies.map((d) => [`${d.sourceFile}:${d.targetFile}`, d])
      ).values()
    );

    console.log(
      `📦 Unique dependencies: ${uniqueDeps.length} (from ${allDependencies.length})`
    );

    try {
      const depsResult = await saveDependencies(projectId, uniqueDeps);
      logger.info(`🔗 Saved ${depsResult.saved} dependencies`);
    } catch (err) {
      logger.warn(`Failed to save dependencies: ${err}`);
    }
  }
  return result;
}

/**
 * Index a single file (for file watcher)
 */
export async function indexSingleFile(
  projectId: number,
  fileUri: vscode.Uri
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return;

  const workspaceFolder = workspaceFolders[0].uri;
  const relativePath = path
    .relative(workspaceFolder.fsPath, fileUri.fsPath)
    .replace(/\\/g, "/");

  // Check if supported
  if (!isSupportedFile(relativePath) || shouldSkipFile(relativePath)) {
    return;
  }

  try {
    const content = await vscode.workspace.fs.readFile(fileUri);
    const textContent = Buffer.from(content).toString("utf-8");

    await post("/file-indexer/index-local", {
      project_id: projectId,
      files: [
        {
          path: relativePath,
          content: textContent,
        },
      ],
    } as any);

    logger.info(`✅ Indexed: ${relativePath}`);
  } catch (error) {
    logger.error(`Failed to index ${relativePath}`, error as Error);
  }
}

/**
 * Re-index a single file (incremental update)
 */
export async function reindexFile(
  projectId: number,
  filePath: string,
  content: string
): Promise<void> {
  try {
    await post("/file-indexer/reindex-file", {
      project_id: projectId,
      file_path: filePath,
      content: content,
    } as any);

    logger.info(`✅ Re-indexed: ${filePath}`);
  } catch (error) {
    logger.error(`Failed to re-index ${filePath}`, error as Error);
    throw error;
  }
}
