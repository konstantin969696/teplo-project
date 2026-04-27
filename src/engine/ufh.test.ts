import { describe, it, expect } from 'vitest'
import {
  COVERING_COEFF,
  ALPHA_FLOOR_TOTAL,
  calculateHeatFlux,
  calculateFloorTemp,
  calculateLoopLength,
  calculateLoopCount,
  calculateLoopHydraulics,
  calculateRequiredCoolantMeanTemp,
  buildUfhAuditString,
  deriveComfortTemps,
} from './ufh'
import type { CoolantSpec, PipeSpec } from '../types/hydraulics'

// Вода при 40°C (типичная для УФН)
const WATER_UFH: CoolantSpec = {
  id: 'water-ufh',
  name: 'Вода',
  rhoKgM3: 992,
  cKjKgK: 4.18,
  nuM2S: 6.3e-7,
  isCustom: false,
}

// PE-X 16 мм (типичная труба УФН)
const PIPE_PEX16: PipeSpec = {
  id: 'pex16',
  material: 'pe-x',
  dnMm: 16,
  innerDiameterMm: 12.0,
  roughnessMm: 0.007,
  wallThicknessMm: 2.0,
  maxLoopLengthM: 90,
  isCustom: false,
}

describe('COVERING_COEFF', () => {
  it('tile = 1.00', () => {
    expect(COVERING_COEFF.tile).toBe(1.00)
  })
  it('laminate = 0.60', () => {
    expect(COVERING_COEFF.laminate).toBe(0.60)
  })
  it('parquet = 0.50', () => {
    expect(COVERING_COEFF.parquet).toBe(0.50)
  })
  it('linoleum = 0.70', () => {
    expect(COVERING_COEFF.linoleum).toBe(0.70)
  })
})

describe('ALPHA_FLOOR_TOTAL', () => {
  it('equals 10.8 per EN 1264-5', () => {
    expect(ALPHA_FLOOR_TOTAL).toBe(10.8)
  })
})

describe('calculateHeatFlux', () => {
  it('tile tS=45 tR=35 tRoom=20: q ≈ 240.7 Вт/м²', () => {
    // t_ср = 40°C, Δt = 40-20 = 20°C
    // q = 8.92·20^1.1·1.0 = 8.92·26.986 ≈ 240.7 Вт/м²
    // Примечание: reference value в RESEARCH.md (215.4) содержит арифметическую ошибку
    // (использовался 20^1.0=20, а не 20^1.1=26.99)
    const q = calculateHeatFlux(45, 35, 20, 'tile')
    expect(q).toBeCloseTo(240.7, 0)
  })

  it('laminate tS=45 tR=35 tRoom=20: q ≈ 144.4 Вт/м² (tile·0.6)', () => {
    // 240.7·0.6 ≈ 144.4 Вт/м²
    const q = calculateHeatFlux(45, 35, 20, 'laminate')
    expect(q).toBeCloseTo(144.4, 0)
  })

  it('parquet: меньше чем laminate (k=0.5 < 0.6)', () => {
    const qParquet = calculateHeatFlux(45, 35, 20, 'parquet')
    const qLaminate = calculateHeatFlux(45, 35, 20, 'laminate')
    expect(qParquet).toBeLessThan(qLaminate)
  })

  it('linoleum: между tile и laminate', () => {
    const qTile = calculateHeatFlux(45, 35, 20, 'tile')
    const qLinoleum = calculateHeatFlux(45, 35, 20, 'linoleum')
    const qLaminate = calculateHeatFlux(45, 35, 20, 'laminate')
    expect(qLinoleum).toBeLessThan(qTile)
    expect(qLinoleum).toBeGreaterThan(qLaminate)
  })

  it('guard: Δt ≤ 0 → 0 (tSupply=tRoom)', () => {
    expect(calculateHeatFlux(20, 20, 20, 'tile')).toBe(0)
  })

  it('guard: tMean < tRoom → 0 (нет теплоотдачи)', () => {
    expect(calculateHeatFlux(15, 15, 20, 'tile')).toBe(0)
  })
})

describe('calculateFloorTemp', () => {
  it('reference value: t_пол ≈ 40.0°C при q=215.4, tRoom=20', () => {
    // t_пол = 20 + 215.4/10.8 ≈ 20 + 19.94 ≈ 39.94 ≈ 40.0
    const t = calculateFloorTemp(215.4, 20)
    expect(t).toBeCloseTo(40.0, 0)
  })

  it('q=0 → t_пол = tRoom', () => {
    expect(calculateFloorTemp(0, 20)).toBe(20)
  })

  it('большой q → t_пол > tRoom', () => {
    expect(calculateFloorTemp(100, 20)).toBeGreaterThan(20)
  })
})

