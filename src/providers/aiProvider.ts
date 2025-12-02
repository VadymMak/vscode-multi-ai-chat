// src/providers/aiProvider.ts

import { Config, ILogger } from "../types/index";
import { API_BASE_URL } from "../constants";
import apiClient from "../api/apiClient";
import logger from "../utils/logger";

// Interface for AI Provider Service
export interface IAIProvider {
  getAvailableModels(): Promise<string[]>;
  sendMessageToAI(message: string, model: string): Promise<string>;
  sendQuery(
    query: string,
    projectId: string,
    roleId: string,
    provider: string
  ): Promise<any>;
}

// Response interfaces
interface ModelsResponse {
  models: string[];
}

interface ChatResponse {
  response: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Define the AIProvider class which will handle interactions with the AI service
class AIProviderService implements IAIProvider {
  private config: Config;
  private logger: ILogger;

  constructor(config: Config, loggerInstance: ILogger) {
    this.config = config;
    this.logger = loggerInstance;
  }

  // Method to fetch AI models available for use
  async getAvailableModels(): Promise<string[]> {
    try {
      // apiClient.get already returns data, not response object
      const data = await apiClient.get<ModelsResponse>(`/models`);
      this.logger.info("Fetched available models successfully.");
      return data.models;
    } catch (error) {
      this.logger.error("Error fetching available models:", error);
      throw new Error("Failed to fetch available models");
    }
  }

  // Method to send a message to the AI and receive a response
  async sendMessageToAI(message: string, model: string): Promise<string> {
    try {
      // apiClient.post already returns data, not response object
      const data = await apiClient.post<ChatResponse>(`/chat`, {
        message,
        model,
      });
      this.logger.info("Message sent to AI successfully.");
      return data.response;
    } catch (error) {
      this.logger.error("Error sending message to AI:", error);
      throw new Error("Failed to send message to AI");
    }
  }

  // Method to send query to Multi-AI Chat backend
  async sendQuery(
    query: string,
    projectId: string,
    roleId: string,
    provider: string = "openai"
  ): Promise<any> {
    try {
      const data = await apiClient.post<any>(`/ask`, {
        query,
        project_id: projectId,
        role_id: roleId,
        provider,
      });
      this.logger.info("Query sent successfully.");
      return data;
    } catch (error) {
      this.logger.error("Error sending query:", error);
      throw new Error("Failed to send query");
    }
  }
}

// Export singleton instance
const aiProviderService = new AIProviderService(
  {
    apiBaseUrl: API_BASE_URL,
    defaultModel: "gpt-4o",
    apiTimeout: 30000,
  },
  logger
);

export default aiProviderService;
export { AIProviderService };
