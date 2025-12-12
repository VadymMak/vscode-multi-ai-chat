import React, { useEffect, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { apiService } from "../../services/apiService";
import { vscodeAPI } from "../../utils/vscodeApi";
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

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === "indexingComplete") {
        console.log("✅ [ProjectInfo] Indexing complete:", message);
        setIsIndexing(false);

        if (message.success) {
          // Refresh status
          fetchIndexStatus();
        } else {
          console.error("❌ [ProjectInfo] Indexing failed:", message.error);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Fetch index status when project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      setIndexStatus(null);
      return;
    }

    // ✅ Try to load from sessionStorage first
    const cachedStatus = sessionStorage.getItem(
      `index-status-${selectedProjectId}`
    );
    if (cachedStatus) {
      try {
        const parsed = JSON.parse(cachedStatus);
        setIndexStatus(parsed);
        console.log(
          `📦 [ProjectInfo] Loaded cached status for project ${selectedProjectId}`
        );

        // Still fetch fresh data in background
        fetchIndexStatus();
        return;
      } catch (e) {
        console.error("Failed to parse cached status:", e);
      }
    }

    // No cache, fetch normally
    fetchIndexStatus();
  }, [selectedProjectId]);

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
      );
      setIndexStatus(status);

      // ✅ Cache the status
      sessionStorage.setItem(
        `index-status-${selectedProjectId}`,
        JSON.stringify(status)
      );
    } catch (error) {
      console.error("❌ [ProjectInfo] Failed to fetch index status:", error);
    }
  };

  const handleIndex = async () => {
    if (!selectedProjectId || isIndexing) return;

    setIsIndexing(true);
    try {
      console.log(
        "📂 [ProjectInfo] Triggering indexing for project:",
        selectedProjectId
      );

      vscodeAPI.postMessage({
        command: "indexWorkspace",
        projectId: selectedProjectId,
      });

      // ✅ That's it! The useEffect listener will handle completion
    } catch (error) {
      console.error("❌ [ProjectInfo] Failed to trigger indexing:", error);
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

  const getButtonText = () => {
    if (isIndexing) {
      if (indexStatus?.files_count) {
        return `⏳ Indexing ${indexStatus.files_count} files...`;
      }
      return "⏳ Indexing...";
    }

    if (!indexStatus || indexStatus.status === "not_indexed") {
      return "📂 Index Now";
    }

    if (indexStatus.status === "stale") {
      return "🔄 Re-index"; // ← Outdated, should refresh
    }

    // ✅ Change this line:
    return "✅ Indexed"; // ← Fresh, up to date!
  };

  return (
    <div className="project-info">
      <div className="project-info-header">
        <div className="project-info-details">
          <span className="project-icon">📂</span>
          <span className="project-name">{selectedProject.name}</span>
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
