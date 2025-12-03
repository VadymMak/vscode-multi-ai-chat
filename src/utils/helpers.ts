import logger from "./logger"; // ✅ default import
import { ValidationError } from "../errors";
// ❌ УДАЛИ: import { AppConstants } from "../constants";

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidUsername(username: string): boolean {
  // ✅ Константы напрямую:
  const MIN_USERNAME_LENGTH = 3;
  const MAX_USERNAME_LENGTH = 20;

  return (
    username.length >= MIN_USERNAME_LENGTH &&
    username.length <= MAX_USERNAME_LENGTH
  );
}

export function safeJsonParse<T>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.error("Failed to parse JSON string", error as Error); // ✅
    return null;
  }
}

export function handleError(error: Error): void {
  if (error instanceof ValidationError) {
    logger.warn("Validation error occurred:"); // ✅ удали второй аргумент
  } else {
    logger.error("An unexpected error occurred:", error); // ✅
  }
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): T {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  } as T;
}

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): T {
  let lastFunc: NodeJS.Timeout;
  let lastRan: number;
  return function executedFunction(...args: Parameters<T>) {
    if (!lastRan) {
      func(...args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func(...args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  } as T;
}
