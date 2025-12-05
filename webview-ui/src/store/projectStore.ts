import { create } from "zustand";

export interface Project {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  git_url?: string;
  role_id?: number; // ✅ Role assigned to project
  assistant_name?: string; // ✅ Assistant name
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
      set({ selectedProjectId: projects[0].id });
      console.log("📂 [ProjectStore] Auto-selected project:", projects[0].id);
    }
  },

  selectProject: (projectId) => {
    set({ selectedProjectId: projectId });
    console.log("📂 [ProjectStore] Selected project:", projectId);
  },

  setLoadingProjects: (loading) => set({ isLoadingProjects: loading }),

  clearSelection: () => {
    set({
      projects: [],
      selectedProjectId: null,
    });
    console.log("🗑️ [ProjectStore] Selection cleared");
  },
}));
