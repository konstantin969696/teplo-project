import { describe, it, expect } from 'vitest'
import {
  calculateFlowRate,
  calculateVelocity,
  selectDiameter,
  findMainCircuit,
  recommendPump,
  calculateBranchImbalance,
  buildFlowAuditString,
} from './hydraulics'
import type { Segment, SegmentNode, PipeSpec, CoolantSpec } from '../types/hydraulics'

// Вспомогательный теплоноситель (вода при 50°C)
const WATER: CoolantSpec = {
  id: 'water',
  name: 'Вода',
  rhoKgM3: 988,
  cKjKgK: 4.18,
  nuM2S: 5.53e-7,
  isCustom: false,
}

// Каталог труб для тестов
const PIPE_DN15: PipeSpec = {
  id: 'dn15',
  material: 'steel-vgp',
  dnMm: 15,
  innerDiameterMm: 15.75,
  roughnessMm: 0.2,
  wallThicknessMm: 2.8,
  maxLoopLengthM: null,
  isCustom: false,
}

const PIPE_DN20: PipeSpec = {
  id: 'dn20',
  material: 'steel-vgp',
  dnMm: 20,
  innerDiameterMm: 21.25,
  roughnessMm: 0.2,
  wallThicknessMm: 2.8,
  maxLoopLengthM: null,
  isCustom: false,
}

const PIPE_DN25: PipeSpec = {
  id: 'dn25',
  material: 'steel-vgp',
  dnMm: 25,
  innerDiameterMm: 27.0,
  roughnessMm: 0.2,
  wallThicknessMm: 3.5,
  maxLoopLengthM: null,
  isCustom: false,
}

const PIPE_CATALOG = [PIPE_DN15, PIPE_DN20, PIPE_DN25] as const

describe('calculateFlowRate', () => {
  it('reference value: G ≈ 122 кг/ч для Q=3540, c=4.18, Δt=25', () => {
    // G = 3540·3.6/(4.18·25) = 12744/104.5 ≈ 122.0 кг/ч
    const g = calculateFlowRate(3540, 4.18, 25)
    expect(g).toBeCloseTo(122.0, 0)
  })

  it('guard: Q=0 → 0', () => {
    expect(calculateFlowRate(0, 4.18, 25)).toBe(0)
  })

  it('guard: c=0 → 0', () => {
    expect(calculateFlowRate(3540, 0, 25)).toBe(0)
  })

  it('guard: Δt=0 → 0', () => {
    expect(calculateFlowRate(3540, 4.18, 0)).toBe(0)
  })

  it('guard: NaN → 0', () => {
    expect(calculateFlowRate(NaN, 4.18, 25)).toBe(0)
  })
})

describe('calculateVelocity', () => {
  it('вычисляет скорость для G=122 кг/ч, d=0.02 м, ρ=988 кг/м³', () => {
    // v = 122 / (988 · π·0.02²/4 · 3600) = 122 / (988 · 3.14159e-4 · 3600) ≈ 0.109 м/с
    const v = calculateVelocity(122, 988, 0.02)
    expect(v).toBeGreaterThan(0)
    expect(v).toBeLessThan(1)
  })

  it('guard: flowKgH=0 → 0', () => {
    expect(calculateVelocity(0, 988, 0.02)).toBe(0)
  })

  it('guard: diameterM=0 → 0', () => {
    expect(calculateVelocity(122, 988, 0)).toBe(0)
  })
})

describe('selectDiameter', () => {
  it('выбирает ближайший сверху от расчётного диаметра', () => {
    // Большой расход → DN25
    const result = selectDiameter(500, 0.6, WATER, PIPE_CATALOG)
    expect(result).not.toBeNull()
    expect(result!.dnMm).toBeGreaterThanOrEqual(20)
  })

  it('малый расход → DN15', () => {
    const result = selectDiameter(20, 0.6, WATER, PIPE_CATALOG)
    expect(result).not.toBeNull()
    expect(result!.dnMm).toBe(15)
  })

  it('пустой каталог → null', () => {
    const result = selectDiameter(122, 0.6, WATER, [])
    expect(result).toBeNull()
  })

  it('flowKgH=0 → возвращает первый из каталога', () => {
    const result = selectDiameter(0, 0.6, WATER, PIPE_CATALOG)
    expect(result).not.toBeNull()
  })
})

// Вспомогательная функция создания сегмента
function makeSegment(id: string, parentId: string | null, options: Partial<Segment> = {}): Segment {
  return {
    id,
    parentSegmentId: parentId,
    name: `Сегмент ${id}`,
    equipmentId: null,
    qOverride: null,
    lengthM: 5,
    pipeId: 'dn20',
    dnMm: null,
    kmsCounts: {},
    velocityTargetMS: 0.6,
    ...options,
  }
}


