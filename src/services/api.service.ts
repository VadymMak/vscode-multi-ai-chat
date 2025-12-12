// webview-ui/src/services/api.service.ts

/**
 * API Service - STEP 1
 *
 * This is the ONLY file that makes HTTP requests to backend.
 * Components should NEVER import axios or make direct calls.
 *
 * Architecture:
 *   Component → Hook → Zustand Store → API Service → Backend
 *
 * Usage:
 *   import { apiService } from '../services/api.service';
 *   const projects = await apiService.getProjects();
 */

import axios, { AxiosInstance, AxiosError } from "axios";

class APIService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = "https://railway-production-8c0e.up.railway.app";

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Add auth token to requests
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("authToken");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Handle response errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem("authToken");
          window.dispatchEvent(new CustomEvent("auth:logout"));
        }
        return Promise.reject(this.formatError(error));
      }
    );
  }

  private formatError(error: AxiosError): Error {
    if (error.response) {
      const message =
        (error.response.data as any)?.detail ||
        (error.response.data as any)?.message ||
        error.message;
      return new Error(message);
    }
    return new Error(error.message || "Network error");
  }

  // ==================== AUTH ====================

  async login(username: string, password: string) {
    const response = await this.client.post("/auth/login", {
      username,
      password,
    });
    return response.data;
  }

  async register(username: string, password: string, email: string) {
    const response = await this.client.post("/auth/register", {
      username,
      password,
      email,
    });
    return response.data;
  }

  async validateToken() {
    const response = await this.client.get("/auth/validate");
    return response.data;
  }

  // ==================== PROJECTS ====================

  async getProjects() {
    const response = await this.client.get("/projects");
    return response.data;
  }

  async getProject(projectId: number) {
    const response = await this.client.get(`/projects/${projectId}`);
    return response.data;
  }

  async createProject(data: {
    name: string;
    description?: string;
    git_url?: string;
  }) {
    const response = await this.client.post("/projects", data);
    return response.data;
  }

  async updateProject(projectId: number, data: any) {
    const response = await this.client.put(`/projects/${projectId}`, data);
    return response.data;
  }

  async deleteProject(projectId: number) {
    const response = await this.client.delete(`/projects/${projectId}`);
    return response.data;
  }

  async getIndexStatus(projectId: number) {
    const response = await this.client.get(
      `/projects/${projectId}/index-status`
    );
    return response.data;
  }

  // ==================== FILES ====================

  async searchFiles(projectId: number, query: string, limit: number = 5) {
    const response = await this.client.post("/vscode/search-files", {
      project_id: projectId,
      query,
      limit,
    });
    return response.data;
  }

  async explainFile(projectId: number, filePath: string, fileContent: string) {
    const response = await this.client.post("/vscode/explain-file", {
      project_id: projectId,
      file_path: filePath,
      file_content: fileContent,
    });
    return response.data;
  }

  // ==================== AI CHAT ====================

  async sendMessage(projectId: number, message: string, roleId?: number) {
    const response = await this.client.post("/ask", {
      project_id: projectId,
      message,
      role_id: roleId,
    });
    return response.data;
  }

  // ==================== TOKEN HELPERS ====================

  setToken(token: string) {
    localStorage.setItem("authToken", token);
  }

  getToken(): string | null {
    return localStorage.getItem("authToken");
  }

  clearToken() {
    localStorage.removeItem("authToken");
  }
}

export const apiService = new APIService();
