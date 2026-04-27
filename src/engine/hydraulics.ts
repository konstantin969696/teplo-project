/** Hydraulic calculations per СП 60.13330.2020. Pure TS — safe for Web Worker. */

import { reynolds } from './reynolds'
import { frictionFactor, pressureLossLinear, pressureLossLocal } from './darcyWeisbach'
import type { Segment, SegmentNode, PipeSpec, KmsItem, CoolantSpec, PumpRecommendation, BranchImbalance, KmsCounts } from '../types/hydraulics'

const G_GRAVITY = 9.81
const DEFAULT_PUMP_SAFETY = 1.10  // инженерный запас 10% per CONTEXT.md Assumptions

/** HYDR-05: G [кг/ч] = Q [Вт] · 3.6 / (c [кДж/кг·К] · Δt [К]). */
export function calculateFlowRate(qWatts: number, cKjKgK: number, deltaTK: number): number {
  if (!Number.isFinite(qWatts) || !Number.isFinite(cKjKgK) || !Number.isFinite(deltaTK)) return 0
  if (cKjKgK <= 0 || deltaTK <= 0 || qWatts <= 0) return 0
  return (qWatts * 3.6) / (cKjKgK * deltaTK)
}

/**
 * Скорость теплоносителя: v = G / (ρ · π·d²/4 · 3600).
 * G в кг/ч, ρ в кг/м³, d в м → результат в м/с.
 */
export function calculateVelocity(flowKgH: number, rhoKgM3: number, diameterM: number): number {
  if (flowKgH <= 0 || rhoKgM3 <= 0 || diameterM <= 0) return 0
  const area = Math.PI * diameterM * diameterM / 4
  return flowKgH / (rhoKgM3 * area * 3600)
}

/**
 * HYDR-06: d_расч = sqrt(4·V/(π·v_target)); выбираем ближайший сверху из каталога.
 * При пустом каталоге возвращает null.
 */
export function selectDiameter(
  flowKgH: number,
  velocityTargetMS: number,
  coolant: CoolantSpec,
  pipeCatalog: readonly PipeSpec[]
): PipeSpec | null {
  if (pipeCatalog.length === 0) return null
  if (flowKgH <= 0 || velocityTargetMS <= 0 || coolant.rhoKgM3 <= 0) {
    return pipeCatalog[0] ?? null
  }
  const volumetricFlowM3S = flowKgH / (coolant.rhoKgM3 * 3600)
  const dCalcM = Math.sqrt(4 * volumetricFlowM3S / (Math.PI * velocityTargetMS))
  const dCalcMm = dCalcM * 1000
  const sorted = [...pipeCatalog].sort((a, b) => a.innerDiameterMm - b.innerDiameterMm)
  for (const pipe of sorted) {
    if (pipe.innerDiameterMm >= dCalcMm) return pipe
  }
  return sorted[sorted.length - 1] ?? null  // fallback: самый большой
}


/** Результат расчёта одного участка системы. */
export interface SegmentCalcResult {
  readonly qWatts: number
  readonly flowKgH: number
  readonly selectedPipe: PipeSpec | null
  readonly velocityMS: number
  readonly re: number
  readonly lambda: number
  readonly rPaPerM: number         // линейные потери на метр, Па/м
  readonly deltaPLinearPa: number
  readonly sumZeta: number
  readonly deltaPLocalPa: number
  readonly deltaPTotalPa: number
}

/** Суммарный Σζ из kmsCounts + kmsCatalog. */
function sumKmsZeta(kmsCounts: KmsCounts, kmsCatalog: readonly KmsItem[]): number {
  const kmsById = new Map(kmsCatalog.map(k => [k.id, k]))
  let sum = 0
  for (const [kmsId, count] of Object.entries(kmsCounts)) {
    const item = kmsById.get(kmsId)
    if (item && count > 0) sum += item.zeta * count
  }
  return sum
}

/**
 * Полный расчёт одного участка трубопровода.
 * Использует calculateFlowRate, selectDiameter, calculateVelocity, reynolds, frictionFactor, pressureLossLinear, pressureLossLocal.
 */
