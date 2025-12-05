import { useAuthStore } from "../store/authStore";
import { AuthResponse, CheckAuthResponse } from "../types";
import { vscodeAPI } from "../utils/vscodeApi";

// ✅ Simple API Client using Extension as proxy
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

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests[requestId]) {
        delete pendingRequests[requestId];
        reject(new Error("Request timeout"));
      }
    }, 30000);
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

    // ✅ Save token to Zustand store
    useAuthStore.getState().setToken(response.access_token);
    console.log("💾 Token saved to Zustand store");

    return {
      user: response.user,
      token: response.access_token,
    };
  },

  logout: async (): Promise<{ success: boolean }> => {
    // ✅ Clear token from Zustand store
    useAuthStore.getState().clearToken();
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
};

// ✅ sendMessage function for ChatView
export const sendMessage = async (
  message: string,
  fileContext?: any
): Promise<{ message: string }> => {
  try {
    console.log("📤 [apiService] Sending message:", message);
    console.log("📁 [apiService] File context:", fileContext);

    const response = await apiRequest("POST", "/ask", {
      query: message,
      project_id: 1,
      role_id: 1,
      file_path: fileContext?.filePath || null,
      file_content: fileContext?.fileContent || null,
      selected_text: fileContext?.selectedText || null,
    });

    console.log("✅ [apiService] Response received:", response);

    return {
      message: response.answer || response.response || "No response from AI",
    };
  } catch (error) {
    console.error("❌ [apiService] Send message error:", error);

    if (error instanceof Error && error.message.includes("401")) {
      useAuthStore.getState().clearToken();
    }

    throw error;
  }
};
