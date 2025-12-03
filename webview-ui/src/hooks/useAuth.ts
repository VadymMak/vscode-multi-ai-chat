import { useState, useEffect } from "react";
import { apiService } from "../services/apiService";
import { AuthStatus, User } from "../types";

// Define the return type for the useAuth hook
interface UseAuthReturn {
  user: User | null;
  authStatus: AuthStatus;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Custom hook for managing authentication state
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("unauthenticated");

  // Function to handle user login
  const login = async (username: string, password: string) => {
    try {
      setAuthStatus("authenticating");
      const response = await apiService.login(username, password);
      setUser(response.user);
      setAuthStatus("authenticated");
    } catch (error) {
      console.error("Login failed:", error);
      setAuthStatus("unauthenticated");
    }
  };

  // Function to handle user logout
  const logout = async () => {
    try {
      await apiService.logout();
      setUser(null);
      setAuthStatus("unauthenticated");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Effect to check authentication status on component mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await apiService.checkAuth();
        if (response.isAuthenticated) {
          setUser(response.user);
          setAuthStatus("authenticated");
        } else {
          setAuthStatus("unauthenticated");
        }
      } catch (error) {
        console.error("Failed to check authentication status:", error);
        setAuthStatus("unauthenticated");
      }
    };

    checkAuthStatus();
  }, []);

  return { user, authStatus, login, logout };
}