export function calculateSegment(
  segment: Segment,
  qWatts: number,
  coolant: CoolantSpec,
  deltaTK: number,
  pipeCatalog: readonly PipeSpec[],
  kmsCatalog: readonly KmsItem[]
): SegmentCalcResult {
  const flowKgH = calculateFlowRate(qWatts, coolant.cKjKgK, deltaTK)
  const selectedPipe = selectDiameter(flowKgH, segment.velocityTargetMS, coolant, pipeCatalog)
  const dInnerM = selectedPipe ? selectedPipe.innerDiameterMm / 1000 : 0
  const velocityMS = dInnerM > 0 ? calculateVelocity(flowKgH, coolant.rhoKgM3, dInnerM) : 0
  const re = dInnerM > 0 ? reynolds(velocityMS, dInnerM, coolant.nuM2S) : 0
  const roughnessMm = selectedPipe ? selectedPipe.roughnessMm : 0
  const dMm = selectedPipe ? selectedPipe.innerDiameterMm : 0
  const lambda = frictionFactor(re, roughnessMm, dMm)
  const deltaPLinearPa = pressureLossLinear(lambda, segment.lengthM, dInnerM, coolant.rhoKgM3, velocityMS)
  const rPaPerM = dInnerM > 0 && segment.lengthM > 0 ? deltaPLinearPa / segment.lengthM : 0
  const sumZeta = sumKmsZeta(segment.kmsCounts, kmsCatalog)
  const deltaPLocalPa = pressureLossLocal(sumZeta, coolant.rhoKgM3, velocityMS)
  const deltaPTotalPa = deltaPLinearPa + deltaPLocalPa
  return {
    qWatts,
    flowKgH,
    selectedPipe,
    velocityMS,
    re,
    lambda,
    rPaPerM,
    deltaPLinearPa,
    sumZeta,
    deltaPLocalPa,
    deltaPTotalPa,
  }
}

/**
 * HYDR-09: ГЦК — путь от источника до конечного участка с максимальной ΣΔP.
 * DFS по дереву узлов. Защита от циклов: visited set.
 */
export function findMainCircuit(nodes: readonly SegmentNode[]): readonly string[] {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const sources = nodes.filter(n => n.parentId === null)
  if (sources.length === 0) return []

  let bestSum = -Infinity
  let bestPath: readonly string[] = []

  function dfs(nodeId: string, path: readonly string[], sum: number, visited: Set<string>): void {
    if (visited.has(nodeId)) return  // защита от циклов в malformed data
    const node = byId.get(nodeId)
    if (!node) return
    const newVisited = new Set(visited)
    newVisited.add(nodeId)
    const newPath = [...path, nodeId]
    const newSum = sum + node.deltaP
    if (node.children.length === 0) {
      if (newSum > bestSum) {
        bestSum = newSum
        bestPath = newPath
      }
      return
    }
    for (const childId of node.children) {
      dfs(childId, newPath, newSum, newVisited)
    }
  }

  for (const src of sources) dfs(src.id, [], 0, new Set())
  return bestPath
}

/**
 * HYDR-10: H = ΔP_ГЦК / (ρ·g) · safetyFactor.
 * @param deltaPGckPa - суммарное давление ГЦК, Па
 * @param rhoKgM3 - плотность теплоносителя, кг/м³
 * @param totalFlowKgH - суммарный расход через насос, кг/ч
 * @param safetyFactor - запас (дефолт 1.10)
 */
export function recommendPump(
  deltaPGckPa: number,
  rhoKgM3: number,
  totalFlowKgH: number,
  safetyFactor: number = DEFAULT_PUMP_SAFETY
): PumpRecommendation {
  if (rhoKgM3 <= 0) return { flowM3H: 0, headM: 0, deltaPGckPa }
  const headM = (deltaPGckPa / (rhoKgM3 * G_GRAVITY)) * safetyFactor
  const flowM3H = totalFlowKgH / rhoKgM3
  return { flowM3H, headM, deltaPGckPa }
}

/**
 * HYDR-11: для параллельных ветвей — невязка и Kvs балансировочника.
 * Kvs [м³/ч] = G [м³/ч] / sqrt(ΔP_дросселируемый [бар]).
 */
