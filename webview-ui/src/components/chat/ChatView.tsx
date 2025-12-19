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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [fileContext, setFileContext] = useState<FileContext | null>(null);
  const [includeFile, setIncludeFile] = useState<boolean>(true);

  useEffect(() => {
    const savedMessages = loadMessagesFromStorage();
    if (savedMessages) {
      setMessages(savedMessages);
    }
  }, []);

  useEffect(() => {
    saveMessagesToStorage(messages);
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "fileContext") {
        setFileContext(message.data);
      }
    };

    window.addEventListener("message", messageHandler);
    requestFileContext();

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

  const requestFileContext = () => {
    vscodeAPI.postMessage({ command: "getFileContext" });
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

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

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
      const contextToSend =
        includeFile && fileContext ? fileContext : undefined;
      const response = await sendMessage(userMessage.content, contextToSend);

      const aiMessage: ExtendedMessage = {
        id: (Date.now() + 1).toString(),
        content: response.message,
        sender: "ai",
        timestamp: new Date().toISOString(),
        response_type: response.response_type,
        ...response,
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
                          message.file_path || "file.ts" // Передаём путь к файлу
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
