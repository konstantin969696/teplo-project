/**
 * Cross-store apply for imported project data.
 * Decouples projectStore.importJSON from direct setState calls on other stores.
 */

import { useSystemStore } from '../store/systemStore'
import { useSegmentStore } from '../store/segmentStore'
import { useEquipmentStore } from '../store/equipmentStore'
import { useUfhLoopStore } from '../store/ufhLoopStore'
import { useEnclosureStore } from '../store/enclosureStore'
import { shapeMerge } from '../store/safeStorage'
import { toast } from 'sonner'

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function applyImportedStores(data: Record<string, unknown>): void {
  if (data.enclosures !== undefined) {
    if (!isPlainObject(data.enclosures)) {
      console.warn('[importService] skipped enclosures: not a plain object')
    } else {
      const validated = shapeMerge(
        { enclosures: data.enclosures, enclosureOrder: data.enclosureOrder },
        { enclosures: {} as Record<string, never>, enclosureOrder: [] as string[] },
        { enclosures: 'record', enclosureOrder: 'array-of-string' }
      )
      useEnclosureStore.setState({ enclosures: validated.enclosures, enclosureOrder: validated.enclosureOrder })
    }
  }

  if (data.systems !== undefined) {
    if (!isPlainObject(data.systems)) {
      console.warn('[importService] skipped systems: not a plain object')
    } else {
      const validated = shapeMerge(
        { systems: data.systems, systemOrder: data.systemOrder },
        { systems: {} as Record<string, never>, systemOrder: [] as string[] },
        { systems: 'record', systemOrder: 'array-of-string' }
      )
      useSystemStore.setState({ systems: validated.systems, systemOrder: validated.systemOrder })
    }
  }

  if (data.segments !== undefined) {
    if (!isPlainObject(data.segments)) {
      console.warn('[importService] skipped segments: not a plain object')
    } else {
      const validated = shapeMerge(
        { segments: data.segments, segmentOrder: data.segmentOrder },
        { segments: {} as Record<string, never>, segmentOrder: [] as string[] },
        { segments: 'record', segmentOrder: 'array-of-string' }
      )
      useSegmentStore.setState({ segments: validated.segments, segmentOrder: validated.segmentOrder })
    }
  }

  if (data.equipment !== undefined) {
    if (!isPlainObject(data.equipment)) {
      console.warn('[importService] skipped equipment: not a plain object')
    } else {
      const validated = shapeMerge(
        { equipment: data.equipment, equipmentOrder: data.equipmentOrder },
        { equipment: {} as Record<string, never>, equipmentOrder: [] as string[] },
        { equipment: 'record', equipmentOrder: 'array-of-string' }
      )
      useEquipmentStore.setState({ equipment: validated.equipment, equipmentOrder: validated.equipmentOrder })
    }
  }

  if (data.ufhLoops !== undefined) {
    if (!isPlainObject(data.ufhLoops)) {
      console.warn('[importService] skipped ufhLoops: not a plain object')
    } else {
      const loopsRaw = data.ufhLoops as Record<string, { id?: string; roomId?: string }>
      const loopsByRoom: Record<string, string> = {}
      for (const [id, loop] of Object.entries(loopsRaw)) {
        if (loop && typeof loop === 'object' && typeof loop.roomId === 'string') {
          loopsByRoom[loop.roomId] = id
        }
      }
      useUfhLoopStore.setState({
        loops: loopsRaw,
        loopsByRoom
      } as unknown as Parameters<typeof useUfhLoopStore.setState>[0])
    }
  }
}
