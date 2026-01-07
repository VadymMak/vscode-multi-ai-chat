/**
 * Error Reporter Service for Auto-Learning
 *
 * Automatically listens to VS Code diagnostics (TypeScript, ESLint, etc.)
 * and reports errors to backend for learning.
 *
 * File: src/services/errorReporter.ts
 */

import * as vscode from "vscode";
import { post } from "../api/apiClient";
import logger from "../utils/logger";

import {
  ReportErrorRequest,
  ReportErrorResponse,
  ReportFixRequest,
} from "../types/index";

// Debounce timer to avoid flooding backend
let reportTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 3000; // Wait 3 seconds after last change

// Track reported errors to avoid duplicates
const reportedErrors = new Map<string, number>(); // errorKey -> timestamp
const DUPLICATE_THRESHOLD_MS = 60000; // Don't report same error within 1 minute

// Disposable for cleanup
let diagnosticsListener: vscode.Disposable | null = null;

/**
 * Initialize the error reporter - call from extension.ts activate()
 */
export function initErrorReporter(context: vscode.ExtensionContext): void {
  logger.info("[ErrorReporter] Initializing...");

  // Listen to diagnostics changes
  diagnosticsListener = vscode.languages.onDidChangeDiagnostics((event) => {
    handleDiagnosticsChange(event);
  });

  context.subscriptions.push(diagnosticsListener);

  logger.info("[ErrorReporter] Initialized - listening for errors");
}

/**
 * Handle diagnostics change event
 */
function handleDiagnosticsChange(event: vscode.DiagnosticChangeEvent): void {
  // Debounce to avoid flooding
  if (reportTimer) {
    clearTimeout(reportTimer);
  }

  reportTimer = setTimeout(() => {
    processChangedDiagnostics(event.uris);
  }, DEBOUNCE_MS);
}

/**
 * Process diagnostics for changed files
 */
async function processChangedDiagnostics(
  uris: readonly vscode.Uri[]
): Promise<void> {
  // Get current project ID from settings or state
  const projectId = await getCurrentProjectId();

  if (!projectId) {
    // No project selected, skip reporting
    return;
  }

  for (const uri of uris) {
    // Only process file:// URIs
    if (uri.scheme !== "file") {
      continue;
    }

    const diagnostics = vscode.languages.getDiagnostics(uri);

    // Filter to errors only (not warnings/hints)
    const errors = diagnostics.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error
    );

    if (errors.length === 0) {
      continue;
    }

    // Process each error
    for (const error of errors) {
      await reportError(projectId, uri, error);
    }
  }
}

/**
 * Report a single error to backend
 */
async function reportError(
  projectId: number,
  uri: vscode.Uri,
  diagnostic: vscode.Diagnostic
): Promise<void> {
  try {
    const filePath = normalizeFilePath(uri.fsPath);
    const errorPattern = diagnostic.message;
    const errorCode = getErrorCode(diagnostic);
    const errorType = getErrorType(diagnostic);
    const lineNumber = diagnostic.range.start.line + 1;

    // Create unique key for deduplication
    const errorKey = `${filePath}:${lineNumber}:${errorPattern}`;

    // Check if recently reported
    const lastReported = reportedErrors.get(errorKey);
    if (lastReported && Date.now() - lastReported < DUPLICATE_THRESHOLD_MS) {
      return; // Skip duplicate
    }

    // Get code snippet around error
    const codeSnippet = await getCodeSnippet(uri, diagnostic.range);

    // Report to backend
    const response = ((await post("/vscode/report-error", {
      project_id: projectId,
      error_pattern: errorPattern,
      error_type: errorType,
      error_code: errorCode,
      file_path: filePath,
      line_number: lineNumber,
      code_snippet: codeSnippet,
    } as ReportErrorRequest)) as unknown) as ReportErrorResponse;

    // Mark as reported
    reportedErrors.set(errorKey, Date.now());

    // Clean old entries periodically
    cleanOldReportedErrors();

    logger.debug(
      `[ErrorReporter] Reported: ${errorType} - ${errorPattern.substring(
        0,
        50
      )}...`
    );
  } catch (error) {
    // Silent fail - don't bother user with reporting errors
    logger.debug(`[ErrorReporter] Failed to report error: ${error}`);
  }
}

/**
 * Report that an error was fixed (call when diagnostics clear)
 */
export async function reportErrorFixed(
  projectId: number,
  errorId: number,
  originalCode?: string,
  fixedCode?: string
): Promise<void> {
  try {
    await post("/vscode/report-fix", {
      error_id: errorId,
      original_code: originalCode,
      fixed_code: fixedCode,
      fix_method: "manual",
    } as ReportFixRequest);

    logger.debug(`[ErrorReporter] Reported fix for error ${errorId}`);
  } catch (error) {
    logger.debug(`[ErrorReporter] Failed to report fix: ${error}`);
  }
}

/**
 * Manually report an error (can be called from other commands)
 */
