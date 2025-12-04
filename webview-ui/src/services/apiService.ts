import axios, { AxiosInstance } from "axios";

// ✅ Railway backend URL
const API_BASE_URL = "https://multi-ai-chat-production.up.railway.app";

// Create Axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Store token
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  console.log("🔧 setAuthToken called:", token ? "Token set" : "Token cleared");
}

// ✅ Request interceptor to add token
apiClient.interceptors.request.use(
  (config) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
      console.log("🔧 Request interceptor: Added token to", config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ✅ API Service object
export const apiService = {
  // Login method
  login: async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append("grant_type", "password");
    formData.append("username", username);
    formData.append("password", password);

    const response = await apiClient.post("/api/auth/login", formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    console.log("🔧 apiService.login response:", response.data);

    const result = {
      user: response.data.user,
      token: response.data.access_token,
    };

    // Save token
    setAuthToken(result.token);

    console.log("🔧 apiService.login returning:", result);

    return result;
  },

  // Logout method
  logout: async () => {
    // Clear token
    setAuthToken(null);
    return { success: true };
  },

  // Check auth status
  checkAuth: async () => {
    try {
      const response = await apiClient.get("/api/auth/me");
      return {
        isAuthenticated: true,
        user: response.data,
      };
    } catch (error) {
      console.log(error);
      return {
        isAuthenticated: false,
        user: null,
      };
    }
  },
};

// Legacy exports
export const fetchData = async <T>(endpoint: string): Promise<T> => {
  const response = await apiClient.get<T>(endpoint);
  return response.data;
};

export const postData = async <T, U>(endpoint: string, data: U): Promise<T> => {
  const response = await apiClient.post<T>(endpoint, data);
  return response.data;
};

// ✅ VS Code Chat Types
export interface SendMessageRequest {
  message: string;
}

export interface SendMessageResponse {
  message: string;
}

// ✅ VS Code Chat Function (ЕДИНСТВЕННАЯ!)
export const sendMessage = async (
  message: string
): Promise<SendMessageResponse> => {
  try {
    console.log("🔧 sendMessage called with:", message);

    const response = await apiClient.post<SendMessageResponse>(
      "/api/vscode/chat",
      { message }
    );

    console.log("🔧 sendMessage response:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ sendMessage error:", error);
    throw error;
  }
};
