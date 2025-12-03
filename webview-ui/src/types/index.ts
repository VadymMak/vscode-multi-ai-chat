// webview-ui/src/types/index.ts

// This file contains frontend-specific type definitions for the webview UI.
// These types are used throughout the webview components to ensure type safety
// and consistency in the data structures used in the React application.

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Message {
  id: string;
  content: string;
  timestamp: Date;
  senderId: string;
  receiverId: string;
}

export interface ChatSession {
  sessionId: string;
  participants: User[];
  messages: Message[];
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// These types can be expanded as the application grows to include more complex
// data structures or additional features. They serve as a foundation for the
// webview's type system, ensuring that components and services can rely on
// consistent and well-defined data shapes.
