/**
 * Construction catalog store — seed (construction-catalog.json) + user overrides.
 * Mirrors catalogStore pattern: mergeSeedWithOverrides is the single source of
 * truth for merging, persisted state holds only userOverrides + deletedSeedIds.
 * Persist key: 'teplo-constructions'.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage } from './safeStorage'
import { uuid } from './uuid'
import seedConstructionsRaw from '../data/construction-catalog.json'
import type { CatalogConstruction, ConstructionState, EnclosureType } from '../types/project'

interface SeedConstructionFile {
  readonly _meta: unknown
  readonly models: readonly CatalogConstruction[]
}

const seedConstructions = seedConstructionsRaw as unknown as SeedConstructionFile

const seedById: Record<string, CatalogConstruction> = Object.fromEntries(
  seedConstructions.models.map(m => [m.id, { ...m, isCustom: false } as CatalogConstruction])
)

export const SEED_CONSTRUCTION_COUNT = seedConstructions.models.length

function mergeSeedWithOverrides(
  overrides: Record<string, CatalogConstruction>,
  deletedIds: readonly string[]
): Record<string, CatalogConstruction> {
  const merged: Record<string, CatalogConstruction> = { ...seedById }
  for (const delId of deletedIds) delete merged[delId]
  for (const [id, m] of Object.entries(overrides)) merged[id] = m
  return merged
}

export const useConstructionStore = create<ConstructionState>()(
  persist(
    (set) => ({
      models: mergeSeedWithOverrides({}, []),
      userOverrides: {},
      deletedSeedIds: [],

      addConstruction: (c: Omit<CatalogConstruction, 'id' | 'isCustom'>): string => {
        const id = uuid()
        const newConstruction: CatalogConstruction = { ...c, id, isCustom: true }
        set(state => {
          const userOverrides = { ...state.userOverrides, [id]: newConstruction }
          return {
            userOverrides,
            models: mergeSeedWithOverrides(userOverrides, state.deletedSeedIds)
          }
        })
        return id
      },

      updateConstruction: (id, changes) => set(state => {
        const existing = state.models[id]
        if (!existing) return state
        // Mark edited seed as custom so UI can surface «отредактировано»
        const isOverridingSeed = !state.userOverrides[id] && id in seedById
        const updated: CatalogConstruction = isOverridingSeed
          ? { ...existing, ...changes, isCustom: true }
          : { ...existing, ...changes, isCustom: existing.isCustom }
        const userOverrides = { ...state.userOverrides, [id]: updated }
        return {
          userOverrides,
          models: mergeSeedWithOverrides(userOverrides, state.deletedSeedIds)
        }
      }),

      deleteConstruction: (id) => set(state => {
        const existing = state.models[id]
        if (!existing) return state
        const isSeed = id in seedById && existing.isCustom === false
        const { [id]: _removed, ...userOverrides } = state.userOverrides
        const deletedSeedIds = isSeed && !state.deletedSeedIds.includes(id)
          ? [...state.deletedSeedIds, id]
          : state.deletedSeedIds
        return {
          userOverrides,
          deletedSeedIds,
          models: mergeSeedWithOverrides(userOverrides, deletedSeedIds)
        }
      })
    }),
    {
      name: 'teplo-constructions',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        userOverrides: state.userOverrides,
        deletedSeedIds: state.deletedSeedIds
      } as unknown as ConstructionState),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Construction catalog rehydration failed:', error)
        }
        if (state) {
          Object.assign(state, { models: mergeSeedWithOverrides(state.userOverrides, state.deletedSeedIds) })
        }
      }
    }
  )
)

/** Selector — конструкции, отфильтрованные по типу ограждения. */
export const selectConstructionsByType = (type: EnclosureType) =>
  (state: ConstructionState): readonly CatalogConstruction[] =>
    Object.values(state.models).filter(m => m.type === type)
