import React from "react";
import { ApprovalRequest, ApprovalResponse } from "../../types/approval.types";
import "./ApprovalDialog.css";

interface ApprovalDialogProps {
  request: ApprovalRequest | null;
  onResponse: (response: ApprovalResponse) => void;
}

export const ApprovalDialog: React.FC<ApprovalDialogProps> = ({
  request,
  onResponse,
}) => {
  const [editMode, setEditMode] = React.useState(false);
  const [editedInstruction, setEditedInstruction] = React.useState("");

  React.useEffect(() => {
    if (request) {
      setEditedInstruction(request.metadata.instruction);
      setEditMode(false);
    }
  }, [request]);

  if (!request) return null;

  const handleAction = (actionId: string) => {
    if (actionId === "edit") {
      setEditMode(true);
      return;
    }

    const response: ApprovalResponse = {
      requestId: request.id,
      action: actionId,
      modifiedInstruction: editMode ? editedInstruction : undefined,
    };

    onResponse(response);
    setEditMode(false);
  };

  const handleEditSubmit = () => {
    const response: ApprovalResponse = {
      requestId: request.id,
      action: "apply",
      modifiedInstruction: editedInstruction,
    };

    onResponse(response);
    setEditMode(false);
  };

  return (
    <div className="approval-dialog-overlay">
      <div className="approval-dialog">
        {/* Header */}
        <div className="approval-dialog-header">
          <h3>{request.title}</h3>
          <button
            className="close-button"
            onClick={() => handleAction("cancel")}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="approval-dialog-content">
          <p className="approval-message">{request.message}</p>

          {/* Metadata Section */}
          <div className="approval-metadata">
            {request.metadata.fileName && (
              <div className="metadata-item">
                <span className="metadata-label">📄 File:</span>
                <span className="metadata-value">
                  {request.metadata.fileName}
                </span>
              </div>
            )}

            {request.metadata.instruction && !editMode && (
              <div className="metadata-item">
                <span className="metadata-label">💡 Instruction:</span>
                <span className="metadata-value instruction">
                  {request.metadata.instruction}
                </span>
              </div>
            )}

            {editMode && (
              <div className="metadata-item edit-mode">
                <label className="metadata-label">✏️ Edit Instruction:</label>
                <textarea
                  className="instruction-editor"
                  value={editedInstruction}
                  onChange={(e) => setEditedInstruction(e.target.value)}
                  rows={3}
                  autoFocus
                />
              </div>
            )}

            {request.metadata.tokensUsed && (
              <div className="metadata-item">
                <span className="metadata-label">🎯 Tokens:</span>
                <span className="metadata-value">
                  {request.metadata.tokensUsed.total.toLocaleString()}
                  {request.metadata.smartContext && (
                    <span className="smart-context">
                      {" "}
                      (Smart Context: {request.metadata.smartContext})
                    </span>
                  )}
                </span>
              </div>
            )}

            {request.metadata.tokensUsed?.cost && (
              <div className="metadata-item">
                <span className="metadata-label">💰 Cost:</span>
                <span className="metadata-value">
                  ~${request.metadata.tokensUsed.cost.toFixed(4)}
                </span>
              </div>
            )}

            {request.metadata.changesSummary &&
              request.metadata.changesSummary.length > 0 && (
                <div className="metadata-item">
                  <span className="metadata-label">📝 Changes:</span>
                  <ul className="changes-list">
                    {request.metadata.changesSummary.map((change, idx) => (
                      <li key={idx}>{change}</li>
                    ))}
                  </ul>
                </div>
              )}

            {request.metadata.dependencies &&
              request.metadata.dependencies.length > 0 && (
                <div className="metadata-item">
                  <span className="metadata-label">📦 Dependencies:</span>
                  <div className="dependencies-list">
                    {request.metadata.dependencies.map((dep, idx) => (
                      <span key={idx} className="dependency-tag">
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Diff View Hint */}
          {request.type === "editFile" && (
            <div className="diff-hint">
              💡 Review the side-by-side diff in the editor above
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="approval-dialog-actions">
          {editMode ? (
            <>
              <button
                className="approval-button secondary"
                onClick={() => setEditMode(false)}
              >
                Cancel Edit
              </button>
              <button
                className="approval-button primary"
                onClick={handleEditSubmit}
              >
                Apply with New Instruction
              </button>
            </>
          ) : (
            <>
              {request.actions.map((action) => (
                <button
                  key={action.id}
                  className={`approval-button ${action.variant}`}
                  onClick={() => handleAction(action.id)}
                >
                  {action.icon && (
                    <span className="button-icon">{action.icon}</span>
                  )}
                  {action.label}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
