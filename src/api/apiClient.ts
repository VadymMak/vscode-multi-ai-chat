// src/api/apiClient.ts

import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from "axios";
import { API_BASE_URL } from "../constants";
import { Config, ILogger } from "../types/index";
import logger from "../utils/logger";

// Define the API client class
class ApiClient {
  private axiosInstance: AxiosInstance;
  private logger: ILogger;

  constructor(config: Config, loggerInstance: ILogger) {
    this.logger = loggerInstance;

    // Initialize axios instance with base URL and interceptors
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: config.apiTimeout || 30000,
    });

    this.initializeInterceptors();
  }

  // Set up request and response interceptors
  private initializeInterceptors() {
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Token is already set in headers, just log the request
        this.logger.debug(
          `API Request: ${config.method?.toUpperCase()} ${config.url}`
        );
        return config;
      },
      (error: any) => {
        this.logger.error("Request error:", error);
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        this.logger.debug(
          `API Response: ${response.status} ${response.config.url}`
        );
        return response;
      },
      (error: any) => {
        this.logger.error("Response error:", error);

        // Handle specific error codes (e.g., unauthorized)
        if (error.response?.status === 401) {
          this.logger.warn("Unauthorized access - token may be invalid");
        }

        return Promise.reject(error);
      }
    );
  }

  // Generic GET request method
  public async get<T>(url: string, config?: any): Promise<T> {
    try {
      const response = await this.axiosInstance.get<T>(url, config);
      return response.data;
    } catch (error) {
      this.logger.error("GET request failed:", error);
      throw error;
    }
  }

  // Generic POST request method
  public async post<T>(url: string, data?: any): Promise<T> {
    try {
      const response = await this.axiosInstance.post<T>(url, data);
      return response.data;
    } catch (error) {
      this.logger.error("POST request failed:", error);
      throw error;
    }
  }

  // Generic PUT request method
  public async put<T>(url: string, data?: any): Promise<T> {
    try {
      const response = await this.axiosInstance.put<T>(url, data);
      return response.data;
    } catch (error) {
      this.logger.error("PUT request failed:", error);
      throw error;
    }
  }

  // Generic DELETE request method
  public async delete<T>(url: string): Promise<T> {
    try {
      const response = await this.axiosInstance.delete<T>(url);
      return response.data;
    } catch (error) {
      this.logger.error("DELETE request failed:", error);
      throw error;
    }
  }

  // ✅ ADD THESE TWO METHODS - This is what's missing!

  // Set authorization token
  public setAuthToken(token: string): void {
    this.axiosInstance.defaults.headers.common[
      "Authorization"
    ] = `Bearer ${token}`;
    this.logger.info("Auth token set");
  }

  // Clear authorization token
  public clearAuthToken(): void {
    delete this.axiosInstance.defaults.headers.common["Authorization"];
    this.logger.info("Auth token cleared");
  }
}

// Export singleton instance
const config: Config = {
  apiBaseUrl: API_BASE_URL,
  defaultModel: "gpt-4o",
  apiTimeout: 30000,
};

const apiClient = new ApiClient(config, logger);

export default apiClient;
export { ApiClient };
