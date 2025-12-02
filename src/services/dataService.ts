// src/services/dataService.ts

// REMOVE these two lines:
// import { APIResponse, DataRequest, IAIProvider, ILogger } from "../types/index";
// import { APIResponse, DataRequest, IAIProvider, ILogger, Message } from '../types/index';

// REPLACE with this ONE line:
import {
  APIResponse,
  DataRequest,
  IAIProvider,
  ILogger,
  Message,
} from "../types/index";
import { API_BASE_URL } from "../constants";
import apiClient from "../api/apiClient";
import aiProviderService from "../providers/aiProvider";
import logger from "../utils/logger";

// DataService class to handle data operations
class DataService {
  private aiProvider: IAIProvider;
  private logger: ILogger;

  constructor(aiProvider: IAIProvider, loggerInstance: ILogger) {
    this.aiProvider = aiProvider;
    this.logger = loggerInstance;
  }

  // Fetch data from the API
  async fetchData(request: DataRequest): Promise<APIResponse> {
    try {
      this.logger.info("Fetching data from API", request);
      const data = await apiClient.get<APIResponse>("/data", {
        params: request,
      });
      this.logger.info("Data fetched successfully", data);
      return data;
    } catch (error) {
      this.logger.error("Error fetching data", error);
      throw new Error("Failed to fetch data");
    }
  }

  // Get messages
  async getMessages(): Promise<Message[]> {
    try {
      this.logger.info("Fetching messages from API");
      const data = await apiClient.get<{ messages: Message[] }>("/messages");
      this.logger.info("Messages fetched successfully");
      return data.messages;
    } catch (error) {
      this.logger.error("Error fetching messages", error);
      throw new Error("Failed to fetch messages");
    }
  }

  // Send message
  async sendMessage(content: string): Promise<Message> {
    try {
      this.logger.info("Sending message to API", { content });
      const data = await apiClient.post<Message>("/messages", { content });
      this.logger.info("Message sent successfully", data);
      return data;
    } catch (error) {
      this.logger.error("Error sending message", error);
      throw new Error("Failed to send message");
    }
  }

  // Process data using AI provider
  async processData(input: string): Promise<string> {
    try {
      this.logger.info("Processing data with AI provider", input);
      const result = await this.aiProvider.sendMessageToAI(input, "gpt-4o");
      this.logger.info("Data processed successfully", result);
      return result;
    } catch (error) {
      this.logger.error("Error processing data", error);
      throw new Error("Failed to process data");
    }
  }

  // Send query to Multi-AI Chat backend
  async sendQuery(
    query: string,
    projectId: string,
    roleId: string
  ): Promise<any> {
    try {
      this.logger.info("Sending query to backend", {
        query,
        projectId,
        roleId,
      });
      const data = await apiClient.post<any>("/ask", {
        query,
        project_id: projectId,
        role_id: roleId,
      });
      this.logger.info("Query sent successfully", data);
      return data;
    } catch (error) {
      this.logger.error("Error sending query", error);
      throw new Error("Failed to send query");
    }
  }
}

// Create singleton instance
const dataService = new DataService(aiProviderService, logger);

export default dataService;
export { DataService };
