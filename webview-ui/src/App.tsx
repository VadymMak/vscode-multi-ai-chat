import React from "react";
import { useAuth } from "./contexts/AuthContext";
import LoginForm from "./components/auth/LoginForm";
import ChatView from "./components/chat/ChatView";
import ProjectSelector from "./components/ProjectSelector/ProjectSelector"; // ✅ NEW
import "./App.css";

const App: React.FC = () => {
  const { authStatus, logout } = useAuth();
  const isAuthenticated = authStatus === "authenticated";

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

      {/* ✅ NEW: Project Selector */}
      {isAuthenticated && <ProjectSelector />}

      <main className="app-main">
        {isAuthenticated ? (
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
    </div>
  );
};

export default App;
