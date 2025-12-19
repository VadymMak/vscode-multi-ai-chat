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

  // ✅ Track if we just logged in (to prevent double detection)
  const justLoggedIn = useRef(false);

  // ✅ Check auth on mount
  useEffect(() => {
    const verifyAuth = async () => {
      // ✅ Check cached auth state first (instant display!)
      const wasAuthenticated = (globalThis as any).sessionStorage?.getItem(
        "multi-ai-chat-auth-status"
      );

      if (wasAuthenticated === "authenticated") {
        console.log("⚡ Using cached auth state - instant display");
        setAuthStatus("authenticated");

        // Load cached user
        const cachedUser = (globalThis as any).sessionStorage?.getItem(
          "multi-ai-chat-user"
        );
        if (cachedUser) {
          try {
            setUser(JSON.parse(cachedUser));
          } catch (e) {
            console.error("Failed to parse cached user:", e);
          }
        }

        // ✅ Skip backend verification - Extension already verified token
        console.log("✅ Auth restored from cache");
        return;
      }

      // ✅ No cached auth - wait for Extension to send token
      console.log("📭 No cached auth, waiting for extension...");
      setAuthStatus("unauthenticated");
    };

    verifyAuth();
  }, []); // ✅ Empty deps - run only once on mount

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.command === "tokenExpired") {
        console.log("🔓 [useAuth] Token expired, logging out");

        // Clear all sessionStorage
        (globalThis as any).sessionStorage?.removeItem(
          "multi-ai-chat-auth-status"
        );
        (globalThis as any).sessionStorage?.removeItem("multi-ai-chat-user");

        // Clear auth state
        setAuthStatus("unauthenticated");
        setUser(null);

        // Show alert to user
        vscodeAPI.postMessage({
          command: "alert",
          text: "Session expired. Please login again.",
        });
      }
    };

    (globalThis as any).window?.addEventListener("message", handleMessage);

    return () => {
      (globalThis as any).window?.removeEventListener("message", handleMessage);
    };
  }, []);

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

      (globalThis as any).sessionStorage?.setItem(
        "multi-ai-chat-auth-status",
        "authenticated"
      );
      (globalThis as any).sessionStorage?.setItem(
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

      (globalThis as any).sessionStorage?.removeItem(
        "multi-ai-chat-auth-status"
      );
      (globalThis as any).sessionStorage?.removeItem("multi-ai-chat-user");
      (globalThis as any).sessionStorage?.removeItem("multi-ai-chat-projects");
      (globalThis as any).sessionStorage?.removeItem(
        "multi-ai-chat-selected-project"
      );

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
