import { create } from "zustand";

interface AuthStore {
  // ✅ REMOVED: token (Extension handles it now)
  isAuthenticated: boolean;
  user: any | null;

  // ✅ NEW: UI state management only
  setAuthenticated: (value: boolean) => void;
  setUser: (user: any) => void;
  clearAuth: () => void;
}

/**
 * ✅ SIMPLIFIED AUTH STORE
 *
 * What changed:
 * - Removed token storage (Extension AuthManager handles it)
 * - Only tracks UI state: isAuthenticated, user
 * - No persist middleware needed
 * - Extension is single source of truth for tokens
 */
export const useAuthStore = create<AuthStore>((set) => ({
  isAuthenticated: false,
  user: null,

  setAuthenticated: (value: boolean) => {
    console.log("🔐 [AuthStore] Setting authenticated:", value);
    set({ isAuthenticated: value });
  },

  setUser: (user: any) => {
    console.log("👤 [AuthStore] Setting user:", user?.username);
    set({ user, isAuthenticated: true });
  },

  clearAuth: () => {
    console.log("🧹 [AuthStore] Clearing auth state");
    set({ isAuthenticated: false, user: null });
  },
}));

// Restore auth state from sessionStorage on init
(() => {
  try {
    const savedAuth = (globalThis as any).sessionStorage?.getItem(
      "multi-ai-chat-auth"
    );

    if (savedAuth) {
      const { isAuthenticated, user } = JSON.parse(savedAuth);
      useAuthStore.setState({ isAuthenticated, user });
      console.log("💾 [AuthStore] Restored auth from sessionStorage");
    }
  } catch (e) {
    console.error("Failed to restore auth from sessionStorage:", e);
  }
})();

// Subscribe to changes and save to sessionStorage
useAuthStore.subscribe((state) => {
  try {
    (globalThis as any).sessionStorage?.setItem(
      "multi-ai-chat-auth",
      JSON.stringify({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      })
    );
  } catch (e) {
    console.error("Failed to save auth to sessionStorage:", e);
  }
});

console.log("💾 [AuthStore] sessionStorage persistence initialized");
