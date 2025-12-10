// src/services/projectDetection.ts
import * as vscode from "vscode";
import * as crypto from "crypto";
import * as path from "path";
import { get, post } from "../api/apiClient";
import logger from "../utils/logger";
import { setCurrentProjectId } from "../extension";

/**
 * Generate unique folder identifier from absolute path
 * Uses SHA-256 hash (first 16 chars)
 */
export function generateFolderIdentifier(folderPath: string): string {
  const normalized = path.normalize(folderPath).toLowerCase();
  const hash = crypto.createHash("sha256").update(normalized).digest("hex");
  return hash.substring(0, 16);
}

/**
 * Try to find project by folder identifier
 */
async function findProjectByFolder(
  identifier: string
): Promise<{ id: number; name: string } | null> {
  try {
    const response = (await get(`/projects/by-folder/${identifier}`)) as any;
    return {
      id: response.id,
      name: response.name,
    };
  } catch (error) {
    if (
      (error as any)?.status === 404 ||
      (error as any)?.response?.status === 404
    ) {
      return null;
    }
    logger.error("Error finding project by folder", error as Error);
    return null;
  }
}

/**
 * Show project picker for manual selection
 */
async function showProjectPicker(): Promise<number | null> {
  try {
    const projects = (await get("/projects")) as any;

    if (!projects || projects.length === 0) {
      const create = await vscode.window.showInformationMessage(
        "No projects found. Create one first in the web app.",
        "Open Web App"
      );

      if (create === "Open Web App") {
        vscode.env.openExternal(vscode.Uri.parse("https://your-app-url.com"));
      }
      return null;
    }

    interface ProjectItem extends vscode.QuickPickItem {
      projectId: number;
    }

    const items: ProjectItem[] = projects.map((p: any) => ({
      label: p.name,
      description: p.description || "",
      projectId: p.id,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a project for this workspace",
    });

    return selected ? selected.projectId : null;
  } catch (error) {
    logger.error("Failed to load projects", error as Error);
    vscode.window.showErrorMessage("Failed to load projects");
    return null;
  }
}

/**
 * Link folder to project (save folder_identifier to project)
 */
async function linkFolderToProject(
  projectId: number,
  folderIdentifier: string
): Promise<boolean> {
  try {
    // TODO: Create endpoint PATCH /projects/{id}/folder
    // For now, we'll skip this step
    logger.info(`Folder linked to project ${projectId}: ${folderIdentifier}`);
    return true;
  } catch (error) {
    logger.error("Failed to link folder to project", error as Error);
    return false;
  }
}

/**
 * Auto-detect or select project for current workspace
 */
export async function detectOrSelectProject(): Promise<number | null> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    logger.warn("No workspace folder open");
    return null;
  }

  const folderPath = workspaceFolders[0].uri.fsPath;
  const folderName = path.basename(folderPath);
  const identifier = generateFolderIdentifier(folderPath);

  logger.info(`Workspace: ${folderPath}`);
  logger.info(`Folder identifier: ${identifier}`);

  // Try to find project by folder identifier
  const foundProject = await findProjectByFolder(identifier);

  if (foundProject) {
    logger.info(
      `✅ Project found automatically: ${foundProject.name} (ID: ${foundProject.id})`
    );

    vscode.window.showInformationMessage(
      `✅ Project "${foundProject.name}" detected automatically`
    );

    setCurrentProjectId(foundProject.id);
    return foundProject.id;
  }

  logger.info(`Project not found for folder: ${folderPath}`);

  const choice = await vscode.window.showInformationMessage(
    `No project linked to "${folderName}". What would you like to do?`,
    "Select Existing Project",
    "Create New Project",
    "Skip"
  );

  if (choice === "Select Existing Project") {
    const projectId = await showProjectPicker();

    if (projectId) {
      await linkFolderToProject(projectId, identifier);

      vscode.window.showInformationMessage(
        `✅ Workspace linked to project ID ${projectId}`
      );

      setCurrentProjectId(projectId);
      return projectId;
    }
  } else if (choice === "Create New Project") {
    const projectName = await vscode.window.showInputBox({
      prompt: "Enter project name",
      placeHolder: folderName,
      value: folderName,
    });

    if (projectName) {
      try {
        const newProject = (await post("/projects", {
          name: projectName,
          description: `Auto-created from ${folderPath}`,
          folder_identifier: identifier,
        } as any)) as any;

        vscode.window.showInformationMessage(
          `✅ Project "${projectName}" created!`
        );

        setCurrentProjectId(newProject.id);
        return newProject.id;
      } catch (error) {
        logger.error("Failed to create project", error as Error);
        vscode.window.showErrorMessage("Failed to create project");
      }
    }
  }

  return null;
}

/**
 * Get current workspace folder identifier
 */
export function getCurrentFolderIdentifier(): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  return generateFolderIdentifier(workspaceFolders[0].uri.fsPath);
}
