import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Message } from "../../types/index";
import {
  sendMessage,
  planTask,
  executeStep,
  skipStep,
  cancelPlan,
  TaskPlan,
  TaskStep,
  ExecuteStepResult,
} from "../../services/apiService";
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

  // ✅ NEW: Agentic Workflow state
  const [activePlan, setActivePlan] = useState<TaskPlan | null>(null);
  const [executingStep, setExecutingStep] = useState<number | null>(null);
  const [stepResults, setStepResults] = useState<
    Record<number, ExecuteStepResult>
  >({});
  
  // ✅ NEW: Track which steps have been applied
  const [appliedSteps, setAppliedSteps] = useState<Set<number>>(new Set());

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

  // ✅ NEW: Detect if message is an agentic task
  const isAgenticTask = (message: string): boolean => {
    const lowerMessage = message.toLowerCase();

    const agenticKeywords = [
      "implement",
      "build feature",
      "add feature",
      "create system",
      "set up",
      "setup",
      "integrate",
      "build out",
      "develop",
      "architect",
      "design and implement",
      "full implementation",
      "end to end",
      "e2e",
      "complete implementation",
      "add authentication",
      "add authorization",
      "add api",
      "add crud",
      "refactor entire",
      "restructure",
    ];

    // Check if message suggests multi-step task
    const hasAgenticKeyword = agenticKeywords.some((keyword) =>
      lowerMessage.includes(keyword)
    );

    // Also check for long, complex requests (>50 chars with action words)
    const isComplexRequest =
      message.length > 50 &&
      (lowerMessage.includes("and") ||
        lowerMessage.includes("with") ||
        lowerMessage.includes("including"));

    return hasAgenticKeyword || isComplexRequest;
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

  // ✅ NEW: Handle agentic task planning
  const handlePlanTask = async (task: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("📋 [ChatView] Planning task:", task);

      const plan = await planTask(
        task,
        fileContext
          ? {
              filePath: fileContext.filePath,
              fileContent: fileContext.fileContent,
            }
          : undefined
      );

      console.log("✅ [ChatView] Plan received:", plan);

      setActivePlan(plan);
      setStepResults({});
      setAppliedSteps(new Set()); // ✅ Reset applied steps

      // Add plan as AI message
      const planMessage: ExtendedMessage = {
        id: Date.now().toString(),
        content: `📋 **Task Plan Created**\n\n**Task:** ${plan.task}\n**Steps:** ${plan.total_steps}\n**Estimated Time:** ${plan.estimated_time}`,
        sender: "ai",
        timestamp: new Date().toISOString(),
        response_type: "plan" as any,
      };

      setMessages((prev) => [...prev, planMessage]);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ FIXED: Handle step execution with proper logging
  const handleExecuteStep = async (stepNum: number) => {
    if (!activePlan || executingStep !== null) return;

    setExecutingStep(stepNum);
    setError(null);

    try {
      const step = activePlan.steps[stepNum - 1];
      console.log(`⚡ [ChatView] Executing step ${stepNum}:`, step.description);
      console.log(`⚡ [ChatView] Step action: ${step.action}, file: ${step.file_path}`);

      // For edit steps, we need to get current file content
      let fileContent: string | undefined;
      if (step.action === "edit" && step.file_path) {
        if (fileContext?.filePath?.endsWith(step.file_path.split("/").pop() || "")) {
          fileContent = fileContext.fileContent;
          console.log(`📄 [ChatView] Using local file content: ${fileContext.filePath}`);
        } else {
          console.log(`⚠️ [ChatView] No local file content for: ${step.file_path}`);
          // Backend will try to get from database
        }
      }

      const result = await executeStep(activePlan.plan_id, stepNum, fileContent);

      // ✅ DETAILED LOGGING
      console.log(`✅ [ChatView] Step ${stepNum} result:`, {
        success: result.success,
        step_status: result.step?.status,
        has_result: !!result.result,
        result_action: result.result?.action,
        result_file_path: result.result?.file_path,
        result_new_content_length: result.result?.new_content?.length || 0,
        plan_completed: result.plan_completed,
      });

      // ✅ Log full result for debugging
      console.log(`🔍 [ChatView] Step ${stepNum} FULL result.result:`, result.result);

      // Update step results
      setStepResults((prev) => ({
        ...prev,
        [stepNum]: result,
      }));

      // Update plan steps status
      setActivePlan((prev) => {
        if (!prev) return prev;
        const updatedSteps = [...prev.steps];
        updatedSteps[stepNum - 1] = result.step;
        return { ...prev, steps: updatedSteps };
      });

      // ✅ FIXED: If plan completed, show completion message but DON'T remove plan!
      // User needs to Apply each step's changes first!
      if (result.plan_completed) {
        const completionMessage: ExtendedMessage = {
          id: Date.now().toString(),
          content: `🎉 **All Steps Executed!**\n\nPlease review and click **"✅ Apply"** for each step to save the changes to your files.`,
          sender: "ai",
          timestamp: new Date().toISOString(),
          response_type: "chat",
        };
        setMessages((prev) => [...prev, completionMessage]);
        // ❌ DON'T do: setActivePlan(null);
        // Plan will be cleared when user clicks "Done - Dismiss Plan"
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);

      // Mark step as failed
      setActivePlan((prev) => {
        if (!prev) return prev;
        const updatedSteps = [...prev.steps];
        updatedSteps[stepNum - 1] = {
          ...updatedSteps[stepNum - 1],
          status: "failed",
          error: errorMessage,
        };
        return { ...prev, steps: updatedSteps };
      });
    } finally {
      setExecutingStep(null);
    }
  };

  // ✅ NEW: Skip a step
  const handleSkipStep = async (stepNum: number) => {
    if (!activePlan) return;

    try {
      console.log(`⏭️ [ChatView] Skipping step ${stepNum}`);

      const result = await skipStep(activePlan.plan_id, stepNum);

      // Update plan
      setActivePlan((prev) => {
        if (!prev) return prev;
        const updatedSteps = [...prev.steps];
        updatedSteps[stepNum - 1] = {
          ...updatedSteps[stepNum - 1],
          status: "skipped",
        };
        return { ...prev, steps: updatedSteps };
      });

      // ✅ FIXED: Don't remove plan even if completed - user may still want to apply other steps
      if (result.plan_completed) {
        const completionMessage: ExtendedMessage = {
          id: Date.now().toString(),
          content: `🎉 **All Steps Processed!**\n\nPlease review and click **"✅ Apply"** for completed steps to save the changes.`,
          sender: "ai",
          timestamp: new Date().toISOString(),
          response_type: "chat",
        };
        setMessages((prev) => [...prev, completionMessage]);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // ✅ NEW: Cancel entire plan
  const handleCancelPlan = async () => {
    if (!activePlan) return;

    try {
      console.log(`🛑 [ChatView] Cancelling plan ${activePlan.plan_id}`);

      await cancelPlan(activePlan.plan_id);

      setActivePlan(null);
      setStepResults({});
      setAppliedSteps(new Set());

      const cancelMessage: ExtendedMessage = {
        id: Date.now().toString(),
        content: `🛑 **Task Cancelled**`,
        sender: "ai",
        timestamp: new Date().toISOString(),
        response_type: "chat",
      };
      setMessages((prev) => [...prev, cancelMessage]);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // ✅ NEW: Dismiss plan (after user has applied all changes)
  const handleDismissPlan = () => {
    console.log(`✅ [ChatView] Dismissing plan`);
    setActivePlan(null);
    setStepResults({});
    setAppliedSteps(new Set());
  };

  // ✅ FIXED: Apply step result (create/edit file) with logging
  const handleApplyStepResult = (stepNum: number) => {
    console.log(`🔧 [ChatView] handleApplyStepResult called for step ${stepNum}`);
    
    const result = stepResults[stepNum];
    console.log(`🔧 [ChatView] stepResults[${stepNum}]:`, result);
    
    if (!result?.result) {
      console.error(`❌ [ChatView] No result for step ${stepNum}`);
      return;
    }

    const { action, file_path, new_content } = result.result;
    
    console.log(`✏️ [ChatView] Applying step ${stepNum}:`, {
      action,
      file_path,
      new_content_length: new_content?.length || 0,
    });

    if (action === "create" && file_path && new_content) {
      console.log(`📄 [ChatView] Creating file: ${file_path}`);
      createFile(file_path, new_content);
      // ✅ Mark as applied
      setAppliedSteps((prev) => new Set([...prev, stepNum]));
    } else if (action === "edit" && file_path && new_content) {
      console.log(`✏️ [ChatView] Editing file: ${file_path}`);
      applyFileEdit(file_path, new_content);
      // ✅ Mark as applied
      setAppliedSteps((prev) => new Set([...prev, stepNum]));
    } else {
      console.error(`❌ [ChatView] Cannot apply - missing data:`, { 
        action, 
        file_path, 
        has_content: !!new_content 
      });
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
    const currentInput = inputValue;
    setInputValue("");
    setError(null);

    // ✅ NEW: Check if this is an agentic task
    if (isAgenticTask(currentInput)) {
      console.log("🤖 [ChatView] Detected agentic task, planning...");
      await handlePlanTask(currentInput);
      return;
    }

    // ✅ Regular chat/edit/create flow
    const mode = detectMode(currentInput);
    console.log(
      "🎯 [ChatView] Detected mode:",
      mode,
      "| Context mode:",
      contextMode
    );

    const contextToSend = getContextForMode();

    console.log("📄 [ChatView] Using file context:", {
      filePath: contextToSend?.filePath,
      contentLength: contextToSend?.fileContent?.length,
      contextMode,
      mode,
    });

    setIsLoading(true);

    try {
      console.log("📤 [ChatView] Sending message with context:", {
        hasContext: !!contextToSend,
        filePath: contextToSend?.filePath,
        contentLength: contextToSend?.fileContent?.length,
        contextMode,
      });

      const response = (await sendMessage(
        currentInput,
        contextToSend,
        mode,
        contextMode
      )) as ApiResponse;

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

  // ✅ FIXED: Render the active plan UI with proper Apply buttons and safety checks
  const renderPlanView = () => {
    if (!activePlan) return null;

    const completedSteps = activePlan.steps.filter(
      (s) => s.status === "completed"
    ).length;
    const progress = (completedSteps / activePlan.total_steps) * 100;
    
    // ✅ Check if all steps are done (completed or skipped)
    const allStepsDone = activePlan.steps.every(
      (s) => s.status === "completed" || s.status === "skipped"
    );

    return (
      <div className="plan-view">
        <div className="plan-header">
          <div className="plan-title">
            <span className="plan-icon">📋</span>
            <span className="plan-text">Task Plan</span>
            <span className="plan-id">#{activePlan.plan_id}</span>
          </div>
          <div className="plan-meta">
            <span className="plan-progress">
              {completedSteps}/{activePlan.total_steps} steps
            </span>
            <span className="plan-time">⏱️ {activePlan.estimated_time}</span>
          </div>
        </div>

        <div className="plan-progress-bar">
          <div
            className="plan-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="plan-task">
          <strong>Task:</strong> {activePlan.task}
        </div>

        <div className="plan-steps">
          {activePlan.steps.map((step, index) => {
            const stepNum = index + 1;
            const isExecuting = executingStep === stepNum;
            const result = stepResults[stepNum];
            const isApplied = appliedSteps.has(stepNum);
            
            // ✅ NEW: Safety check for suspiciously short content
            const contentLength = result?.result?.new_content?.length || 0;
            const isSuspiciouslyShort = contentLength > 0 && contentLength < 200;
            const isErrorResponse = result?.result?.new_content?.includes('[ERROR]') || 
                                    result?.result?.new_content?.toLowerCase().includes('quota') ||
                                    result?.result?.new_content?.toLowerCase().includes('rate limit');

            return (
              <div
                key={stepNum}
                className={`plan-step ${step.status} ${
                  isExecuting ? "executing" : ""
                } ${isApplied ? "applied" : ""}`}
              >
                <div className="step-header">
                  <span className="step-number">
                    {isApplied
                      ? "✅"
                      : step.status === "completed"
                      ? "🔵"
                      : step.status === "failed"
                      ? "❌"
                      : step.status === "skipped"
                      ? "⏭️"
                      : isExecuting
                      ? "⏳"
                      : stepNum}
                  </span>
                  <span className="step-action">
                    {step.action.toUpperCase()}
                  </span>
                  {step.file_path && (
                    <span className="step-file">{step.file_path}</span>
                  )}
                  <span
                    className={`step-complexity ${step.estimated_complexity}`}
                  >
                    {step.estimated_complexity}
                  </span>
                </div>

                <div className="step-description">{step.description}</div>

                {step.error && (
                  <div className="step-error">❌ {step.error}</div>
                )}

                {/* ✅ FIXED: Show result preview for completed create/edit steps with safety checks */}
                {result?.result?.new_content && step.status === "completed" && (
                  <div className={`step-result-preview ${isErrorResponse ? 'error-response' : ''} ${isSuspiciouslyShort ? 'warning-response' : ''}`}>
                    <div className="result-header">
                      <span>📝 Generated Code ({contentLength} chars)</span>
                      
                      {/* ✅ NEW: Warning badges for problematic responses */}
                      {isErrorResponse && (
                        <span className="error-badge">❌ API Error - Do NOT Apply!</span>
                      )}
                      {isSuspiciouslyShort && !isErrorResponse && (
                        <span className="warning-badge">⚠️ Suspiciously short!</span>
                      )}
                      
                      {isApplied ? (
                        <span className="applied-badge">✅ Applied</span>
                      ) : isErrorResponse ? (
                        <span className="blocked-badge">🚫 Blocked</span>
                      ) : (
                        <button
                          className={`apply-step-btn ${isSuspiciouslyShort ? 'warning' : ''}`}
                          onClick={() => handleApplyStepResult(stepNum)}
                          disabled={isErrorResponse}
                          title={isSuspiciouslyShort ? 'Warning: Content seems too short. Review before applying!' : 'Apply changes to file'}
                        >
                          {isSuspiciouslyShort ? '⚠️ Apply (Review First!)' : '✅ Apply to File'}
                        </button>
                      )}
                    </div>
                    <pre className={`result-code ${isErrorResponse ? 'error-code' : ''}`}>
                      {result.result.new_content.slice(0, 500)}
                      {result.result.new_content.length > 500 ? "\n\n... (truncated)" : ""}
                    </pre>
                  </div>
                )}

                {/* Show command for command steps */}
                {result?.result?.command && step.status === "completed" && (
                  <div className="step-command">
                    <code>{result.result.command}</code>
                    <button
                      className="copy-cmd-btn"
                      onClick={() => handleCopy(result.result!.command!)}
                    >
                      📋
                    </button>
                  </div>
                )}

                {/* Action buttons for pending steps */}
                {step.status === "pending" && !isExecuting && (
                  <div className="step-actions">
                    <button
                      className="execute-btn"
                      onClick={() => handleExecuteStep(stepNum)}
                      disabled={executingStep !== null}
                    >
                      ▶️ Execute
                    </button>
                    <button
                      className="skip-btn"
                      onClick={() => handleSkipStep(stepNum)}
                      disabled={executingStep !== null}
                    >
                      ⏭️ Skip
                    </button>
                  </div>
                )}

                {isExecuting && (
                  <div className="step-executing">
                    <span className="executing-spinner">⏳</span>
                    Executing...
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="plan-actions">
          <button
            className="execute-all-btn"
            onClick={async () => {
              for (const step of activePlan.steps) {
                if (step.status === "pending") {
                  await handleExecuteStep(step.step_num);
                }
              }
            }}
            disabled={executingStep !== null}
          >
            ▶️ Execute All Remaining
          </button>
          
          {/* ✅ NEW: Dismiss button - shown when all steps are done */}
          {allStepsDone && (
            <button
              className="dismiss-plan-btn"
              onClick={handleDismissPlan}
            >
              ✅ Done - Dismiss Plan
            </button>
          )}
          
          <button
            className="cancel-plan-btn"
            onClick={handleCancelPlan}
            disabled={executingStep !== null}
          >
            🛑 Cancel Plan
          </button>
        </div>
      </div>
    );
  };

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

      {/* ✅ NEW: Active Plan View */}
      {activePlan && renderPlanView()}

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