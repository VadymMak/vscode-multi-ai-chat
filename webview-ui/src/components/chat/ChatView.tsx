import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Message } from "../../types/index";
import { sendMessage } from "../../services/apiService";
import { vscodeAPI } from "../../utils/vscodeApi";
import "./ChatView.css";
import { diffLines } from "diff";

// ✅ Context mode type
type ContextMode = "selection" | "file" | "project";

// ✅ File context interface
interface FileContext {
  filePath?: string;
  fileName?: string;
  fileContent?: string;
  selectedText?: string;
  language?: string;
  lineCount?: number;
}

// ✅ API Response wrapper interface
interface ApiResponse {
  success?: boolean;
  data?: ExtendedMessage;
  message?: string;
  response_type?: "chat" | "edit" | "create";
  original_content?: string;
  new_content?: string;
  diff?: string;
  file_path?: string;
  tokens_used?: any;
}

interface ExtendedMessage extends Message {
  message?: string;
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [fileContext, setFileContext] = useState<FileContext | null>(null);
  const [includeFile, setIncludeFile] = useState<boolean>(true);

  // ✅ NEW: Context mode state
  const [contextMode, setContextMode] = useState<ContextMode>("file");

  useEffect(() => {
    const savedMessages = loadMessagesFromStorage();
    if (savedMessages) {
      setMessages(savedMessages);
    }

    // ✅ Load saved context mode
    const savedMode = (globalThis as any).sessionStorage?.getItem(
      "multi-ai-chat-context-mode"
    );
    if (savedMode && ["selection", "file", "project"].includes(savedMode)) {
      setContextMode(savedMode as ContextMode);
    }
  }, []);

  useEffect(() => {
    saveMessagesToStorage(messages);
  }, [messages]);

  // ✅ Save context mode when it changes
  useEffect(() => {
    (globalThis as any).sessionStorage?.setItem(
      "multi-ai-chat-context-mode",
      contextMode
    );
  }, [contextMode]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      console.log(
        "📨 [ChatView] Received message:",
        message.command || message.type
      );

      if (message.command === "fileContext" || message.type === "currentFile") {
        console.log("📄 [ChatView] File context updated:", {
          filePath: message.data?.filePath || message.filePath,
          contentLength:
            message.data?.fileContent?.length || message.fileContent?.length,
          lineCount: message.data?.lineCount || message.lineCount,
        });

        // ✅ Handle both message formats
        const context = message.data || {
          filePath: message.filePath,
          fileContent: message.fileContent,
          lineCount: message.lineCount,
        };

        setFileContext(context);
      }
    };

    window.addEventListener("message", messageHandler);

