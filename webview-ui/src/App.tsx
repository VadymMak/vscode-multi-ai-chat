import React from "react";
import { useAuth } from "./contexts/AuthContext";
import LoginForm from "./components/auth/LoginForm";
import ChatView from "./components/chat/ChatView";
import ProjectInfo from "./components/ProjectInfo/ProjectInfo";
import { ApprovalDialog } from "./components/ApprovalDialog/ApprovalDialog";
import { ApprovalRequest, ApprovalResponse } from "./types/approval.types";

import { vscodeAPI } from "./utils/vscodeApi";
import "./App.css";

const App: React.FC = () => {
  const { authStatus, logout } = useAuth();
  const isAuthenticated = authStatus === "authenticated";
  const isChecking = authStatus === "checking";

  const [approvalRequest, setApprovalRequest] =
    React.useState<ApprovalRequest | null>(null);

  const handleApprovalResponse = React.useCallback(
    (response: ApprovalResponse) => {
      console.log("🟢 [App] Approval response:", response);

      vscodeAPI.postMessage({
        type: "approvalResponse",
        response: response,
      });

      console.log("✅ [App] Message posted via vscodeAPI");

      setApprovalRequest(null);
    },
    []
  );

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = event.data;

        console.log("📨 [App] Received message:", message);

        if (message && message.command === "apiResponse") {
          const response = message.response;

          if (response && response.response_type === "requestApproval") {
            console.log("🟢 [App] Approval requested:", response);
            setApprovalRequest(response);
          } else {
            console.log(
              "⚠️ [App] Received response with undefined or unsupported response_type"
            );
          }
        } else {
          console.log(
            "⚠️ [App] Received message with undefined or unsupported command"
          );
        }
      } catch (error) {
        console.error("❌ [App] Error handling message:", error);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>VS Code Multi AI Chat</h1>
        {isAuthenticated && (
          <button onClick={logout} className="logout-button">
            Logout
          </button>
        )}
      </header>

      {isAuthenticated && <ProjectInfo />}

      <main className="app-main">
        {isChecking ? (
          <div className="auth-checking">
            <div className="spinner"></div>
            <p>Checking authentication...</p>
          </div>
        ) : isAuthenticated ? (
          <ChatView />
        ) : (
          <LoginForm
            onSuccess={() => {
              console.log("Login successful!");
            }}
            onError={(message) => {
              console.error("Login error:", message);
            }}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Powered by AI</p>
      </footer>

      <ApprovalDialog
        request={approvalRequest}
        onResponse={handleApprovalResponse}
      />
    </div>
  );
};

export default App;
