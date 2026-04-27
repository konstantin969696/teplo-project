/**
 * Zustand store with persist middleware for project state.
 * Persists project data to localStorage key 'teplo-project'.
 * UI-only state (activeTab) excluded via partialize.
 *
 * Phase 04.1: persist.version bumped to 2.
 * migrate() sets schemaVersion='1.1' and preserves 7 legacy fields for runV11Migration.
 * clearLegacyV10Fields() removes them after migration completes (called from App.tsx).
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ProjectState, ProjectData, CityData, CustomCityData, Room, PoolParams } from '../types/project'
import { validateProjectJSON } from '../engine/validation'
import { clampTemperature } from '../engine/climate'
import { migrateV10toV11Json } from '../engine/migration'
import { safeStorage } from './safeStorage'
import { applyImportedStores } from '../services/importService'
import { collectExportData } from '../services/exportService'
import { uuid } from './uuid'
import { toast } from 'sonner'

export const defaultProjectData: ProjectData = {
  city: null,
  tInside: 20,
  rooms: {},
  roomOrder: [],
  customCities: [],
  schemaVersion: '1.1'
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      ...defaultProjectData,
      activeTab: 0,

      setCity: (city: CityData | null) => set({ city }),

      setTInside: (t: number) => set({ tInside: clampTemperature(t) }),

      setActiveTab: (tab: number) => set({ activeTab: tab }),

      clearLegacyV10Fields: () => set({
        // Set each legacy v1.0 field to undefined via normal merge (no replace=true).
        // replace=true would risk wiping store actions if the spread cast ever fails.
        tSupply: undefined,
        tReturn: undefined,
        tSupplyUfh: undefined,
        tReturnUfh: undefined,
        schemaType: undefined,
        pipeMaterialId: undefined,
        coolantId: undefined,
      } as unknown as Partial<ProjectState>),

      exportJSON: () => {
        const data = collectExportData()
        const date = new Date()
        const dd = String(date.getDate()).padStart(2, '0')
        const mm = String(date.getMonth() + 1).padStart(2, '0')
        const yyyy = date.getFullYear()
        const filename = `ТеплоПроект_${dd}.${mm}.${yyyy}.json`
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Проект экспортирован')
      },

      importJSON: (data: unknown) => {
        if (typeof data !== 'object' || data === null) {
          toast.error('Ошибка импорта: файл повреждён или имеет неверный формат')
          return
        }
        const rawObj = data as Record<string, unknown>

        // Prototype pollution guard
        if (Object.prototype.hasOwnProperty.call(rawObj, '__proto__') ||
            Object.prototype.hasOwnProperty.call(rawObj, 'constructor')) {
          toast.error('Ошибка импорта: файл содержит недопустимые ключи')
          return
        }

        // v1.0 → v1.1 миграция: migrateV10toV11Json идемпотентен (already-v1.1 → no-op).
        const needsMigration = rawObj.schemaVersion !== '1.1'
        let normalized: Record<string, unknown>
        try {
          normalized = needsMigration ? migrateV10toV11Json(rawObj) : rawObj
        } catch (err) {
          toast.error(`Ошибка миграции проекта: ${(err as Error).message}`)
          return
        }

        if (!validateProjectJSON(normalized)) {
          toast.error('Ошибка импорта: файл повреждён или имеет неверный формат')
          return
        }

        // Normalize rooms: Phase 1 JSON may lack Phase 2 fields
        const normalizedRooms: Record<string, Room> = {}
        let roomIdx = 0
        for (const [id, room] of Object.entries(normalized.rooms)) {
          const r = room as unknown as Record<string, unknown>
          roomIdx++
          normalizedRooms[id] = {
            id,
            number: typeof r.number === 'number' ? r.number : roomIdx,
            name: r.name as string,
            floor: r.floor as number,
            area: r.area as number,
            height: r.height as number,
            isCorner: (r.isCorner as boolean) ?? false,
            infiltrationMethod: (r.infiltrationMethod as 'rate' | 'gap') ?? 'rate',
            nInfiltration: typeof r.nInfiltration === 'number' ? r.nInfiltration : null,
            gapArea: (r.gapArea as number | null) ?? null,
            windSpeed: (r.windSpeed as number | null) ?? null,
            lVentilation: (r.lVentilation as number) ?? 0,
            tInside: (r.tInside as number) ?? normalized.tInside ?? 20,
            floorTempThresholdC: typeof r.floorTempThresholdC === 'number' ? r.floorTempThresholdC : null,
          ...(r.poolParams != null ? { poolParams: r.poolParams as PoolParams } : {}),
          }
        }
        set({
          city: normalized.city,
          tInside: normalized.tInside,
          rooms: normalizedRooms,
          roomOrder: normalized.roomOrder,
          customCities: normalized.customCities ?? [],
          schemaVersion: '1.1'
        })

        // Apply per-system data into dedicated stores (Phase 04.1 multi-store split)
        applyImportedStores(normalized as Record<string, unknown>)
      },

      resetProject: () => set({ ...defaultProjectData }),

      addCustomCity: (cityInput) => set(state => ({
        customCities: [...state.customCities, { ...cityInput, id: uuid(), isCustom: true as const }]
      })),

      updateCustomCity: (id, cityInput) => set(state => {
        const updated: CustomCityData = { ...cityInput, id, isCustom: true as const }
        const customCities = state.customCities.map(c => c.id === id ? updated : c)
        const city = (state.city && 'id' in state.city && (state.city as CustomCityData).id === id)
          ? updated
          : state.city
        return { customCities, city }
      }),

      deleteCustomCity: (id) => set(state => {
        const customCities = state.customCities.filter(c => c.id !== id)
        const city = (state.city && 'id' in state.city && (state.city as CustomCityData).id === id)
          ? null
          : state.city
        return { customCities, city }
      }),

      addRoom: (room: Omit<Room, 'id'>) => set((state) => {
        const id = uuid()
        return {
          rooms: { ...state.rooms, [id]: { ...room, id } },
          roomOrder: [...state.roomOrder, id]
        }
      }),

      updateRoom: (id: string, changes: Partial<Omit<Room, 'id'>>) => set(state => {
        const existing = state.rooms[id]
        if (!existing) return state
        return {
          rooms: {
            ...state.rooms,
            [id]: { ...existing, ...changes }
          }
        }
      }),

      deleteRoom: (id: string) => set(state => {
        const { [id]: _, ...rooms } = state.rooms
        return {
          rooms,
          roomOrder: state.roomOrder.filter(rid => rid !== id)
        }
      })
    }),
    {
      name: 'teplo-project',
      version: 3,
      storage: createJSONStorage(() => safeStorage),
      migrate: (persistedState, version) => {
        const s = (persistedState as Record<string, unknown> | null) ?? {}
        // Prototype pollution guard
        if (Object.prototype.hasOwnProperty.call(s, '__proto__') ||
            Object.prototype.hasOwnProperty.call(s, 'constructor')) {
          return { ...defaultProjectData } as unknown as ProjectState
        }
        let result: Record<string, unknown> = s

        if (version < 2) {
          // ONLY set schemaVersion. 7 legacy fields are preserved for runV11Migration.
          // clearLegacyV10Fields (called from App.tsx after migration) removes them.
          result = { ...result, schemaVersion: '1.1' }
        }

        if (version < 3) {
          // Backfill floorTempThresholdC: null on all rooms.
          const rooms = (result.rooms ?? {}) as Record<string, Record<string, unknown>>
          const patchedRooms: Record<string, unknown> = {}
          for (const [id, room] of Object.entries(rooms)) {
            patchedRooms[id] = { floorTempThresholdC: null, ...room }
          }
          result = { ...result, rooms: patchedRooms }
        }

        return result as unknown as ProjectState
      },
      partialize: (state) => {
        const { activeTab: _omit, ...data } = state as unknown as Record<string, unknown>
        return data as unknown as ProjectState
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Rehydration failed:', error)
          return
        }
        // Backward-compat: older saves did not have Room.number. Fill it with
        // roomOrder position (1-based) so existing projects don't break.
        if (state && state.roomOrder && state.rooms) {
          const patched: Record<string, Room> = { ...state.rooms }
          let changed = false
          state.roomOrder.forEach((id, idx) => {
            const r = patched[id] as Room | undefined
            if (r && (typeof (r as unknown as { number?: unknown }).number !== 'number')) {
              patched[id] = { ...r, number: idx + 1 }
              changed = true
            }
          })
          if (changed) Object.assign(state, { rooms: patched })
        }
      }
    }
  )
)

/** Selector -- deltaT computed on the fly, NOT stored */
export const selectDeltaT = (state: ProjectState): number | null =>
  state.city ? state.tInside - state.city.tOutside : null
