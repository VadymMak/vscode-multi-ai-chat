import { useAuthStore } from "../store/authStore";
import { useProjectStore } from "../store/projectStore";
import { AuthResponse, CheckAuthResponse, Project } from "../types";
import { vscodeAPI } from "../utils/vscodeApi";

// ✅ NEW: Context mode type
type ContextMode = "selection" | "file" | "project";

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
    }, 180000);
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

// ✅ UPDATED: Added contextMode parameter
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
  mode?: "chat" | "edit" | "create",
  contextMode?: ContextMode // ✅ NEW: Context mode parameter
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

    // ✅ Log mode and contextMode
    console.log("🎯 [apiService] Mode:", mode || "chat");
    console.log("🔍 [apiService] Context Mode:", contextMode || "file");

    // ✅ Build request payload with contextMode
    const requestPayload: any = {
      message: message,
      project_id: projectId,
      filePath: fileContext?.filePath || null,
      role_id: roleId,
      chat_session_id: chatSessionId,
      fileContent: fileContext?.fileContent || null,
      selectedText: fileContext?.selectedText || null,
      mode: mode || "chat",
      context_mode: contextMode || "file", // ✅ NEW: Send context mode to backend
    };

    // ✅ If project mode, signal backend to use Smart Context
    if (contextMode === "project") {
      requestPayload.use_smart_context = true;
      console.log("🧠 [apiService] Smart Context enabled (project mode)");
    }

    const response = await apiRequest("POST", "/vscode/chat", requestPayload);

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
// ==================== AGENTIC WORKFLOW ====================

// Types for Agentic Workflow
export interface TaskStep {
  step_num: number;
  action: "create" | "edit" | "delete" | "command";
  file_path: string | null;
  description: string;
  dependencies: string[];
  estimated_complexity: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  result?: any;
  error?: string;
}

export interface TaskPlan {
  plan_id: string;
  task: string;
  steps: TaskStep[];
  total_steps: number;
  estimated_time: string;
  tokens_used: number;
}

export interface ExecuteStepResult {
  success: boolean;
  step: TaskStep;
  result?: {
    action: string;
    file_path?: string;
    new_content?: string;
    original_content?: string;
    message?: string;
    command?: string;
  };
  plan_completed: boolean;
}

/**
 * Plan a complex task - AI breaks it into steps
 */
export const planTask = async (
  task: string,
  fileContext?: {
    filePath?: string;
    fileContent?: string;
  }
): Promise<TaskPlan> => {
  try {
    console.log("📋 [apiService] Planning task:", task);

    const projectId = useProjectStore.getState().selectedProjectId;

    if (!projectId) {
      throw new Error("No project selected");
    }

    const response = await apiRequest("POST", "/vscode/plan-task", {
      project_id: projectId,
      task: task,
      file_path: fileContext?.filePath || null,
      file_content: fileContext?.fileContent || null,
    });

    console.log("✅ [apiService] Plan received:", response);

    const planData = response.data || response;

    return {
      plan_id: planData.plan_id,
      task: planData.task,
      steps: planData.steps,
      total_steps: planData.total_steps,
      estimated_time: planData.estimated_time,
      tokens_used: planData.tokens_used,
    };
  } catch (error) {
    console.error("❌ [apiService] Plan task error:", error);
    throw error;
  }
};

/**
 * Execute a single step from the plan
 */
export const executeStep = async (
  planId: string,
  stepNum: number,
  fileContent?: string
): Promise<ExecuteStepResult> => {
  try {
    console.log(`⚡ [apiService] Executing step ${stepNum} of plan ${planId}`);

    const response = await apiRequest("POST", "/vscode/execute-step", {
      plan_id: planId,
      step_num: stepNum,
      file_content: fileContent || null,
    });

    console.log("✅ [apiService] Step executed:", response);

    const resultData = response.data || response;

    return {
      success: resultData.success,
      step: resultData.step,
      result: resultData.result,
      plan_completed: resultData.plan_completed,
    };
  } catch (error) {
    console.error("❌ [apiService] Execute step error:", error);
    throw error;
  }
};

/**
 * Skip a step in the plan
 */
export const skipStep = async (
  planId: string,
  stepNum: number
): Promise<{ success: boolean; plan_completed: boolean }> => {
  try {
    console.log(`⏭️ [apiService] Skipping step ${stepNum} of plan ${planId}`);

    const response = await apiRequest("POST", "/vscode/skip-step", {
      plan_id: planId,
      step_num: stepNum,
    });

    console.log("✅ [apiService] Step skipped:", response);

    const resultData = response.data || response;

    return {
      success: resultData.success,
      plan_completed: resultData.plan_completed,
    };
  } catch (error) {
    console.error("❌ [apiService] Skip step error:", error);
    throw error;
  }
};

/**
 * Cancel entire plan
 */
export const cancelPlan = async (
  planId: string
): Promise<{ success: boolean }> => {
  try {
    console.log(`🛑 [apiService] Cancelling plan ${planId}`);

    const response = await apiRequest(
      "POST",
      `/vscode/cancel-plan/${planId}`,
      {}
    );

    console.log("✅ [apiService] Plan cancelled:", response);

    const resultData = response.data || response;

    return {
      success: resultData.success,
    };
  } catch (error) {
    console.error("❌ [apiService] Cancel plan error:", error);
    throw error;
  }
};

/**
 * Get plan status
 */
export const getTaskPlan = async (
  planId: string
): Promise<TaskPlan & { status: string; completed_steps: number }> => {
  try {
    console.log(`📊 [apiService] Getting plan ${planId}`);

    const response = await apiRequest("GET", `/vscode/task-plan/${planId}`);

    console.log("✅ [apiService] Plan status:", response);

    const planData = response.data || response;

    return planData;
  } catch (error) {
    console.error("❌ [apiService] Get plan error:", error);
    throw error;
  }
};
