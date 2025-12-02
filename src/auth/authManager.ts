// src/auth/authManager.ts

import { User } from "../types/index";
import { API_BASE_URL } from "../constants";
import logger from "../utils/logger";
import { fetchWithTimeout } from "../utils/helpers";

interface AuthResponse {
  token: string;
  user: User;
}

class AuthManager {
  private static instance: AuthManager;
  private token: string | null = null;
  private currentUser: User | null = null;

  private constructor() {}

  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  public async login(username: string, password: string): Promise<User> {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error("Failed to login");
      }

      const data = (await response.json()) as AuthResponse;
      this.token = data.token;
      this.currentUser = data.user;
      logger.info("User logged in successfully", this.currentUser);
      return this.currentUser;
    } catch (error) {
      logger.error("Login failed", error);
      throw error;
    }
  }

  public logout(): void {
    this.token = null;
    this.currentUser = null;
    logger.info("User logged out");
  }

  public getToken(): string | null {
    return this.token;
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.token !== null;
  }
}

export default AuthManager;