export async function manualReportError(
  projectId: number,
  errorPattern: string,
  errorType: string,
  filePath?: string,
  lineNumber?: number,
  codeSnippet?: string
): Promise<{
  error_id: number;
  is_new: boolean;
  occurrence_count: number;
} | null> {
  try {
    const response = ((await post("/vscode/report-error", {
      project_id: projectId,
      error_pattern: errorPattern,
      error_type: errorType,
      file_path: filePath,
      line_number: lineNumber,
      code_snippet: codeSnippet,
    } as ReportErrorRequest)) as unknown) as ReportErrorResponse;

    logger.info(
      `[ErrorReporter] Manual report: ${errorType} - ${errorPattern.substring(
        0,
        50
      )}...`
    );

    return {
      error_id: response.error_id,
      is_new: response.is_new,
      occurrence_count: response.occurrence_count,
    };
  } catch (error) {
    logger.error(`[ErrorReporter] Manual report failed: ${error}`);
    return null;
  }
}

// ==================== HELPERS ====================

/**
 * Get current project ID from extension state
 */
async function getCurrentProjectId(): Promise<number | null> {
  // Try to get from workspace state or configuration
  const config = vscode.workspace.getConfiguration("multiAiChat");
  const projectId = config.get<number>("currentProjectId");

  if (projectId) {
    return projectId;
  }

  // Fallback: try to get from global state (set by sidebar)
  // This would need to be implemented based on your state management
  return null;
}

/**
 * Normalize file path to match database format
 */
function normalizeFilePath(fsPath: string): string {
  let normalized = fsPath.replace(/\\/g, "/");

  // Extract relative path from project markers
  const markers = ["backend/", "frontend/", "src/", "app/"];

  for (const marker of markers) {
    const idx = normalized.indexOf(marker);
    if (idx !== -1) {
      return normalized.substring(idx);
    }
  }

  // Fallback: return last 4 parts
  const parts = normalized.split("/");
  if (parts.length > 4) {
    return parts.slice(-4).join("/");
  }

  return normalized;
}

/**
 * Extract error code from diagnostic
 */
function getErrorCode(diagnostic: vscode.Diagnostic): string | undefined {
  if (!diagnostic.code) {
    return undefined;
  }

  if (
    typeof diagnostic.code === "string" ||
    typeof diagnostic.code === "number"
  ) {
    return String(diagnostic.code);
  }

  // Handle { value: string | number, target: Uri }
  if (typeof diagnostic.code === "object" && "value" in diagnostic.code) {
    return String(diagnostic.code.value);
  }

  return undefined;
}

/**
 * Determine error type from diagnostic source
 */
function getErrorType(diagnostic: vscode.Diagnostic): string {
  const source = diagnostic.source?.toLowerCase() || "";
  const code = getErrorCode(diagnostic) || "";

  // TypeScript errors
  if (source === "ts" || source === "typescript" || code.startsWith("TS")) {
    // Categorize TS errors
    if (
      code === "TS2307" ||
      diagnostic.message.includes("Cannot find module")
    ) {
      return "import";
    }
    if (
      code === "TS2339" ||
      diagnostic.message.includes("does not exist on type")
    ) {
      return "type";
    }
    if (code === "TS2345" || diagnostic.message.includes("is not assignable")) {
      return "type";
    }
    return "typescript";
  }

  // ESLint errors
  if (source === "eslint") {
    if (code.includes("unused") || diagnostic.message.includes("never used")) {
      return "lint_unused";
    }
    if (code.includes("import") || diagnostic.message.includes("import")) {
      return "lint_import";
    }
    return "lint";
  }

  // Python errors
  if (source === "pylint" || source === "pyright" || source === "python") {
    return "python";
  }

  // Generic
  if (
    diagnostic.message.includes("import") ||
    diagnostic.message.includes("module")
  ) {
    return "import";
  }
  if (
    diagnostic.message.includes("type") ||
    diagnostic.message.includes("Type")
  ) {
    return "type";
  }
  if (diagnostic.message.includes("syntax")) {
    return "syntax";
  }

  return "unknown";
}

/**
 * Get code snippet around error location
 */
async function getCodeSnippet(
  uri: vscode.Uri,
  range: vscode.Range
): Promise<string | undefined> {
  try {
    const document = await vscode.workspace.openTextDocument(uri);

    // Get 3 lines before and after
    const startLine = Math.max(0, range.start.line - 3);
    const endLine = Math.min(document.lineCount - 1, range.end.line + 3);

    const snippetRange = new vscode.Range(startLine, 0, endLine, 1000);
    const snippet = document.getText(snippetRange);

    // Limit size
    if (snippet.length > 500) {
      return snippet.substring(0, 500) + "...";
    }

    return snippet;
  } catch {
    return undefined;
  }
}

/**
 * Clean old entries from reportedErrors map
 */
function cleanOldReportedErrors(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  reportedErrors.forEach((timestamp, key) => {
    if (now - timestamp > DUPLICATE_THRESHOLD_MS * 5) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach((key) => reportedErrors.delete(key));
}

/**
 * Dispose the error reporter
 */
export function disposeErrorReporter(): void {
  if (reportTimer) {
    clearTimeout(reportTimer);
    reportTimer = null;
  }

  if (diagnosticsListener) {
    diagnosticsListener.dispose();
    diagnosticsListener = null;
  }

  reportedErrors.clear();

  logger.info("[ErrorReporter] Disposed");
}
