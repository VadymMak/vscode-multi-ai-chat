import * as vscode from "vscode";
import logger from "../utils/logger";

// Error patterns to detect
const ERROR_PATTERNS = [
  // Python
  /Traceback \(most recent call last\)/i,
  /^\s*File ".*", line \d+/m,
  /Error: .+/i,
  /Exception: .+/i,
  /TypeError: .+/i,
  /ValueError: .+/i,
  /ImportError: .+/i,
  /ModuleNotFoundError: .+/i,
  /AttributeError: .+/i,
  /KeyError: .+/i,
  /IndexError: .+/i,
  /SyntaxError: .+/i,

  // JavaScript/TypeScript
  /ReferenceError: .+/i,
  /TypeError: Cannot read propert/i,
  /TypeError: .+ is not a function/i,
  /SyntaxError: Unexpected token/i,
  /Cannot find module/i,
  /ENOENT: no such file/i,

  // General
  /FAILED/i,
  /FATAL/i,
  /panic:/i,
  /error\[E\d+\]/i, // Rust errors
  /error TS\d+/i, // TypeScript compiler errors
];

// Patterns to IGNORE (false positives)
const IGNORE_PATTERNS = [
  /error: 0/i, // "error: 0" means no errors
  /0 errors/i,
  /errors: 0/i,
  /Error pages/i, // Next.js pages
  /error\.tsx?/i, // File names
  /\.error\./i,
];

interface DetectedError {
  text: string;
  timestamp: Date;
  terminalName: string;
}

type ErrorCallback = (error: DetectedError) => void;

class TerminalWatcher {
  private static instance: TerminalWatcher;
  private isWatching: boolean = false;
  private errorCallbacks: ErrorCallback[] = [];
  private recentErrors: Map<string, Date> = new Map(); // Dedupe errors
  private disposables: vscode.Disposable[] = [];

  private constructor() {}

  public static getInstance(): TerminalWatcher {
    if (!TerminalWatcher.instance) {
      TerminalWatcher.instance = new TerminalWatcher();
    }
    return TerminalWatcher.instance;
  }

  /**
   * Start watching terminal output
   */
  public startWatching(context: vscode.ExtensionContext): void {
    if (this.isWatching) {
      logger.info("Terminal watcher already running");
      return;
    }

    logger.info("🔍 Starting Terminal Watcher...");

    /// Note: onDidWriteTerminalData is Proposed API (not available)
    // We use fallback method: Diagnostics + clipboard-based error detection
    logger.info(
      "Using diagnostics-based error detection (Terminal API not available)"
    );
    this.setupFallbackWatcher();

    // Also watch for active terminal changes
    const terminalChangeListener = vscode.window.onDidChangeActiveTerminal(
      (terminal) => {
        if (terminal) {
          logger.info(`Active terminal changed: ${terminal.name}`);
        }
      }
    );
    this.disposables.push(terminalChangeListener);

    // Watch for terminal close (cleanup)
    const terminalCloseListener = vscode.window.onDidCloseTerminal(
      (terminal) => {
        logger.info(`Terminal closed: ${terminal.name}`);
      }
    );
    this.disposables.push(terminalCloseListener);

    // Add to extension subscriptions
    context.subscriptions.push(...this.disposables);

    this.isWatching = true;
    logger.info("✅ Terminal Watcher started");
  }

  /**
   * Fallback watcher using diagnostic changes
   */
  private setupFallbackWatcher(): void {
    // Watch VS Code diagnostics (Problems panel)
    const diagnosticListener = vscode.languages.onDidChangeDiagnostics(
      (event) => {
        for (const uri of event.uris) {
          const diagnostics = vscode.languages.getDiagnostics(uri);
          const errors = diagnostics.filter(
            (d) => d.severity === vscode.DiagnosticSeverity.Error
          );

          if (errors.length > 0) {
            const errorText = errors
              .map((e) => `${e.message} (line ${e.range.start.line + 1})`)
              .join("\n");

            this.handleDetectedError({
              text: errorText,
              timestamp: new Date(),
              terminalName: "Diagnostics",
            });
          }
        }
      }
    );
    this.disposables.push(diagnosticListener);
  }

  /**
   * Process terminal output data
   */
  private processTerminalData(terminalName: string, data: string): void {
    // Skip if data is too short
    if (data.length < 10) return;

    // Check ignore patterns first
    for (const pattern of IGNORE_PATTERNS) {
      if (pattern.test(data)) {
        return;
      }
    }

    // Check error patterns
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.test(data)) {
        // Extract relevant error portion (up to 500 chars around match)
        const match = data.match(pattern);
        if (match) {
          const errorText = this.extractErrorContext(data, match.index || 0);

          // Dedupe: don't report same error within 5 seconds
          const errorKey = this.getErrorKey(errorText);
          const lastSeen = this.recentErrors.get(errorKey);
          if (lastSeen && Date.now() - lastSeen.getTime() < 5000) {
            return;
          }
          this.recentErrors.set(errorKey, new Date());

          // Clean old entries
          this.cleanupRecentErrors();

          this.handleDetectedError({
            text: errorText,
            timestamp: new Date(),
            terminalName,
          });
        }
        break; // Only report first match
      }
    }
  }

  /**
   * Extract error context around match
   */
  private extractErrorContext(data: string, matchIndex: number): string {
    const contextBefore = 100;
    const contextAfter = 400;

    const start = Math.max(0, matchIndex - contextBefore);
    const end = Math.min(data.length, matchIndex + contextAfter);

    let extracted = data.substring(start, end).trim();

    // Clean ANSI escape codes
    extracted = extracted.replace(/\x1b\[[0-9;]*m/g, "");

    // Clean control characters
    extracted = extracted.replace(/[\x00-\x09\x0B-\x1F]/g, "");

    return extracted;
  }

  /**
   * Generate key for deduplication
   */
  private getErrorKey(errorText: string): string {
    // Use first 100 chars as key
    return errorText.substring(0, 100).toLowerCase().replace(/\s+/g, " ");
  }

  /**
   * Cleanup old error entries
   */
  private cleanupRecentErrors(): void {
    const now = Date.now();
    for (const [key, date] of this.recentErrors.entries()) {
      if (now - date.getTime() > 30000) {
        // 30 seconds
        this.recentErrors.delete(key);
      }
    }
  }

  /**
   * Handle detected error
   */
  private handleDetectedError(error: DetectedError): void {
    logger.info(
      `🔴 Error detected in terminal "${
        error.terminalName
      }": ${error.text.substring(0, 100)}...`
    );

    // Notify all registered callbacks
    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch (e) {
        logger.error("Error in error callback", e as Error);
      }
    }
  }

  /**
   * Register callback for error detection
   */
  public onErrorDetected(callback: ErrorCallback): vscode.Disposable {
    this.errorCallbacks.push(callback);

    return new vscode.Disposable(() => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    });
  }

  /**
   * Stop watching
   */
  public stopWatching(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.isWatching = false;
    logger.info("Terminal Watcher stopped");
  }

  /**
   * Check if watching
   */
  public isActive(): boolean {
    return this.isWatching;
  }
}

export default TerminalWatcher;
export { DetectedError };
