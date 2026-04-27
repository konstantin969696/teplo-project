import { describe, it, expect } from 'vitest'
import {
  BETA_BY_MODE,
  calculateSaturatedVaporPressure,
  calculatePartialVaporPressure,
  calculateEvaporationMass,
  calculateEvaporationHeatW,
  calculatePoolEvaporationHeat,
} from './poolEvaporation'
import type { PoolParams } from '../types/project'

describe('BETA_BY_MODE', () => {
  it('active = 0.20', () => expect(BETA_BY_MODE.active).toBe(0.20))
  it('idle = 0.05',   () => expect(BETA_BY_MODE.idle).toBe(0.05))
  it('covered = 0.005', () => expect(BETA_BY_MODE.covered).toBe(0.005))
})

describe('calculateSaturatedVaporPressure (Magnus)', () => {
  // Reference table from spec (tolerance ±0.005 кПа)
  it('20 °C → 2.338 кПа', () => expect(calculateSaturatedVaporPressure(20)).toBeCloseTo(2.338, 2))
  it('22 °C → 2.644 кПа', () => expect(calculateSaturatedVaporPressure(22)).toBeCloseTo(2.644, 2))
  it('24 °C → 2.985 кПа', () => expect(calculateSaturatedVaporPressure(24)).toBeCloseTo(2.985, 2))
  it('26 °C → 3.363 кПа', () => expect(calculateSaturatedVaporPressure(26)).toBeCloseTo(3.363, 2))
  it('28 °C → 3.782 кПа', () => expect(calculateSaturatedVaporPressure(28)).toBeCloseTo(3.782, 2))
  it('30 °C → 4.246 кПа', () => expect(calculateSaturatedVaporPressure(30)).toBeCloseTo(4.246, 2))
  it('35 °C → 5.627 кПа', () => expect(calculateSaturatedVaporPressure(35)).toBeCloseTo(5.627, 2))
})

describe('calculatePartialVaporPressure', () => {
  it('tAir=28 φ=0.6 → 3.782 · 0.6 = 2.269 кПа', () => {
    expect(calculatePartialVaporPressure(28, 0.6)).toBeCloseTo(2.269, 2)
  })

  it('tAir=20 φ=1.0 → P_нас(20) = 2.338 кПа (fully saturated)', () => {
    expect(calculatePartialVaporPressure(20, 1.0)).toBeCloseTo(2.338, 2)
  })
})

describe('calculateEvaporationMass', () => {
  it('standard: β=0.20, ΔP=1.513, F=50 → 15.13 кг/ч', () => {
    // ΔP = 3.782 − 2.269 = 1.513 кПа
    expect(calculateEvaporationMass(0.20, 3.782, 2.269, 50)).toBeCloseTo(15.13, 1)
  })

  it('F=0 → 0', () => {
    expect(calculateEvaporationMass(0.20, 3.782, 2.269, 0)).toBe(0)
  })

  it('β=0 → 0', () => {
    expect(calculateEvaporationMass(0, 3.782, 2.269, 50)).toBe(0)
  })

  it('pSat < pPartial (tWater < tAir при высокой φ) → clamp to 0', () => {
    // pSat < pPartial → отрицательное испарение невозможно
    expect(calculateEvaporationMass(0.20, 2.0, 3.0, 50)).toBe(0)
  })
})

describe('calculateEvaporationHeatW', () => {
  it('15.13 кг/ч → ≈10 297 Вт', () => {
    // Q = 15.13 · 2450 · 1000 / 3600 = 10296.8 Вт (spec rounds to ≈10 298)
    expect(calculateEvaporationHeatW(15.13)).toBeCloseTo(10296.8, 0)
  })

  it('0 кг/ч → 0 Вт', () => {
    expect(calculateEvaporationHeatW(0)).toBe(0)
  })
})

describe('calculatePoolEvaporationHeat', () => {
  const basePool: PoolParams = {
    enabled: true,
    fMirrorM2: 50,
    tWaterC: 28,
    phi: 0.6,
    mode: 'active',
  }

  it('sanity: 5×10 м, tWater=28°C, tAir=28°C, φ=0.6, active → ≈10.3 кВт', () => {
    // P_нас(28) = 3.782 кПа
    // P_парц = 3.782 · 0.6 = 2.269 кПа
    // ΔP = 3.782 - 2.269 = 1.513 кПа
    // G = 0.20 · 1.513 · 50 = 15.13 кг/ч
    // Q = 15.13 · 2450 · 1000 / 3600 = 10 298 Вт ≈ 10.3 кВт
    const q = calculatePoolEvaporationHeat(basePool, 28)
    expect(q).toBeCloseTo(10298, -2)  // within ±100 Вт
  })

  it('enabled=false → 0', () => {
    expect(calculatePoolEvaporationHeat({ ...basePool, enabled: false }, 28)).toBe(0)
  })

  it('pool=undefined → 0', () => {
    expect(calculatePoolEvaporationHeat(undefined, 28)).toBe(0)
  })

  it('F=0 → 0', () => {
    expect(calculatePoolEvaporationHeat({ ...basePool, fMirrorM2: 0 }, 28)).toBe(0)
  })

  it('φ≥1 (saturated air): tWater=28, tAir=28, φ=1.0 → 0 (no evaporation)', () => {
    // P_парц = P_нас(28) · 1.0 = P_нас(28) → ΔP = 0
    expect(calculatePoolEvaporationHeat({ ...basePool, phi: 1.0 }, 28)).toBeCloseTo(0, 0)
  })

  it('tWater < tAir → clamped to 0', () => {
    // Cold pool, hot humid room: no evaporation
    expect(calculatePoolEvaporationHeat({ ...basePool, tWaterC: 20, phi: 0.9 }, 35)).toBe(0)
  })

  it('idle mode uses β=0.05 → ~25× less than active', () => {
    const qActive = calculatePoolEvaporationHeat(basePool, 28)
    const qIdle = calculatePoolEvaporationHeat({ ...basePool, mode: 'idle' }, 28)
    expect(qIdle).toBeCloseTo(qActive * (0.05 / 0.20), 0)
  })

  it('covered mode uses β=0.005 → ~4× less than idle', () => {
    const qIdle = calculatePoolEvaporationHeat({ ...basePool, mode: 'idle' }, 28)
    const qCovered = calculatePoolEvaporationHeat({ ...basePool, mode: 'covered' }, 28)
    expect(qCovered).toBeCloseTo(qIdle * (0.005 / 0.05), 0)
  })
})
