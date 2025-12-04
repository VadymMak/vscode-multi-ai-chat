import React, { useState } from "react";
import { Message } from "../../types/index";
import { sendMessage } from "../../services/apiService";
import "./ChatView.css";

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [loading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // useEffect(() => {
  //   // Fetch chat history when component mounts
  //   const loadChatHistory = async () => {
  //     try {
  //       setLoading(true);
  //       const history = await fetchChatHistory();
  //       setMessages(history);
  //     } catch (error) {
  //       const errorMessage =
  //         error instanceof Error
  //           ? error.message
  //           : "Failed to load chat history.";
  //       setError(errorMessage);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   loadChatHistory();
  // }, []);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    // 1. Create user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date().toISOString(),
    };

    // 2. Add to UI
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInputValue("");
    setError(null);

    try {
      // 3. Call API
      const response = await sendMessage(userMessage.content);

      // 4. Create AI message with correct structure
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.message, // ✅ response.message, не response
        sender: "ai",
        timestamp: new Date().toISOString(),
      };

      // 5. Add AI response to UI
      setMessages((prevMessages) => [...prevMessages, aiMessage]);
    } catch (err: unknown) {
      let errorMessage = "Failed to send message";

      if (err && typeof err === "object") {
        if (
          "response" in err &&
          err.response &&
          typeof err.response === "object"
        ) {
          if (
            "data" in err.response &&
            err.response.data &&
            typeof err.response.data === "object"
          ) {
            if ("detail" in err.response.data) {
              errorMessage = String(err.response.data.detail);
            }
          }
        } else if ("message" in err) {
          errorMessage = String(err.message);
        }
      }

      setError(errorMessage);
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
