// webview-ui/src/types/index.ts

// Frontend-specific type definitions for the webview UI

export interface User {
  id: string;
  name: string;
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

// ✅ ДОБАВЛЕНО: Auth Status type
export type AuthStatus = "authenticated" | "authenticating" | "unauthenticated";

// ✅ ДОБАВЛЕНО: API Error type
export interface ApiError {
  message: string;
  status: number;
  statusText: string;
}
