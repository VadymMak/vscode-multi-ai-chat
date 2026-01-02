/**
 * Fix Generator
 * Uses AI to generate code fixes for errors
 */

import * as vscode from "vscode";
import { post } from "../../api/apiClient";
import logger from "../../utils/logger";
import {
  DetectedError,
  ErrorClassification,
  GeneratedFix,
  FixType,
} from "../../types";

// ============================================
// AI RESPONSE INTERFACE
// ============================================

interface AIFixResponse {
  message: string;
  response_type?: string;
  new_content?: string;
  original_content?: string;
  diff?: string;
}

// ============================================
// FIX GENERATOR CLASS
// ============================================

class FixGenerator {
  /**
   * Generate fix using AI
   */
  public async generateFix(
    error: DetectedError,
    classification: ErrorClassification,
    projectId: number,
    fileContent: string,
    filePath: string
  ): Promise<GeneratedFix | null> {
    try {
      logger.info(`🔧 Generating fix for ${classification.type} error...`);

      // Get context around error line
      const errorLine = error.line || 1;
      const contextLines = this.getContextLines(fileContent, errorLine, 10);

      // Build prompt for AI
      const prompt = this.buildPrompt(
        error,
        classification,
        contextLines,
        filePath
      );

      // Call AI
      const response = ((await post("/vscode/chat", {
        message: prompt,
        project_id: projectId,
        filePath: filePath,
        fileContent: fileContent.substring(0, 10000),
      } as any)) as unknown) as AIFixResponse;

      // DEBUG: Log AI response
      logger.info(
        `🤖 AI Response: ${JSON.stringify(response).substring(0, 500)}`
      );

      if (!response.message) {
        logger.warn("AI returned empty response");
        return null;
      }

      // Parse AI response
      // Check if AI returned structured edit response
      if (response.response_type === "edit" && response.new_content) {
        logger.info("✅ AI returned structured edit response");
        return {
          originalCode: response.original_content || contextLines.code,
          fixedCode: response.new_content,
          explanation: response.message || "AI-generated fix",
          filePath: filePath,
          lineStart: 1,
          lineEnd: fileContent.split("\n").length,
          confidence: 0.9,
          fixType: "replace_block" as const,
        };
      }

      // Fallback: Parse AI response from message
      const fix = this.parseAIResponse(
        response.message,
        filePath,
        errorLine,
        contextLines
      );

      return fix;
    } catch (err) {
      logger.error("Fix generation failed", err as Error);
      return null;
    }
  }

  /**
   * Build prompt for AI
   */
  private buildPrompt(
    error: DetectedError,
    classification: ErrorClassification,
    contextLines: { code: string; startLine: number; endLine: number },
    filePath: string
  ): string {
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    const language = this.detectLanguage(filePath);

    return `Fix this ${
      classification.type
    } error. Return ONLY the fixed code block, no explanations.

**Error:** ${error.text}

**Error Type:** ${classification.type} (${classification.description})

**File:** ${fileName}
**Line:** ${error.line || "unknown"}

**Code context (lines ${contextLines.startLine}-${contextLines.endLine}):**
\`\`\`${language}
${contextLines.code}
\`\`\`

**Instructions:**
1. Return ONLY the fixed code that replaces the context above
2. Keep the same indentation
3. Fix ONLY the error, don't change other logic
4. Wrap your fix in \`\`\`${language} code block

**Fixed code:**`;
  }

  /**
   * Get lines around error
   */
  private getContextLines(
    content: string,
    errorLine: number,
    contextSize: number
  ): { code: string; startLine: number; endLine: number } {
    const lines = content.split("\n");
    const startLine = Math.max(1, errorLine - contextSize);
    const endLine = Math.min(lines.length, errorLine + contextSize);

    const contextLines = lines.slice(startLine - 1, endLine);

    return {
      code: contextLines.join("\n"),
      startLine,
      endLine,
    };
  }

