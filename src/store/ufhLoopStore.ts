/**
 * UFH loop store — normalized CRUD для контуров тёплого пола.
 * Pattern: Phase 2/3 (equipmentStore). One loop per room (enforced via loopsByRoom index).
 * Persist key: 'teplo-ufh-loops'. Persists: loops + loopsByRoom.
 *
 * Phase 04.1: UfhLoop.systemId обязателен (D-11).
 * Добавлены deleteBySystemId + bulkSetSystemId для cascade-delete и миграции.
 *
 * Threat mitigation:
 *   T-04-08: IDs generated via uuid(), never accepted from external input.
 *
 * Decisions:
 *   D-07: activeAreaM2 default = 0.8 * room.area — computed in UI, store accepts value.
 *   D-14 (04.1): UFH temperatures are now per-system (tSupplyUfh/tReturnUfh in HeatingSystem).
 *   D-17: Q cascade — selectLoopByRoom exposes loop for UI derived Q calculation.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage, shapeMerge } from './safeStorage'
import { uuid } from './uuid'
import type { UfhLoop } from '../types/hydraulics'

export interface UfhLoopState {
  readonly loops: Record<string, UfhLoop>       // keyed by loop.id
  readonly loopsByRoom: Record<string, string>  // roomId → loopId (один loop на комнату)
  addLoop: (loop: Omit<UfhLoop, 'id'>) => string
  updateLoop: (id: string, changes: Partial<Omit<UfhLoop, 'id' | 'roomId'>>) => void
  deleteLoop: (id: string) => void
  deleteLoopByRoom: (roomId: string) => void
  toggleEnabled: (id: string) => void
  /** Phase 04.1 cascade: removes all loops belonging to a system (D-04). */
  deleteBySystemId: (systemId: string) => void
  /** Phase 04.1 migration: sets systemId on all loops (D-25). */
  bulkSetSystemId: (systemId: string) => void
}

export const useUfhLoopStore = create<UfhLoopState>()(
  persist(
    (set) => ({
      loops: {},
      loopsByRoom: {},

      addLoop: (loop: Omit<UfhLoop, 'id'>): string => {
        // If room already has a loop — update it instead of creating duplicate
        const existingId = useUfhLoopStore.getState().loopsByRoom[loop.roomId]
        if (existingId) {
          const { id: _id, roomId: _roomId, ...changes } = { id: existingId, ...loop }
          set(state => ({
            loops: {
              ...state.loops,
              [existingId]: { ...state.loops[existingId], ...changes } as UfhLoop
            }
          }))
          return existingId
        }
        const id = uuid()
        set(state => ({
          loops: { ...state.loops, [id]: { ...loop, id } as UfhLoop },
          loopsByRoom: { ...state.loopsByRoom, [loop.roomId]: id }
        }))
        return id
      },

      updateLoop: (id: string, changes: Partial<Omit<UfhLoop, 'id' | 'roomId'>>) => set(state => {
        const existing = state.loops[id]
        if (!existing) return state
        return {
          loops: {
            ...state.loops,
            [id]: { ...existing, ...changes } as UfhLoop
          }
        }
      }),

      deleteLoop: (id: string) => set(state => {
        const loop = state.loops[id]
        if (!loop) return state
        const { [id]: _removed, ...loops } = state.loops
        const { [loop.roomId]: _roomEntry, ...loopsByRoom } = state.loopsByRoom
        return { loops, loopsByRoom }
      }),

      deleteLoopByRoom: (roomId: string) => set(state => {
        const loopId = state.loopsByRoom[roomId]
        if (!loopId) return state
        const { [loopId]: _removed, ...loops } = state.loops
        const { [roomId]: _roomEntry, ...loopsByRoom } = state.loopsByRoom
        return { loops, loopsByRoom }
      }),

      toggleEnabled: (id: string) => set(state => {
        const loop = state.loops[id]
        if (!loop) return state
        return {
          loops: {
            ...state.loops,
            [id]: { ...loop, enabled: !loop.enabled }
          }
        }
      }),

      deleteBySystemId: (systemId: string) => set(state => {
        const idsToRemove = new Set(
          Object.values(state.loops).filter(l => l.systemId === systemId).map(l => l.id)
        )
        if (idsToRemove.size === 0) return state
        const loops: Record<string, UfhLoop> = {}
        const loopsByRoom: Record<string, string> = {}
        for (const [lid, loop] of Object.entries(state.loops)) {
          if (!idsToRemove.has(lid)) {
            loops[lid] = loop
          }
        }
        for (const [roomId, loopId] of Object.entries(state.loopsByRoom)) {
          if (!idsToRemove.has(loopId)) {
            loopsByRoom[roomId] = loopId
          }
        }
        return { loops, loopsByRoom }
      }),

      bulkSetSystemId: (systemId: string) => set(state => {
        const loops: Record<string, UfhLoop> = {}
        for (const [lid, loop] of Object.entries(state.loops)) {
          loops[lid] = { ...loop, systemId }
        }
        return { loops }
      })
    }),
    {
      name: 'teplo-ufh-loops',
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      migrate: (persistedState, version) => {
        if (version < 2) {
          // Fill placeholder systemId for existing loops.
          // runV11Migration (App.tsx) will set correct systemId via bulkSetSystemId.
          const s = persistedState as { loops?: Record<string, Record<string, unknown>> } | null
          if (s?.loops) {
            for (const loop of Object.values(s.loops)) {
              if (loop.systemId === undefined) loop.systemId = ''
            }
          }
          return s
        }
        return persistedState
      },
      partialize: (state) => ({
        loops: state.loops,
        loopsByRoom: state.loopsByRoom
      } as unknown as UfhLoopState),
      // Phase 04.2: validate shape of persisted state, drop garbage to defaults.
      merge: (persisted, current) => shapeMerge(persisted, current as UfhLoopState, {
        loops: 'record',
        loopsByRoom: 'record'
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('UFH loop rehydration failed:', error)
        }
      }
    }
  )
)

/** Selector — returns UFH loop for a given room, or null if none. */
export const selectLoopByRoom = (roomId: string) =>
  (state: UfhLoopState): UfhLoop | null => {
    const loopId = state.loopsByRoom[roomId]
    return loopId != null ? (state.loops[loopId] ?? null) : null
  }
