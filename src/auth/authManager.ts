// src/auth/authManager.ts - ИСПРАВЛЕННЫЙ

import { EventEmitter } from "events";
import logger from "../utils/logger"; // ✅ default import
import { AuthenticationError } from "../errors";
import { User, AuthState } from "../types/index";

class AuthManager extends EventEmitter {
  private static instance: AuthManager;
  private authState: AuthState = AuthState.LOGGED_OUT;
  private currentUser: User | null = null;
  private token: string | null = null; // ✅ ДОБАВЛЕНО

  private constructor() {
    super();
    logger.info("AuthManager initialized"); // ✅ logger маленькая
  }

  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  public async login(username: string, password: string): Promise<void> {
    try {
      logger.info(`Attempting to log in user: ${username}`);
      const user = await this.authenticate(username, password);
      this.currentUser = user;
      this.token = "mock-jwt-token-" + Date.now(); // ✅ ТОКЕН
      this.authState = AuthState.LOGGED_IN;
      this.emit("login", user);
      logger.info(`User ${username} logged in successfully`);
    } catch (error) {
      const err = error as Error;
      logger.error(`Login failed for user ${username}: ${err.message}`);
      throw new AuthenticationError("Login failed");
    }
  }

  public logout(): void {
    if (this.authState === AuthState.LOGGED_IN) {
      logger.info(`Logging out user: ${this.currentUser?.username}`);
      this.currentUser = null;
      this.token = null; // ✅ ОЧИСТКА ТОКЕНА
      this.authState = AuthState.LOGGED_OUT;
      this.emit("logout");
      logger.info("User logged out successfully");
    } else {
      logger.warn("Logout attempted while no user is logged in");
    }
  }

  public getAuthState(): AuthState {
    return this.authState;
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  // ✅ ДОБАВЛЕН МЕТОД getToken
  public async getToken(): Promise<string | null> {
    return this.token;
  }

  private async authenticate(
    username: string,
    password: string
  ): Promise<User> {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (username === "admin" && password === "password") {
      return {
        id: "1", // ✅ ДОБАВЛЕН id
        username: "admin",
        email: "admin@example.com", // ✅ ДОБАВЛЕН email
        roles: ["admin"],
      };
    } else {
      throw new Error("Invalid credentials");
    }
  }
}

export default AuthManager;
