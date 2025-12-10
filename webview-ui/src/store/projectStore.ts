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
    if (!selectedProjectId && projects.length > 0) {
      const firstProjectId = projects[0].id;
      set({ selectedProjectId: firstProjectId });
      console.log("📂 [ProjectStore] Auto-selected project:", firstProjectId);

      // ✅ NOTIFY EXTENSION about auto-selection
      vscodeAPI.postMessage({
        command: "projectSelected",
        projectId: firstProjectId,
      });
    }
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

            // Update selected project in store
            useProjectStore.getState().selectProject(message.projectId);

            // If projects not loaded yet, load them
            const { projects } = useProjectStore.getState();
            if (projects.length === 0) {
              console.log(
                "📂 [ProjectStore] Projects not loaded, will load on auth"
              );
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