  /**
   * Parse AI response to extract fix
   */
  private parseAIResponse(
    aiResponse: string,
    filePath: string,
    errorLine: number,
    context: { code: string; startLine: number; endLine: number }
  ): GeneratedFix | null {
    // Try multiple patterns to extract code
    let fixedCode: string | null = null;

    const codeBlockMatch = aiResponse.match(/```[\w]*\n([\s\S]*?)```/);
    if (codeBlockMatch !== null && codeBlockMatch[1] !== undefined) {
      fixedCode = codeBlockMatch[1].trim();
    }

    // Pattern 2: Code block without language specifier
    const simpleBlockMatch = aiResponse.match(/```\n?([\s\S]*?)```/);
    if (simpleBlockMatch && simpleBlockMatch[1]) {
      fixedCode = simpleBlockMatch[1].trim();
    }

    // Pattern 3: If response looks like code (no markdown)
    if (!fixedCode) {
      const lines = aiResponse.trim().split("\n");
      const looksLikeCode = lines.some(
        (line) =>
          line.includes("const ") ||
          line.includes("let ") ||
          line.includes("function ") ||
          line.includes("import ") ||
          line.includes("export ") ||
          line.includes("class ") ||
          line.includes("def ") ||
          line.includes("return ")
      );

      if (looksLikeCode) {
        // Remove any explanation text before/after code
        const codeLines = lines.filter(
          (line) =>
            !line.startsWith("Here") &&
            !line.startsWith("The ") &&
            !line.startsWith("This ") &&
            !line.startsWith("I ") &&
            !line.startsWith("You ") &&
            line.trim() !== ""
        );
        if (codeLines.length > 0) {
          fixedCode = codeLines.join("\n").trim();
        }
      }
    }

    if (!fixedCode) {
      logger.warn("Could not extract code from AI response");
      logger.debug(`AI Response was: ${aiResponse.substring(0, 200)}...`);
      return null;
    }

    fixedCode = codeBlockMatch![1].trim();

    if (!fixedCode) {
      logger.warn("Extracted code block is empty");
      return null;
    }

    // Determine fix type
    const fixType = this.determineFixType(context.code, fixedCode);

    // Extract explanation (text before code block)
    const explanation = aiResponse.split("```")[0].trim() || "AI-generated fix";

    return {
      originalCode: context.code,
      fixedCode: fixedCode,
      explanation: explanation,
      filePath: filePath,
      lineStart: context.startLine,
      lineEnd: context.endLine,
      confidence: 0.8,
      fixType: fixType,
    };
  }

  /**
   * Determine type of fix
   */
  private determineFixType(original: string, fixed: string): FixType {
    const originalLines = original.split("\n").length;
    const fixedLines = fixed.split("\n").length;

    // Check for import addition
    if (
      fixed.includes("import ") &&
      !original.includes(fixed.match(/import .+/)?.[0] || "")
    ) {
      return "add_import";
    }

    // Check for null check addition
    if (
      (fixed.includes("?.") && !original.includes("?.")) ||
      (fixed.includes("?? ") && !original.includes("?? ")) ||
      (fixed.includes("|| ") && !original.includes("|| "))
    ) {
      return "add_null_check";
    }

    // Check for type change
    if (fixed.match(/: \w+/) && original.match(/: \w+/)) {
      const originalType = original.match(/: (\w+)/)?.[1];
      const fixedType = fixed.match(/: (\w+)/)?.[1];
      if (originalType !== fixedType) {
        return "change_type";
      }
    }

    // Line count based
    if (fixedLines > originalLines) {
      return "insert_line";
    }
    if (fixedLines < originalLines) {
      return "delete_line";
    }
    if (originalLines === 1) {
      return "replace_line";
    }

    return "replace_block";
  }

  /**
   * Detect language from file path
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      py: "python",
      rs: "rust",
      go: "go",
      java: "java",
      cs: "csharp",
      cpp: "cpp",
      c: "c",
      rb: "ruby",
      php: "php",
    };
    return langMap[ext] || ext;
  }
}

// Export singleton
export const fixGenerator = new FixGenerator();
export default FixGenerator;
