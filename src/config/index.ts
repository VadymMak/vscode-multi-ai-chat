import { AppConfig } from "../types/index";
import { ENVIRONMENT, DEFAULT_SETTINGS } from "../constants";

// Configuration settings for the application
// Configuration settings for the application
const config: AppConfig = {
  environment: process.env.NODE_ENV || ENVIRONMENT.DEVELOPMENT,
  apiBaseUrl: process.env.API_BASE_URL || DEFAULT_SETTINGS.API_BASE_URL,
  logLevel: DEFAULT_SETTINGS.LOG_LEVEL, // ✅ ПРОСТО используй из настроек
  maxRetries: 3,
  featureFlags: {
    enableNewFeature: process.env.ENABLE_NEW_FEATURE === "true",
  },
};

// Function to get a configuration value by key
export function getConfigValue<T extends keyof AppConfig>(
  key: T
): AppConfig[T] {
  return config[key];
}

// Function to update a configuration value
export function setConfigValue<T extends keyof AppConfig>(
  key: T,
  value: AppConfig[T]
): void {
  config[key] = value;
}

// Export the configuration object
export default config;
