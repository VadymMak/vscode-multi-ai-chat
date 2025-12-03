import React, { useState, useEffect } from "react";
import { Message } from "../types/index";
import { fetchChatHistory, sendMessage } from "../services/apiService";
import "./ChatView.css";

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch chat history when component mounts
    const loadChatHistory = async () => {
      try {
        setLoading(true);
        const history = await fetchChatHistory();
        setMessages(history);
      } catch (err) {
        setError("Failed to load chat history.");
      } finally {
        setLoading(false);
      }
    };

    loadChatHistory();
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date().toISOString(),
    };

    try {
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setInputValue("");
      const response = await sendMessage(newMessage.content);
      setMessages((prevMessages) => [
        ...prevMessages,
        { ...response, sender: "ai" },
      ]);
    } catch (err) {
      setError("Failed to send message.");
    }
  };

  return (
    <div className="chat-view">
      <div className="chat-messages">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message ${message.sender}`}>
              <span className="content">{message.content}</span>
              <span className="timestamp">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
        {error && <div className="error">{error}</div>}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
        />
        <button onClick={handleSend} disabled={loading}>
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatView;
