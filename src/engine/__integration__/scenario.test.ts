/**
 * Phase 4 integration: canonical 3-room scenario.
 * Pure engine tests — no React, no stores.
 * Verifies hydraulics + UFH engine functions produce expected results.
 */

import { describe, it, expect } from 'vitest'
import { calculateFlowRate, calculateSegment, calculateSegmentQ, findMainCircuit, recommendPump } from '../hydraulics'
import { calculateHeatFlux, calculateFloorTemp, calculateLoopLength, calculateLoopCount } from '../ufh'
import type { Segment, PipeSpec, KmsItem, CoolantSpec, SegmentNode, FloorCovering } from '../../types/hydraulics'

describe('Phase 4 integration: canonical 3-room scenario', () => {
  const coolant: CoolantSpec = {
    id: 'water', name: 'Вода', rhoKgM3: 988, cKjKgK: 4.181, nuM2S: 5.53e-7, isCustom: false
  }

  const pipeDN20: PipeSpec = {
    id: 'steel-vgp-dn20', material: 'steel-vgp', dnMm: 20, innerDiameterMm: 20.9,
    roughnessMm: 0.2, wallThicknessMm: 2.95, maxLoopLengthM: null, isCustom: false
  }

  const kmsCatalog: KmsItem[] = [
    { id: 'elbow', name: 'Колено 90°', zeta: 1.1, isCustom: false },
    { id: 'tee', name: 'Тройник проход', zeta: 0.5, isCustom: false },
  ]

  it('hydraulics: 3 segments, finds main circuit, recommends pump', () => {
    const segments: Record<string, Segment> = {
      's1': {
        id: 's1', parentSegmentId: null, name: 'Магистраль', equipmentId: null, qOverride: null,
        lengthM: 10, pipeId: 'steel-vgp-dn20', dnMm: null, kmsCounts: { elbow: 2 }, velocityTargetMS: 0.6
      },
      's2': {
        id: 's2', parentSegmentId: 's1', name: 'К гостиной', equipmentId: 'eq1', qOverride: null,
        lengthM: 6, pipeId: 'steel-vgp-dn20', dnMm: null, kmsCounts: { tee: 1 }, velocityTargetMS: 0.3
      },
      's3': {
        id: 's3', parentSegmentId: 's1', name: 'К кухне', equipmentId: 'eq2', qOverride: null,
        lengthM: 4, pipeId: 'steel-vgp-dn20', dnMm: null, kmsCounts: { tee: 1 }, velocityTargetMS: 0.3
      },
    }
    const equipmentQMap: Record<string, number> = { eq1: 2400, eq2: 1300 }
    const deltaTK = 20  // 80/60 system

    // Calculate Q for each segment
    const qS1 = calculateSegmentQ('s1', segments, equipmentQMap)
    const qS2 = calculateSegmentQ('s2', segments, equipmentQMap)
    const qS3 = calculateSegmentQ('s3', segments, equipmentQMap)

    expect(qS2).toBe(2400)
    expect(qS3).toBe(1300)
    expect(qS1).toBe(3700)  // sum of children

    const results: Record<string, ReturnType<typeof calculateSegment>> = {
      s1: calculateSegment(segments.s1, qS1, coolant, deltaTK, [pipeDN20], kmsCatalog),
      s2: calculateSegment(segments.s2, qS2, coolant, deltaTK, [pipeDN20], kmsCatalog),
      s3: calculateSegment(segments.s3, qS3, coolant, deltaTK, [pipeDN20], kmsCatalog),
    }

    // All segments have Q as expected
    expect(results.s1.qWatts).toBe(3700)
    expect(results.s2.qWatts).toBe(2400)
    expect(results.s3.qWatts).toBe(1300)

    // All pressure drops > 0
    expect(results.s1.deltaPTotalPa).toBeGreaterThan(0)
    expect(results.s2.deltaPTotalPa).toBeGreaterThan(0)
    expect(results.s3.deltaPTotalPa).toBeGreaterThan(0)

    // Flow rates > 0
    expect(results.s1.flowKgH).toBeGreaterThan(0)
    expect(results.s2.flowKgH).toBeGreaterThan(0)

    // Build SegmentNode graph for GCK
    const children: Record<string, string[]> = { s1: [], s2: [], s3: [] }
    for (const [id, seg] of Object.entries(segments)) {
      if (seg.parentSegmentId) children[seg.parentSegmentId]?.push(id)
    }
    const nodes: SegmentNode[] = Object.entries(segments).map(([id, seg]) => ({
      id,
      parentId: seg.parentSegmentId,
      children: children[id] ?? [],
      deltaP: results[id].deltaPTotalPa
    }))

    const gckPath = findMainCircuit(nodes)
    expect(gckPath.length).toBeGreaterThan(0)
    expect(gckPath[0]).toBe('s1')  // always starts at root
    // GCK ends at the branch with higher ΔP
    expect(gckPath.length).toBe(2)  // s1 → either s2 or s3

    // Pump recommendation
    const totalFlow = results.s1.flowKgH
    const deltaPGck = gckPath.reduce((sum, id) => sum + results[id].deltaPTotalPa, 0)
    const pump = recommendPump(deltaPGck, coolant.rhoKgM3, totalFlow)
    expect(pump.headM).toBeGreaterThan(0)
    expect(pump.flowM3H).toBeGreaterThan(0)
    expect(pump.deltaPGckPa).toBe(deltaPGck)
  })

  it('ufh: bathroom loop tS=45/tR=35 gives q≈241 W/m², t_пол>33°C (UFH-04 threshold)', () => {
    const q = calculateHeatFlux(45, 35, 20, 'tile' as FloorCovering)

    // EN 1264: q = 8.92 * (t_ср − t_вн)^1.1 * k_покр
    // t_ср = (45+35)/2 = 40°C, Δt = 40 - 20 = 20°C
    // q = 8.92 * 20^1.1 = 8.92 * 26.98 ≈ 240.7 Вт/м²
    expect(q).toBeCloseTo(240.7, 0)

    const F = 3.2  // м² (bathroom)
    const qTotal = q * F
    // 240.7 * 3.2 ≈ 770W
    expect(qTotal).toBeGreaterThan(700)   // > 700W
    expect(qTotal).toBeLessThan(850)      // < 850W

    // Floor temperature check (UFH-04 threshold: 33°C for bathrooms)
    const tFloor = calculateFloorTemp(q, 20)
    expect(tFloor).toBeGreaterThan(33)    // triggers warning in bathroom
    expect(tFloor).toBeLessThan(50)       // sanity upper bound

    // Loop length calculation
    const L = calculateLoopLength(F, 15, 3)
    // L = 3.2 * 100 / 15 + 2*3 = 21.33 + 6 = 27.33 м
    expect(L).toBeCloseTo(27.3, 0)

    // Number of loops (max 90m per PE-X 16)
    const N = calculateLoopCount(L, 90)
    expect(N).toBe(1)  // 27.3 < 90 → fits in one loop
  })

  it('ufh: Q-cascade clamp — Q_тп >= Q_пом means 0 for radiator', () => {
    // Small room: Q_пом ≈ 500W
    // Large UFH area: 10m² → Q_тп ≈ 2137W
    const q = calculateHeatFlux(45, 35, 20, 'tile' as FloorCovering)
    const qUfh = q * 10
    const qRoom = 500

    // D-06: остаток = max(0, Q_пом - Q_тп)
    const qRadiator = Math.max(0, qRoom - qUfh)
    expect(qRadiator).toBe(0)
    expect(qUfh).toBeGreaterThan(qRoom)
  })

  it('flow rate: calculateFlowRate matches G = Q*3.6/(c*dt)', () => {
    const G = calculateFlowRate(2400, 4.181, 20)
    // G = 2400 * 3.6 / (4.181 * 20) = 8640 / 83.62 ≈ 103.3 кг/ч
    expect(G).toBeCloseTo(103.3, 0)
  })
})
