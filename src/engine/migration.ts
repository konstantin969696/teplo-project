/**
 * Migration engine: v1.0 → v1.1 cross-store orchestration + JSON-import variant.
 * Pure TS — zero React / store imports. Store APIs passed as parameters.
 * Threat mitigations: T-04.1-03-01 (prototype pollution), T-04.1-03-03 (idempotency),
 * T-04.1-03-05 (partial v1.0 tolerance).
 */

import type { HeatingSystem } from '../types/system'
import { DEFAULT_SYSTEM } from '../types/system'

// Re-export so callers can import DEFAULT_SYSTEM from migration.ts (convenience)
export { DEFAULT_SYSTEM }

// ---------------------------------------------------------------------------
// Store API surface (passed as parameter — never imported directly)
// ---------------------------------------------------------------------------

interface ProjectStoreState {
  /** @deprecated Phase 04.1: moved to HeatingSystem */
  tSupply?: number
  /** @deprecated Phase 04.1: moved to HeatingSystem */
  tReturn?: number
  /** @deprecated Phase 04.1: moved to HeatingSystem */
  tSupplyUfh?: number
  /** @deprecated Phase 04.1: moved to HeatingSystem */
  tReturnUfh?: number
  /** @deprecated Phase 04.1: moved to HeatingSystem */
  schemaType?: string
  /** @deprecated Phase 04.1: moved to HeatingSystem */
  pipeMaterialId?: string
  /** @deprecated Phase 04.1: moved to HeatingSystem */
  coolantId?: string
  [key: string]: unknown
}

interface SystemStoreState {
  systems: Record<string, HeatingSystem>
  systemOrder: string[]
  addSystem: (sys: Omit<HeatingSystem, 'id'>) => string
}

interface SegmentStoreState {
  segments: Record<string, unknown>
  segmentOrder: string[]
  bulkSetSystemId: (ids: string[], systemId: string) => void
}

interface EquipmentStoreState {
  equipment: Record<string, unknown>
  equipmentOrder: string[]
  bulkSetSystemId: (ids: string[], systemId: string) => void
}

interface UfhLoopStoreState {
  ufhLoops: Record<string, unknown>
  ufhLoopOrder: string[]
  bulkSetSystemId: (ids: string[], systemId: string) => void
}

export interface MigrationApi {
  projectStore: { getState: () => ProjectStoreState }
  systemStore: { getState: () => SystemStoreState }
  segmentStore: { getState: () => SegmentStoreState }
  equipmentStore: { getState: () => EquipmentStoreState }
  ufhLoopStore: { getState: () => UfhLoopStoreState }
}

export interface MigrationResult {
  readonly migrated: boolean
  readonly seeded: boolean
  readonly systemId: string | null
}

// ---------------------------------------------------------------------------
// runV11Migration — D-24/D-25/D-26: single-shot cross-store migration.
// Idempotent: systemOrder.length > 0 → early return { migrated: false, seeded: false, systemId: null }.
// ---------------------------------------------------------------------------

