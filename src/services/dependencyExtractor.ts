/**
 * DependencyExtractor Service
 * Extracts import/export dependencies from source files
 * Fills file_dependencies table for graph-based search
 */

export interface ImportInfo {
  sourceFile: string; // файл который импортирует
  targetModule: string; // что импортируется (raw)
  targetFile: string | null; // resolved путь к файлу (если найден)
  importType: "import" | "require" | "dynamic" | "from";
  importsWhat: string[]; // конкретные exports: ['useState', 'useEffect']
  line: number; // номер строки
}

export interface ExportInfo {
  name: string;
  type: "named" | "default" | "all";
  line: number;
}

export interface FileAnalysis {
  filePath: string;
  language: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
}

class DependencyExtractor {
  /**
   * Analyze file and extract all dependencies
   */
  analyzeFile(content: string, filePath: string): FileAnalysis {
    const language = this.detectLanguage(filePath);

    let imports: ImportInfo[] = [];
    let exports: ExportInfo[] = [];

    if (
      [
        "typescript",
        "javascript",
        "typescriptreact",
        "javascriptreact",
      ].includes(language)
    ) {
      imports = this.extractJsImports(content, filePath);
      exports = this.extractJsExports(content);
    } else if (language === "python") {
      imports = this.extractPythonImports(content, filePath);
      exports = this.extractPythonExports(content);
    }

    return {
      filePath,
      language,
      imports,
      exports,
    };
  }

  /**
   * Extract imports from TypeScript/JavaScript files
   */
  private extractJsImports(content: string, sourceFile: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();

      // Skip comments
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*")
      ) {
        return;
      }

      // Pattern 1: import { X, Y } from './path'
      const namedImport = trimmed.match(
        /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/
      );
      if (namedImport) {
        const importsWhat = namedImport[1]
          .split(",")
          .map((s) => s.trim().split(" as ")[0].trim())
          .filter(Boolean);
        imports.push({
          sourceFile,
          targetModule: namedImport[2],
          targetFile: null,
          importType: "import",
          importsWhat,
          line: lineNum,
        });
        return;
      }

      // Pattern 2: import X from './path'
      const defaultImport = trimmed.match(
        /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/
      );
      if (defaultImport) {
        imports.push({
          sourceFile,
          targetModule: defaultImport[2],
          targetFile: null,
          importType: "import",
          importsWhat: [defaultImport[1]],
          line: lineNum,
        });
        return;
      }

      // Pattern 3: import * as X from './path'
      const namespaceImport = trimmed.match(
        /^import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/
      );
      if (namespaceImport) {
        imports.push({
          sourceFile,
          targetModule: namespaceImport[2],
          targetFile: null,
          importType: "import",
          importsWhat: ["*"],
          line: lineNum,
        });
        return;
      }

      // Pattern 4: import './path' (side effect)
      const sideEffectImport = trimmed.match(/^import\s+['"]([^'"]+)['"]/);
      if (sideEffectImport) {
        imports.push({
          sourceFile,
          targetModule: sideEffectImport[1],
          targetFile: null,
          importType: "import",
          importsWhat: [],
          line: lineNum,
        });
        return;
      }

