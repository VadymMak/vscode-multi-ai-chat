// src/services/dataService.ts - ИСПРАВЛЕННЫЙ

import logger from "../utils/logger"; // ✅
import apiClient from "../api/apiClient"; // ✅
import AuthManager from "../auth/authManager"; // ✅
import AIProvider from "../providers/aiProvider"; // ✅
import { APIError } from "../errors"; // ✅
import { APIResponse, DataRequest } from "../types"; // ✅

interface IDataService {
  fetchData: (endpoint: string) => Promise<any[]>;
  saveData: (data: any) => Promise<void>;
  initialize: () => Promise<void>;
}

class DataService implements IDataService {
  private static instance: DataService;
  private authManager: AuthManager;
  private aiProvider: AIProvider;

  private constructor() {
    this.authManager = AuthManager.getInstance();
    this.aiProvider = new AIProvider();
  }

  public static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  async initialize(): Promise<void> {
    logger.info("DataService initialized");
  }

  async fetchData(endpoint: string): Promise<any[]> {
    try {
      logger.info(`Fetching data from: ${endpoint}`);
      const response = await apiClient.get(endpoint);
      return response.data || [];
    } catch (error) {
      logger.error(`Error fetching data`, error as Error);
      throw new APIError("Error fetching data", 500);
    }
  }

  async saveData(data: any): Promise<void> {
    try {
      logger.info(`Saving data`);
      await apiClient.post("/data", data);
      logger.info("Data saved successfully");
    } catch (error) {
      logger.error(`Error saving data`, error as Error);
      throw new APIError("Error saving data", 500);
    }
  }
}

export default DataService;
