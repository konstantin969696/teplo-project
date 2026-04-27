/**
 * Pure heat loss calculation functions per SP 50.13330.2012.
 * Zero React imports -- safe for Web Worker usage in Phase 6.
 */

import type { Enclosure, EnclosureType, FloorZoneResult, Orientation, Room, RoomHeatLossResult } from '../types/project'
import { calculatePoolEvaporationHeat } from './poolEvaporation'

/** Orientation addition factors per SP 50.13330.2012. */
export const ORIENTATION_ADDITIONS: Record<Orientation, number> = {
  'С': 0.10, 'СВ': 0.10, 'СЗ': 0.10,
  'В': 0.05, 'ЮВ': 0.05,
  'Ю': 0.00, 'ЮЗ': 0.00, 'З': 0.00,
}

/** Default n (reduction) coefficients by enclosure type. */
export const DEFAULT_N_COEFF: Record<EnclosureType, number> = {
  'wall-ext': 1.0,
  'window': 1.0,
  'door-ext': 1.0,
  'ceiling': 1.0,
  'roof': 1.0,
  'floor-ground': 1.0,
  'wall-int': 0.5,
  'ceiling-int': 0.4,
}

/** Default zone R values per SP 50 Appendix E (m2*C/W). */
export const DEFAULT_ZONE_R = [2.1, 4.3, 8.6, 14.2] as const

/** Enclosure type configuration for UI and calculations. */
export const ENCLOSURE_TYPE_CONFIG: Record<EnclosureType, {
  label: string
  isExternal: boolean
  defaultN: number
  colorVar: string
}> = {
  'wall-ext':     { label: 'Наружная стена',        isExternal: true,  defaultN: 1.0, colorVar: '--enc-wall' },
  'window':       { label: 'Окно',                  isExternal: true,  defaultN: 1.0, colorVar: '--enc-window' },
  'door-ext':     { label: 'Дверь',                 isExternal: true,  defaultN: 1.0, colorVar: '--enc-door' },
  'ceiling':      { label: 'Перекрытие',            isExternal: true,  defaultN: 1.0, colorVar: '--enc-ceiling' },
  'roof':         { label: 'Покрытие (кровля)',      isExternal: true,  defaultN: 1.0, colorVar: '--enc-roof' },
  'floor-ground': { label: 'Пол по грунту',         isExternal: true,  defaultN: 1.0, colorVar: '--enc-floor-ground' },
  'wall-int':     { label: 'Внутренняя стена',      isExternal: false, defaultN: 0.5, colorVar: '--enc-wall-int' },
  'ceiling-int':  { label: 'Внутреннее перекрытие',  isExternal: false, defaultN: 0.4, colorVar: '--enc-ceil-int' },
}

/** Calculate basic heat loss: Q = K * A * deltaT * n * (1 + beta_or + beta_corner). */
export function calculateQBasic(
  kValue: number,
  area: number,
  deltaT: number,
  nCoeff: number,
  orientation: Orientation | null,
  isCorner: boolean
): number {
  const betaOr = orientation ? ORIENTATION_ADDITIONS[orientation] : 0
  const betaCorner = isCorner ? 0.05 : 0
  return kValue * area * deltaT * nCoeff * (1 + betaOr + betaCorner)
}

/** Estimate room perimeter from area assuming square room: P = 4 * sqrt(A). */
export function estimatePerimeter(area: number): number {
  return 4 * Math.sqrt(area)
}

/** Calculate floor heat loss by zones per SP 50 Appendix E. */
export function calculateFloorZones(
  roomArea: number,
  roomPerimeter: number,
  zoneR: readonly [number, number, number, number],
  deltaT: number
): FloorZoneResult[] {
  // T-02-02 mitigation: clamp inputs to prevent NaN/Infinity
  const safeArea = Math.max(0, Number.isFinite(roomArea) ? roomArea : 0)
  const safePerimeter = Math.max(0, Number.isFinite(roomPerimeter) ? roomPerimeter : 0)

  const zoneWidths = [2, 2, 2, Infinity]
  const results: FloorZoneResult[] = []
  let remainingArea = safeArea

  for (let i = 0; i < 4; i++) {
    if (remainingArea <= 0) break

    const zoneArea = i < 3
      ? Math.min(safePerimeter * zoneWidths[i]!, remainingArea)
      : remainingArea

    const rValue = zoneR[i]!
    const q = zoneArea > 0 ? (zoneArea / rValue) * deltaT : 0

    results.push({
      zoneIndex: i as 0 | 1 | 2 | 3,
      width: i < 3 ? 2 : 0,
      area: zoneArea,
      rValue,
      qWatts: q,
    })

    remainingArea = Math.max(0, remainingArea - zoneArea)
  }

  return results
}

/** Calculate infiltration heat loss by air change rate: Q = 0.337 * V * n * deltaT. */
export function calculateQInfiltrationByRate(
  area: number,
  height: number,
  nInf: number,
  deltaT: number
): number {
  return 0.337 * area * height * nInf * deltaT
}

/** Calculate infiltration heat loss by gap area: Q = 0.337 * gapArea * windSpeed * deltaT. */
export function calculateQInfiltrationByGap(
  gapArea: number,
  windSpeed: number,
  deltaT: number
): number {
  return 0.337 * gapArea * windSpeed * deltaT
}

/** Calculate ventilation heat loss: Q = 0.337 * L_vent * deltaT. */
export function calculateQVentilation(lVent: number, deltaT: number): number {
  return 0.337 * lVent * deltaT
}