export function runV11Migration(api: MigrationApi): MigrationResult {
  const systemState = api.systemStore.getState()

  // T-04.1-03-03: idempotency guard — already migrated.
  // Phase 04.2: stores guarantee systemOrder is always an array via shapeMerge,
  // so `?? []` defense-in-depth removed (covered by store-level invariant).
  if (systemState.systemOrder.length > 0) {
    return { migrated: false, seeded: false, systemId: null }
  }

  const project = api.projectStore.getState()
  const segState = api.segmentStore.getState()
  const eqState = api.equipmentStore.getState()
  const ufhState = api.ufhLoopStore.getState()

  // Detect v1.0 legacy fields (7 deprecated project-level fields)
  const hasOldFields =
    project.tSupply !== undefined ||
    project.tReturn !== undefined ||
    project.tSupplyUfh !== undefined ||
    project.tReturnUfh !== undefined ||
    project.schemaType !== undefined ||
    project.pipeMaterialId !== undefined ||
    project.coolantId !== undefined

  const hasMembers =
    segState.segmentOrder.length > 0 ||
    eqState.equipmentOrder.length > 0 ||
    (ufhState.ufhLoopOrder ?? []).length > 0

  // T-04.1-03-05: partial v1.0 — missing legacy fields fall back to DEFAULT_SYSTEM
  const systemFields: Omit<HeatingSystem, 'id' | 'name'> = {
    schemaType: (project.schemaType as HeatingSystem['schemaType']) ?? DEFAULT_SYSTEM.schemaType,
    pipeMaterialId: (project.pipeMaterialId as string) ?? DEFAULT_SYSTEM.pipeMaterialId,
    coolantId: (project.coolantId as string) ?? DEFAULT_SYSTEM.coolantId,
    tSupply: (project.tSupply as number) ?? DEFAULT_SYSTEM.tSupply,
    tReturn: (project.tReturn as number) ?? DEFAULT_SYSTEM.tReturn,
    tSupplyUfh: (project.tSupplyUfh as number) ?? DEFAULT_SYSTEM.tSupplyUfh,
    tReturnUfh: (project.tReturnUfh as number) ?? DEFAULT_SYSTEM.tReturnUfh,
    sourceLabel: DEFAULT_SYSTEM.sourceLabel
  }

  const systemId = systemState.addSystem({ name: 'Система 1', ...systemFields })

  if (hasMembers) {
    segState.bulkSetSystemId([...segState.segmentOrder], systemId)
    eqState.bulkSetSystemId([...eqState.equipmentOrder], systemId)
    // ufhLoopOrder doesn't actually exist on useUfhLoopStore (record-only store).
    // Tracked as known-issue in .planning/phases/04.2-system-order-rca/STATUS.md.
    ufhState.bulkSetSystemId([...(ufhState.ufhLoopOrder ?? [])], systemId)
  }

  return {
    migrated: hasMembers || hasOldFields,
    seeded: !hasMembers && !hasOldFields,
    systemId
  }
}

// ---------------------------------------------------------------------------
// migrateV10toV11Json — pure JSON-import variant; no store API needed.
// ---------------------------------------------------------------------------

export function migrateV10toV11Json(data: unknown): Record<string, unknown> {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid JSON: not an object')
  }
  const obj = data as Record<string, unknown>

  // T-04.1-03-01: prototype pollution guard
  if (
    Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
    Object.prototype.hasOwnProperty.call(obj, 'constructor')
  ) {
    throw new Error('Malicious keys in JSON')
  }

  // Idempotency: already v1.1 shape
  if ('systems' in obj && 'systemOrder' in obj) return obj

  const systemId = 'sys-migrated-1'
  const system: HeatingSystem = {
    id: systemId,
    name: 'Система 1',
    schemaType: (obj.schemaType as HeatingSystem['schemaType']) ?? DEFAULT_SYSTEM.schemaType,
    pipeMaterialId: (obj.pipeMaterialId as string) ?? DEFAULT_SYSTEM.pipeMaterialId,
    coolantId: (obj.coolantId as string) ?? DEFAULT_SYSTEM.coolantId,
    tSupply: (obj.tSupply as number) ?? DEFAULT_SYSTEM.tSupply,
    tReturn: (obj.tReturn as number) ?? DEFAULT_SYSTEM.tReturn,
    tSupplyUfh: (obj.tSupplyUfh as number) ?? DEFAULT_SYSTEM.tSupplyUfh,
    tReturnUfh: (obj.tReturnUfh as number) ?? DEFAULT_SYSTEM.tReturnUfh,
    sourceLabel: ''
  }

  // Attach systemId to all member objects (skip prototype-pollution keys)
  const attachSystemId = (map: unknown): Record<string, unknown> => {
    if (typeof map !== 'object' || map === null) return {}
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(map as Record<string, unknown>)) {
      if (k === '__proto__' || k === 'constructor') continue
      if (typeof v === 'object' && v !== null) {
        out[k] = { ...(v as Record<string, unknown>), systemId }
      } else {
        out[k] = v
      }
    }
    return out
  }

  // Destructure to remove legacy project-level fields
  const {
    schemaType: _s, pipeMaterialId: _p, coolantId: _c,
    tSupply: _ts, tReturn: _tr, tSupplyUfh: _tsu, tReturnUfh: _tru,
    ...rest
  } = obj

  return {
    ...rest,
    schemaVersion: '1.1',
    systems: { [systemId]: system },
    systemOrder: [systemId],
    segments: attachSystemId(obj.segments),
    equipment: attachSystemId(obj.equipment),
    ufhLoops: attachSystemId(obj.ufhLoops)
  }
}