export function calculateBranchImbalance(
  branches: ReadonlyArray<{ branchId: string; deltaPPa: number; flowKgH: number }>,
  mainDeltaPPa: number,
  rhoKgM3: number
): readonly BranchImbalance[] {
  return branches.map(b => {
    const imbalancePct = mainDeltaPPa > 0 ? ((mainDeltaPPa - b.deltaPPa) / mainDeltaPPa) * 100 : 0
    const flowM3H = rhoKgM3 > 0 ? b.flowKgH / rhoKgM3 : 0
    const diffPa = Math.max(0, mainDeltaPPa - b.deltaPPa)
    const diffBar = diffPa / 100000
    const requiredKvs = diffBar > 1e-6 ? flowM3H / Math.sqrt(diffBar) : 0
    return { branchId: b.branchId, deltaPPa: b.deltaPPa, imbalancePct, requiredKvs }
  })
}

// ---------------------------------------------------------------------------
// Phase 04.1: per-system extensions (D-07/D-28)
// ---------------------------------------------------------------------------

const DERIVED_Q_MAX_DEPTH = 20

/**
 * D-28: filter segments to a single system.
 * Returns a new record containing only segments where systemId matches.
 */
export function filterSegmentsBySystem(
  segments: Readonly<Record<string, Segment>>,
  systemId: string
): Readonly<Record<string, Segment>> {
  const out: Record<string, Segment> = {}
  for (const [id, s] of Object.entries(segments)) {
    if (s.systemId === systemId) out[id] = s
  }
  return out
}

/**
 * Builds parent → children map for segments of a single system.
 * O(n) construction; pass the result to derivedQ to avoid O(n²) per-call scans.
 */
export function buildChildrenMap(
  segments: Readonly<Record<string, Segment>>,
  systemId: string
): Map<string, Segment[]> {
  const map = new Map<string, Segment[]>()
  for (const seg of Object.values(segments)) {
    if (seg.systemId !== systemId) continue
    const pid = seg.parentSegmentId
    if (pid === null) continue
    if (!map.has(pid)) map.set(pid, [])
    map.get(pid)!.push(seg)
  }
  return map
}

/**
 * D-07/D-28: Q-cascade — recursively compute heat load for a segment.
 * Priority: qOverride → equipmentId → Σ children.
 *
 * Threat mitigations:
 * - T-04.1-03-02: visited Set prevents infinite cycle loops
 * - B2 revision: depth counter → MAX_DEPTH=20 terminates pathological chains
 *
 * @param segmentId   - starting segment
 * @param segments    - all segments (lookup by id)
 * @param equipmentQ  - map of equipmentId → Q in Watts
 * @param childrenMap - pre-built parent→children map from buildChildrenMap (O(1) lookup)
 * @param visited     - cycle guard (internal, pass new Set() externally)
 * @param depth       - current recursion depth (internal, start at 0)
 */
export function derivedQ(
  segmentId: string,
  segments: Readonly<Record<string, Segment>>,
  equipmentQ: Readonly<Record<string, number>>,
  childrenMap: Map<string, Segment[]>,
  visited: Set<string> = new Set(),
  depth: number = 0
): number {
  if (depth > DERIVED_Q_MAX_DEPTH) return 0
  if (visited.has(segmentId)) return 0
  visited.add(segmentId)

  const seg = segments[segmentId]
  if (!seg) return 0

  if (seg.qOverride != null) return seg.qOverride
  if (seg.equipmentId) return equipmentQ[seg.equipmentId] ?? 0

  const children = childrenMap.get(segmentId) ?? []
  return children.reduce(
    (acc, child) => acc + derivedQ(child.id, segments, equipmentQ, childrenMap, visited, depth + 1),
    0
  )
}

/** Строка аудита для расчёта расхода. */
export function buildFlowAuditString(q: number, c: number, dt: number, g: number): string {
  return [
    'G = Q·3.6/(c·Δt)',
    `  = ${q.toFixed(0)}·3.6/(${c.toFixed(2)}·${dt.toFixed(1)})`,
    `  = ${g.toFixed(1)} кг/ч`,
  ].join('\n')
}
