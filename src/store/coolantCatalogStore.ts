/**
 * Coolant catalog store — seed (coolant-catalog.json) + user overrides.
 * Pattern: Phase 3 catalogStore (seed-merge, userOverrides, deletedSeedIds).
 * Persist key: 'teplo-coolant-catalog'. Only userOverrides + deletedSeedIds persisted.
 *
 * Threat mitigation: T-04-07 (quota-safe via safeStorage), T-04-08 (uuid-generated IDs).
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage } from './safeStorage'
import { uuid } from './uuid'
import { mergeSeedWithOverrides } from './catalogMerge'
import seedRaw from '../data/coolant-catalog.json'
import type { CoolantSpec } from '../types/hydraulics'

interface SeedCoolantFile {
  readonly _meta: unknown
  readonly coolants: readonly Omit<CoolantSpec, 'isCustom'>[]
}

const seedFile = seedRaw as unknown as SeedCoolantFile

const seedById: Record<string, CoolantSpec> = Object.fromEntries(
  seedFile.coolants.map(c => [c.id, { ...c, isCustom: false } as CoolantSpec])
)

export const SEED_COOLANT_COUNT = seedFile.coolants.length

export interface CoolantCatalogState {
  readonly coolants: Record<string, CoolantSpec>
  readonly userOverrides: Record<string, CoolantSpec>
  readonly deletedSeedIds: readonly string[]
  addCoolant: (coolant: Omit<CoolantSpec, 'id' | 'isCustom'>) => string
  updateCoolant: (id: string, changes: Partial<Omit<CoolantSpec, 'id'>>) => void
  deleteCoolant: (id: string) => void
  resetToSeed: () => void
}

export const useCoolantCatalogStore = create<CoolantCatalogState>()(
  persist(
    (set) => ({
      coolants: mergeSeedWithOverrides(seedById, {}, []),
      userOverrides: {},
      deletedSeedIds: [],

      addCoolant: (coolant: Omit<CoolantSpec, 'id' | 'isCustom'>): string => {
        const id = uuid()
        const newCoolant: CoolantSpec = { ...coolant, id, isCustom: true }
        set(state => {
          const userOverrides = { ...state.userOverrides, [id]: newCoolant }
          return {
            userOverrides,
            coolants: mergeSeedWithOverrides(seedById, userOverrides, state.deletedSeedIds)
          }
        })
        return id
      },

      updateCoolant: (id: string, changes: Partial<Omit<CoolantSpec, 'id'>>) => set(state => {
        const existing = state.coolants[id]
        if (!existing) return state
        const isOverridingSeed = !state.userOverrides[id] && id in seedById
        const updated: CoolantSpec = isOverridingSeed
          ? { ...existing, ...changes, isCustom: true }
          : { ...existing, ...changes, isCustom: existing.isCustom }
        const userOverrides = { ...state.userOverrides, [id]: updated }
        return {
          userOverrides,
          coolants: mergeSeedWithOverrides(seedById, userOverrides, state.deletedSeedIds)
        }
      }),

      deleteCoolant: (id: string) => set(state => {
        const existing = state.coolants[id]
        if (!existing) return state
        const isSeed = id in seedById && !state.userOverrides[id]
        const { [id]: _removed, ...userOverrides } = state.userOverrides
        const deletedSeedIds = isSeed && !state.deletedSeedIds.includes(id)
          ? [...state.deletedSeedIds, id]
          : state.deletedSeedIds
        return {
          userOverrides,
          deletedSeedIds,
          coolants: mergeSeedWithOverrides(seedById, userOverrides, deletedSeedIds)
        }
      }),

      resetToSeed: () => set({
        userOverrides: {},
        deletedSeedIds: [],
        coolants: { ...seedById }
      })
    }),
    {
      name: 'teplo-coolant-catalog',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        userOverrides: state.userOverrides,
        deletedSeedIds: state.deletedSeedIds
      } as unknown as CoolantCatalogState),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Coolant catalog rehydration failed:', error)
        }
        if (state) {
          Object.assign(state, { coolants: mergeSeedWithOverrides(seedById, state.userOverrides, state.deletedSeedIds) })
        }
      }
    }
  )
)
