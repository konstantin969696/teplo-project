/**
 * Shared helpers for grouping rooms by floor.
 * Used by both HeatLoss and Equipment tables — single source of truth keeps
 * floor ordering and pluralisation consistent across tabs.
 */

import type { Room } from '../types/project'

export interface FloorGroup {
  readonly floor: number
  readonly roomIds: readonly string[]
}

/**
 * Groups room ids by Room.floor.
 * Group order follows first-appearance order in roomOrder
 * (so the user's drag/sort preferences are respected).
 */
export function groupByFloor(
  rooms: Record<string, Room>,
  roomOrder: readonly string[]
): FloorGroup[] {
  const byFloor = new Map<number, string[]>()
  const floorFirstSeen = new Map<number, number>()

  roomOrder.forEach((id, idx) => {
    const room = rooms[id]
    if (!room) return
    if (!byFloor.has(room.floor)) {
      byFloor.set(room.floor, [])
      floorFirstSeen.set(room.floor, idx)
    }
    byFloor.get(room.floor)!.push(id)
  })

  return [...byFloor.entries()]
    .sort((a, b) => (floorFirstSeen.get(a[0])! - floorFirstSeen.get(b[0])!))
    .map(([floor, roomIds]) => ({ floor, roomIds }))
}

/**
 * Russian pluralization for room counts: 1 помещение, 2 помещения, 5 помещений.
 */
export function pluralizeRooms(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'помещение'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'помещения'
  return 'помещений'
}
