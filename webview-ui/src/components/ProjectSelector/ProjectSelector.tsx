import React, { useEffect, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { apiService } from "../../services/apiService";
import { vscodeAPI } from "../../utils/vscodeApi";
import "./ProjectSelector.css";

const ProjectSelector: React.FC = () => {
  const {
    projects,
    selectedProjectId,
    isLoadingProjects,
    selectProject,
    setLoadingProjects,
  } = useProjectStore();

  const [isIndexing, setIsIndexing] = useState(false);

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        await apiService.getProjects();
      } catch (error) {
        console.error("❌ Failed to load projects:", error);
      } finally {
        setLoadingProjects(false);
      }
    };

    if (projects.length === 0) {
      loadProjects();
    }
  }, []);

  // Listen for indexing result from Extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === "indexingComplete") {
        setIsIndexing(false);
        if (message.success) {
          console.log("✅ Indexing complete:", message.result);
        } else {
          console.error("❌ Indexing failed:", message.error);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = parseInt(e.target.value, 10);
    selectProject(projectId);
  };

  const handleIndexWorkspace = () => {
    if (!selectedProjectId) {
      console.error("No project selected");
      return;
    }

    setIsIndexing(true);

    // Send message to Extension to start indexing
    vscodeAPI.postMessage({
      command: "indexWorkspace",
      projectId: selectedProjectId,
    });
  };

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);

  return (
    <div className="project-selector">
      {/* Project Dropdown */}
      <div className="selector-group">
        <label className="selector-label">📂 Project</label>
        <select
          className="selector-dropdown"
          value={selectedProjectId || ""}
          onChange={handleProjectChange}
          disabled={isLoadingProjects}
        >
          {isLoadingProjects ? (
            <option>Loading...</option>
          ) : projects.length === 0 ? (
            <option>No projects</option>
          ) : (
            projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))
          )}
        </select>

        {/* Index Button */}
        <button
          className="index-button"
          onClick={handleIndexWorkspace}
          disabled={!selectedProjectId || isIndexing}
          title="Index current workspace files into this project"
        >
          {isIndexing ? "⏳ Indexing..." : "📥 Index"}
        </button>
      </div>

      {/* Show project's assistant (read-only info) */}
      {selectedProject && selectedProject.assistant_name && (
        <div className="project-assistant">
          <span className="assistant-icon">🤖</span>
          <span className="assistant-name">
            {selectedProject.assistant_name}
          </span>
        </div>
      )}
    </div>
  );
};

export default ProjectSelector;
