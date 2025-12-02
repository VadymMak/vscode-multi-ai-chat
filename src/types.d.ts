// foundation/types.d.ts

// Import necessary modules from VS Code API
import * as vscode from "vscode";

// Define a type for the configuration settings of the extension
export interface ExtensionConfig {
  enableFeatureX: boolean;
  apiEndpoint: string;
  maxRetries: number;
}

// Define a type for the user authentication state
export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: UserProfile | null;
}

// Define a type for user profile information
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string; // Optional field for user's avatar
}

// Define a type for API response structure
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string; // Optional field for error message
}

// Define a type for chat message structure
export interface ChatMessage {
  id: string;
  userId: string;
  content: string;
  timestamp: Date;
}

// Define a type for the chat panel state
export interface ChatPanelState {
  messages: ChatMessage[];
  isLoading: boolean;
  error?: string; // Optional field for error message
}

// Define a type for the command registration in VS Code
export interface Command {
  command: string;
  title: string;
  callback: (...args: any[]) => void;
}

// Define a type for the webview message structure
export interface WebviewMessage {
  type: string;
  payload: any;
}

// Define a type for the API service configuration
export interface ApiServiceConfig {
  baseUrl: string;
  timeout: number;
  headers: Record<string, string>;
}

// Define a type for the environment variables
export interface EnvironmentVariables {
  NODE_ENV: "development" | "production" | "test";
  API_KEY: string;
}

// Define a type for the Redux-like action structure
export interface Action<T = any> {
  type: string;
  payload?: T;
}

// Define a type for the Redux-like state structure
export interface State {
  auth: AuthState;
  chat: ChatPanelState;
  config: ExtensionConfig;
}

// Define a type for the possible events emitted by the extension
export type ExtensionEvent = "onLogin" | "onLogout" | "onMessageReceived";
