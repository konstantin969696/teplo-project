/**
 * Projects registry store (Phase 1) — CRUD only, no snapshot switch logic.
 * Persist key: 'teplo-projects-registry'.
 * Persists: projects, projectOrder, activeId.
 *
 * Phase 2 will replace createProject / duplicateProject / deleteProject with
 * snapshot-aware versions and add switchProject.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ProjectMeta } from '../types/project'
import { safeStorage } from './safeStorage'
import { uuid } from './uuid'

export interface ProjectsRegistryState {
  readonly projects: Record<string, ProjectMeta>
  readonly projectOrder: readonly string[]
  readonly activeId: string | null
  createProject: (name: string) => string
  renameProject: (id: string, name: string) => void
  duplicateProject: (id: string) => string
  deleteProject: (id: string) => void
}

export const useProjectsRegistryStore = create<ProjectsRegistryState>()(
  persist(
    (set, get) => ({
      projects: {},
      projectOrder: [],
      activeId: null,

      createProject: (name: string): string => {
        const id = uuid()
        const now = Date.now()
        set(state => ({
          projects: {
            ...state.projects,
            [id]: { id, name, createdAt: now, updatedAt: now },
          },
          projectOrder: [...state.projectOrder, id],
          activeId: id,
        }))
        return id
      },

      renameProject: (id: string, name: string) => set(state => {
        if (!state.projects[id]) return state
        return {
          projects: {
            ...state.projects,
            [id]: { ...state.projects[id], name, updatedAt: Date.now() },
          },
        }
      }),

      duplicateProject: (id: string): string => {
        const newId = uuid()
        const now = Date.now()
        const source = get().projects[id]
        if (!source) return newId
        set(state => ({
          projects: {
            ...state.projects,
            [newId]: {
              id: newId,
              name: `${source.name} (копия)`,
              createdAt: now,
              updatedAt: now,
            },
          },
          projectOrder: [...state.projectOrder, newId],
        }))
        return newId
      },

      deleteProject: (id: string) => set(state => {
        const { [id]: _removed, ...projects } = state.projects
        const projectOrder = state.projectOrder.filter(pid => pid !== id)
        const activeId = state.activeId === id
          ? (projectOrder[0] ?? null)
          : state.activeId
        return { projects, projectOrder, activeId }
      }),
    }),
    {
      name: 'teplo-projects-registry',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        projects: state.projects,
        projectOrder: state.projectOrder,
        activeId: state.activeId,
      } as unknown as ProjectsRegistryState),
    }
  )
)