describe('calculateLoopLength', () => {
  it('reference value: L = 47 м для F=8.2м², step=20см, leadIn=3м', () => {
    // L = 8.2·100/20 + 2·3 = 41 + 6 = 47 м
    const L = calculateLoopLength(8.2, 20, 3)
    expect(L).toBeCloseTo(47.0, 1)
  })

  it('guard: area=0 → 0', () => {
    expect(calculateLoopLength(0, 20, 3)).toBe(0)
  })

  it('guard: stepCm=0 → 0', () => {
    expect(calculateLoopLength(8.2, 0, 3)).toBe(0)
  })

  it('шаг 15 см: больше труб чем при 20 см', () => {
    const L20 = calculateLoopLength(10, 20, 3)
    const L15 = calculateLoopLength(10, 15, 3)
    expect(L15).toBeGreaterThan(L20)
  })
})

describe('calculateLoopCount', () => {
  it('reference value: N=3 для L=250м, L_max=90м', () => {
    // ceil(250/90) = ceil(2.78) = 3
    expect(calculateLoopCount(250, 90)).toBe(3)
  })

  it('минимум 1 контур даже при малой длине', () => {
    expect(calculateLoopCount(30, 90)).toBe(1)
  })

  it('ровно L_max → 1 контур', () => {
    expect(calculateLoopCount(90, 90)).toBe(1)
  })

  it('L_max + 1 → 2 контура', () => {
    expect(calculateLoopCount(91, 90)).toBe(2)
  })

  it('guard: L_max=0 → 1', () => {
    expect(calculateLoopCount(100, 0)).toBe(1)
  })
})

describe('calculateLoopHydraulics', () => {
  it('возвращает ненулевые значения для валидных входов', () => {
    const result = calculateLoopHydraulics(1500, 45, 35, PIPE_PEX16, WATER_UFH, 80)
    expect(result.flowKgH).toBeGreaterThan(0)
    expect(result.velocityMS).toBeGreaterThan(0)
    expect(result.deltaPLinearPa).toBeGreaterThan(0)
    expect(result.deltaPTotalPa).toBeGreaterThanOrEqual(result.deltaPLinearPa)
  })

  it('deltaPTotalPa = deltaPLinearPa + deltaPManifoldPa', () => {
    const result = calculateLoopHydraulics(1500, 45, 35, PIPE_PEX16, WATER_UFH, 80)
    expect(result.deltaPTotalPa).toBeCloseTo(result.deltaPLinearPa + result.deltaPManifoldPa, 1)
  })
})

describe('buildUfhAuditString', () => {
  it('содержит ключевые строки с подстановкой', () => {
    const q = calculateHeatFlux(45, 35, 20, 'tile')
    const totalQ = q * 8.2
    const floorT = calculateFloorTemp(q, 20)
    const loopL = calculateLoopLength(8.2, 20, 3)
    const loopN = calculateLoopCount(loopL, 90)
    const audit = buildUfhAuditString(45, 35, 20, 'tile', 8.2, 20, q, totalQ, floorT, loopL, loopN)
    expect(audit).toContain('t_ср_ТП')
    expect(audit).toContain('Δt_ТП')
    expect(audit).toContain('q_raw')
    expect(audit).toContain('Q_тп')
    expect(audit).toContain('t_пол_ср')
    expect(audit).toContain('L_контура')
    expect(audit).toContain('N_контуров')
  })
})

