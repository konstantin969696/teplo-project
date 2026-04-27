/**
 * Projects snapshots store — thin persist wrapper over a record of ProjectSnapshot.
 * Persist key: 'teplo-projects-snapshots'.
 * Used by switchProject / duplicateProject (Phase 2) to save/restore inactive projects.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ProjectSnapshot } from '../types/project'
import { safeStorage } from './safeStorage'

export interface ProjectsSnapshotsState {
  readonly snapshots: Record<string, ProjectSnapshot>
  saveSnapshot: (id: string, snap: ProjectSnapshot) => void
  getSnapshot: (id: string) => ProjectSnapshot | undefined
  deleteSnapshot: (id: string) => void
}

export const useProjectsSnapshotsStore = create<ProjectsSnapshotsState>()(
  persist(
    (set, get) => ({
      snapshots: {},

      saveSnapshot: (id: string, snap: ProjectSnapshot) => set(state => ({
        snapshots: { ...state.snapshots, [id]: snap },
      })),

      getSnapshot: (id: string): ProjectSnapshot | undefined => {
        return get().snapshots[id]
      },

      deleteSnapshot: (id: string) => set(state => {
        const { [id]: _removed, ...snapshots } = state.snapshots
        return { snapshots }
      }),
    }),
    {
      name: 'teplo-projects-snapshots',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        snapshots: state.snapshots,
      } as unknown as ProjectsSnapshotsState),
    }
  )
)
