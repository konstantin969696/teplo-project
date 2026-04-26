/**
 * Pipe catalog store — seed (pipe-catalog.json) + user overrides.
 * Pattern: Phase 3 catalogStore (seed-merge, userOverrides, deletedSeedIds).
 * Persist key: 'teplo-pipe-catalog'. Only userOverrides + deletedSeedIds persisted.
 *
 * Threat mitigation:
 *   T-04-07: persists minimal data (overrides only), safeStorage handles quota errors.
 *   T-04-08: IDs generated via uuid(), never accepted from external input.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage } from './safeStorage'
import { uuid } from './uuid'
import { mergeSeedWithOverrides } from './catalogMerge'
import seedRaw from '../data/pipe-catalog.json'
import type { PipeSpec, PipeMaterial } from '../types/hydraulics'

interface SeedPipeFile {
  readonly _meta: unknown
  readonly pipes: readonly Omit<PipeSpec, 'isCustom'>[]
}

const seedFile = seedRaw as unknown as SeedPipeFile

const seedById: Record<string, PipeSpec> = Object.fromEntries(
  seedFile.pipes.map(p => [p.id, { ...p, isCustom: false } as PipeSpec])
)

export const SEED_PIPE_COUNT = seedFile.pipes.length

export interface PipeCatalogState {
  readonly pipes: Record<string, PipeSpec>
  readonly userOverrides: Record<string, PipeSpec>
  readonly deletedSeedIds: readonly string[]
  addPipe: (pipe: Omit<PipeSpec, 'id' | 'isCustom'>) => string
  updatePipe: (id: string, changes: Partial<Omit<PipeSpec, 'id'>>) => void
  deletePipe: (id: string) => void
  resetToSeed: () => void
}

export const usePipeCatalogStore = create<PipeCatalogState>()(
  persist(
    (set) => ({
      pipes: mergeSeedWithOverrides(seedById, {}, []),
      userOverrides: {},
      deletedSeedIds: [],

      addPipe: (pipe: Omit<PipeSpec, 'id' | 'isCustom'>): string => {
        const id = uuid()
        const newPipe: PipeSpec = { ...pipe, id, isCustom: true }
        set(state => {
          const userOverrides = { ...state.userOverrides, [id]: newPipe }
          return {
            userOverrides,
            pipes: mergeSeedWithOverrides(seedById, userOverrides, state.deletedSeedIds)
          }
        })
        return id
      },

      updatePipe: (id: string, changes: Partial<Omit<PipeSpec, 'id'>>) => set(state => {
        const existing = state.pipes[id]
        if (!existing) return state
        // Seed override → mark isCustom=true (паттерн Phase 3 catalogStore строки 64-72)
        const isOverridingSeed = !state.userOverrides[id] && id in seedById
        const updated: PipeSpec = isOverridingSeed
          ? { ...existing, ...changes, isCustom: true }
          : { ...existing, ...changes, isCustom: existing.isCustom }
        const userOverrides = { ...state.userOverrides, [id]: updated }
        return {
          userOverrides,
          pipes: mergeSeedWithOverrides(seedById, userOverrides, state.deletedSeedIds)
        }
      }),

      deletePipe: (id: string) => set(state => {
        const existing = state.pipes[id]
        if (!existing) return state
        const isSeed = id in seedById && !state.userOverrides[id]
        const { [id]: _removed, ...userOverrides } = state.userOverrides
        const deletedSeedIds = isSeed && !state.deletedSeedIds.includes(id)
          ? [...state.deletedSeedIds, id]
          : state.deletedSeedIds
        return {
          userOverrides,
          deletedSeedIds,
          pipes: mergeSeedWithOverrides(seedById, userOverrides, deletedSeedIds)
        }
      }),

      resetToSeed: () => set({
        userOverrides: {},
        deletedSeedIds: [],
        pipes: { ...seedById }
      })
    }),
    {
      name: 'teplo-pipe-catalog',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        userOverrides: state.userOverrides,
        deletedSeedIds: state.deletedSeedIds
      } as unknown as PipeCatalogState),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Pipe catalog rehydration failed:', error)
        }
        if (state) {
          Object.assign(state, { pipes: mergeSeedWithOverrides(seedById, state.userOverrides, state.deletedSeedIds) })
        }
      }
    }
  )
)

/** Selector — фильтрует трубы по материалу. */
export const selectPipesByMaterial = (material: PipeMaterial) =>
  (state: PipeCatalogState): readonly PipeSpec[] =>
    Object.values(state.pipes).filter(p => p.material === material)
