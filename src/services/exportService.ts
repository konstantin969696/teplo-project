/**
 * Cross-store collection for project export.
 * Mirrors applyImportedStores in importService.ts: produces a flat JSON object
 * that the import path understands directly.
 */

import { useProjectStore } from '../store/projectStore'
import { useEnclosureStore } from '../store/enclosureStore'
import { useSystemStore } from '../store/systemStore'
import { useSegmentStore } from '../store/segmentStore'
import { useEquipmentStore } from '../store/equipmentStore'
import { useUfhLoopStore } from '../store/ufhLoopStore'

export function collectExportData(): Record<string, unknown> {
  const p = useProjectStore.getState()
  const enc = useEnclosureStore.getState()
  const sys = useSystemStore.getState()
  const seg = useSegmentStore.getState()
  const eq = useEquipmentStore.getState()
  const ufh = useUfhLoopStore.getState()

  return {
    city: p.city,
    tInside: p.tInside,
    rooms: p.rooms,
    roomOrder: p.roomOrder,
    customCities: p.customCities,
    schemaVersion: p.schemaVersion,
    enclosures: enc.enclosures,
    enclosureOrder: enc.enclosureOrder,
    systems: sys.systems,
    systemOrder: sys.systemOrder,
    segments: seg.segments,
    segmentOrder: seg.segmentOrder,
    equipment: eq.equipment,
    equipmentOrder: eq.equipmentOrder,
    ufhLoops: ufh.loops,
  }
}