const WALL_TYPES = new Set<Enclosure['type']>(['wall-ext', 'wall-int'])

/**
 * Compute children-area map: for each potential parent id → sum of child areas.
 * Child `area` is the gross area the child occupies inside the parent.
 */
function buildChildrenAreaMap(enclosures: readonly Enclosure[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of enclosures) {
    if (e.parentEnclosureId) {
      map.set(e.parentEnclosureId, (map.get(e.parentEnclosureId) ?? 0) + e.area)
    }
  }
  return map
}

/**
 * Effective area for Q calculation: net for walls (gross − children), gross for everything else.
 * Net is clamped to ≥ 0 so mis-input doesn't produce negative heat loss.
 */
export function effectiveEnclosureArea(
  enc: Enclosure,
  childrenAreaByParent: Map<string, number>
): number {
  if (!WALL_TYPES.has(enc.type)) return enc.area
  const childrenArea = childrenAreaByParent.get(enc.id) ?? 0
  return Math.max(0, enc.area - childrenArea)
}

/** Calculate total heat loss for a room from all its enclosures. */
export function calculateRoomTotals(
  enclosures: readonly Enclosure[],
  room: Room,
  deltaT: number
): RoomHeatLossResult {
  let qBasic = 0
  const childrenAreaMap = buildChildrenAreaMap(enclosures)

  for (const enc of enclosures) {
    if (enc.type === 'floor-ground') {
      // Fallback to room.area when enclosure area is 0 — keeps engine aggregation
      // in sync with FloorZonesBlock which already uses roomArea for zone calc.
      const floorArea = enc.area > 0 ? enc.area : room.area
      const perimeter = enc.perimeterOverride ?? estimatePerimeter(floorArea)
      const zones = calculateFloorZones(floorArea, perimeter, enc.zoneR, deltaT)
      qBasic += zones.reduce((sum, z) => sum + z.qWatts, 0)
    } else {
      const area = effectiveEnclosureArea(enc, childrenAreaMap)
      qBasic += calculateQBasic(
        enc.kValue, area, deltaT, enc.nCoeff,
        enc.orientation, room.isCorner
      )
    }
  }

  const qInfiltration = room.infiltrationMethod === 'gap'
    ? calculateQInfiltrationByGap(room.gapArea ?? 0, room.windSpeed ?? 0, deltaT)
    : calculateQInfiltrationByRate(room.area, room.height, room.nInfiltration ?? 0, deltaT)

  const qVentilation = calculateQVentilation(room.lVentilation, deltaT)
  const qEvaporation = calculatePoolEvaporationHeat(room.poolParams, room.tInside)
  const qTotal = qBasic + qInfiltration + qVentilation + qEvaporation
  const qSpecific = room.area > 0 ? qTotal / room.area : 0

  return {
    roomId: room.id,
    roomName: room.name,
    floor: room.floor,
    area: room.area,
    qBasic,
    qInfiltration,
    qVentilation,
    qEvaporation,
    qTotal,
    qSpecific,
  }
}

/** Build audit string for a single enclosure calculation. */
export function buildEnclosureAuditString(
  enc: Enclosure,
  deltaT: number,
  isCorner: boolean,
  q: number,
  netArea?: number
): string {
  const betaOr = enc.orientation ? ORIENTATION_ADDITIONS[enc.orientation] : 0
  const betaCorner = isCorner ? 0.05 : 0
  const areaLabel = netArea !== undefined && netArea !== enc.area
    ? `${netArea.toFixed(2)} (брутто ${enc.area} − дети ${(enc.area - netArea).toFixed(2)})`
    : String(enc.area)
  const areaForFormula = netArea ?? enc.area
  return [
    'Q = K * A * deltaT * n * (1 + beta_or + beta_corner)',
    `  = ${enc.kValue} * ${areaLabel} * ${deltaT} * ${enc.nCoeff} * (1 + ${betaOr.toFixed(2)} + ${betaCorner.toFixed(2)})`,
    `  = ${enc.kValue} * ${areaForFormula} * ${deltaT} * ${enc.nCoeff} * ${(1 + betaOr + betaCorner).toFixed(2)}`,
    `  = ${q.toFixed(1)} Вт`,
  ].join('\n')
}

/** Build audit string for floor zone decomposition. */
export function buildFloorZoneAuditString(
  zones: readonly FloorZoneResult[],
  deltaT: number
): string {
  const lines = zones.map(z =>
    `  Зона ${z.zoneIndex + 1}: F=${z.area.toFixed(1)} м2, R=${z.rValue}, Q=${z.qWatts.toFixed(1)} Вт`
  )
  const totalQ = zones.reduce((s, z) => s + z.qWatts, 0)
  return [
    `Q_пол = sum(F_i / R_i) * deltaT (deltaT=${deltaT})`,
    ...lines,
    `  Итого Q_пол = ${totalQ.toFixed(1)} Вт`,
  ].join('\n')
}

/** Build audit string for room totals breakdown. */
export function buildRoomAuditString(
  qBasic: number,
  qInf: number,
  qVent: number,
  qEvap: number,
  qTotal: number
): string {
  return [
    'Q_итого = Q_осн + Q_инф + Q_вент + Q_исп',
    `  = ${qBasic.toFixed(1)} + ${qInf.toFixed(1)} + ${qVent.toFixed(1)} + ${qEvap.toFixed(1)}`,
    `  = ${qTotal.toFixed(1)} Вт`,
  ].join('\n')
}
