/**
 * Equipment store — normalized CRUD приборов отопления per Phase 3.
 * Привязан к Room через roomId. Q_пом НЕ хранится здесь (D-07) — derived в UI.
 * Persist key: 'teplo-equipment'.
 *
 * Phase 04.1: Equipment.systemId обязателен (D-10).
 * Добавлены deleteBySystemId + bulkSetSystemId для cascade-delete и миграции.
 *
 * Threat mitigation:
 *   T-04-08: addEquipment генерирует id через uuid().
 *   deleteEquipmentByRoom — cascade delete для предотвращения zombie-записей (Pitfall 3).
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Equipment, EquipmentState } from '../types/project'
import { safeStorage, shapeMerge } from './safeStorage'
import { uuid } from './uuid'

export const defaultEquipmentData = {
  equipment: {} as Record<string, Equipment>,
  equipmentOrder: [] as string[]
}

export const useEquipmentStore = create<EquipmentState>()(
  persist(
    (set) => ({
      ...defaultEquipmentData,

      addEquipment: (eq: Omit<Equipment, 'id'>): string => {
        const id = uuid()
        set(state => ({
          equipment: { ...state.equipment, [id]: { ...eq, id } as Equipment },
          equipmentOrder: [...state.equipmentOrder, id]
        }))
        return id
      },

      updateEquipment: (id: string, changes: Partial<Omit<Equipment, 'id'>>) => set(state => {
        if (!state.equipment[id]) return state
        return {
          equipment: {
            ...state.equipment,
            [id]: { ...state.equipment[id], ...changes } as Equipment
          }
        }
      }),

      deleteEquipment: (id: string) => set(state => {
        const { [id]: _removed, ...equipment } = state.equipment
        return {
          equipment,
          equipmentOrder: state.equipmentOrder.filter(eid => eid !== id)
        }
      }),

      deleteEquipmentByRoom: (roomId: string) => set(state => {
        const idsToRemove = new Set(
          state.equipmentOrder.filter(eid => state.equipment[eid]?.roomId === roomId)
        )
        if (idsToRemove.size === 0) return state
        const equipment: Record<string, Equipment> = {}
        for (const [eid, e] of Object.entries(state.equipment)) {
          if (!idsToRemove.has(eid)) equipment[eid] = e
        }
        return {
          equipment,
          equipmentOrder: state.equipmentOrder.filter(eid => !idsToRemove.has(eid))
        }
      }),

      deleteBySystemId: (systemId: string) => set(state => {
        const idsToRemove = new Set(
          state.equipmentOrder.filter(eid => state.equipment[eid]?.systemId === systemId)
        )
        if (idsToRemove.size === 0) return state
        const equipment: Record<string, Equipment> = {}
        for (const [eid, e] of Object.entries(state.equipment)) {
          if (!idsToRemove.has(eid)) equipment[eid] = e
        }
        return {
          equipment,
          equipmentOrder: state.equipmentOrder.filter(eid => !idsToRemove.has(eid))
        }
      }),

      bulkSetSystemId: (systemId: string) => set(state => {
        const equipment: Record<string, Equipment> = {}
        for (const [eid, e] of Object.entries(state.equipment)) {
          equipment[eid] = { ...e, systemId }
        }
        return { equipment }
      })
    }),
    {
      name: 'teplo-equipment',
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      migrate: (persistedState, version) => {
        if (version < 2) {
          // Fill placeholder systemId for existing equipment.
          // runV11Migration (App.tsx) will set correct systemId via bulkSetSystemId.
          const s = persistedState as { equipment?: Record<string, Record<string, unknown>> } | null
          if (s?.equipment) {
            for (const eq of Object.values(s.equipment)) {
              if (eq.systemId === undefined) eq.systemId = ''
            }
          }
          return s
        }
        return persistedState
      },
      partialize: (state) => ({
        equipment: state.equipment,
        equipmentOrder: state.equipmentOrder
      } as unknown as EquipmentState),
      // Phase 04.2: validate shape of persisted state, drop garbage to defaults.
      merge: (persisted, current) => shapeMerge(persisted, current as EquipmentState, {
        equipment: 'record',
        equipmentOrder: 'array-of-string'
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Equipment rehydration failed:', error)
        }
      }
    }
  )
)

/** Selector — returns equipment for a given room, in equipmentOrder. */
export const selectEquipmentByRoom = (roomId: string) =>
  (state: EquipmentState): readonly Equipment[] =>
    state.equipmentOrder
      .filter(id => state.equipment[id]?.roomId === roomId)
      .map(id => state.equipment[id])
      .filter((e): e is Equipment => e != null)
