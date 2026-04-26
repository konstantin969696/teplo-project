/**
 * Project JSON validation for import.
 * Zero React imports — pure validation logic.
 * Threat mitigation: T-01-01 / T-3-02 — validates all fields, types, and ranges
 * before accepting untrusted import data. Reject prototype pollution via
 * '__proto__' / 'constructor' key checks on object boundaries.
 */

import type { ProjectData } from '../types/project'

const VALID_KINDS: ReadonlySet<string> = new Set([
  'panel', 'bimetal', 'aluminum', 'cast-iron', 'underfloor-convector'
])
const VALID_CONNECTIONS: ReadonlySet<string> = new Set(['side', 'bottom', 'diagonal'])
const VALID_INSTALLATIONS: ReadonlySet<string> = new Set(['open', 'niche', 'under-sill'])
const VALID_PANEL_TYPES: ReadonlySet<string> = new Set(['11', '21', '22', '33'])

/** Validate that unknown data conforms to ProjectData schema. */
export function validateProjectJSON(data: unknown): data is ProjectData {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>

  // city: null or valid CityData
  if (obj.city !== null) {
    if (typeof obj.city !== 'object' || obj.city === null) return false
    const city = obj.city as Record<string, unknown>
    if (typeof city.name !== 'string') return false
    if (typeof city.tOutside !== 'number') return false
    if (typeof city.gsop !== 'number') return false
    if (!['А', 'Б', 'В'].includes(city.humidityZone as string)) return false
  }

  // tInside: number in valid range [10, 30]
  if (typeof obj.tInside !== 'number') return false
  if (obj.tInside < 10 || obj.tInside > 30) return false

  // rooms: Record<string, Room>
  if (typeof obj.rooms !== 'object' || obj.rooms === null) return false

  // Validate each room has required base fields
  for (const room of Object.values(obj.rooms as Record<string, unknown>)) {
    if (typeof room !== 'object' || room === null) return false
    const r = room as Record<string, unknown>
    if (typeof r.id !== 'string') return false
    if (typeof r.name !== 'string') return false
    if (typeof r.floor !== 'number') return false
    if (typeof r.area !== 'number') return false
    if (typeof r.height !== 'number') return false
    // Phase 2 fields are optional in imported JSON (backward compat)
  }

  // roomOrder: string[]
  if (!Array.isArray(obj.roomOrder)) return false

  // customCities: optional array of CustomCityData (backward compat: absent = [])
  if ('customCities' in obj) {
    if (!Array.isArray(obj.customCities)) return false
    for (const cc of obj.customCities) {
      if (typeof cc !== 'object' || cc === null) return false
      const c = cc as Record<string, unknown>
      if (typeof c.id !== 'string') return false
      if (typeof c.name !== 'string' || c.name.trim() === '') return false
      if (typeof c.tOutside !== 'number' || !Number.isFinite(c.tOutside)) return false
      if (typeof c.gsop !== 'number' || !Number.isFinite(c.gsop)) return false
      if (!['А', 'Б', 'В'].includes(c.humidityZone as string)) return false
      if (c.isCustom !== true) return false
    }
  }

  // Phase 3 fields — optional for backward-compat
  if ('tSupply' in obj) {
    if (typeof obj.tSupply !== 'number' || !Number.isFinite(obj.tSupply) || obj.tSupply < 20 || obj.tSupply > 150) return false
  }
  if ('tReturn' in obj) {
    if (typeof obj.tReturn !== 'number' || !Number.isFinite(obj.tReturn) || obj.tReturn < 10 || obj.tReturn > 140) return false
  }

  // Phase 4 fields — optional for backward-compat
  const VALID_SCHEMA_TYPES = new Set(['two-pipe-dead-end', 'two-pipe-flow-through', 'manifold', 'single-pipe'])
  if ('schemaType' in obj) {
    if (typeof obj.schemaType !== 'string' || !VALID_SCHEMA_TYPES.has(obj.schemaType)) return false
  }
  if ('pipeMaterialId' in obj) {
    if (typeof obj.pipeMaterialId !== 'string' || obj.pipeMaterialId.length === 0) return false
  }
  if ('coolantId' in obj) {
    if (typeof obj.coolantId !== 'string' || obj.coolantId.length === 0) return false
  }
  if ('tSupplyUfh' in obj) {
    if (typeof obj.tSupplyUfh !== 'number' || !Number.isFinite(obj.tSupplyUfh) || obj.tSupplyUfh < 20 || obj.tSupplyUfh > 80) return false
  }
  if ('tReturnUfh' in obj) {
    if (typeof obj.tReturnUfh !== 'number' || !Number.isFinite(obj.tReturnUfh) || obj.tReturnUfh < 15 || obj.tReturnUfh > 70) return false
  }

  return true
}

