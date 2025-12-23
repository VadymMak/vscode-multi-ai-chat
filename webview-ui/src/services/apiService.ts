import { useAuthStore } from "../store/authStore";
import { useProjectStore } from "../store/projectStore";
import { AuthResponse, CheckAuthResponse, Project } from "../types";
import { vscodeAPI } from "../utils/vscodeApi";

// Simple API Client using Extension as proxy
let requestCounter = 0;
const pendingRequests: Record<string, any> = {};

/// Listen for API responses from extension
(globalThis as any).addEventListener("message", (event: any) => {
  const message = event.data;

  if (message.command === "apiResponse" && message.requestId) {
    const pending = pendingRequests[message.requestId];
    if (pending) {
      console.log(`🔍 [ApiClient] RAW message from extension:`, {
        requestId: message.requestId,
        has_response: !!message.response,
        has_success: message.response?.success,
        has_data: !!message.response?.data,
        response_type_level1: message.response?.response_type,
        response_type_level2: message.response?.data?.response_type,
      });
      if (message.response) {
        // Check for errors (can be in 'error' or 'detail' field)
        if (message.response.error || message.response.detail) {
          const errorMsg = message.response.error || message.response.detail;
          console.error(`❌ [ApiClient] Request failed:`, errorMsg);
          pending.reject(new Error(errorMsg));
        } else {
          // ✅ Return entire response object (includes response_type, diff, etc.)
          console.log(`✅ [ApiClient] Request succeeded:`, message.response);
          pending.resolve(message.response);
        }
      } else {
        console.error(`❌ [ApiClient] Empty response`);
        pending.reject(new Error("Empty response from API"));
      }
      delete pendingRequests[message.requestId];
    }
  }
});

/**
 * ✅ SIMPLIFIED: No token management here!
 * Extension handles ALL token logic
 */
async function apiRequest(
  method: string,
  endpoint: string,
  data?: any
): Promise<any> {
  const requestId = `req_${++requestCounter}_${Date.now()}`;

  console.log(`🔄 [ApiClient] ${method} ${endpoint}`, { requestId });

  return new Promise((resolve, reject) => {
    pendingRequests[requestId] = { resolve, reject };

    // ✅ Send request to extension (NO TOKEN!)
    // Extension will add token from AuthManager
    vscodeAPI.postMessage({
      command: "apiRequest",
      requestId,
      data: {
        method,
        endpoint,
        data,
        // ❌ NO TOKEN HERE! Extension handles it!
      },
    });

    setTimeout(() => {
      if (pendingRequests[requestId]) {
        delete pendingRequests[requestId];
        reject(new Error("Request timeout"));
      }
    }, 60000);
  });
}

export const apiService = {
  /**
   * ✅ SIMPLIFIED: Just call API, Extension handles token
   */
  login: async (username: string, password: string): Promise<AuthResponse> => {
    console.log("🔧 apiService.login called");

    const response = await apiRequest("POST", "/auth/login", {
      username,
      password,
    });

    console.log("🔧 apiService.login response received");
    console.log("🔍 [DEBUG] Full response:", response);
    console.log("🔍 [DEBUG] response.user:", response.user);
    console.log("🔍 [DEBUG] response.access_token:", response.access_token);
    console.log("🔍 [DEBUG] response.data:", response.data);

    // ✅ FIX: Extract from response.data!
    const userData = response.data || response;

    useAuthStore.getState().setAuthenticated(true);
    useAuthStore.getState().setUser(userData.user);

    return {
      user: userData.user,
      token: userData.access_token,
    };
  },

  logout: async (): Promise<{ success: boolean }> => {
    console.log("🔓 apiService.logout called");

    // ✅ Tell extension to clear token
    vscodeAPI.postMessage({
      command: "logout",
    });

    // Clear UI state
    useAuthStore.getState().clearAuth();
    useProjectStore.getState().clearSelection();

    return { success: true };
  },

  checkAuth: async (): Promise<CheckAuthResponse> => {
    try {
      const response = await apiRequest("GET", "/auth/me");

      // ✅ Update UI state
      useAuthStore.getState().setAuthenticated(true);
      useAuthStore.getState().setUser(response);

      return {
        isAuthenticated: true,
        user: response,
      };
    } catch (error) {
      // Clear UI state if not authenticated
      useAuthStore.getState().clearAuth();
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

      // ✅ FIX: Extract from response.data (same pattern as login)
      const projectsData = response.data || response;
      const projects = Array.isArray(projectsData)
        ? projectsData
        : projectsData.projects || [];

      console.log("📂 [apiService] Extracted projects:", projects.length);

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

      // ✅ FIX: Extract from response.data (same pattern!)
      const statusData = response.data || response;
      console.log("📊 [apiService] Extracted status:", statusData);

      return statusData;
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
  },
  mode?: "chat" | "edit" | "create"
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

    const projectId = useProjectStore.getState().selectedProjectId;
    console.log("📂 [apiService] Project ID:", projectId);

    const roleId = 1; // или из store если есть
    const chatSessionId = null; // или из store если есть

    if (fileContext) {
      console.log("📎 [apiService] File context:", {
        filePath: fileContext.filePath,
        hasContent: !!fileContext.fileContent,
        hasSelection: !!fileContext.selectedText,
      });
    }

    // ✅ ДОБАВИТЬ лог mode
    console.log("🎯 [apiService] Mode:", mode || "chat");

    const response = await apiRequest("POST", "/vscode/chat", {
      message: message,
      project_id: projectId,
      filePath: fileContext?.filePath || null,
      role_id: roleId,
      chat_session_id: chatSessionId,
      fileContent: fileContext?.fileContent || null,
      selectedText: fileContext?.selectedText || null,
      mode: mode || "chat",
    });

    console.log("✅ [apiService] Response received:", response);

    // ✅ FIX: Extract from response.data (same pattern!)
    const responseData = response.data || response;
    console.log("✅ [apiService] Extracted response:", responseData);

    const formattedResponse = {
      message: responseData.message || "No response from AI",
      response_type: responseData.response_type || "chat",
      original_content: responseData.original_content,
      new_content: responseData.new_content,
      diff: responseData.diff,
      file_path: responseData.file_path,
      tokens_used: responseData.tokens_used,
    };

    console.log("📤 [apiService] Formatted response:", formattedResponse);

    return formattedResponse;
  } catch (error) {
    console.error("❌ [apiService] Send message error:", error);

    if (error instanceof Error && error.message.includes("401")) {
      // ✅ Clear UI state on 401
      useAuthStore.getState().clearAuth();
    }

    throw error;
  }
};