describe('findMainCircuit', () => {
  it('возвращает [] для пустого дерева', () => {
    expect(findMainCircuit([])).toEqual([])
  })

  it('возвращает [] если нет источника', () => {
    // Все узлы имеют parent (никто не является root)
    const nodes: SegmentNode[] = [
      { id: 'A', parentId: 'B', children: [], deltaP: 100 },
    ]
    expect(findMainCircuit(nodes)).toEqual([])
  })

  it('выбирает путь с максимальной ΣΔP на дереве из 4 узлов', () => {
    // A→B→D: ΔP = 100+200+80 = 380
    // A→C:   ΔP = 100+150 = 250
    const nodes: SegmentNode[] = [
      { id: 'A', parentId: null, children: ['B', 'C'], deltaP: 100 },
      { id: 'B', parentId: 'A', children: ['D'], deltaP: 200 },
      { id: 'C', parentId: 'A', children: [], deltaP: 150 },
      { id: 'D', parentId: 'B', children: [], deltaP: 80 },
    ]
    const circuit = findMainCircuit(nodes)
    expect(circuit).toEqual(['A', 'B', 'D'])
  })

  it('при одном конечном узле — возвращает весь путь', () => {
    const nodes: SegmentNode[] = [
      { id: 'root', parentId: null, children: ['leaf'], deltaP: 500 },
      { id: 'leaf', parentId: 'root', children: [], deltaP: 300 },
    ]
    const circuit = findMainCircuit(nodes)
    expect(circuit).toEqual(['root', 'leaf'])
  })

  it('интеграционный сценарий: 3 помещения + магистраль + 2 ветви', () => {
    const nodes: SegmentNode[] = [
      { id: 'main', parentId: null, children: ['branch1', 'branch2'], deltaP: 500 },
      { id: 'branch1', parentId: 'main', children: ['room1', 'room2'], deltaP: 300 },
      { id: 'branch2', parentId: 'main', children: ['room3'], deltaP: 200 },
      { id: 'room1', parentId: 'branch1', children: [], deltaP: 400 },
      { id: 'room2', parentId: 'branch1', children: [], deltaP: 600 },
      { id: 'room3', parentId: 'branch2', children: [], deltaP: 800 },
    ]
    const circuit = findMainCircuit(nodes)
    // main(500) + branch2(200) + room3(800) = 1500 — максимальный путь
    // main(500) + branch1(300) + room2(600) = 1400
    // main(500) + branch1(300) + room1(400) = 1200
    expect(circuit).toEqual(['main', 'branch2', 'room3'])
  })
})

describe('recommendPump', () => {
  it('reference value: H ≈ 0.547 м для ΔP=4820 Па, ρ=988 кг/м³, safety=1.10', () => {
    // H = 4820/(988·9.81)·1.10 ≈ 0.547 м
    const result = recommendPump(4820, 988, 500, 1.10)
    expect(result.headM).toBeCloseTo(0.547, 2)
  })

  it('расход насоса в м³/ч: flowM3H = totalFlowKgH / rho', () => {
    // 500 кг/ч / 988 кг/м³ ≈ 0.506 м³/ч
    const result = recommendPump(4820, 988, 500, 1.10)
    expect(result.flowM3H).toBeCloseTo(0.506, 2)
  })

  it('guard: rho=0 → headM=0, flowM3H=0', () => {
    const result = recommendPump(4820, 0, 500)
    expect(result.headM).toBe(0)
    expect(result.flowM3H).toBe(0)
  })

  it('deltaPGckPa пробрасывается в результат', () => {
    const result = recommendPump(4820, 988, 500)
    expect(result.deltaPGckPa).toBe(4820)
  })
})

describe('calculateBranchImbalance', () => {
  it('две ветви: ΔP_ГЦК=4500, ветви 3000 и 4500', () => {
    const branches = [
      { branchId: 'b1', deltaPPa: 3000, flowKgH: 100 },
      { branchId: 'b2', deltaPPa: 4500, flowKgH: 150 },
    ]
    const result = calculateBranchImbalance(branches, 4500, 988)
    // Ветвь b1: невязка = (4500-3000)/4500*100 = 33.3%
    expect(result[0].imbalancePct).toBeCloseTo(33.3, 0)
    // Ветвь b2: невязка = 0%
    expect(result[1].imbalancePct).toBeCloseTo(0, 1)
  })

  it('reference Kvs: G=0.5 м³/ч, ΔP_дросс=0.1 бар → Kvs ≈ 1.58', () => {
    // G = 0.5 м³/ч = 0.5·988 = 494 кг/ч
    // ΔP_main = 10000 Па (0.1 бар), ΔP_branch = 0
    const branches = [
      { branchId: 'b1', deltaPPa: 0, flowKgH: 494 },
    ]
    const result = calculateBranchImbalance(branches, 10000, 988)
    // requiredKvs = 0.5 / sqrt(0.1) ≈ 1.581
    expect(result[0].requiredKvs).toBeCloseTo(1.58, 1)
  })

  it('mainDeltaPPa=0 → imbalancePct=0', () => {
    const branches = [{ branchId: 'b', deltaPPa: 100, flowKgH: 50 }]
    const result = calculateBranchImbalance(branches, 0, 988)
    expect(result[0].imbalancePct).toBe(0)
  })
})

describe('buildFlowAuditString', () => {
  it('содержит формулу и подстановку', () => {
    const audit = buildFlowAuditString(3540, 4.18, 25, 122.0)
    expect(audit).toContain('G = Q·3.6/(c·Δt)')
    expect(audit).toContain('122.0 кг/ч')
  })
})
