/**
 * Error Classifier
 * Analyzes error text and classifies type + severity
 */

import {
  DetectedError,
  ErrorClassification,
  ErrorType,
  ErrorSeverity,
  ErrorPattern,
} from "../../types";

// ============================================
// ERROR PATTERNS
// ============================================

const ERROR_PATTERNS: ErrorPattern[] = [
  // TypeScript Type Errors (SIMPLE - can auto-fix)
  {
    pattern: /Type '(.+)' is not assignable to type '(.+)'/i,
    type: "type_error",
    severity: "simple",
    confidence: 0.9,
  },
  {
    pattern: /Property '(.+)' does not exist on type '(.+)'/i,
    type: "type_error",
    severity: "simple",
    confidence: 0.85,
  },
  {
    pattern: /Argument of type '(.+)' is not assignable/i,
    type: "type_error",
    severity: "simple",
    confidence: 0.85,
  },

  // Import Errors (SIMPLE - can auto-fix)
  {
    pattern: /Cannot find module '(.+)'/i,
    type: "import_error",
    severity: "simple",
    confidence: 0.9,
  },
  {
    pattern: /Module '"(.+)"' has no exported member '(.+)'/i,
    type: "import_error",
    severity: "simple",
    confidence: 0.85,
  },
  {
    pattern: /ImportError: No module named '(.+)'/i,
    type: "import_error",
    severity: "simple",
    confidence: 0.9,
  },
  {
    pattern: /ModuleNotFoundError: No module named '(.+)'/i,
    type: "import_error",
    severity: "simple",
    confidence: 0.9,
  },

  // Null/Undefined Errors (SIMPLE - can auto-fix)
  {
    pattern: /Cannot read propert(y|ies) .+ of undefined/i,
    type: "null_error",
    severity: "simple",
    confidence: 0.85,
  },
  {
    pattern: /Cannot read propert(y|ies) .+ of null/i,
    type: "null_error",
    severity: "simple",
    confidence: 0.85,
  },
  {
    pattern: /'(.+)' is possibly 'undefined'/i,
    type: "null_error",
    severity: "simple",
    confidence: 0.9,
  },
  {
    pattern: /'(.+)' is possibly 'null'/i,
    type: "null_error",
    severity: "simple",
    confidence: 0.9,
  },

  // Reference Errors (SIMPLE)
  {
    pattern: /ReferenceError: (.+) is not defined/i,
    type: "reference_error",
    severity: "simple",
    confidence: 0.85,
  },
  {
    pattern: /Cannot find name '(.+)'/i,
    type: "reference_error",
    severity: "simple",
    confidence: 0.85,
  },

  // Syntax Errors (COMPLEX - needs user review)
  {
    pattern: /SyntaxError: Unexpected token/i,
    type: "syntax_error",
    severity: "complex",
    confidence: 0.7,
  },
  {
    pattern: /SyntaxError: (.+)/i,
    type: "syntax_error",
    severity: "complex",
    confidence: 0.7,
  },

  // Runtime Errors (COMPLEX)
  {
    pattern: /TypeError: (.+) is not a function/i,
    type: "runtime_error",
    severity: "complex",
    confidence: 0.7,
  },
  {
    pattern: /Traceback \(most recent call last\)/i,
    type: "runtime_error",
    severity: "complex",
    confidence: 0.6,
  },
];

// ============================================
// CLASSIFIER CLASS
// ============================================

class ErrorClassifier {
  /**
   * Classify an error based on its text
   */
  public classify(error: DetectedError): ErrorClassification {
    const text = error.text;

    // Try to match against patterns
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.pattern.test(text)) {
        return {
          type: pattern.type,
          severity: pattern.severity,
          confidence: pattern.confidence,
          suggestedAction: this.getSuggestedAction(
            pattern.severity,
            pattern.confidence
          ),
          description: this.getDescription(pattern.type, text),
        };
      }
    }

    // Unknown error
    return {
      type: "unknown",
      severity: "complex",
      confidence: 0.3,
      suggestedAction: "show_notification",
      description: "Unknown error type - requires manual review",
    };
  }

  /**
   * Determine suggested action based on severity and confidence
   */
  private getSuggestedAction(
    severity: ErrorSeverity,
    confidence: number
  ): "auto_fix" | "show_notification" | "ignore" {
    if (severity === "simple" && confidence >= 0.8) {
      return "auto_fix";
    }
    if (confidence >= 0.5) {
      return "show_notification";
    }
    return "ignore";
  }

  /**
   * Generate human-readable description
   */
  private getDescription(type: ErrorType, errorText: string): string {
    const descriptions: Record<ErrorType, string> = {
      type_error: "Type mismatch error - incorrect type assignment",
      import_error: "Import/module error - missing or incorrect import",
      syntax_error: "Syntax error - code structure problem",
      reference_error: "Reference error - undefined variable or function",
      null_error: "Null/undefined error - accessing property of null",
      runtime_error: "Runtime error - error during execution",
      unknown: "Unknown error type",
    };

    return descriptions[type] || "Unknown error";
  }

  /**
   * Check if error should be auto-fixed
   */
  public shouldAutoFix(classification: ErrorClassification): boolean {
    return (
      classification.suggestedAction === "auto_fix" &&
      classification.confidence >= 0.8 &&
      classification.severity === "simple"
    );
  }

  /**
   * Extract file path and line from error text
   */
  public extractLocation(
    errorText: string
  ): { filePath: string | null; line: number | null } {
    // TypeScript/JavaScript: file.ts(10,5)
    const tsMatch = errorText.match(/([^\s]+\.[tj]sx?)\((\d+),\d+\)/);
    if (tsMatch) {
      return { filePath: tsMatch[1], line: parseInt(tsMatch[2]) };
    }

    // TypeScript: file.ts:10:5
    const tsMatch2 = errorText.match(/([^\s]+\.[tj]sx?):(\d+):\d+/);
    if (tsMatch2) {
      return { filePath: tsMatch2[1], line: parseInt(tsMatch2[2]) };
    }

    // Python: File "path.py", line 10
    const pyMatch = errorText.match(/File "([^"]+)", line (\d+)/);
    if (pyMatch) {
      return { filePath: pyMatch[1], line: parseInt(pyMatch[2]) };
    }

    // Generic: (line 10)
    const lineMatch = errorText.match(/line (\d+)/i);
    if (lineMatch) {
      return { filePath: null, line: parseInt(lineMatch[1]) };
    }

    return { filePath: null, line: null };
  }
}

// Export singleton instance
export const errorClassifier = new ErrorClassifier();
export default ErrorClassifier;
