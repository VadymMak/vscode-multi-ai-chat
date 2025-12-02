// src/controllers/appController.ts

import { User, Message } from "../types/index";
import logger from "../utils/logger";
import apiClient from "../api/apiClient";
import aiProviderService from "../providers/aiProvider";
import dataService from "../services/dataService";
import config from "../config/index";

// AppController class to manage application logic
class AppController {
  private logger = logger;
  private config = config;
  private apiClient = apiClient;
  private aiProvider = aiProviderService;
  private dataService = dataService;

  constructor() {
    // All services are already initialized as singletons
    this.logger.info("AppController created");
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info("Initializing application...");
      // TODO: Add initialization logic here
      // For example: check auth status, load initial data
      this.logger.info("Application initialized successfully.");
    } catch (error) {
      this.logger.error("Failed to initialize application:", error);
      throw error;
    }
  }

  async login(email: string, password: string): Promise<User> {
    try {
      this.logger.info(`Attempting to log in user: ${email}`);

      // Call login endpoint
      const data = await apiClient.post<{ token: string; user: User }>(
        "/auth/login",
        {
          email,
          password,
        }
      );

      // Set auth token
      apiClient.setAuthToken(data.token);

      this.logger.info("User logged in successfully:", data.user);
      return data.user;
    } catch (error) {
      this.logger.error("Login failed:", error);
      throw error;
    }
  }

  async fetchMessages(): Promise<Message[]> {
    try {
      this.logger.info("Fetching messages...");
      const messages = await this.dataService.getMessages();
      this.logger.info("Messages fetched successfully:", messages.length);
      return messages;
    } catch (error) {
      this.logger.error("Failed to fetch messages:", error);
      throw error;
    }
  }

  async sendMessage(content: string): Promise<Message> {
    try {
      this.logger.info("Sending message...");
      const message = await this.dataService.sendMessage(content);
      this.logger.info("Message sent successfully:", message.id);
      return message;
    } catch (error) {
      this.logger.error("Failed to send message:", error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      this.logger.info("Logging out...");

      // Clear auth token
      apiClient.clearAuthToken();

      this.logger.info("Logged out successfully.");
    } catch (error) {
      this.logger.error("Logout failed:", error);
      throw error;
    }
  }

  // Send query to AI
  async sendAIQuery(
    query: string,
    projectId: string,
    roleId: string
  ): Promise<any> {
    try {
      this.logger.info("Sending AI query...", { query, projectId, roleId });
      const result = await this.dataService.sendQuery(query, projectId, roleId);
      this.logger.info("AI query completed successfully");
      return result;
    } catch (error) {
      this.logger.error("Failed to send AI query:", error);
      throw error;
    }
  }
}

// Export singleton instance
const appController = new AppController();

export default appController;
export { AppController };
