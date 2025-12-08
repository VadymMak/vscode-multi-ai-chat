// src/constants.ts - ИСПРАВЛЕННЫЙ

import { AppConfig, LogLevel } from "./types/index"; // ✅ Правильный импорт

export const APP_NAME = "VSCode Multi AI Chat";
export const APP_VERSION = "1.0.0";

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
  GUEST = "guest",
}

// ❌ УДАЛИ! LogLevel уже в types/index.ts
// export enum LogLevel { ... }

export enum Environment {
  DEVELOPMENT = "development",
  PRODUCTION = "production",
  TEST = "test",
}

export const DEFAULT_CONFIG: AppConfig = {
  environment: Environment.DEVELOPMENT,
  logLevel: LogLevel.INFO,
  apiBaseUrl: "https://multi-ai-chat-production.up.railway.app/api",
  maxRetries: 3,
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Network error, please try again later.",
  AUTHENTICATION_FAILED:
    "Authentication failed, please check your credentials.",
  UNKNOWN_ERROR: "An unknown error occurred.",
};

export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: "Successfully logged in.",
  DATA_FETCH_SUCCESS: "Data fetched successfully.",
};

export const TIMEOUTS = {
  API_REQUEST: 5000,
  USER_INACTIVITY: 300000,
};

export const ENVIRONMENT = Environment; // Alias для Environment enum

export const DEFAULT_SETTINGS = {
  API_BASE_URL: "https://multi-ai-chat-production.up.railway.app/api",
  LOG_LEVEL: LogLevel.INFO,
};
