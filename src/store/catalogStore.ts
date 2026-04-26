/**
 * Catalog store — seed (read-only из equipment-catalog.json) + user overrides.
 * mergeSeedWithOverrides — единственная функция мержа, не дублировать логику.
 * Persist key: 'teplo-catalog'. Persistится только userOverrides + deletedSeedIds.
 * Threat mitigation: seed берётся из внутреннего JSON (trust boundary), overrides
 *   проходят через validateCatalogJSON при импорте (см. engine/validation.ts).
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage } from './safeStorage'
import { uuid } from './uuid'
import seedCatalogRaw from '../data/equipment-catalog.json'
import type { CatalogModel, CatalogState, EquipmentKind } from '../types/project'

interface SeedCatalogFile {
  readonly _meta: unknown
  readonly models: readonly CatalogModel[]
}

const seedCatalog = seedCatalogRaw as unknown as SeedCatalogFile

const seedById: Record<string, CatalogModel> = Object.fromEntries(
  seedCatalog.models.map(m => [m.id, { ...m, isCustom: false } as CatalogModel])
)

export const SEED_CATALOG_MODELS_COUNT = seedCatalog.models.length

function mergeSeedWithOverrides(
  overrides: Record<string, CatalogModel>,
  deletedIds: readonly string[]
): Record<string, CatalogModel> {
  const merged: Record<string, CatalogModel> = { ...seedById }
  for (const delId of deletedIds) delete merged[delId]
  for (const [id, m] of Object.entries(overrides)) merged[id] = m
  return merged
}

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set) => ({
      models: mergeSeedWithOverrides({}, []),
      userOverrides: {},
      deletedSeedIds: [],

      addModel: (model: Omit<CatalogModel, 'id' | 'isCustom'>): string => {
        const id = uuid()
        const newModel = { ...model, id, isCustom: true } as CatalogModel
        set(state => {
          const userOverrides = { ...state.userOverrides, [id]: newModel }
          return {
            userOverrides,
            models: mergeSeedWithOverrides(userOverrides, state.deletedSeedIds)
          }
        })
        return id
      },

      updateModel: (id: string, changes: Partial<CatalogModel>) => set(state => {
        const existing = state.models[id]
        if (!existing) return state
        // BLOCKER-5 semantic: seed-модель с override помечается isCustom=true,
        // иначе UI badge "встр." будет отображаться неправильно для отредактированной seed-модели
        const isOverridingSeed = !state.userOverrides[id] && id in seedById
        const updated = (isOverridingSeed
          ? { ...existing, ...changes, isCustom: true }
          : { ...existing, ...changes, isCustom: existing.isCustom }) as CatalogModel
        const userOverrides = { ...state.userOverrides, [id]: updated }
        return {
          userOverrides,
          models: mergeSeedWithOverrides(userOverrides, state.deletedSeedIds)
        }
      }),

      deleteModel: (id: string) => set(state => {
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
      }),

      resetToSeed: () => set({
        userOverrides: {},
        deletedSeedIds: [],
        models: { ...seedById }
      })
    }),
    {
      name: 'teplo-catalog',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        userOverrides: state.userOverrides,
        deletedSeedIds: state.deletedSeedIds
      } as unknown as CatalogState),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Catalog rehydration failed:', error)
        }
        if (state) {
          Object.assign(state, { models: mergeSeedWithOverrides(state.userOverrides, state.deletedSeedIds) })
        }
      }
    }
  )
)

/** Selector — возвращает модели каталога, отфильтрованные по kind. */
export const selectModelsByKind = (kind: EquipmentKind) =>
  (state: CatalogState): readonly CatalogModel[] =>
    Object.values(state.models).filter(m => m.kind === kind)
