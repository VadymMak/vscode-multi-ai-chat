// src/api/apiClient.ts - ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ

import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import config from "../config";
import AuthManager from "../auth/authManager";
import { APIError } from "../errors";
import logger from "../utils/logger";
import {
  APIResponse,
  DataRequest,
  FileDependency,
  SaveDependenciesResponse,
} from "../types/index";

// Create an Axios instance with default configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: config.apiTimeout || 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add authentication token
// Request interceptor to add authentication token
apiClient.interceptors.request.use(
  async (
    config: InternalAxiosRequestConfig
  ): Promise<InternalAxiosRequestConfig> => {
    try {
      const token = await AuthManager.getInstance().getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      logger.error("Error in request interceptor", error as Error);
      throw new APIError("Failed to attach authentication token", 500);
    }
  },
  (error) => {
    logger.error("Request error", error as Error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle responses and errors
apiClient.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    return response;
  },
  (error) => {
    if (error.response) {
      logger.error("API response error", error.response);
      throw new APIError(
        `API Error: ${error.response.status} - ${error.response.statusText}`,
        error.response.status
      );
    } else if (error.request) {
      logger.error("No response received", error.request);
      throw new APIError("No response received from API", 503);
    } else {
      logger.error("Error in setting up request", error);
      throw new APIError("Error in setting up API request", 500);
    }
  }
);

// Function to make a GET request
export const get = async (
  url: string,
  params?: DataRequest
): Promise<APIResponse> => {
  try {
    const response = await apiClient.get<APIResponse>(url, { params });
    return response.data;
  } catch (error) {
    logger.error("GET request failed", error as Error);
    throw error;
  }
};

// Function to make a POST request
export const post = async (
  url: string,
  data: DataRequest
): Promise<APIResponse> => {
  try {
    const response = await apiClient.post<APIResponse>(url, data);
    return response.data;
  } catch (error) {
    logger.error("POST request failed", error as Error);
    throw error;
  }
};

// Function to make a PUT request
export const put = async (
  url: string,
  data: DataRequest
): Promise<APIResponse> => {
  try {
    const response = await apiClient.put<APIResponse>(url, data);
    return response.data;
  } catch (error) {
    logger.error("PUT request failed", error as Error);
    throw error;
  }
};

// Function to make a DELETE request
export const remove = async (url: string): Promise<APIResponse> => {
  try {
    const response = await apiClient.delete<APIResponse>(url);
    return response.data;
  } catch (error) {
    logger.error("DELETE request failed", error as Error);
    throw error;
  }
};

// ============================================
// Dependencies API
// ============================================

export const saveDependencies = async (
  projectId: number,
  dependencies: FileDependency[]
): Promise<SaveDependenciesResponse> => {
  try {
    console.log("📍 API Base URL:", apiClient.defaults.baseURL);
    console.log(
      "📍 Full URL will be:",
      apiClient.defaults.baseURL + "/api/vscode/save-dependencies"
    );
    console.log("📍 Dependencies count:", dependencies.length);
    const response = await apiClient.post<SaveDependenciesResponse>(
      "/vscode/save-dependencies",
      {
        project_id: projectId,
        dependencies: dependencies.map((dep) => ({
          source_file: dep.sourceFile,
          target_file: dep.targetFile,
          dependency_type: dep.dependencyType,
          imports_what: dep.importsWhat,
        })),
      }
    );
    return response.data;
  } catch (error) {
    logger.error("Save dependencies failed", error as Error);
    throw error;
  }
};

/**
 * Get dependencies for a specific file
 */
export const getFileDependencies = async (
  projectId: number,
  filePath: string
): Promise<FileDependency[]> => {
  try {
    const response = await apiClient.get<{ dependencies: FileDependency[] }>(
      `/api/vscode/file-dependencies/${projectId}`,
      { params: { file_path: filePath } } as any
    );
    return response.data.dependencies || [];
  } catch (error) {
    logger.error("Get file dependencies failed", error as Error);
    throw error;
  }
};

export default apiClient;
