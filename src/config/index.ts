import { Config } from "../types/index";
import { API_BASE_URL, DEFAULT_MODELS } from "../constants";

// Environment configuration interface
interface EnvironmentConfig {
  apiUrl: string;
  defaultModels: string[];
  environment: "development" | "production" | "test";
}

// Function to load environment configuration
const loadEnvironmentConfig = (): EnvironmentConfig => {
  // Determine the environment
  const environment =
    (process.env.NODE_ENV as "development" | "production" | "test") ||
    "development";

  // Load configuration based on the environment
  switch (environment) {
    case "development":
      return {
        apiUrl: `${API_BASE_URL}/dev`,
        defaultModels: DEFAULT_MODELS,
        environment,
      };
    case "production":
      return {
        apiUrl: `${API_BASE_URL}/prod`,
        defaultModels: DEFAULT_MODELS,
        environment,
      };
    case "test":
      return {
        apiUrl: `${API_BASE_URL}/test`,
        defaultModels: DEFAULT_MODELS,
        environment,
      };
    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
};

// Export the configuration as a singleton
const config: EnvironmentConfig = loadEnvironmentConfig();

export default config;
