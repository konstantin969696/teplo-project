/**
 * Shared room-management actions: bulk-add on floor, clone room with all
 * attached enclosures (parent/child ids remapped) and equipment.
 * Kept outside the Zustand stores so cross-store orchestration stays visible.
 */

import type { Enclosure, Equipment, Room } from '../types/project'
import { useProjectStore } from '../store/projectStore'
import { useEnclosureStore } from '../store/enclosureStore'
import { useEquipmentStore } from '../store/equipmentStore'
import { uuid } from '../store/uuid'

const MAX_FLOOR = 200
const MAX_ROOM_NUMBER = 9999
const MAX_BATCH_ADD = 50

function clampFloor(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(MAX_FLOOR, Math.round(n)))
}

function nextRoomNumberOnFloor(
  rooms: Readonly<Record<string, Room>>,
  floor: number
): number {
  const floorBase = floor * 100
  const existingOnFloor = Object.values(rooms).filter(r => r.floor === floor)
  if (existingOnFloor.length === 0) {
    return Math.min(floorBase + 1, MAX_ROOM_NUMBER)
  }
  const maxNumber = existingOnFloor.reduce((acc, r) => Math.max(acc, r.number), 0)
  // TODO(phase-7): silent cap at 9999 produces duplicate numbers if exceeded.
  // Surface a warning/return null when max reached.
  return Math.min(Math.max(maxNumber + 1, floorBase + 1), MAX_ROOM_NUMBER)
}

/**
 * Adds `count` fresh rooms to a given floor with auto-assigned room numbers
 * (floor·100+N convention, continuing past the current max).
 * Uses the store setter `addRoom`, which generates a stable uuid per call.
 */
export function addRoomsToFloor(floor: number, count: number): void {
  const floorN = clampFloor(floor)
  const n = Math.max(1, Math.min(MAX_BATCH_ADD, Math.round(count)))
  const state = useProjectStore.getState()
  const tInsideDefault = state.tInside
  let runningRooms = state.rooms
  // TODO(phase-7): batch into a single setState to avoid N re-renders for large N.
  for (let i = 0; i < n; i++) {
    const suggestedNumber = nextRoomNumberOnFloor(runningRooms, floorN)
    state.addRoom({
      number: suggestedNumber,
      name: '',
      floor: floorN,
      area: 0,
      height: 2.7,
      isCorner: false,
      infiltrationMethod: 'rate',
      nInfiltration: null,
      gapArea: null,
      windSpeed: null,
      lVentilation: 0,
      tInside: tInsideDefault,
    })
    // Re-read to include the just-added room for subsequent iterations
    runningRooms = useProjectStore.getState().rooms
  }
}

/**
 * Clones a room together with:
 *  - its enclosures (parentEnclosureId references remapped to the cloned parents)
 *  - its equipment (fresh ids, same config)
 * Keeps the floor; bumps the room number to the next free on that floor.
 * Name gets " (копия)" suffix.
 */
export function cloneRoom(sourceRoomId: string): string | null {
  const projectState = useProjectStore.getState()
  const source = projectState.rooms[sourceRoomId]
  if (!source) return null

  const newRoomId = uuid()
  const newNumber = nextRoomNumberOnFloor(projectState.rooms, source.floor)

  // Order matters: we populate enclosures/equipment FIRST, then insert the room
  // into projectStore last. Reason: UI subscribers watching projectStore see
  // the new roomId only when its attachments are already in place — no flash
  // of a "0 Вт / 0 enclosures" intermediate render (see M1 in review).
  //
  // 1) Clone enclosures with two-pass id remap (for parentEnclosureId refs).
  useEnclosureStore.setState(state => {
    const roomEncs = state.enclosureOrder
      .filter(eid => state.enclosures[eid]?.roomId === sourceRoomId)
      .map(eid => state.enclosures[eid])
      .filter((e): e is Enclosure => e != null)

    if (roomEncs.length === 0) return state

    const oldToNew = new Map<string, string>()
    for (const enc of roomEncs) oldToNew.set(enc.id, uuid())

    const newEncs: Record<string, Enclosure> = {}
    const newOrder: string[] = []
    for (const enc of roomEncs) {
      const newEncId = oldToNew.get(enc.id)!
      const remappedParent = enc.parentEnclosureId
        ? oldToNew.get(enc.parentEnclosureId) ?? null
        : null
      newEncs[newEncId] = {
        ...enc,
        id: newEncId,
        roomId: newRoomId,
        parentEnclosureId: remappedParent,
      }
      newOrder.push(newEncId)
    }
    return {
      enclosures: { ...state.enclosures, ...newEncs },
      enclosureOrder: [...state.enclosureOrder, ...newOrder],
    }
  })

  // 2) Clone equipment — straight copy, fresh ids.
  // TODO(phase-7): align iteration pattern with enclosure block (filter-by-roomId first, then type-guard).
  useEquipmentStore.setState(state => {
    const roomEq = state.equipmentOrder
      .map(id => state.equipment[id])
      .filter((e): e is Equipment => e != null && e.roomId === sourceRoomId)
    if (roomEq.length === 0) return state
    const newEq: Record<string, Equipment> = {}
    const newOrder: string[] = []
    for (const eq of roomEq) {
      const newId = uuid()
      newEq[newId] = { ...eq, id: newId, roomId: newRoomId }
      newOrder.push(newId)
    }
    return {
      equipment: { ...state.equipment, ...newEq },
      equipmentOrder: [...state.equipmentOrder, ...newOrder],
    }
  })

  // 3) Finally, insert the room copy — this is what UI subscribers watch.
  useProjectStore.setState(state => ({
    rooms: {
      ...state.rooms,
      [newRoomId]: {
        ...source,
        id: newRoomId,
        number: newNumber,
        name: source.name ? `${source.name} (копия)` : '',
      },
    },
    roomOrder: [...state.roomOrder, newRoomId],
  }))

  return newRoomId
}
