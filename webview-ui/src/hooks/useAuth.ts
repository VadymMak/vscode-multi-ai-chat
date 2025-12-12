import { useState, useEffect, useRef } from "react";
import { apiService } from "../services/apiService";
import { vscodeAPI } from "../utils/vscodeApi";
import { useAuthStore } from "../store/authStore";
import { User, AuthStatus } from "../types";

export interface UseAuthReturn {
  user: User | null;
  authStatus: AuthStatus;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const clearToken = useAuthStore((state) => state.clearToken);
  const token = useAuthStore((state) => state.token);

  // ✅ Track if we just logged in (to prevent double detection)
  const justLoggedIn = useRef(false);

  /// ✅ Check auth ONLY if token exists
  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        // ✅ NEW: Check if we were authenticated in this session
        const wasAuthenticated = sessionStorage.getItem(
          "multi-ai-chat-auth-status"
        );

        if (wasAuthenticated === "authenticated") {
          // ✅ Trust sessionStorage, set state immediately (no flash!)
          console.log("⚡ Using cached auth state - instant display");
          setAuthStatus("authenticated");

          // ✅ Load cached user if available
          const cachedUser = sessionStorage.getItem("multi-ai-chat-user");
          if (cachedUser) {
            try {
              setUser(JSON.parse(cachedUser));
            } catch (e) {
              console.error("Failed to parse cached user:", e);
            }
          }
        }

        console.log("🔍 Token exists, verifying with backend...");

        // ✅ CRITICAL: Skip verification if we just logged in
        if (justLoggedIn.current) {
          console.log("⏭️ Skipping verification - just logged in");
          justLoggedIn.current = false; // Reset flag
          return;
        }

        try {
          const result = await apiService.checkAuth();
          if (result.isAuthenticated) {
            setUser(result.user);
            setAuthStatus("authenticated");

            // ✅ Cache auth state
            sessionStorage.setItem(
              "multi-ai-chat-auth-status",
              "authenticated"
            );
            sessionStorage.setItem(
              "multi-ai-chat-user",
              JSON.stringify(result.user)
            );

            console.log("✅ Token verified, user authenticated");

            // ✅ Send tokenValidated (this is a RESTORED session)
            console.log("📤 Sending tokenValidated (restored session)");
            vscodeAPI.postMessage({
              command: "tokenValidated",
            });
          } else {
            console.log("❌ Token invalid, clearing...");
            clearToken();
            vscodeAPI.setState({ authToken: null });
            vscodeAPI.postMessage({ command: "tokenUpdated", token: null });
            setAuthStatus("unauthenticated");

            // ✅ Clear cache
            sessionStorage.removeItem("multi-ai-chat-auth-status");
            sessionStorage.removeItem("multi-ai-chat-user");
          }
        } catch (error) {
          console.error("❌ Token verification failed:", error);
          clearToken();
          vscodeAPI.setState({ authToken: null });
          vscodeAPI.postMessage({ command: "tokenUpdated", token: null });
          setAuthStatus("unauthenticated");

          // ✅ Clear cache
          sessionStorage.removeItem("multi-ai-chat-auth-status");
          sessionStorage.removeItem("multi-ai-chat-user");
        }
      } else {
        console.log("📭 No token found, showing login form");
        setAuthStatus("unauthenticated");

        // ✅ Clear cache
        sessionStorage.removeItem("multi-ai-chat-auth-status");
        sessionStorage.removeItem("multi-ai-chat-user");
      }
    };

    verifyToken();
  }, [token, clearToken]);

  const checkAuth = async () => {
    try {
      const result = await apiService.checkAuth();
      if (result.isAuthenticated) {
        setUser(result.user);
        setAuthStatus("authenticated");
      } else {
        setUser(null);
        setAuthStatus("unauthenticated");
      }
    } catch (error) {
      console.error("Check auth error:", error);
      setUser(null);
      setAuthStatus("unauthenticated");
    }
  };

  const login = async (username: string, password: string) => {
    try {
      console.log("🔧 useAuth.login START");
      setAuthStatus("authenticating");

      // ✅ CRITICAL: Set flag BEFORE login API call
      // (because apiService.login sets token internally, triggering useEffect)
      justLoggedIn.current = true;

      const response = await apiService.login(username, password);
      console.log("🔧 useAuth.login got response:", response);

      setUser(response.user);
      setAuthStatus("authenticated");

      sessionStorage.setItem("multi-ai-chat-auth-status", "authenticated");
      sessionStorage.setItem(
        "multi-ai-chat-user",
        JSON.stringify(response.user)
      );

      console.log("💾 Saving token to VS Code State");
      vscodeAPI.setState({ authToken: response.token });

      console.log("📤 Notifying extension about token");
      vscodeAPI.postMessage({
        command: "tokenUpdated",
        token: response.token,
      });

      console.log("✅ Login successful!");
    } catch (error) {
      console.error("❌ Login error:", error);
      setAuthStatus("unauthenticated");
      justLoggedIn.current = false; // ✅ Reset flag on error
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log("🗑️ Token cleared from Zustand store");
      await apiService.logout();
      setUser(null);
      setAuthStatus("unauthenticated");

      sessionStorage.removeItem("multi-ai-chat-auth-status");
      sessionStorage.removeItem("multi-ai-chat-user");
      sessionStorage.removeItem("multi-ai-chat-projects");
      sessionStorage.removeItem("multi-ai-chat-selected-project");

      console.log("🗑️ Clearing token from VS Code State");
      vscodeAPI.setState({ authToken: null });

      console.log("📤 Notifying extension to clear token");
      vscodeAPI.postMessage({
        command: "tokenUpdated",
        token: null,
      });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return {
    user,
    authStatus,
    login,
    logout,
    checkAuth,
  };
}