describe('calculateRequiredCoolantMeanTemp (UFH-08)', () => {
  it('возвращает null когда targetFloorTempC <= tRoom', () => {
    expect(calculateRequiredCoolantMeanTemp(20, 20, 'tile')).toBeNull()
    expect(calculateRequiredCoolantMeanTemp(15, 20, 'tile')).toBeNull()
  })

  it('tile: t_пол=30, tRoom=20 → t_ср ≈ 29.65°C', () => {
    // q = 10.8 * 10 = 108 Вт/м²; dtCoolant = (108/8.92)^(1/1.1) ≈ 9.65
    const result = calculateRequiredCoolantMeanTemp(30, 20, 'tile')
    expect(result).not.toBeNull()
    expect(result!).toBeCloseTo(29.65, 1)
  })

  it('round-trip: t_пол → t_ср → calculateFloorTemp воспроизводит исходную t_пол (±0.01°C)', () => {
    const targetFloorTempC = 30
    const tRoom = 20
    const covering = 'tile' as const

    const tMean = calculateRequiredCoolantMeanTemp(targetFloorTempC, tRoom, covering)!
    // Подаём в calculateHeatFlux: tSupply = tMean+5, tReturn = tMean-5
    const dt = 5
    const q = calculateHeatFlux(tMean + dt, tMean - dt, tRoom, covering)
    const tFloorActual = calculateFloorTemp(q, tRoom)

    expect(tFloorActual).toBeCloseTo(targetFloorTempC, 1)
  })

  it('ламинат требует более высокой t_ср чем плитка для одинаковой t_пола', () => {
    // k_laminate (0.6) < k_tile (1.0) → нужен более горячий теплоноситель
    const tTile = calculateRequiredCoolantMeanTemp(30, 20, 'tile')!
    const tLaminate = calculateRequiredCoolantMeanTemp(30, 20, 'laminate')!
    expect(tLaminate).toBeGreaterThan(tTile)
  })

  it('паркет требует самой высокой t_ср среди всех покрытий (k_parquet минимальный)', () => {
    // k: tile=1.0, linoleum=0.7, laminate=0.6, parquet=0.5
    const results = (['tile', 'linoleum', 'laminate', 'parquet'] as const).map(
      c => calculateRequiredCoolantMeanTemp(30, 20, c)!
    )
    const maxIdx = results.indexOf(Math.max(...results))
    expect(maxIdx).toBe(3) // parquet — последний
  })

  it('более высокая целевая t_пола → более высокая t_ср теплоносителя', () => {
    const t28 = calculateRequiredCoolantMeanTemp(28, 20, 'tile')!
    const t30 = calculateRequiredCoolantMeanTemp(30, 20, 'tile')!
    const t32 = calculateRequiredCoolantMeanTemp(32, 20, 'tile')!
    expect(t28).toBeLessThan(t30)
    expect(t30).toBeLessThan(t32)
  })
})

describe('deriveComfortTemps (UFH-09)', () => {
  it('возвращает null когда target ≤ tRoom', () => {
    expect(deriveComfortTemps(20, 20, 'tile', 45, 40)).toBeNull()
    expect(deriveComfortTemps(19, 20, 'tile', 45, 40)).toBeNull()
  })

  it('tSupply и tReturn кратны 5°C', () => {
    // Любая комбинация параметров должна давать кратные 5 результаты
    const r = deriveComfortTemps(33, 20, 'tile', 45, 40)
    expect(r).not.toBeNull()
    expect(r!.tSupply % 5).toBe(0)
    expect(r!.tReturn % 5).toBe(0)
  })

  it('tile target=33°C, system 45/40 (dt=5) → tSup=35, tRet=30', () => {
    // tMean ≈ 32.25; tSupRaw≈34.75→35, tRetRaw≈29.75→30
    const r = deriveComfortTemps(33, 20, 'tile', 45, 40)
    expect(r).not.toBeNull()
    expect(r!.tSupply).toBe(35)
    expect(r!.tReturn).toBe(30)
  })

  it('floorTempActual соответствует calculateHeatFlux от округлённых tSup/tRet', () => {
    const r = deriveComfortTemps(33, 20, 'tile', 45, 40)!
    const qCheck = calculateHeatFlux(r.tSupply, r.tReturn, 20, 'tile')
    const floorCheck = calculateFloorTemp(qCheck, 20)
    expect(r.floorTempActual).toBeCloseTo(floorCheck, 3)
  })

  it('target=33°C, tile, system 45/35 (dt=10) → tSup=35, tRet=25', () => {
    // tMean ≈ 32.25; tSupRaw≈37.25→35, tRetRaw≈27.25→25
    const r = deriveComfortTemps(33, 20, 'tile', 45, 35)
    expect(r).not.toBeNull()
    expect(r!.tSupply).toBe(35)
    expect(r!.tReturn).toBe(25)
  })

  it('более высокая целевая t_пола → более высокие tSup/tRet', () => {
    const r29 = deriveComfortTemps(29, 20, 'tile', 45, 40)!
    const r33 = deriveComfortTemps(33, 20, 'tile', 45, 40)!
    expect(r33.tSupply).toBeGreaterThanOrEqual(r29.tSupply)
  })

  it('ламинат требует более высоких tSup/tRet чем плитка для той же целевой t_пола', () => {
    const tile = deriveComfortTemps(33, 20, 'tile', 45, 40)!
    const lam = deriveComfortTemps(33, 20, 'laminate', 45, 40)!
    expect(lam.tSupply).toBeGreaterThanOrEqual(tile.tSupply)
  })
})
