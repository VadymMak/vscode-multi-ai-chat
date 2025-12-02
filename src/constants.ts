import { Config } from "./types";

// Define application constants
export const API_BASE_URL: string = "https://api.example.com";
export const DEFAULT_MODELS: string[] = ["gpt-3", "gpt-4"];

// Define environment-specific configurations
export const ENV_CONFIG: Record<string, Config> = {
  development: {
    apiUrl: `${API_BASE_URL}/dev`,
    loggingEnabled: true,
  },
  production: {
    apiUrl: `${API_BASE_URL}/prod`,
    loggingEnabled: false,
  },
};

// Export a function to get the current environment configuration
export const getConfig = (env: string): Config => {
  return ENV_CONFIG[env] || ENV_CONFIG["development"];
};