/**
 * Validate equipment import payload.
 * T-3-02 mitigation: rejects prototype pollution and out-of-range numeric fields.
 */
export function validateEquipmentJSON(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  // Reject prototype pollution attempts at top level
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor')) return false

  if (typeof obj.equipment !== 'object' || obj.equipment === null) return false
  if (!Array.isArray(obj.equipmentOrder)) return false
  const equipment = obj.equipment as Record<string, unknown>

  // Reject prototype pollution in equipment record keys
  for (const key of Object.keys(equipment)) {
    if (key === '__proto__' || key === 'constructor') return false
  }

  // Verify equipmentOrder entries are strings and reference existing equipment
  for (const id of obj.equipmentOrder) {
    if (typeof id !== 'string') return false
    if (!Object.prototype.hasOwnProperty.call(equipment, id)) return false
    const eq = equipment[id] as Record<string, unknown> | null
    if (!eq || typeof eq !== 'object') return false
    if (typeof eq.id !== 'string' || eq.id !== id) return false
    if (typeof eq.roomId !== 'string') return false
    if (typeof eq.kind !== 'string' || !VALID_KINDS.has(eq.kind)) return false
    if (typeof eq.connection !== 'string' || !VALID_CONNECTIONS.has(eq.connection)) return false
    if (typeof eq.installation !== 'string' || !VALID_INSTALLATIONS.has(eq.installation)) return false
    if (eq.catalogModelId !== null && typeof eq.catalogModelId !== 'string') return false
    if (eq.panelType !== null && (typeof eq.panelType !== 'string' || !VALID_PANEL_TYPES.has(eq.panelType))) return false
    if (eq.panelHeightMm !== null && (typeof eq.panelHeightMm !== 'number' || !Number.isFinite(eq.panelHeightMm) || eq.panelHeightMm <= 0)) return false
    if (eq.panelLengthMm !== null && (typeof eq.panelLengthMm !== 'number' || !Number.isFinite(eq.panelLengthMm) || eq.panelLengthMm <= 0)) return false
    if (eq.sectionsOverride !== null && (typeof eq.sectionsOverride !== 'number' || !Number.isInteger(eq.sectionsOverride) || eq.sectionsOverride < 1)) return false
    if (eq.convectorLengthMm !== null && (typeof eq.convectorLengthMm !== 'number' || !Number.isFinite(eq.convectorLengthMm) || eq.convectorLengthMm <= 0)) return false
    if (eq.manualQNominal !== null && (typeof eq.manualQNominal !== 'number' || !Number.isFinite(eq.manualQNominal) || eq.manualQNominal <= 0)) return false
    if (eq.manualNExponent !== null && (typeof eq.manualNExponent !== 'number' || !Number.isFinite(eq.manualNExponent) || eq.manualNExponent < 1.0 || eq.manualNExponent > 2.0)) return false
  }

  return true
}

/**
 * Phase 4: validate segments export.
 * T-04-05 mitigation: prototype pollution guard + typed field checks.
 */
