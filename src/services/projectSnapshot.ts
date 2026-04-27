/**
 * Snapshot helpers for the projects manager.
 * collectSnapshot — reads all 6 working stores into a ProjectSnapshot.
 * restoreSnapshot — writes a ProjectSnapshot back into the 6 working stores.
 * resetAllStores — clears all 6 working stores to their defaults.
 *
 * Note: runRegistryMigration lives in registryMigration.ts to avoid circular
 * imports (projectsRegistryStore.ts imports this file).
 */

import type { ProjectSnapshot } from '../types/project'
import { useProjectStore, defaultProjectData } from '../store/projectStore'
import { useEnclosureStore, defaultEnclosureData } from '../store/enclosureStore'
import { useSystemStore, defaultSystemData } from '../store/systemStore'
import { useSegmentStore, defaultSegmentData } from '../store/segmentStore'
import { useEquipmentStore, defaultEquipmentData } from '../store/equipmentStore'
import { useUfhLoopStore, defaultUfhLoopData } from '../store/ufhLoopStore'

export function collectSnapshot(): ProjectSnapshot {
  const p = useProjectStore.getState()
  const enc = useEnclosureStore.getState()
  const sys = useSystemStore.getState()
  const seg = useSegmentStore.getState()
  const eq = useEquipmentStore.getState()
  const ufh = useUfhLoopStore.getState()

  return {
    version: 1,
    project: {
      city: p.city,
      tInside: p.tInside,
      rooms: p.rooms,
      roomOrder: [...p.roomOrder],
      customCities: [...p.customCities],
      schemaVersion: p.schemaVersion,
    },
    enclosures: {
      enclosures: { ...enc.enclosures },
      enclosureOrder: [...enc.enclosureOrder],
    },
    systems: {
      systems: { ...sys.systems },
      systemOrder: [...sys.systemOrder],
    },
    segments: {
      segments: { ...seg.segments },
      segmentOrder: [...seg.segmentOrder],
    },
    equipment: {
      equipment: { ...eq.equipment },
      equipmentOrder: [...eq.equipmentOrder],
    },
    ufhLoops: {
      loops: { ...ufh.loops },
      loopsByRoom: { ...ufh.loopsByRoom },
    },
  }
}

export function restoreSnapshot(snap: ProjectSnapshot): void {
  useProjectStore.setState({ ...snap.project, activeTab: 0 })
  useEnclosureStore.setState(snap.enclosures as Parameters<typeof useEnclosureStore.setState>[0])
  useSystemStore.setState(snap.systems as Parameters<typeof useSystemStore.setState>[0])
  useSegmentStore.setState(snap.segments as Parameters<typeof useSegmentStore.setState>[0])
  useEquipmentStore.setState(snap.equipment as Parameters<typeof useEquipmentStore.setState>[0])
  useUfhLoopStore.setState(snap.ufhLoops as Parameters<typeof useUfhLoopStore.setState>[0])
}

export function resetAllStores(): void {
  useProjectStore.setState({ ...defaultProjectData, activeTab: 0 })
  useEnclosureStore.setState(defaultEnclosureData as Parameters<typeof useEnclosureStore.setState>[0])
  useSystemStore.setState(defaultSystemData as Parameters<typeof useSystemStore.setState>[0])
  useSegmentStore.setState(defaultSegmentData as Parameters<typeof useSegmentStore.setState>[0])
  useEquipmentStore.setState(defaultEquipmentData as Parameters<typeof useEquipmentStore.setState>[0])
  useUfhLoopStore.setState(defaultUfhLoopData as Parameters<typeof useUfhLoopStore.setState>[0])
}

