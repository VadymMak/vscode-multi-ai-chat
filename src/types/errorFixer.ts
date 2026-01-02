/**
 * Error Fixer System - Type Definitions
 * Scalable architecture for auto-fixing errors
 */

// ============================================
// ERROR DETECTION
// ============================================

export interface DetectedError {
  text: string;
  filePath: string | null;
  line: number | null;
  source: "terminal" | "diagnostics" | "manual";
  timestamp: Date;
  sourceName: string;
}

// ============================================
// ERROR CLASSIFICATION
// ============================================

export type ErrorType =
  | "type_error"
  | "import_error"
  | "syntax_error"
  | "reference_error"
  | "null_error"
  | "runtime_error"
  | "unknown";

export type ErrorSeverity = "simple" | "complex";

export interface ErrorClassification {
  type: ErrorType;
  severity: ErrorSeverity;
  confidence: number;
  suggestedAction: "auto_fix" | "show_notification" | "ignore";
  description: string;
}

// ============================================
// FIX GENERATION
// ============================================

export type FixType =
  | "replace_line"
  | "replace_block"
  | "insert_line"
  | "delete_line"
  | "add_import"
  | "change_type"
  | "add_null_check"
  | "other";

export interface GeneratedFix {
  originalCode: string;
  fixedCode: string;
  explanation: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  confidence: number;
  fixType: FixType;
}

// ============================================
// FIX APPLICATION
// ============================================

export interface FixResult {
  success: boolean;
  applied: boolean;
  message: string;
  error?: string;
}

export interface FixOptions {
  autoApply: boolean;
  showDiff: boolean;
  showNotification: boolean;
}

// ============================================
// CONFIGURATION
// ============================================

export interface ErrorFixerConfig {
  autoFixSimpleErrors: boolean;
  autoFixMinConfidence: number;
  autoFixTypes: ErrorType[];
  showDetectionNotification: boolean;
  showFixNotification: boolean;
}

export const DEFAULT_ERROR_FIXER_CONFIG: ErrorFixerConfig = {
  autoFixSimpleErrors: true,
  autoFixMinConfidence: 0.8,
  autoFixTypes: ["type_error", "import_error", "null_error"],
  showDetectionNotification: true,
  showFixNotification: true,
};

// ============================================
// ERROR PATTERNS
// ============================================

export interface ErrorPattern {
  pattern: RegExp;
  type: ErrorType;
  severity: ErrorSeverity;
  confidence: number;
  extractInfo?: (
    match: RegExpMatchArray
  ) => {
    filePath?: string;
    line?: number;
  };
}
