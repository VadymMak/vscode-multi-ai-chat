// webview-ui/src/types/index.ts

// Frontend-specific type definitions for the webview UI

// ✅ UPDATED: User interface для соответствия с backend
export interface User {
  id: number; // ✅ number, не string
  username: string; // ✅ добавлено username
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

// ✅ UPDATED: Auth Status type с "checking"
export type AuthStatus =
  | "checking"
  | "authenticated"
  | "authenticating"
  | "unauthenticated";

// ✅ ADDED: Auth Response types
export interface AuthResponse {
  user: User;
  token: string;
}

export interface CheckAuthResponse {
  isAuthenticated: boolean;
  user: User | null;
}

// ✅ API Error type
export interface ApiError {
  message: string;
  status: number;
  statusText: string;
}
