// webview-ui/src/types/index.ts

// Frontend-specific type definitions for the webview UI

// ✅ EXISTING TYPES (keep as is)
export interface User {
  id: number;
  username: string;
  email: string;
}

export interface Message {
  id: string;
  content: string;
  timestamp: string;
  senderId?: string;
  receiverId?: string;
  sender?: string;
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

export type AuthStatus =
  | "checking"
  | "authenticated"
  | "authenticating"
  | "unauthenticated";

export interface AuthResponse {
  user: User;
  token: string;
}

export interface CheckAuthResponse {
  isAuthenticated: boolean;
  user: User | null;
}

export interface ApiError {
  message: string;
  status: number;
  statusText: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  git_url?: string;
  role_id?: number;
  assistant_name?: string;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
}

// ✅ NEW: Export approval types
export * from "./approval.types";

// ✅ NEW: Export message types
export * from "./messages";
