/**
 * System store — normalized CRUD систем отопления.
 * Pattern: Phase 04.1 (equipmentStore analog, D-01).
 * Persist key: 'teplo-systems'. Persists: systems + systemOrder.
 *
 * Threat mitigation:
 *   T-04.1-02-01: IDs generated via uuid(), never accepted from external input.
 *   T-04.1-02-02: reorderSystems validates length and all ids against known keys.
 *
 * Decisions:
 *   D-01: normalized store — systems: Record<string, HeatingSystem> + systemOrder: string[]
 *   D-26: seed (default "Система 1") is created imperatively via addSystem in runV11Migration.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { HeatingSystem, SystemState } from '../types/system'
import { safeStorage } from './safeStorage'
import { uuid } from './uuid'

const defaultSystemData = {
  systems: {} as Record<string, HeatingSystem>,
  systemOrder: [] as string[]
}

export const useSystemStore = create<SystemState>()(
  persist(
    (set) => ({
      ...defaultSystemData,

      addSystem: (sys: Omit<HeatingSystem, 'id'>): string => {
        const id = uuid()
        set(state => ({
          systems: { ...state.systems, [id]: { ...sys, id } as HeatingSystem },
          systemOrder: [...state.systemOrder, id]
        }))
        return id
      },

      updateSystem: (id: string, changes: Partial<Omit<HeatingSystem, 'id'>>) => set(state => {
        if (!state.systems[id]) return state
        return {
          systems: {
            ...state.systems,
            [id]: { ...state.systems[id], ...changes } as HeatingSystem
          }
        }
      }),

      deleteSystem: (id: string) => set(state => {
        if (!state.systems[id]) return state
        const { [id]: _removed, ...rest } = state.systems
        return {
          systems: rest,
          systemOrder: state.systemOrder.filter(sid => sid !== id)
        }
      }),

      reorderSystems: (order: readonly string[]) => set(state => {
        // T-04.1-02-02: validate that order contains exactly the known system ids
        const validIds = new Set(Object.keys(state.systems))
        if (order.length !== validIds.size || order.some(id => !validIds.has(id))) return state
        return { systemOrder: [...order] }
      })
    }),
    {
      name: 'teplo-systems',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        systems: state.systems,
        systemOrder: state.systemOrder
      } as unknown as SystemState),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('[systemStore] rehydration failed', error)
        }
      }
    }
  )
)

/** Selector — returns systems in display order. */
export const selectOrderedSystems = (state: SystemState): readonly HeatingSystem[] =>
  state.systemOrder.map(id => state.systems[id]).filter((s): s is HeatingSystem => s !== undefined)
