import React, { useEffect, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { apiService } from "../../services/apiService";
import "./ProjectInfo.css";

interface IndexStatus {
  project_id: number;
  indexed_at: string | null;
  files_count: number;
  status: "not_indexed" | "indexed" | "stale";
}

const ProjectInfo: React.FC = () => {
  const { projects, selectedProjectId } = useProjectStore();
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Fetch index status when project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      setIndexStatus(null);
      return;
    }

    fetchIndexStatus();
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId && projects.length === 0) {
      console.log("📂 [ProjectInfo] Auto-fetching projects list...");

      apiService
        .getProjects()
        .then((projectsList) => {
          console.log(
            `📂 [ProjectInfo] Loaded ${projectsList.length} projects`
          );
          useProjectStore.getState().setProjects(projectsList);
        })
        .catch((err) => {
          console.error("❌ [ProjectInfo] Failed to load projects:", err);
        });
    }
  }, [selectedProjectId, projects.length]);

  const fetchIndexStatus = async () => {
    if (!selectedProjectId) return;

    try {
      console.log(
        `📊 [ProjectInfo] Fetching status for project ${selectedProjectId}...`
      );
      const status = await apiService.getProjectIndexStatus(selectedProjectId);
      console.log(
        `📊 [ProjectInfo] Received status:`,
        JSON.stringify(status, null, 2)
      ); // ✅ USE JSON.stringify!
      setIndexStatus(status);
    } catch (error) {
      console.error("❌ [ProjectInfo] Failed to fetch index status:", error);
    }
  };

  const handleIndex = async () => {
    if (!selectedProjectId || isIndexing) return;

    setIsIndexing(true);
    try {
      // Trigger indexing via extension command
      (window as any).vscode.postMessage({
        command: "indexWorkspace",
      });

      // Poll for status update
      setTimeout(async () => {
        await fetchIndexStatus();
        setIsIndexing(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to trigger indexing:", error);
      setIsIndexing(false);
    }
  };

  if (!selectedProject) {
    return (
      <div className="project-info">
        <div className="project-info-empty">
          <span>📂 No project selected</span>
        </div>
      </div>
    );
  }

  // Determine status icon and text
  const getStatusDisplay = () => {
    if (isIndexing) {
      return { icon: "⏳", text: "Indexing...", color: "#ffa500" };
    }

    if (!indexStatus) {
      return { icon: "⚪", text: "Unknown", color: "#888" };
    }

    switch (indexStatus.status) {
      case "indexed":
        return {
          icon: "✅",
          text: `${indexStatus.files_count} files`,
          color: "#4ec9b0",
        };
      case "stale":
        return {
          icon: "⚠️",
          text: `${indexStatus.files_count} files (stale)`,
          color: "#ce9178",
        };
      case "not_indexed":
        return { icon: "⚪", text: "Not indexed", color: "#888" };
      default:
        return { icon: "⚪", text: "Unknown", color: "#888" };
    }
  };

  const statusDisplay = getStatusDisplay();

  // Button text based on status
  const getButtonText = () => {
    if (isIndexing) return "⏳ Indexing...";
    if (!indexStatus || indexStatus.status === "not_indexed")
      return "📂 Index Now";
    return "🔄 Re-index";
  };

  return (
    <div className="project-info">
      <div className="project-info-header">
        <div className="project-info-details">
          <span className="project-icon">📂</span>
          <span className="project-name">{selectedProject.name}</span>
          <span className="project-id">({selectedProject.id})</span>
          <span className="project-separator">•</span>
          <span
            className="project-status"
            style={{ color: statusDisplay.color }}
            title={
              indexStatus?.indexed_at
                ? `Last indexed: ${new Date(
                    indexStatus.indexed_at
                  ).toLocaleString()}`
                : undefined
            }
          >
            {statusDisplay.icon} {statusDisplay.text}
          </span>
        </div>
        <button
          onClick={handleIndex}
          disabled={isIndexing}
          className={`index-button ${indexStatus?.status || "not_indexed"}`}
          title={
            isIndexing
              ? "Indexing in progress..."
              : "Index or re-index workspace files"
          }
        >
          {getButtonText()}
        </button>
      </div>
    </div>
  );
};

export default ProjectInfo;
