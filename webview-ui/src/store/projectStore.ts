import { create } from "zustand";
import { vscodeAPI } from "../utils/vscodeApi";

export interface Project {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  git_url?: string;
  role_id?: number;
  assistant_name?: string;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
}

interface ProjectState {
  // Data
  projects: Project[];

  // Selection
  selectedProjectId: number | null;

  // Loading states
  isLoadingProjects: boolean;

  // Actions
  setProjects: (projects: Project[]) => void;
  selectProject: (projectId: number) => void;
  setLoadingProjects: (loading: boolean) => void;
  clearSelection: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  projects: [],
  selectedProjectId: null,
  isLoadingProjects: false,

  // Actions
  setProjects: (projects) => {
    set({ projects });

    // Auto-select first project if none selected
    const { selectedProjectId } = get();
    console.log("📂 [ProjectStore] Auto-selected project:", projects.length);
  },

  selectProject: (projectId) => {
    set({ selectedProjectId: projectId });
    console.log("📂 [ProjectStore] Selected project:", projectId);

    // ✅ NOTIFY EXTENSION about selection
    vscodeAPI.postMessage({
      command: "projectSelected",
      projectId: projectId,
    });
  },

  setLoadingProjects: (loading) => set({ isLoadingProjects: loading }),

  clearSelection: () => {
    set({
      projects: [],
      selectedProjectId: null,
    });
    console.log("🗑️ [ProjectStore] Selection cleared");

    // ✅ NOTIFY EXTENSION about clear
    vscodeAPI.postMessage({
      command: "projectSelected",
      projectId: null,
    });
  },
}));

// ✅ NEW: Listen for messages from extension
(() => {
  try {
    if (typeof globalThis !== "undefined") {
      const handleMessage = (event: any) => {
        const message = event.data;

        switch (message.command) {
          case "projectUpdated":
            console.log(
              "📂 [ProjectStore] Project updated from extension:",
              message.projectId
            );

            // ✅ FIX: Load projects first if not loaded, then select
            const { projects } = useProjectStore.getState();
            if (projects.length === 0) {
              console.log("📂 [ProjectStore] Loading projects first...");

              // Dynamically import apiService to load projects
              import("../services/apiService").then(({ apiService }) => {
                apiService.getProjects().then(() => {
                  console.log(
                    "📂 [ProjectStore] Projects loaded, now selecting"
                  );
                  // THEN select the project
                  useProjectStore.getState().selectProject(message.projectId);
                });
              });
            } else {
              // Projects already loaded, just select
              useProjectStore.getState().selectProject(message.projectId);
            }
            break;

          case "tokenUpdated":
            // Token updated - projects will be loaded via AuthContext
            console.log("🔑 [ProjectStore] Token updated, projects will load");
            break;
        }
      };

      (globalThis as any).addEventListener("message", handleMessage);
      console.log("👂 [ProjectStore] Message listener initialized");
    }
  } catch (e) {
    console.error("Failed to initialize message listener:", e);
  }
})();

// ✅ NEW: Persist projects to sessionStorage
(() => {
  try {
    // Load from sessionStorage on init
    const savedProjects = sessionStorage.getItem("multi-ai-chat-projects");
    const savedProjectId = sessionStorage.getItem(
      "multi-ai-chat-selected-project"
    );

    if (savedProjects) {
      const projects = JSON.parse(savedProjects);
      useProjectStore.setState({ projects });
      console.log(
        "📦 [ProjectStore] Restored projects from sessionStorage:",
        projects.length
      );
    }

    if (savedProjectId) {
      const projectId = parseInt(savedProjectId, 10);
      useProjectStore.setState({ selectedProjectId: projectId });
      console.log(
        "📦 [ProjectStore] Restored selected project from sessionStorage:",
        projectId
      );
    }

    // Subscribe to changes and save to sessionStorage
    useProjectStore.subscribe((state) => {
      if (state.projects.length > 0) {
        sessionStorage.setItem(
          "multi-ai-chat-projects",
          JSON.stringify(state.projects)
        );
      }

      if (state.selectedProjectId) {
        sessionStorage.setItem(
          "multi-ai-chat-selected-project",
          state.selectedProjectId.toString()
        );
      }
    });

    console.log("💾 [ProjectStore] sessionStorage persistence initialized");
  } catch (e) {
    console.error("Failed to initialize sessionStorage persistence:", e);
  }
})();
