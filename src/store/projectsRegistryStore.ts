/**
 * Projects registry store — CRUD + switch logic (Phase 2).
 * Persist key: 'teplo-projects-registry'.
 * Persists: projects, projectOrder, activeId.
 *
 * Switch mechanic:
 *   switchProject(newId): save current → resetAllStores → restore newId → activeId = newId
 *   createProject(name): save current → resetAllStores → create entry → activeId = newId
 *   duplicateProject(id): copy snapshot → add registry entry (no activation)
 *   deleteProject(id): remove entry + snapshot → if was active: switch to next or create "Проект 1"
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ProjectMeta } from '../types/project'
import { safeStorage } from './safeStorage'
import { uuid } from './uuid'
import { collectSnapshot, restoreSnapshot, resetAllStores } from '../services/projectSnapshot'
import { useProjectsSnapshotsStore } from './projectsSnapshotsStore'

export interface ProjectsRegistryState {
  readonly projects: Record<string, ProjectMeta>
  readonly projectOrder: readonly string[]
  readonly activeId: string | null
  createProject: (name: string) => string
  switchProject: (id: string) => void
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
        const { activeId } = get()
        const snapshotsStore = useProjectsSnapshotsStore.getState()

        // Save current project's state before switching
        if (activeId !== null) {
          snapshotsStore.saveSnapshot(activeId, collectSnapshot())
        }

        // Reset working stores to blank
        resetAllStores()

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

      switchProject: (newId: string) => {
        const { activeId } = get()
        if (activeId === newId) return

        const snapshotsStore = useProjectsSnapshotsStore.getState()

        // Save current project
        if (activeId !== null) {
          snapshotsStore.saveSnapshot(activeId, collectSnapshot())
        }

        // Reset working stores
        resetAllStores()

        // Restore new project (if snapshot exists)
        const snap = snapshotsStore.getSnapshot(newId)
        if (snap) {
          restoreSnapshot(snap)
          snapshotsStore.deleteSnapshot(newId)
        }

        set({ activeId: newId })
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
        const { activeId, projects } = get()
        const source = projects[id]
        if (!source) return ''

        const snapshotsStore = useProjectsSnapshotsStore.getState()

        // Collect the source snapshot
        const snap = id === activeId
          ? collectSnapshot()
          : snapshotsStore.getSnapshot(id)

        const newId = uuid()
        const now = Date.now()

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
          // activeId unchanged — duplicate is NOT activated
        }))

        if (snap) {
          // Deep clone to ensure independence
          snapshotsStore.saveSnapshot(newId, JSON.parse(JSON.stringify(snap)))
        }

        return newId
      },

      deleteProject: (id: string) => {
        const { activeId, projectOrder } = get()
        const wasActive = activeId === id
        const remainingOrder = projectOrder.filter(pid => pid !== id)

        // Remove from registry (activeId unchanged for now)
        set(state => {
          const { [id]: _removed, ...projects } = state.projects
          return { projects, projectOrder: remainingOrder }
        })

        // Remove from snapshot store
        useProjectsSnapshotsStore.getState().deleteSnapshot(id)

        // Handle active project deletion
        if (wasActive) {
          if (remainingOrder.length > 0) {
            // Switch to next without saving current (deleted project's data is discarded)
            resetAllStores()
            const snapshotsStore = useProjectsSnapshotsStore.getState()
            const nextSnap = snapshotsStore.getSnapshot(remainingOrder[0])
            if (nextSnap) {
              restoreSnapshot(nextSnap)
              snapshotsStore.deleteSnapshot(remainingOrder[0])
            }
            set({ activeId: remainingOrder[0] })
          } else {
            // No projects left: clear activeId first so createProject doesn't save a ghost snapshot
            set({ activeId: null })
            get().createProject('Проект 1')
          }
        }
      },
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
