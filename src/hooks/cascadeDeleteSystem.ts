/**
 * cascadeDeleteSystem — D-04 cascade delete helper.
 * SP-2: Pattern аналог RoomRow.tsx handleDelete (PATTERNS.md §SP-2).
 *
 * Порядок важен: members первыми, система последней.
 * T-04.1-04-02: deleteBySystemId делает noop на неизвестный id — безопасно.
 */

import { useSystemStore } from '../store/systemStore'
import { useSegmentStore } from '../store/segmentStore'
import { useEquipmentStore } from '../store/equipmentStore'
import { useUfhLoopStore } from '../store/ufhLoopStore'

/** D-04: синхронный cascade delete. Порядок важен: members первыми, система последней. */
export function cascadeDeleteSystem(systemId: string): void {
  useSegmentStore.getState().deleteBySystemId(systemId)
  useEquipmentStore.getState().deleteBySystemId(systemId)
  useUfhLoopStore.getState().deleteBySystemId(systemId)
  useSystemStore.getState().deleteSystem(systemId)
}

/** Подсчёт будущих удалений — для ConfirmDialog body. */
export function getCascadeDeleteCounts(systemId: string): {
  readonly segments: number
  readonly equipment: number
  readonly ufhLoops: number
} {
  const seg = useSegmentStore.getState().segments ?? {}
  const eq = useEquipmentStore.getState().equipment ?? {}
  const ufh = useUfhLoopStore.getState().loops ?? {}
  return {
    segments: Object.values(seg).filter(s => (s as unknown as { systemId?: string }).systemId === systemId).length,
    equipment: Object.values(eq).filter(e => (e as unknown as { systemId?: string }).systemId === systemId).length,
    ufhLoops: Object.values(ufh).filter(l => (l as unknown as { systemId?: string }).systemId === systemId).length
  }
}
