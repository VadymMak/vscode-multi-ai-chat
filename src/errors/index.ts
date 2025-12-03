// src/errors/index.ts - FIXED VERSION ✅

// ============================================
// CUSTOM ERROR CLASSES
// ============================================

/**
 * Base application error class
 * Extends built-in Error with additional functionality
 */
export class AppError extends Error {
  public code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = "AppError";
    this.code = code;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Authentication-related errors
 */
export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication failed") {
    super(message, 401);
    this.name = "AuthenticationError";
  }
}

/**
 * Authorization-related errors (user logged in but no permission)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403);
    this.name = "AuthorizationError";
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

/**
 * Validation errors (bad input data)
 */
export class ValidationError extends AppError {
  constructor(message: string = "Validation failed") {
    super(message, 400);
    this.name = "ValidationError";
  }
}

/**
 * API/Network errors
 */
export class APIError extends AppError {
  constructor(message: string = "API request failed", code: number = 500) {
    super(message, code);
    this.name = "APIError";
  }
}

/**
 * Configuration errors
 */
export class ConfigError extends AppError {
  constructor(message: string = "Configuration error") {
    super(message, 500);
    this.name = "ConfigError";
  }
}

// ============================================
// ERROR HANDLING UTILITIES
// ============================================

/**
 * Handle errors gracefully with proper logging
 * @param error - The error to handle
 * @param context - Optional context for debugging
 */
export function handleError(error: unknown, context?: string): void {
  const prefix = context ? `[${context}] ` : "";

  if (error instanceof AppError) {
    console.error(`${prefix}${error.name} [${error.code}]: ${error.message}`);
    if (error.stack) {
      console.error(`Stack: ${error.stack}`);
    }
  } else if (error instanceof Error) {
    console.error(`${prefix}Error: ${error.message}`);
    if (error.stack) {
      console.error(`Stack: ${error.stack}`);
    }
  } else {
    console.error(`${prefix}Unknown error occurred:`, error);
  }
}

/**
 * Check if an error is an instance of AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Get error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error occurred";
}

/**
 * Get error code from error (returns 500 for unknown errors)
 */
export function getErrorCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.code;
  }
  return 500;
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Type guard for authentication errors
 */
export function isAuthenticationError(
  error: unknown
): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

/**
 * Type guard for validation errors
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard for API errors
 */
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}
