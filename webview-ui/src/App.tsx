import React from "react";
import { useAuth } from "./hooks/useAuth";
import LoginForm from "./components/auth/LoginForm";
import ChatView from "./components/chat/ChatView";
import "./App.css"; // Importing application-specific styles

const App: React.FC = () => {
  const { isAuthenticated, login, logout } = useAuth();

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
      <main className="app-main">
        {isAuthenticated ? <ChatView /> : <LoginForm onLogin={login} />}
      </main>
      <footer className="app-footer">
        <p>Powered by AI</p>
      </footer>
    </div>
  );
};

export default App;
