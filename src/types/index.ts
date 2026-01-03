// src/types/index.ts - ИСПРАВЛЕННЫЙ

export interface User {
  id: string;
  username: string;
  email: string;
  roles?: string[];
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
}

export interface AIProvider {
  id: string;
  name: string;
  apiKey: string;
  sendMessage(message: Message): Promise<Message>;
}

// ✅ ОДИН Config (объединенный)
export interface Config {
  apiBaseUrl: string;
  defaultModel: string;
  apiTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

// ✅ AppConfig для constants.ts
export interface AppConfig {
  environment: string;
  logLevel: LogLevel;
  apiBaseUrl: string;
  maxRetries: number;
  apiTimeout?: number;
  featureFlags?: {
    // ✅ ДОБАВЬ ЭТО
    enableNewFeature?: boolean;
  };
}

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

export enum AuthState {
  LOGGED_IN = "logged_in",
  LOGGED_OUT = "logged_out",
  AUTHENTICATING = "authenticating",
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  gitUrl?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface DataRequest {
  query?: string;
  filters?: Record<string, any>;
  limit?: number;
  offset?: number;
}

export interface APIResponse {
  success: boolean;
  data: any;
  message?: string;
  error?: string;
}

export interface IAIProvider {
  getAvailableModels(): Promise<string[]>;
  sendMessageToAI(message: string, model: string): Promise<string>;
}

// В конец types/index.ts:

export interface ChatSession {
  id: string;
  participants: string[];
  createdAt: Date;
  messages?: Message[];
}

export interface AIRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
}

export interface AIResponse {
  response: string;
  model: string;
  tokensUsed?: number;
}
export * from "./errorFixer";
export * from "./dependencies";