    // ✅ Request initial file context when component mounts
    console.log("🔄 [ChatView] Requesting initial file context");
    vscodeAPI.postMessage({
      command: "getFileContext",
      mode: "edit",
    });

    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, []);

  const loadMessagesFromStorage = () => {
    const savedMessages = (globalThis as any).sessionStorage?.getItem(
      "multi-ai-chat-messages"
    );
    return savedMessages ? JSON.parse(savedMessages) : null;
  };

  const saveMessagesToStorage = (messages: ExtendedMessage[]) => {
    (globalThis as any).sessionStorage?.setItem(
      "multi-ai-chat-messages",
      JSON.stringify(messages)
    );
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const requestFileContext = (mode: "chat" | "edit" | "create" = "edit") => {
    // ✅ Default mode = 'edit' чтобы не обрезать большие файлы
    vscodeAPI.postMessage({
      command: "getFileContext",
      mode: mode,
    });
  };

  const detectMode = (message: string): "chat" | "edit" | "create" => {
    const lowerMessage = message.toLowerCase();

    // EDIT mode keywords
    const editKeywords = [
      "add",
      "fix",
      "change",
      "modify",
      "update",
      "refactor",
      "remove",
      "delete",
      "replace",
      "edit",
      "correct",
      "improve",
      "optimize",
      "rewrite",
      "wrap",
      "line",
      "comment",
      "rename",
      "move",
    ];

    // CREATE mode keywords
    const createKeywords = [
      "create",
      "generate",
      "make",
      "build",
      "write new",
      "add new",
      "new file",
      "new class",
      "new function",
    ];

    // Check for CREATE
    if (createKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      return "create";
    }

    // Check for EDIT
    if (editKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      return "edit";
    }

    // Default to CHAT
    return "chat";
  };

  const refreshFileContext = () => {
    requestFileContext();
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    (globalThis as any).sessionStorage?.removeItem("multi-ai-chat-messages");
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // ✅ NEW: Get context based on selected mode
  const getContextForMode = (): FileContext | undefined => {
    if (!includeFile || !fileContext) return undefined;

    switch (contextMode) {
      case "selection":
        // Only send selected text (if any)
        if (fileContext.selectedText) {
          return {
            ...fileContext,
            fileContent: fileContext.selectedText, // Override with selection
          };
        }
        // If no selection, show warning and fall back to file mode
        console.warn("⚠️ [ChatView] No selection, falling back to file mode");
        return fileContext;

      case "file":
        // Send full file content (default behavior)
        return fileContext;

      case "project":
        // Signal to backend to use Smart Context (pgvector search)
        // We still send file context for reference, but backend will augment with project search
        return {
          ...fileContext,
          // Add marker for backend to know to use project-wide context
        };

      default:
        return fileContext;
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    // ✅ Detect mode from user message
    const mode = detectMode(inputValue);
    console.log(
      "🎯 [ChatView] Detected mode:",
      mode,
      "| Context mode:",
      contextMode
    );

    // ✅ Get context based on selected context mode
    const contextToSend = getContextForMode();

    console.log("📄 [ChatView] Using file context:", {
      filePath: contextToSend?.filePath,
      contentLength: contextToSend?.fileContent?.length,
      contextMode,
      mode,
    });

    const userMessage: ExtendedMessage = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date().toISOString(),
      response_type: "chat",
    };

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInputValue("");
    setError(null);
    setIsLoading(true);

    try {
      console.log("📤 [ChatView] Sending message with context:", {
        hasContext: !!contextToSend,
        filePath: contextToSend?.filePath,
        contentLength: contextToSend?.fileContent?.length,
        contextMode,
      });

      // ✅ Pass contextMode to sendMessage
      const response = (await sendMessage(
        userMessage.content,
        contextToSend,
        mode,
        contextMode // NEW: Pass context mode
      )) as ApiResponse;

      // ✅ FIX: Unwrap nested data object from backend
      const actualResponse = (response.data || response) as ExtendedMessage;

      console.log("🔍 [ChatView] Response structure:", {
        hasData: !!response.data,
        response_type: actualResponse.response_type,
        has_original: !!actualResponse.original_content,
        has_new: !!actualResponse.new_content,
        has_diff: !!actualResponse.diff,
      });

      const aiMessage: ExtendedMessage = {
        id: (Date.now() + 1).toString(),
        content: actualResponse.message || "",
        sender: "ai",
        timestamp: new Date().toISOString(),
        response_type: actualResponse.response_type,
        original_content: actualResponse.original_content,
        new_content: actualResponse.new_content,
        diff: actualResponse.diff,
        file_path: actualResponse.file_path,
        tokens_used: actualResponse.tokens_used,
      };

      setMessages((prevMessages) => [...prevMessages, aiMessage]);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorMessage = (err: unknown) => {
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

    return errorMessage;
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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

  const applyFileEdit = async (filePath: string, content: string) => {
    try {
      vscodeAPI.postMessage({
        command: "writeFile",
        filePath: filePath,
        content: content,
      });
    } catch (error) {
      console.error("Failed to apply edit:", error);
      setError("Failed to apply changes to file");
    }
  };

  const createFile = async (filePath: string, content: string) => {
    try {
      vscodeAPI.postMessage({
        command: "createFile",
        filePath: filePath,
        content: content,
      });
    } catch (error) {
      console.error("Failed to create file:", error);
      setError("Failed to create file");
    }
  };

  const renderDiff = (original: string, modified: string, filePath: string) => {
    const diff = diffLines(original, modified);

    // Определяем язык из расширения файла
    const getLanguage = (path: string): string => {
      const ext = path.split(".").pop()?.toLowerCase();
      const langMap: { [key: string]: string } = {
        ts: "typescript",
        tsx: "tsx",
        js: "javascript",
        jsx: "jsx",
        py: "python",
        json: "json",
        css: "css",
        html: "html",
        md: "markdown",
        yml: "yaml",
        yaml: "yaml",
      };
      return langMap[ext || ""] || "typescript";
    };

    const language = getLanguage(filePath);

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
              <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  padding: 0,
                  background: "transparent",
                  fontSize: "13px",
                  lineHeight: "1.5",
                }}
                codeTagProps={{
                  style: {
                    fontFamily:
                      '"Consolas", "Monaco", "Courier New", monospace',
                  },
                }}
                showLineNumbers={true}
                lineNumberStyle={{
                  minWidth: "30px",
                  paddingRight: "10px",
                  textAlign: "center",
                  userSelect: "none",
                  color: part.added
                    ? "#4ec9b0"
                    : part.removed
                    ? "#f48771"
                    : "#858585",
                  backgroundColor: part.added
                    ? "rgba(46, 160, 67, 0.3)"
                    : part.removed
                    ? "rgba(244, 71, 71, 0.25)"
                    : "transparent",
                }}
                wrapLines={true}
                lineProps={(lineNumber) => ({
                  style: {
                    display: "block",
                    width: "100%",
                  },
                })}
              >
                {part.value}
              </SyntaxHighlighter>
            </div>
          );
        })}
      </div>
    );
  };

  const handleViewDiff = (message: ExtendedMessage) => {
    if (
      !message.original_content ||
      !message.new_content ||
      !message.file_path
    ) {
      console.error("Missing diff data");
      return;
    }

    vscodeAPI.postMessage({
      command: "viewDiff",
      filePath: message.file_path,
      originalContent: message.original_content,
      newContent: message.new_content,
    });
  };

  // ✅ NEW: Get context mode description
  const getContextModeDescription = (mode: ContextMode): string => {
    switch (mode) {
      case "selection":
        return "AI sees only selected code";
      case "file":
        return "AI sees current file";
      case "project":
        return "AI uses Smart Context (pgvector)";
      default:
        return "";
    }
  };

  const fileInfo = getFileInfo();

  return (
    <div className="chat-view">
      {/* Header */}
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

      {/* ✅ NEW: Context Mode Selector */}
      <div className="context-mode-bar">
        <span className="context-mode-label">Context:</span>
        <div className="context-mode-selector">
          <button
            className={`context-mode-btn ${
              contextMode === "selection" ? "active" : ""
            }`}
            onClick={() => setContextMode("selection")}
            title={getContextModeDescription("selection")}
          >
            <span className="mode-icon">✂️</span>
            <span className="mode-text">Selection</span>
          </button>
          <button
            className={`context-mode-btn ${
              contextMode === "file" ? "active" : ""
            }`}
            onClick={() => setContextMode("file")}
            title={getContextModeDescription("file")}
          >
            <span className="mode-icon">📄</span>
            <span className="mode-text">File</span>
          </button>
          <button
            className={`context-mode-btn ${
              contextMode === "project" ? "active" : ""
            }`}
            onClick={() => setContextMode("project")}
            title={getContextModeDescription("project")}
          >
            <span className="mode-icon">📁</span>
            <span className="mode-text">Project</span>
          </button>
        </div>
      </div>

      {/* Messages */}
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
            {/* ✅ Show current context mode hint */}
            <span
              className="empty-hint"
              style={{ marginTop: "8px", color: "#4fc3f7" }}
            >
              Context:{" "}
              {contextMode === "selection"
                ? "✂️ Selection"
                : contextMode === "file"
                ? "📄 Active File"
                : "📁 Full Project"}
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

                  {/* Diff View */}
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
                          message.new_content,
                          message.file_path || "file.ts"
                        )}

                        <div className="diff-actions">
                          <button
                            className="view-diff-button"
                            onClick={() => handleViewDiff(message)}
                          >
                            👁️ View Diff in Editor
                          </button>
                          <button
                            className="approve-button"
                            onClick={() =>
                              applyFileEdit(
                                message.file_path!,
                                message.new_content!
                              )
                            }
                          >
                            ✅ Apply Changes
                          </button>
                        </div>
                      </div>
                    )}

                  {/* File Preview */}
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

                        <div className="file-preview-actions">
                          <button
                            className="approve-button"
                            onClick={() =>
                              createFile(
                                message.file_path!,
                                message.new_content!
                              )
                            }
                          >
                            ✅ Create File
                          </button>
                        </div>
                      </div>
                    )}

                  {/* Token Usage */}
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

      {/* File Context Indicator */}
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
              {/* ✅ NEW: Show context mode badge */}
              {contextMode === "project" && (
                <span className="file-badge project">Smart Context</span>
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
