// File: vscode-extension/src/services/authService.ts (NEW FILE)

import * as vscode from "vscode";

/**
 * AuthService - Single Source of Truth for authentication
 * Stores token securely in Extension's secret storage
 */
export class AuthService {
  private static instance: AuthService;
  private context: vscode.ExtensionContext;
  private readonly TOKEN_KEY = "multi-ai-chat.token";
  private readonly USER_KEY = "multi-ai-chat.user";

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public static getInstance(context: vscode.ExtensionContext): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService(context);
    }
    return AuthService.instance;
  }

  /**
   * Save token to secure storage
   */
  public async setToken(token: string): Promise<void> {
    console.log("[AuthService] 💾 Saving token to secure storage");
    await this.context.secrets.store(this.TOKEN_KEY, token);
    console.log("[AuthService] ✅ Token saved");
  }

  /**
   * Get token from secure storage
   */
  public async getToken(): Promise<string | undefined> {
    const token = await this.context.secrets.get(this.TOKEN_KEY);
    console.log(
      "[AuthService] 🔑 Token retrieved:",
      token ? "EXISTS" : "NOT FOUND"
    );
    return token;
  }

  /**
   * Clear token from secure storage
   */
  public async clearToken(): Promise<void> {
    console.log("[AuthService] 🧹 Clearing token from secure storage");
    await this.context.secrets.delete(this.TOKEN_KEY);
    console.log("[AuthService] ✅ Token cleared");
  }

  /**
   * Save user info
   */
  public async setUser(user: any): Promise<void> {
    await this.context.globalState.update(this.USER_KEY, user);
  }

  /**
   * Get user info
   */
  public async getUser(): Promise<any> {
    return this.context.globalState.get(this.USER_KEY);
  }

  /**
   * Clear user info
   */
  public async clearUser(): Promise<void> {
    await this.context.globalState.update(this.USER_KEY, undefined);
  }

  /**
   * Check if authenticated
   */
  public async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}
