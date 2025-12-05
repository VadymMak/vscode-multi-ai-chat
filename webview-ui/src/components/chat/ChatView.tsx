import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Message } from "../../types/index";
import { sendMessage } from "../../services/apiService";
import { vscodeAPI } from "../../utils/vscodeApi";
import "./ChatView.css";

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [fileContext, setFileContext] = useState<any>(null);
  const [waitingForContext, setWaitingForContext] = useState<boolean>(false);

  // ✅ REMOVED - Token now restored in main.tsx BEFORE app mount!

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ✅ Listen for file context only (token handled in main.tsx)
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      if (message.command === "fileContext") {
        console.log("📁 [ChatView] File context received:", message.data);
        setFileContext(message.data);
        setWaitingForContext(false);
      }
    };

    window.addEventListener("message", messageHandler);
    return () => window.removeEventListener("message", messageHandler);
  }, []);

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      console.log("✅ [ChatView] Copied to clipboard!");
    } catch (err) {
      console.error("❌ [ChatView] Failed to copy:", err);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date().toISOString(),
    };

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInputValue("");
    setError(null);
    setIsLoading(true);

    try {
      console.log("📤 [ChatView] Requesting file context from extension...");
      setWaitingForContext(true);
      vscodeAPI.postMessage({ command: "getFileContext" });

      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 500);
        const checkContext = setInterval(() => {
          if (!waitingForContext) {
            clearInterval(checkContext);
            clearTimeout(timeout);
            resolve(null);
          }
        }, 50);
      });

      console.log("📤 [ChatView] Sending message with context:", fileContext);
      const response = await sendMessage(userMessage.content, fileContext);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.message,
        sender: "ai",
        timestamp: new Date().toISOString(),
      };

      setMessages((prevMessages) => [...prevMessages, aiMessage]);
      setFileContext(null);
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
      console.error("❌ [ChatView] Send message error:", errorMessage);
    } finally {
      setIsLoading(false);
      setWaitingForContext(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-view">
      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender}`}>
            <div className="message-content">
              {message.sender === "ai" ? (
                <ReactMarkdown
                  components={{
                    code({ node, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const isInline = !match;

                      return isInline ? (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      ) : (
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                        >
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              ) : (
                <span className="content">{message.content}</span>
              )}
            </div>
            <div className="message-footer">
              <span className="timestamp">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
              {message.sender === "ai" && (
                <button
                  className="copy-button"
                  onClick={() => handleCopy(message.content)}
                  title="Copy message"
                >
                  📋
                </button>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message ai loading-message">
            <div className="message-content">
              <span className="loading-dots">AI is thinking</span>
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type a message... (Enter to send)"
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading || !inputValue.trim()}>
          {isLoading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
};

export default ChatView;
