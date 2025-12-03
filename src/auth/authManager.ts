// src/auth/authManager.ts - RAILWAY BACKEND INTEGRATION (FIXED)

import { EventEmitter } from "events";
import * as vscode from "vscode";
import logger from "../utils/logger";
import { AuthenticationError } from "../errors";
import { User, AuthState } from "../types/index";

class AuthManager extends EventEmitter {
  private static instance: AuthManager | null = null; // ✅ ИЗМЕНЕНО
  private authState: AuthState = AuthState.LOGGED_OUT;
  private currentUser: User | null = null;
  private token: string | null = null;
  private context: vscode.ExtensionContext | null = null; // ✅ ИЗМЕНЕНО

  private constructor() {
    // ✅ УБРАЛИ context из constructor
    super();
    logger.info("AuthManager initialized");
  }

  // ✅ ИЗМЕНЕНО - initialize вместо getInstance
  public static initialize(context: vscode.ExtensionContext): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    AuthManager.instance.context = context;
    AuthManager.instance.loadToken();
    return AuthManager.instance;
  }

  // ✅ ДОБАВЛЕНО - getInstance БЕЗ параметров для других файлов
  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      throw new Error("AuthManager not initialized. Call initialize() first.");
    }
    return AuthManager.instance;
  }

  private async loadToken(): Promise<void> {
    if (!this.context) return;

    try {
      this.token = (await this.context.secrets.get("jwt_token")) || null;
      if (this.token) {
        logger.info("Token loaded from SecretStorage");
        this.authState = AuthState.LOGGED_IN;
      }
    } catch (error) {
      logger.error(
        "Failed to load token",
        error instanceof Error ? error : new Error(String(error))
      ); // ✅ ИСПРАВЛЕНО
    }
  }

  public async login(username: string, password: string): Promise<void> {
    try {
      logger.info(`Attempting to log in user: ${username}`);
      const result = await this.authenticate(username, password);

      this.currentUser = result.user;
      this.token = result.token;
      this.authState = AuthState.LOGGED_IN;

      await this.saveToken(result.token);

      this.emit("login", result.user);
      logger.info(`User ${username} logged in successfully`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error)); // ✅ ИСПРАВЛЕНО
      logger.error(`Login failed for user ${username}: ${err.message}`);
      throw new AuthenticationError("Login failed");
    }
  }

  public async logout(): Promise<void> {
    if (this.authState === AuthState.LOGGED_IN) {
      logger.info(`Logging out user: ${this.currentUser?.username}`);

      this.currentUser = null;
      this.token = null;
      this.authState = AuthState.LOGGED_OUT;

      if (this.context) {
        await this.context.secrets.delete("jwt_token");
      }

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

  public async getToken(): Promise<string | null> {
    return this.token;
  }

  public async saveToken(token: string): Promise<void> {
    if (!this.context) {
      throw new Error("AuthManager context not set");
    }

    try {
      await this.context.secrets.store("jwt_token", token);
      this.token = token;
      logger.info("Token saved to SecretStorage");
    } catch (error) {
      logger.error(
        "Failed to save token",
        error instanceof Error ? error : new Error(String(error))
      ); // ✅ ИСПРАВЛЕНО
      throw error;
    }
  }

  private async authenticate(
    username: string,
    password: string
  ): Promise<{ user: User; token: string }> {
    const url =
      "https://multi-ai-chat-production.up.railway.app/api/auth/login";

    const body = new URLSearchParams({
      username: username,
      password: password,
      grant_type: "password",
    });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `Authentication failed: ${response.status} - ${errorText}`
        );
        throw new Error(`Authentication failed: ${response.status}`);
      }

      const data = await response.json();

      const user: User = {
        id: data.user.id.toString(),
        username: data.user.username,
        email: data.user.email,
        roles: data.user.is_superuser ? ["admin"] : [],
      };

      return {
        user: user,
        token: data.access_token,
      };
    } catch (error) {
      logger.error(
        "Authentication error",
        error instanceof Error ? error : new Error(String(error))
      ); // ✅ ИСПРАВЛЕНО
      throw error;
    }
  }
}

export default AuthManager;
