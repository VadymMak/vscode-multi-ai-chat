import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Message } from "../../types/index";
import { sendMessage } from "../../services/apiService";
import { vscodeAPI } from "../../utils/vscodeApi";
import "./ChatView.css";

// ✅ File context interface
interface FileContext {
  filePath?: string;
  fileName?: string;
  fileContent?: string;
  selectedText?: string;
  language?: string;
  lineCount?: number;
}

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [fileContext, setFileContext] = useState<FileContext | null>(null);
  const [includeFile, setIncludeFile] = useState<boolean>(true); // ✅ Toggle to include/exclude

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ✅ Request file context on mount and listen for updates
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      if (message.command === "fileContext") {
        console.log("📁 [ChatView] File context received:", message.data);
        if (message.data && Object.keys(message.data).length > 0) {
          setFileContext(message.data);
        } else {
          setFileContext(null);
        }
      }
    };

    window.addEventListener("message", messageHandler);

    // ✅ Request initial file context
    console.log("📤 [ChatView] Requesting initial file context...");
    vscodeAPI.postMessage({ command: "getFileContext" });

    return () => window.removeEventListener("message", messageHandler);
  }, []);

  // ✅ Refresh file context (e.g., when user switches files)
  const refreshFileContext = () => {
    console.log("🔄 [ChatView] Refreshing file context...");
    vscodeAPI.postMessage({ command: "getFileContext" });
  };

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
      // ✅ Use current file context if toggle is ON
      const contextToSend = includeFile ? fileContext : null;
      console.log("📤 [ChatView] Sending message with context:", contextToSend);

      const response = await sendMessage(userMessage.content, contextToSend);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.message,
        sender: "ai",
        timestamp: new Date().toISOString(),
      };

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
      console.error("❌ [ChatView] Send message error:", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ✅ Get display info for file context
  const getFileInfo = () => {
    if (!fileContext) return null;

    const hasSelection = !!fileContext.selectedText;
    const fileName = fileContext.fileName || "Unknown file";
    const language = fileContext.language || "text";
    const charCount = hasSelection
      ? fileContext.selectedText!.length
      : fileContext.fileContent?.length || 0;

    return {
      fileName,
      language,
      hasSelection,
      charCount,
      displayText: hasSelection
        ? `Selection (${charCount} chars)`
        : `${fileContext.lineCount || "?"} lines`,
    };
  };

  const fileInfo = getFileInfo();

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

      {/* ✅ File Context Indicator */}
      <div className="file-context-bar">
        {fileInfo ? (
          <>
            <div className="file-info">
              <span
                className={`file-toggle ${includeFile ? "active" : ""}`}
                onClick={() => setIncludeFile(!includeFile)}
                title={
                  includeFile
                    ? "Click to exclude file"
                    : "Click to include file"
                }
              >
                {includeFile ? "📎" : "📎"}
              </span>
              <span className={`file-name ${!includeFile ? "disabled" : ""}`}>
                {fileInfo.fileName}
              </span>
              <span className="file-badge">{fileInfo.language}</span>
              {fileInfo.hasSelection && (
                <span className="file-badge selection">Selected</span>
              )}
              <span className="file-meta">{fileInfo.displayText}</span>
            </div>
            <button
              className="refresh-button"
              onClick={refreshFileContext}
              title="Refresh file context"
            >
              🔄
            </button>
          </>
        ) : (
          <div className="file-info">
            <span className="no-file">No file open</span>
            <button
              className="refresh-button"
              onClick={refreshFileContext}
              title="Refresh file context"
            >
              🔄
            </button>
          </div>
        )}
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={
            fileInfo && includeFile
              ? `Ask about ${fileInfo.fileName}...`
              : "Type a message... (Enter to send)"
          }
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
