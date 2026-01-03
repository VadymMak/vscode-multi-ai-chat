/**
 * Types for file dependencies system
 * Used for graph-based search in Brain Memory System
 */

/**
 * Dependency record to save to database
 */
export interface FileDependency {
  projectId: number;
  sourceFile: string; // файл который импортирует
  targetFile: string; // файл который импортируется
  dependencyType: "import" | "require" | "dynamic" | "from";
  importsWhat: string[]; // что именно импортируется
}

/**
 * Request to save dependencies to backend
 */
export interface SaveDependenciesRequest {
  projectId: number;
  dependencies: FileDependency[];
}

/**
 * Response from save dependencies endpoint
 */
export interface SaveDependenciesResponse {
  success: boolean;
  saved: number;
  errors?: string[];
}

/**
 * Request to get dependencies for a file
 */
export interface GetDependenciesRequest {
  projectId: number;
  filePath: string;
}

/**
 * File with its dependencies (for graph traversal)
 */
export interface FileWithDependencies {
  filePath: string;
  imports: FileDependency[]; // files this file imports
  importedBy: FileDependency[]; // files that import this file
}
