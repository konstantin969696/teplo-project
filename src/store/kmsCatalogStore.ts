/**
 * KMS (local resistances) catalog store — seed (kms-catalog.json) + user overrides.
 * Pattern: Phase 3 catalogStore (seed-merge, userOverrides, deletedSeedIds).
 * Persist key: 'teplo-kms-catalog'. Only userOverrides + deletedSeedIds persisted.
 *
 * Threat mitigation: T-04-07 (quota-safe via safeStorage), T-04-08 (uuid-generated IDs).
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage } from './safeStorage'
import { uuid } from './uuid'
import { mergeSeedWithOverrides } from './catalogMerge'
import seedRaw from '../data/kms-catalog.json'
import type { KmsItem } from '../types/hydraulics'

interface SeedKmsFile {
  readonly _meta: unknown
  readonly elements: readonly Omit<KmsItem, 'isCustom'>[]
}

const seedFile = seedRaw as unknown as SeedKmsFile

const seedById: Record<string, KmsItem> = Object.fromEntries(
  seedFile.elements.map(e => [e.id, { ...e, isCustom: false } as KmsItem])
)

export const SEED_KMS_COUNT = seedFile.elements.length

export interface KmsCatalogState {
  readonly elements: Record<string, KmsItem>
  readonly userOverrides: Record<string, KmsItem>
  readonly deletedSeedIds: readonly string[]
  addKms: (item: Omit<KmsItem, 'id' | 'isCustom'>) => string
  updateKms: (id: string, changes: Partial<Omit<KmsItem, 'id'>>) => void
  deleteKms: (id: string) => void
  resetToSeed: () => void
}

export const useKmsCatalogStore = create<KmsCatalogState>()(
  persist(
    (set) => ({
      elements: mergeSeedWithOverrides(seedById, {}, []),
      userOverrides: {},
      deletedSeedIds: [],

      addKms: (item: Omit<KmsItem, 'id' | 'isCustom'>): string => {
        const id = uuid()
        const newItem: KmsItem = { ...item, id, isCustom: true }
        set(state => {
          const userOverrides = { ...state.userOverrides, [id]: newItem }
          return {
            userOverrides,
            elements: mergeSeedWithOverrides(seedById, userOverrides, state.deletedSeedIds)
          }
        })
        return id
      },

      updateKms: (id: string, changes: Partial<Omit<KmsItem, 'id'>>) => set(state => {
        const existing = state.elements[id]
        if (!existing) return state
        const isOverridingSeed = !state.userOverrides[id] && id in seedById
        const updated: KmsItem = isOverridingSeed
          ? { ...existing, ...changes, isCustom: true }
          : { ...existing, ...changes, isCustom: existing.isCustom }
        const userOverrides = { ...state.userOverrides, [id]: updated }
        return {
          userOverrides,
          elements: mergeSeedWithOverrides(seedById, userOverrides, state.deletedSeedIds)
        }
      }),

      deleteKms: (id: string) => set(state => {
        const existing = state.elements[id]
        if (!existing) return state
        const isSeed = id in seedById && !state.userOverrides[id]
        const { [id]: _removed, ...userOverrides } = state.userOverrides
        const deletedSeedIds = isSeed && !state.deletedSeedIds.includes(id)
          ? [...state.deletedSeedIds, id]
          : state.deletedSeedIds
        return {
          userOverrides,
          deletedSeedIds,
          elements: mergeSeedWithOverrides(seedById, userOverrides, deletedSeedIds)
        }
      }),

      resetToSeed: () => set({
        userOverrides: {},
        deletedSeedIds: [],
        elements: { ...seedById }
      })
    }),
    {
      name: 'teplo-kms-catalog',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        userOverrides: state.userOverrides,
        deletedSeedIds: state.deletedSeedIds
      } as unknown as KmsCatalogState),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('KMS catalog rehydration failed:', error)
        }
        if (state) {
          Object.assign(state, { elements: mergeSeedWithOverrides(seedById, state.userOverrides, state.deletedSeedIds) })
        }
      }
    }
  )
)
