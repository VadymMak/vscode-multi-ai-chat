/**
 * Universal approval dialog types
 * Supports: File edits, file creation, task execution, etc.
 */

export type ApprovalType =
  | "editFile"
  | "createFile"
  | "deleteFile"
  | "executeTask"
  | "multiStep";

export interface ApprovalMetadata {
  tokensUsed?: {
    context?: number;
    total: number;
    cost?: number;
  };
  smartContext?: number;
  instruction: string;
  fileName?: string;
  filePath?: string;
  changesSummary?: string[];
  dependencies?: string[];
  estimatedTime?: string;
}

export interface ApprovalRequest {
  id: string; // Unique request ID
  type: ApprovalType;
  title: string;
  message: string;
  metadata: ApprovalMetadata;
  diffUri?: string; // For opening diff view
  actions: ApprovalAction[];
}

export interface ApprovalAction {
  id: string;
  label: string;
  variant: "primary" | "secondary" | "danger";
  icon?: string;
}

export interface ApprovalResponse {
  requestId: string;
  action: string; // "apply" | "reject" | "edit" | "cancel"
  modifiedInstruction?: string; // If user edited instruction
}

// Example usage:
// const editFileApproval: ApprovalRequest = {
//   id: "edit-123",
//   type: "editFile",
//   title: "Review AI Changes",
//   message: "AI has prepared changes to your file",
//   metadata: {
//     tokensUsed: { context: 1634, total: 11586 },
//     instruction: "Add comment above router.get",
//     fileName: "projects.py",
//     filePath: "backend/app/routers/projects.py"
//   },
//   actions: [
//     { id: "apply", label: "Apply Changes", variant: "primary", icon: "check" },
//     { id: "reject", label: "Reject", variant: "secondary", icon: "x" },
//     { id: "edit", label: "Edit Instruction", variant: "secondary", icon: "edit" }
//   ]
// };
