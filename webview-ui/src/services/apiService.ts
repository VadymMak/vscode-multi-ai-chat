import { useAuthStore } from "../store/authStore";
import { useProjectStore } from "../store/projectStore";
import { AuthResponse, CheckAuthResponse, Project } from "../types";
import { vscodeAPI } from "../utils/vscodeApi";

// Simple API Client using Extension as proxy
let requestCounter = 0;
const pendingRequests: Record<string, any> = {};

// Listen for API responses from extension
(globalThis as any).addEventListener("message", (event: any) => {
  const message = event.data;

  if (message.command === "apiResponse" && message.requestId) {
    const pending = pendingRequests[message.requestId];
    if (pending) {
      if (message.response.success) {
        pending.resolve(message.response.data);
      } else {
        pending.reject(
          new Error(message.response.error || "API request failed")
        );
      }
      delete pendingRequests[message.requestId];
    }
  }
});

async function apiRequest(
  method: string,
  endpoint: string,
  data?: any
): Promise<any> {
  const token = useAuthStore.getState().token;
  const requestId = `req_${++requestCounter}_${Date.now()}`;

  console.log(`🔄 [ApiClient] ${method} ${endpoint}`, { hasToken: !!token });

  return new Promise((resolve, reject) => {
    pendingRequests[requestId] = { resolve, reject };

    // Send request to extension
    vscodeAPI.postMessage({
      command: "apiRequest",
      requestId,
      data: {
        method,
        endpoint,
        data,
        token,
      },
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      if (pendingRequests[requestId]) {
        delete pendingRequests[requestId];
        reject(new Error("Request timeout"));
      }
    }, 60000);
  });
}

export const apiService = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    console.log("🔧 apiService.login called");

    const response = await apiRequest("POST", "/auth/login", {
      username,
      password,
    });

    console.log("🔧 apiService.login response:", response);

    // Save token to Zustand store
    useAuthStore.getState().setToken(response.access_token);
    console.log("💾 Token saved to Zustand store");

    return {
      user: response.user,
      token: response.access_token,
    };
  },

  logout: async (): Promise<{ success: boolean }> => {
    // Clear token from Zustand store
    useAuthStore.getState().clearToken();
    // Clear project selection
    useProjectStore.getState().clearSelection();
    return { success: true };
  },

  checkAuth: async (): Promise<CheckAuthResponse> => {
    try {
      const response = await apiRequest("GET", "/auth/me");
      return {
        isAuthenticated: true,
        user: response,
      };
    } catch (error) {
      return {
        isAuthenticated: false,
        user: null,
      };
    }
  },

  getProjects: async (): Promise<Project[]> => {
    console.log("📂 [apiService] Fetching projects...");

    try {
      const response = await apiRequest("GET", "/projects");
      console.log("📂 [apiService] Projects received:", response);

      // Handle both array and object with projects key
      const projects = Array.isArray(response)
        ? response
        : response.projects || [];

      // Save to Zustand store
      useProjectStore.getState().setProjects(projects);

      return projects;
    } catch (error) {
      console.error("❌ [apiService] Get projects error:", error);
      throw error;
    }
  },

  getProjectIndexStatus: async (
    projectId: number
  ): Promise<{
    project_id: number;
    indexed_at: string | null;
    files_count: number;
    status: "not_indexed" | "indexed" | "stale";
  }> => {
    console.log(
      `📊 [apiService] Fetching index status for project ${projectId}...`
    );

    try {
      const response = await apiRequest(
        "GET",
        `/projects/${projectId}/index-status`
      );
      console.log("📊 [apiService] Index status received:", response);
      return response;
    } catch (error) {
      console.error("❌ [apiService] Get index status error:", error);
      throw error;
    }
  },

  getRoles: async (): Promise<any[]> => {
    console.log(`📋 [apiService] Fetching roles...`);

    try {
      const response = await apiRequest("GET", "/roles");
      console.log("📋 [apiService] Roles received:", response);

      const roles = Array.isArray(response) ? response : response.roles || [];

      return roles;
    } catch (error) {
      console.error("❌ [apiService] Get roles error:", error);
      // Return default role if endpoint fails
      const defaultRoles = [
        { id: 1, name: "Assistant", description: "Default AI assistant" },
      ];

      return defaultRoles;
    }
  },
};

export const sendMessage = async (
  message: string,
  fileContext?: {
    filePath?: string;
    fileName?: string;
    language?: string;
    lineCount?: number;
    fileContent?: string;
    selectedText?: string;
  }
): Promise<{
  message: string;
  response_type?: "chat" | "edit" | "create";
  original_content?: string;
  new_content?: string;
  diff?: string;
  file_path?: string;
  tokens_used?: any;
}> => {
  try {
    console.log("📤 [apiService] Sending message:", message);

    // Get selected project
    const projectId = useProjectStore.getState().selectedProjectId;
    console.log("📂 [apiService] Project ID:", projectId);

    if (fileContext) {
      console.log("📎 [apiService] File context:", {
        filePath: fileContext.filePath,
        hasContent: !!fileContext.fileContent,
        hasSelection: !!fileContext.selectedText,
      });
    }

    // Include project_id in request
    const response = await apiRequest("POST", "/vscode/chat", {
      message: message,
      project_id: projectId,
      filePath: fileContext?.filePath || null,
      fileContent: fileContext?.fileContent || null,
      selectedText: fileContext?.selectedText || null,
    });

    console.log("✅ [apiService] Response received:", response);

    // ✅ NEW: Return full response with all fields
    return {
      message: response.message || "No response from AI",
      response_type: response.response_type || "chat",
      original_content: response.original_content,
      new_content: response.new_content,
      diff: response.diff,
      file_path: response.file_path,
      tokens_used: response.tokens_used,
    };
  } catch (error) {
    console.error("❌ [apiService] Send message error:", error);

    if (error instanceof Error && error.message.includes("401")) {
      useAuthStore.getState().clearToken();
    }

    throw error;
  }
};
