import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { vscodeAPI } from "./utils/vscodeApi";
import { useAuthStore } from "./store/authStore";
import { AuthProvider } from "./contexts/AuthContext";

// ✅ Loading wrapper component
function AppLoader() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // ✅ Try to restore token from VS Code State
    const state = vscodeAPI.getState();
    if (state?.authToken) {
      console.log("🚀 [main] Token found in state");
      useAuthStore.getState().setToken(state.authToken);
      setIsReady(true);
      return;
    }

    console.log("📭 [main] No token in state, waiting for extension...");

    // ✅ Wait for token from extension (max 1 second)
    const timeout = setTimeout(() => {
      console.log("⏱️ [main] Timeout - no token from extension");
      setIsReady(true);
    }, 1000);

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      if (message.command === "tokenUpdated" && message.token) {
        console.log("🔑 [main] Token received from extension during init");
        vscodeAPI.setState({ authToken: message.token });
        useAuthStore.getState().setToken(message.token);
        clearTimeout(timeout);
        setIsReady(true);
      }
    };

    window.addEventListener("message", messageHandler);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", messageHandler);
    };
  }, []);

  // ✅ Listen for token updates after app is ready
  useEffect(() => {
    if (!isReady) return;

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      if (message.command === "tokenUpdated") {
        console.log("🔑 [main] Token updated from extension");
        if (message.token) {
          vscodeAPI.setState({ authToken: message.token });
          useAuthStore.getState().setToken(message.token);
          console.log("💾 [main] Token saved to state and store");
        } else {
          vscodeAPI.setState({ authToken: null });
          useAuthStore.getState().setToken(null);
          console.log("🗑️ [main] Token cleared from state and store");
        }
      }
    };

    window.addEventListener("message", messageHandler);
    return () => window.removeEventListener("message", messageHandler);
  }, [isReady]);

  // ✅ Show loading screen while waiting
  if (!isReady) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          backgroundColor: "#1e1e1e",
          color: "#cccccc",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #3e3e42",
              borderTop: "4px solid #0e639c",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p>Loading Multi AI Chat...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // ✅ Render app when ready
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppLoader />
  </React.StrictMode>
);
