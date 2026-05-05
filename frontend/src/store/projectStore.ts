import { create } from 'zustand'

interface ProjectStore {
  activeProjectId: string | null
  setActiveProjectId: (id: string) => void
}

export const useProjectStore = create<ProjectStore>(set => ({
  activeProjectId: null,
  setActiveProjectId: (id) => set({ activeProjectId: id }),
}))
