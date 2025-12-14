import { ApprovalRequest, ApprovalResponse } from "./approval.types";

/**
 * Message types for communication between webview and extension
 */

export type MessageType =
  | "login"
  | "logout"
  | "getProjects"
  | "selectProject"
  | "sendMessage"
  | "webviewReady"
  | "tokenValidated"
  | "projectDetected"
  | "startIndexing"
  | "getProjectIndexStatus"
  | "requestApproval" // NEW
  | "approvalResponse"
  | "chatResponse";

export interface BaseMessage {
  type: MessageType;
}

// Auth messages
export interface LoginMessage extends BaseMessage {
  type: "login";
  email: string;
  password: string;
}

export interface LogoutMessage extends BaseMessage {
  type: "logout";
}

// Project messages
export interface GetProjectsMessage extends BaseMessage {
  type: "getProjects";
}

export interface SelectProjectMessage extends BaseMessage {
  type: "selectProject";
  projectId: number;
}

// Chat messages
export interface SendChatMessage extends BaseMessage {
  type: "sendMessage";
  message: string;
}

// System messages
export interface WebviewReadyMessage extends BaseMessage {
  type: "webviewReady";
}

export interface TokenValidatedMessage extends BaseMessage {
  type: "tokenValidated";
}

export interface ProjectDetectedMessage extends BaseMessage {
  type: "projectDetected";
  gitUrl: string;
  folderName: string;
}

// Indexing messages
export interface StartIndexingMessage extends BaseMessage {
  type: "startIndexing";
  projectId: number;
}

export interface GetProjectIndexStatusMessage extends BaseMessage {
  type: "getProjectIndexStatus";
  projectId: number;
}

// Approval messages (NEW)
export interface RequestApprovalMessage extends BaseMessage {
  type: "requestApproval";
  approval: ApprovalRequest;
}

export interface ApprovalResponseMessage extends BaseMessage {
  type: "approvalResponse";
  response: ApprovalResponse;
}

// Union type of all messages
export type WebviewMessage =
  | LoginMessage
  | LogoutMessage
  | GetProjectsMessage
  | SelectProjectMessage
  | SendChatMessage
  | WebviewReadyMessage
  | TokenValidatedMessage
  | ProjectDetectedMessage
  | StartIndexingMessage
  | GetProjectIndexStatusMessage
  | RequestApprovalMessage
  | ApprovalResponseMessage
  | ChatResponseMessage;

// Chat response messages (NEW)
export interface ChatResponseMessage extends BaseMessage {
  type: "chatResponse";
  response: {
    message: string;
    chat_session_id?: string;
    response_type: "chat" | "edit" | "create";
    // For edit responses:
    original_content?: string;
    new_content?: string;
    diff?: string;
    file_path?: string;
    tokens_used?: {
      step1_gpt4o_mini?: number;
      step2_prompt?: number;
      step2_response?: number;
      total?: number;
    };
  };
}