      // Pattern 5: const X = require('./path')
      const requireImport = trimmed.match(
        /(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/
      );
      if (requireImport) {
        const importsWhat = requireImport[1]
          ? requireImport[1]
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [requireImport[2]];
        imports.push({
          sourceFile,
          targetModule: requireImport[3],
          targetFile: null,
          importType: "require",
          importsWhat,
          line: lineNum,
        });
        return;
      }

      // Pattern 6: import('./path') - dynamic import
      const dynamicImport = trimmed.match(
        /import\s*\(\s*['"]([^'"]+)['"]\s*\)/
      );
      if (dynamicImport) {
        imports.push({
          sourceFile,
          targetModule: dynamicImport[1],
          targetFile: null,
          importType: "dynamic",
          importsWhat: [],
          line: lineNum,
        });
        return;
      }

      // Pattern 7: export { X } from './path' (re-export)
      const reExport = trimmed.match(
        /^export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/
      );
      if (reExport) {
        const importsWhat = reExport[1]
          .split(",")
          .map((s) => s.trim().split(" as ")[0].trim())
          .filter(Boolean);
        imports.push({
          sourceFile,
          targetModule: reExport[2],
          targetFile: null,
          importType: "from",
          importsWhat,
          line: lineNum,
        });
        return;
      }

      // Pattern 8: export * from './path'
      const reExportAll = trimmed.match(
        /^export\s+\*\s+from\s+['"]([^'"]+)['"]/
      );
      if (reExportAll) {
        imports.push({
          sourceFile,
          targetModule: reExportAll[1],
          targetFile: null,
          importType: "from",
          importsWhat: ["*"],
          line: lineNum,
        });
        return;
      }
    });

    return imports;
  }

  /**
   * Extract exports from TypeScript/JavaScript files
   */
  private extractJsExports(content: string): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();

      // export default
      if (trimmed.match(/^export\s+default\s+/)) {
        exports.push({ name: "default", type: "default", line: lineNum });
        return;
      }

      // export const/let/var/function/class X
      const namedExport = trimmed.match(
        /^export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/
      );
      if (namedExport) {
        exports.push({ name: namedExport[1], type: "named", line: lineNum });
        return;
      }

      // export { X, Y, Z }
      const bracketExport = trimmed.match(/^export\s+\{([^}]+)\}(?!\s+from)/);
      if (bracketExport) {
        const names = bracketExport[1]
          .split(",")
          .map((s) => {
            const parts = s.trim().split(" as ");
            return parts[parts.length - 1].trim();
          })
          .filter(Boolean);
        names.forEach((name) => {
          exports.push({ name, type: "named", line: lineNum });
        });
        return;
      }
    });

    return exports;
  }

  /**
   * Extract imports from Python files
   */
  private extractPythonImports(
    content: string,
    sourceFile: string
  ): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith("#")) {
        return;
      }

      // Pattern 1: from module import X, Y
      const fromImport = trimmed.match(/^from\s+(\S+)\s+import\s+(.+)/);
      if (fromImport) {
        const importsWhat = fromImport[2]
          .split(",")
          .map((s) => s.trim().split(" as ")[0].trim())
          .filter(Boolean);
        imports.push({
          sourceFile,
          targetModule: fromImport[1],
          targetFile: null,
          importType: "from",
          importsWhat,
          line: lineNum,
        });
        return;
      }

      // Pattern 2: import module
      const simpleImport = trimmed.match(/^import\s+(\S+)(?:\s+as\s+\w+)?$/);
      if (simpleImport) {
        imports.push({
          sourceFile,
          targetModule: simpleImport[1],
          targetFile: null,
          importType: "import",
          importsWhat: [simpleImport[1].split(".").pop() || simpleImport[1]],
          line: lineNum,
        });
        return;
      }
    });

    return imports;
  }

  /**
   * Extract exports from Python files (functions and classes at module level)
   */
  private extractPythonExports(content: string): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Only top-level definitions (not indented)
      if (line.startsWith(" ") || line.startsWith("\t")) {
        return;
      }

      // def function_name(
      const funcDef = line.match(/^def\s+(\w+)\s*\(/);
      if (funcDef && !funcDef[1].startsWith("_")) {
        exports.push({ name: funcDef[1], type: "named", line: lineNum });
        return;
      }

      // class ClassName
      const classDef = line.match(/^class\s+(\w+)/);
      if (classDef && !classDef[1].startsWith("_")) {
        exports.push({ name: classDef[1], type: "named", line: lineNum });
        return;
      }
    });

    return exports;
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";

    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescriptreact",
      js: "javascript",
      jsx: "javascriptreact",
      mjs: "javascript",
      cjs: "javascript",
      py: "python",
      pyw: "python",
    };

    return langMap[ext] || "unknown";
  }

  /**
   * Check if import is a relative path (local file)
   */
  isRelativeImport(targetModule: string): boolean {
    return targetModule.startsWith("./") || targetModule.startsWith("../");
  }

  /**
   * Check if import is a node module (npm package)
   */
  isNodeModule(targetModule: string): boolean {
    return (
      !this.isRelativeImport(targetModule) && !targetModule.startsWith("@/")
    );
  }
}

export const dependencyExtractor = new DependencyExtractor();
export default dependencyExtractor;