export function validateSegmentJSON(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor')) return false

  if (typeof obj.segments !== 'object' || obj.segments === null) return false
  if (!Array.isArray(obj.segmentOrder)) return false

  const segments = obj.segments as Record<string, unknown>
  for (const key of Object.keys(segments)) {
    if (key === '__proto__' || key === 'constructor') return false
  }

  for (const [sid, segRaw] of Object.entries(segments)) {
    if (typeof segRaw !== 'object' || segRaw === null) return false
    const seg = segRaw as Record<string, unknown>
    if (typeof seg.id !== 'string' || seg.id !== sid) return false
    if (seg.parentSegmentId !== null && typeof seg.parentSegmentId !== 'string') return false
    if (typeof seg.name !== 'string') return false
    if (seg.equipmentId !== null && typeof seg.equipmentId !== 'string') return false
    if (seg.qOverride !== null && (typeof seg.qOverride !== 'number' || !Number.isFinite(seg.qOverride) || seg.qOverride < 0)) return false
    if (typeof seg.lengthM !== 'number' || !Number.isFinite(seg.lengthM) || seg.lengthM < 0) return false
    if (typeof seg.pipeId !== 'string') return false
    if (seg.dnMm !== null && (typeof seg.dnMm !== 'number' || seg.dnMm <= 0 || seg.dnMm > 500)) return false
    if (typeof seg.kmsCounts !== 'object' || seg.kmsCounts === null) return false
    if (typeof seg.velocityTargetMS !== 'number' || seg.velocityTargetMS <= 0 || seg.velocityTargetMS > 5) return false
    // Phase 04.1 fields — optional for backward-compat (absent in v1.0 snapshots pre-migration)
    if ('systemId' in seg && typeof seg.systemId !== 'string') return false
    const VALID_SEGMENT_KINDS = new Set(['trunk', 'riser', 'branch', 'connection'])
    if ('kind' in seg && (typeof seg.kind !== 'string' || !VALID_SEGMENT_KINDS.has(seg.kind as string))) return false
    if ('autoGenerated' in seg && typeof seg.autoGenerated !== 'boolean') return false
  }

  for (const id of obj.segmentOrder) {
    if (typeof id !== 'string') return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Phase 04.1 validators
// ---------------------------------------------------------------------------

const VALID_SCHEMA_TYPES_SYSTEM = new Set([
  'two-pipe-dead-end', 'two-pipe-flow-through', 'manifold', 'single-pipe'
])

/**
 * Phase 04.1: validate systems block (systems + systemOrder).
 * T-04.1-03-01 mitigation: prototype pollution guard.
 */
export function validateSystemJSON(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor')) return false

  if (typeof obj.systems !== 'object' || obj.systems === null) return false
  if (!Array.isArray(obj.systemOrder)) return false

  const systems = obj.systems as Record<string, unknown>
  for (const key of Object.keys(systems)) {
    if (key === '__proto__' || key === 'constructor') return false
  }

  for (const [id, sysRaw] of Object.entries(systems)) {
    if (typeof sysRaw !== 'object' || sysRaw === null) return false
    const sys = sysRaw as Record<string, unknown>
    if (sys.id !== id) return false
    if (typeof sys.name !== 'string' || sys.name.length === 0) return false
    if (typeof sys.schemaType !== 'string' || !VALID_SCHEMA_TYPES_SYSTEM.has(sys.schemaType as string)) return false
    if (typeof sys.pipeMaterialId !== 'string') return false
    if (typeof sys.coolantId !== 'string') return false
    for (const tempKey of ['tSupply', 'tReturn', 'tSupplyUfh', 'tReturnUfh']) {
      if (typeof sys[tempKey] !== 'number' || !Number.isFinite(sys[tempKey] as number)) return false
    }
    if (typeof sys.sourceLabel !== 'string') return false
  }

  for (const id of obj.systemOrder as unknown[]) {
    if (typeof id !== 'string') return false
    if (!Object.prototype.hasOwnProperty.call(systems, id)) return false
  }

  return true
}

const VALID_FLOOR_COVERINGS: ReadonlySet<string> = new Set(['tile', 'laminate', 'parquet', 'linoleum'])

/**
 * Phase 4: validate UFH loops export.
 * T-04-05 mitigation: prototype pollution guard + typed field checks.
 */
export function validateUfhLoopJSON(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor')) return false

  if (typeof obj.loops !== 'object' || obj.loops === null) return false
  if (typeof obj.loopsByRoom !== 'object' || obj.loopsByRoom === null) return false

  const loops = obj.loops as Record<string, unknown>
  for (const key of Object.keys(loops)) {
    if (key === '__proto__' || key === 'constructor') return false
  }

  for (const [lid, loopRaw] of Object.entries(loops)) {
    if (typeof loopRaw !== 'object' || loopRaw === null) return false
    const loop = loopRaw as Record<string, unknown>
    if (typeof loop.id !== 'string' || loop.id !== lid) return false
    if (typeof loop.roomId !== 'string') return false
    if (typeof loop.enabled !== 'boolean') return false
    if (typeof loop.activeAreaM2 !== 'number' || !Number.isFinite(loop.activeAreaM2) || loop.activeAreaM2 < 0 || loop.activeAreaM2 > 10000) return false
    if (typeof loop.covering !== 'string' || !VALID_FLOOR_COVERINGS.has(loop.covering)) return false
    if (typeof loop.pipeId !== 'string') return false
    if (typeof loop.stepCm !== 'number' || loop.stepCm < 5 || loop.stepCm > 50) return false
    if (typeof loop.leadInM !== 'number' || !Number.isFinite(loop.leadInM) || loop.leadInM < 0) return false
  }

  const loopsByRoom = obj.loopsByRoom as Record<string, unknown>
  for (const [, loopId] of Object.entries(loopsByRoom)) {
    if (typeof loopId !== 'string') return false
  }

  return true
}

/**
 * Phase 4: validate pipe catalog export (userOverrides + deletedSeedIds).
 * T-04-05 mitigation: prototype pollution guard.
 */
export function validatePipeCatalogJSON(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor')) return false

  if (typeof obj.userOverrides !== 'object' || obj.userOverrides === null) return false
  if (!Array.isArray(obj.deletedSeedIds)) return false

  const VALID_MATERIALS: ReadonlySet<string> = new Set(['steel-vgp', 'copper', 'pe-x', 'pe-rt', 'mlcp', 'ppr'])
  const overrides = obj.userOverrides as Record<string, unknown>
  for (const key of Object.keys(overrides)) {
    if (key === '__proto__' || key === 'constructor') return false
  }

  for (const [id, pipeRaw] of Object.entries(overrides)) {
    if (typeof pipeRaw !== 'object' || pipeRaw === null) return false
    const pipe = pipeRaw as Record<string, unknown>
    if (typeof pipe.id !== 'string' || pipe.id !== id) return false
    if (typeof pipe.material !== 'string' || !VALID_MATERIALS.has(pipe.material)) return false
    if (typeof pipe.dnMm !== 'number' || pipe.dnMm <= 0 || pipe.dnMm > 500) return false
    if (typeof pipe.innerDiameterMm !== 'number' || pipe.innerDiameterMm <= 0) return false
    if (typeof pipe.roughnessMm !== 'number' || pipe.roughnessMm < 0) return false
    if (typeof pipe.wallThicknessMm !== 'number' || pipe.wallThicknessMm < 0) return false
    if (pipe.maxLoopLengthM !== null && (typeof pipe.maxLoopLengthM !== 'number' || pipe.maxLoopLengthM <= 0)) return false
    if (typeof pipe.isCustom !== 'boolean') return false
  }

  for (const id of obj.deletedSeedIds) {
    if (typeof id !== 'string') return false
  }

  return true
}

/**
 * Phase 4: validate KMS catalog export (userOverrides + deletedSeedIds).
 * T-04-05 mitigation: prototype pollution guard.
 */
export function validateKmsCatalogJSON(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor')) return false

  if (typeof obj.userOverrides !== 'object' || obj.userOverrides === null) return false
  if (!Array.isArray(obj.deletedSeedIds)) return false

  const overrides = obj.userOverrides as Record<string, unknown>
  for (const key of Object.keys(overrides)) {
    if (key === '__proto__' || key === 'constructor') return false
  }

  for (const [id, itemRaw] of Object.entries(overrides)) {
    if (typeof itemRaw !== 'object' || itemRaw === null) return false
    const item = itemRaw as Record<string, unknown>
    if (typeof item.id !== 'string' || item.id !== id) return false
    if (typeof item.name !== 'string' || item.name.length === 0) return false
    if (typeof item.zeta !== 'number' || !Number.isFinite(item.zeta) || item.zeta < 0) return false
    if (typeof item.isCustom !== 'boolean') return false
  }

  for (const id of obj.deletedSeedIds) {
    if (typeof id !== 'string') return false
  }

  return true
}

/**
 * Phase 4: validate coolant catalog export (userOverrides + deletedSeedIds).
 * T-04-05 mitigation: prototype pollution guard.
 */
export function validateCoolantCatalogJSON(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor')) return false

  if (typeof obj.userOverrides !== 'object' || obj.userOverrides === null) return false
  if (!Array.isArray(obj.deletedSeedIds)) return false

  const overrides = obj.userOverrides as Record<string, unknown>
  for (const key of Object.keys(overrides)) {
    if (key === '__proto__' || key === 'constructor') return false
  }

  for (const [id, coolantRaw] of Object.entries(overrides)) {
    if (typeof coolantRaw !== 'object' || coolantRaw === null) return false
    const coolant = coolantRaw as Record<string, unknown>
    if (typeof coolant.id !== 'string' || coolant.id !== id) return false
    if (typeof coolant.name !== 'string' || coolant.name.length === 0) return false
    if (typeof coolant.rhoKgM3 !== 'number' || !Number.isFinite(coolant.rhoKgM3) || coolant.rhoKgM3 <= 0) return false
    if (typeof coolant.cKjKgK !== 'number' || !Number.isFinite(coolant.cKjKgK) || coolant.cKjKgK <= 0) return false
    if (typeof coolant.nuM2S !== 'number' || !Number.isFinite(coolant.nuM2S) || coolant.nuM2S <= 0) return false
    if (typeof coolant.isCustom !== 'boolean') return false
  }

  for (const id of obj.deletedSeedIds) {
    if (typeof id !== 'string') return false
  }

  return true
}

/**
 * Validate catalog import payload (userOverrides + deletedSeedIds).
 * T-3-02 mitigation: rejects prototype pollution and out-of-range fields per CatalogModel shape.
 */
export function validateCatalogJSON(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor')) return false

  if (typeof obj.userOverrides !== 'object' || obj.userOverrides === null) return false
  if (!Array.isArray(obj.deletedSeedIds)) return false

  const overrides = obj.userOverrides as Record<string, unknown>
  for (const key of Object.keys(overrides)) {
    if (key === '__proto__' || key === 'constructor') return false
  }

  for (const [id, modelRaw] of Object.entries(overrides)) {
    if (typeof modelRaw !== 'object' || modelRaw === null) return false
    const m = modelRaw as Record<string, unknown>
    if (typeof m.id !== 'string' || m.id !== id) return false
    if (typeof m.manufacturer !== 'string') return false
    if (typeof m.series !== 'string') return false
    if (typeof m.kind !== 'string' || !VALID_KINDS.has(m.kind)) return false
    if (typeof m.nExponent !== 'number' || !Number.isFinite(m.nExponent) || m.nExponent < 1.0 || m.nExponent > 2.0) return false
    if (typeof m.isCustom !== 'boolean') return false

    if (m.kind === 'panel') {
      if (typeof m.panelType !== 'string' || !VALID_PANEL_TYPES.has(m.panelType)) return false
      if (!Array.isArray(m.variants)) return false
      for (const v of m.variants) {
        if (typeof v !== 'object' || v === null) return false
        const vv = v as Record<string, unknown>
        if (typeof vv.heightMm !== 'number' || vv.heightMm <= 0) return false
        if (typeof vv.lengthMm !== 'number' || vv.lengthMm <= 0) return false
        if (typeof vv.qAt70 !== 'number' || vv.qAt70 <= 0) return false
      }
    } else if (m.kind === 'underfloor-convector') {
      if (typeof m.widthMm !== 'number' || m.widthMm <= 0) return false
      if (typeof m.depthMm !== 'number' || m.depthMm <= 0) return false
      if (!Array.isArray(m.variants)) return false
      for (const v of m.variants) {
        if (typeof v !== 'object' || v === null) return false
        const vv = v as Record<string, unknown>
        if (typeof vv.lengthMm !== 'number' || vv.lengthMm <= 0) return false
        if (typeof vv.qAt70 !== 'number' || vv.qAt70 <= 0) return false
      }
    } else {
      // sectional: bimetal | aluminum | cast-iron
      if (typeof m.qPerSectionAt70 !== 'number' || m.qPerSectionAt70 <= 0) return false
      if (typeof m.heightMm !== 'number' || m.heightMm <= 0) return false
      if (typeof m.sectionWidthMm !== 'number' || m.sectionWidthMm <= 0) return false
      if (typeof m.maxSections !== 'number' || !Number.isInteger(m.maxSections) || m.maxSections < 1 || m.maxSections > 30) return false
    }
  }

  for (const id of obj.deletedSeedIds) {
    if (typeof id !== 'string') return false
  }
  return true
}
