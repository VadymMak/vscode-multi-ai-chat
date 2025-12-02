// src/types/index.ts

// Define core TypeScript interfaces for the project

// Interface representing a User
export interface User {
  id: string;
  username: string;
  email: string;
  // Additional user properties can be added here
}

// Interface representing a Message in the chat
export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  // Additional message properties can be added here
}

// Interface representing an AI Provider
export interface AIProvider {
  id: string;
  name: string;
  apiKey: string;
  // Method to send a message to the AI provider
  sendMessage(message: Message): Promise<Message>;
  // Additional AI provider methods and properties can be added here
}

// Interface representing the application configuration
export interface Config {
  apiBaseUrl: string;
  defaultModel: string;
  // Additional configuration properties can be added here
}

export interface EnvironmentConfig extends Config {
  logLevel?: LogLevel;
  timeout?: number;
  // Add any other environment-specific properties
}

// ============================================
// ADD THESE - Missing types that other files need
// ============================================

// Log levels for the logger utility
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

export type LogLevelType = "debug" | "info" | "warn" | "error";

// Project interface (if other files need it)
export interface Project {
  id: string;
  name: string;
  description?: string;
  gitUrl?: string;
}

// Role interface (if other files need it)
export interface Role {
  id: string;
  name: string;
  description?: string;
}

// Authentication response
export interface AuthResponse {
  token: string;
  user: User;
}

export interface Config {
  apiBaseUrl: string;
  defaultModel: string;
  apiTimeout?: number; // ✅ Now defined
}

// Logger interface for typing
export interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

// Config interface with apiTimeout
export interface Config {
  apiBaseUrl: string;
  defaultModel: string;
  apiTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

// API Request/Response interfaces
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

// Update IAIProvider interface to include process method
export interface IAIProvider {
  getAvailableModels(): Promise<string[]>;
  sendMessageToAI(message: string, model: string): Promise<string>;
}
