// src/providers/aiProvider.ts - ИСПРАВЛЕННЫЙ

import apiClient from "../api/apiClient"; // ✅ default
import logger from "../utils/logger"; // ✅ default
import { AIResponse, AIRequest } from "../types";
import { APIError } from "../errors"; // ✅ APIError, не AppError
import config from "../config"; // ✅ default

class AIProvider {
  // Методы для использования в appController
  async getAIResponse(prompt: string): Promise<string> {
    try {
      logger.info("Sending request to AI service");

      const request: AIRequest = { prompt };
      const response = await apiClient.post("/ai-endpoint", request);

      logger.info("Received response from AI service");
      return response.data?.response || "No response";
    } catch (error) {
      logger.error("Error communicating with AI service", error as Error);
      throw new APIError("Failed to communicate with AI service", 500);
    }
  }

  async sendRequest(request: AIRequest): Promise<AIResponse> {
    try {
      logger.info("Sending AI request");
      const response = await apiClient.post("/ai-endpoint", request);
      return response.data;
    } catch (error) {
      logger.error("AI service error", error as Error);
      throw new APIError("AI service error", 500);
    }
  }
}

// ✅ Экспортируй КЛАСС, не экземпляр!
export default AIProvider;
