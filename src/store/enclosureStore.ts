/**
 * Zustand store with persist middleware for enclosure state.
 * Persists enclosure data to localStorage key 'teplo-enclosures'.
 * Normalized record + order array pattern (per D-02).
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Enclosure, EnclosureState, Room } from '../types/project'
import { safeStorage } from './safeStorage'
import { uuid } from './uuid'
import { toast } from 'sonner'

const defaultEnclosureData = {
  enclosures: {} as Record<string, Enclosure>,
  enclosureOrder: [] as string[]
}

export const useEnclosureStore = create<EnclosureState>()(
  persist(
    (set) => ({
      ...defaultEnclosureData,

      addEnclosure: (enc: Omit<Enclosure, 'id'>) => set(state => {
        const id = uuid()
        return {
          enclosures: { ...state.enclosures, [id]: { ...enc, id } as Enclosure },
          enclosureOrder: [...state.enclosureOrder, id]
        }
      }),

      updateEnclosure: (id: string, changes: Partial<Omit<Enclosure, 'id'>>) => set(state => {
        const existing = state.enclosures[id]
        if (!existing) return state
        return {
          enclosures: {
            ...state.enclosures,
            [id]: { ...existing, ...changes }
          }
        }
      }),

      deleteEnclosure: (id: string) => set(state => {
        const { [id]: _, ...rest } = state.enclosures
        // Orphan children (if this was a parent wall): set their parentEnclosureId to null.
        // Avoids accidental data loss — user re-assigns manually.
        let orphanCount = 0
        const enclosures: Record<string, Enclosure> = {}
        for (const [eid, enc] of Object.entries(rest)) {
          if (enc.parentEnclosureId === id) {
            enclosures[eid] = { ...enc, parentEnclosureId: null }
            orphanCount++
          } else {
            enclosures[eid] = enc
          }
        }
        if (orphanCount > 0) {
          toast.warning(
            `Родительская стена удалена — ${orphanCount} окон/дверей остались без привязки. Переназначьте вручную.`
          )
        }
        return {
          enclosures,
          enclosureOrder: state.enclosureOrder.filter(eid => eid !== id)
        }
      }),

      deleteEnclosuresByRoom: (roomId: string) => set(state => {
        const idsToRemove = new Set(
          state.enclosureOrder.filter(eid => state.enclosures[eid]?.roomId === roomId)
        )
        const enclosures: Record<string, Enclosure> = {}
        for (const [eid, enc] of Object.entries(state.enclosures)) {
          if (!idsToRemove.has(eid)) {
            enclosures[eid] = enc
          }
        }
        return {
          enclosures,
          enclosureOrder: state.enclosureOrder.filter(eid => !idsToRemove.has(eid))
        }
      }),

      copyFloor: (
        sourceFloor: number,
        targetFloor: number,
        rooms: Record<string, Room>,
        addRooms: (newRooms: Record<string, Room>, newOrder: string[]) => void
      ) => {
        const sourceRooms = Object.values(rooms).filter(
          (r: Room) => r.floor === sourceFloor
        )
        if (sourceRooms.length === 0) return

        const roomIdMap = new Map<string, string>()
        const newRooms: Record<string, Room> = {}
        const newRoomOrder: string[] = []

        for (const room of sourceRooms) {
          const newId = uuid()
          roomIdMap.set(room.id, newId)
          newRooms[newId] = { ...room, id: newId, floor: targetFloor, name: room.name + ' (копия)' }
          newRoomOrder.push(newId)
        }

        // Add cloned rooms via callback (decoupled from projectStore)
        addRooms(newRooms, newRoomOrder)

        // Clone enclosures for the copied rooms. Build old→new enclosure id map
        // per room first, so we can remap parentEnclosureId references to the
        // cloned parents (not the originals from the source floor).
        set(state => {
          const newEnclosures: Record<string, Enclosure> = {}
          const newOrder: string[] = []
          const encIdMap = new Map<string, string>() // old encId → new encId

          // First pass: allocate new ids (so we can resolve parent refs in pass 2)
          const toClone: Array<{ enc: Enclosure; newRoomId: string; newEncId: string }> = []
          for (const [oldRoomId, newRoomId] of roomIdMap) {
            const roomEncs = state.enclosureOrder
              .filter(eid => state.enclosures[eid]?.roomId === oldRoomId)
              .map(eid => state.enclosures[eid])
              .filter((enc): enc is Enclosure => enc != null)
            for (const enc of roomEncs) {
              const newEncId = uuid()
              encIdMap.set(enc.id, newEncId)
              toClone.push({ enc, newRoomId, newEncId })
            }
          }

          // Second pass: build clones with remapped parent ids
          for (const { enc, newRoomId, newEncId } of toClone) {
            const remappedParent = enc.parentEnclosureId
              ? encIdMap.get(enc.parentEnclosureId) ?? null
              : null
            newEnclosures[newEncId] = {
              ...enc,
              id: newEncId,
              roomId: newRoomId,
              parentEnclosureId: remappedParent,
            }
            newOrder.push(newEncId)
          }

          return {
            enclosures: { ...state.enclosures, ...newEnclosures },
            enclosureOrder: [...state.enclosureOrder, ...newOrder]
          }
        })
      }
    }),
    {
      name: 'teplo-enclosures',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        enclosures: state.enclosures,
        enclosureOrder: state.enclosureOrder
      } as unknown as EnclosureState),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Enclosure rehydration failed:', error)
          return
        }
        // Backward-compat: older saves didn't have parentEnclosureId or
        // constructionId on enclosures. Fill with null so engine/UI never
        // sees undefined.
        if (state && state.enclosures) {
          const patched: Record<string, Enclosure> = { ...state.enclosures }
          let changed = false
          for (const [eid, enc] of Object.entries(patched)) {
            const raw = enc as unknown as { parentEnclosureId?: unknown; constructionId?: unknown }
            const needsParent = raw.parentEnclosureId === undefined
            const needsConstr = raw.constructionId === undefined
            if (needsParent || needsConstr) {
              patched[eid] = {
                ...enc,
                parentEnclosureId: needsParent ? null : enc.parentEnclosureId,
                constructionId: needsConstr ? null : enc.constructionId,
              }
              changed = true
            }
          }
          if (changed) Object.assign(state, { enclosures: patched })
        }
      }
    }
  )
)

/** Selector -- returns enclosures for a given room, in order */
export const selectEnclosuresByRoom = (roomId: string) =>
  (state: EnclosureState): Enclosure[] =>
    state.enclosureOrder
      .filter(id => state.enclosures[id]?.roomId === roomId)
      .map(id => state.enclosures[id])
      .filter((enc): enc is Enclosure => enc != null)
