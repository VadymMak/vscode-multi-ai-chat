import * as vscode from "vscode";

/**
 * Utility function to get a configuration value from the VS Code settings.
 * @param section The configuration section to retrieve.
 * @param key The specific key within the section.
 * @returns The configuration value or undefined if not found.
 */
export function getConfigValue<T>(section: string, key: string): T | undefined {
  const config = vscode.workspace.getConfiguration(section);
  return config.get<T>(key);
}

/**
 * Utility function to set a configuration value in the VS Code settings.
 * @param section The configuration section to modify.
 * @param key The specific key within the section.
 * @param value The value to set.
 * @returns A promise that resolves when the configuration has been updated.
 */
export async function setConfigValue(
  section: string,
  key: string,
  value: any
): Promise<void> {
  const config = vscode.workspace.getConfiguration(section);
  await config.update(key, value, vscode.ConfigurationTarget.Global);
}

/**
 * Utility function to show an information message to the user.
 * @param message The message to display.
 */
export function showInfoMessage(message: string): void {
  vscode.window.showInformationMessage(message);
}

/**
 * Utility function to show an error message to the user.
 * @param message The message to display.
 */
export function showErrorMessage(message: string): void {
  vscode.window.showErrorMessage(message);
}

/**
 * Utility function to check if a string is a valid JSON.
 * @param str The string to check.
 * @returns True if the string is valid JSON, otherwise false.
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Utility function to debounce a function call.
 * @param func The function to debounce.
 * @param wait The number of milliseconds to delay.
 * @returns A debounced version of the function.
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): T {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: Parameters<T>): void {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  } as T;
}
