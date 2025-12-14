import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Message } from "../../types/index";
import { sendMessage } from "../../services/apiService";
import { vscodeAPI } from "../../utils/vscodeApi";
import "./ChatView.css";
import { diffLines } from "diff";

// ✅ File context interface
interface FileContext {
  filePath?: string;
  fileName?: string;
  fileContent?: string;
  selectedText?: string;
  language?: string;
  lineCount?: number;
}

interface ExtendedMessage extends Message {
  response_type?: "chat" | "edit" | "create";
  original_content?: string;
  new_content?: string;
  diff?: string;
  file_path?: string;
  tokens_used?: any;
}

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{
    messageId: string;
    type: "edit" | "create";
    data: any;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [fileContext, setFileContext] = useState<FileContext | null>(null);
  const [includeFile, setIncludeFile] = useState<boolean>(true);

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

    console.log("📤 [ChatView] Requesting initial file context...");
    vscodeAPI.postMessage({ command: "getFileContext" });

    return () => window.removeEventListener("message", messageHandler);
  }, []);

  // ✅ Refresh file context
  const refreshFileContext = () => {
    console.log("🔄 [ChatView] Refreshing file context...");
    vscodeAPI.postMessage({ command: "getFileContext" });
  };

  // ✅ Clear chat
  const clearChat = () => {
    setMessages([]);
    setError(null);
    console.log("🧹 [ChatView] Chat cleared");
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

    const userMessage: ExtendedMessage = {
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
      const contextToSend =
        includeFile && fileContext ? fileContext : undefined;
      console.log("📤 [ChatView] Sending message with context:", contextToSend);

      const response = await sendMessage(userMessage.content, contextToSend);

      console.log("🎯 [ChatView] Response type:", response.response_type);

      // ✅ NEW: Handle different response types
      if (response.response_type === "edit" && response.diff) {
        console.log("✏️ [ChatView] EDIT mode - showing diff approval");

        // Show approval UI
        setPendingApproval({
          messageId: (Date.now() + 1).toString(),
          type: "edit",
          data: {
            message: response.message,
            original_content: response.original_content,
            new_content: response.new_content,
            diff: response.diff,
            file_path: response.file_path,
            tokens_used: response.tokens_used,
          },
        });

        // Add a message indicating approval needed
        const aiMessage: ExtendedMessage = {
          id: (Date.now() + 1).toString(),
          content: response.message,
          sender: "ai",
          timestamp: new Date().toISOString(),
          response_type: "edit",
          original_content: response.original_content,
          new_content: response.new_content,
          diff: response.diff,
          file_path: response.file_path,
          tokens_used: response.tokens_used,
        };

        setMessages((prevMessages) => [...prevMessages, aiMessage]);
      } else if (response.response_type === "create" && response.new_content) {
        console.log("📝 [ChatView] CREATE mode - showing file preview");

        // Show approval UI
        setPendingApproval({
          messageId: (Date.now() + 1).toString(),
          type: "create",
          data: {
            message: response.message,
            new_content: response.new_content,
            file_path: response.file_path,
            tokens_used: response.tokens_used,
          },
        });

        // Add a message indicating approval needed
        const aiMessage: ExtendedMessage = {
          id: (Date.now() + 1).toString(),
          content: response.message,
          sender: "ai",
          timestamp: new Date().toISOString(),
          response_type: "create",
          new_content: response.new_content,
          file_path: response.file_path,
          tokens_used: response.tokens_used,
        };

        setMessages((prevMessages) => [...prevMessages, aiMessage]);
      } else {
        // Regular chat response
        const aiMessage: ExtendedMessage = {
          id: (Date.now() + 1).toString(),
          content: response.message,
          sender: "ai",
          timestamp: new Date().toISOString(),
          response_type: "chat",
        };

        setMessages((prevMessages) => [...prevMessages, aiMessage]);
      }
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

  // ✅ NEW: Handle approval actions
  const handleApprove = async () => {
    if (!pendingApproval) return;

    console.log("✅ [ChatView] User approved:", pendingApproval.type);

    if (pendingApproval.type === "edit") {
      // Apply the edit to the file
      const { new_content, file_path } = pendingApproval.data;

      try {
        console.log("📝 [ChatView] Applying edit to file:", file_path);

        // ✅ NEW: Send write command to extension
        vscodeAPI.postMessage({
          command: "writeFile",
          filePath: file_path,
          content: new_content,
        });

        // Clear pending approval
        setPendingApproval(null);
      } catch (error) {
        console.error("❌ [ChatView] Failed to apply edit:", error);
        setError("Failed to apply changes to file");
      }
    } else if (pendingApproval.type === "create") {
      // Create the new file
      const { new_content, file_path } = pendingApproval.data;

      try {
        console.log("📝 [ChatView] Creating file:", file_path);

        // ✅ NEW: Send create command to extension
        vscodeAPI.postMessage({
          command: "createFile",
          filePath: file_path,
          content: new_content,
        });

        // Clear pending approval
        setPendingApproval(null);
      } catch (error) {
        console.error("❌ [ChatView] Failed to create file:", error);
        setError("Failed to create file");
      }
    }
  };

  const handleReject = () => {
    console.log("❌ [ChatView] User rejected changes");
    setPendingApproval(null);
  };

  // ✅ NEW: Render diff view
  const renderDiff = (original: string, modified: string) => {
    const diff = diffLines(original, modified);

    return (
      <div className="diff-view">
        {diff.map((part, index) => {
          const className = part.added
            ? "diff-added"
            : part.removed
            ? "diff-removed"
            : "diff-unchanged";

          return (
            <div key={index} className={className}>
              {part.value.split("\n").map((line, lineIndex) => (
                <div key={lineIndex} className="diff-line">
                  <span className="diff-marker">
                    {part.added ? "+" : part.removed ? "-" : " "}
                  </span>
                  <span className="diff-content">{line}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const handleViewDiff = (message: ExtendedMessage) => {
    console.log("📊 [ChatView] Opening diff view in VS Code");

    if (
      !message.original_content ||
      !message.new_content ||
      !message.file_path
    ) {
      console.error("❌ Missing diff data");
      return;
    }

    vscodeAPI.postMessage({
      command: "viewDiff",
      filePath: message.file_path,
      originalContent: message.original_content,
      newContent: message.new_content,
    });
  };

  return (
    <div className="chat-view">
      {/* ✅ Chat Header with Clear Button */}
      <div className="chat-header">
        <span className="chat-title">Chat</span>
        {messages.length > 0 && (
          <button
            className="clear-button"
            onClick={clearChat}
            title="Clear chat"
          >
            🗑️ Clear
          </button>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !isLoading && (
          <div className="empty-state">
            <span className="empty-icon">💬</span>
            <span className="empty-text">Start a conversation</span>
            <span className="empty-hint">
              {fileInfo
                ? `Ask about ${fileInfo.fileName}`
                : "Open a file to get context-aware answers"}
            </span>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender}`}>
            <div className="message-content">
              {message.sender === "ai" ? (
                <>
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

                  {/* ✅ NEW: Show diff for edit responses */}
                  {message.response_type === "edit" &&
                    message.original_content &&
                    message.new_content && (
                      <div className="diff-container">
                        <div className="diff-header">
                          <span className="diff-title">
                            📝 Proposed Changes
                          </span>
                          <span className="diff-file">{message.file_path}</span>
                        </div>
                        {renderDiff(
                          message.original_content,
                          message.new_content
                        )}
                        {pendingApproval?.messageId === message.id && (
                          <div className="diff-actions">
                            <button
                              className="view-diff-button"
                              onClick={() => handleViewDiff(message)}
                            >
                              👁️ View Diff in Editor
                            </button>
                            <button
                              className="approve-button"
                              onClick={handleApprove}
                            >
                              ✅ Apply Changes
                            </button>
                            <button
                              className="reject-button"
                              onClick={handleReject}
                            >
                              ❌ Reject
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                  {/* ✅ NEW: Show file preview for create responses */}
                  {message.response_type === "create" &&
                    message.new_content && (
                      <div className="file-preview-container">
                        <div className="file-preview-header">
                          <span className="preview-title">
                            📄 New File Preview
                          </span>
                          <span className="preview-file">
                            {message.file_path}
                          </span>
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language="typescript"
                          PreTag="div"
                          customStyle={{ maxHeight: "400px", overflow: "auto" }}
                        >
                          {message.new_content}
                        </SyntaxHighlighter>
                        {pendingApproval?.messageId === message.id && (
                          <div className="file-preview-actions">
                            <button
                              className="approve-button"
                              onClick={handleApprove}
                            >
                              ✅ Create File
                            </button>
                            <button
                              className="reject-button"
                              onClick={handleReject}
                            >
                              ❌ Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                  {/* ✅ NEW: Show token usage if available */}
                  {message.tokens_used && (
                    <div className="token-usage">
                      <span className="token-label">Tokens:</span>
                      <span className="token-value">
                        {message.tokens_used.total}
                      </span>
                    </div>
                  )}
                </>
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
                📎
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
