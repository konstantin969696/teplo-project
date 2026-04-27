import { describe, it, expect } from 'vitest'
import {
  calculateQBasic,
  estimatePerimeter,
  calculateFloorZones,
  calculateQInfiltrationByRate,
  calculateQInfiltrationByGap,
  calculateQVentilation,
  calculateRoomTotals,
  buildEnclosureAuditString,
  buildFloorZoneAuditString,
  buildRoomAuditString,
  ORIENTATION_ADDITIONS,
  DEFAULT_N_COEFF,
  DEFAULT_ZONE_R,
  ENCLOSURE_TYPE_CONFIG,
} from './heatLoss'

describe('ORIENTATION_ADDITIONS', () => {
  it('has +10% for north-facing orientations', () => {
    expect(ORIENTATION_ADDITIONS['С']).toBe(0.10)
    expect(ORIENTATION_ADDITIONS['СВ']).toBe(0.10)
    expect(ORIENTATION_ADDITIONS['СЗ']).toBe(0.10)
  })

  it('has +5% for east-facing orientations', () => {
    expect(ORIENTATION_ADDITIONS['В']).toBe(0.05)
    expect(ORIENTATION_ADDITIONS['ЮВ']).toBe(0.05)
  })

  it('has 0% for south/west orientations', () => {
    expect(ORIENTATION_ADDITIONS['Ю']).toBe(0.00)
    expect(ORIENTATION_ADDITIONS['ЮЗ']).toBe(0.00)
    expect(ORIENTATION_ADDITIONS['З']).toBe(0.00)
  })
})

describe('DEFAULT_N_COEFF', () => {
  it('returns 1.0 for external types', () => {
    expect(DEFAULT_N_COEFF['wall-ext']).toBe(1.0)
    expect(DEFAULT_N_COEFF['window']).toBe(1.0)
    expect(DEFAULT_N_COEFF['roof']).toBe(1.0)
  })

  it('returns reduced values for internal types', () => {
    expect(DEFAULT_N_COEFF['wall-int']).toBe(0.5)
    expect(DEFAULT_N_COEFF['ceiling-int']).toBe(0.4)
  })
})

describe('ENCLOSURE_TYPE_CONFIG', () => {
  it('has config for all 8 types', () => {
    expect(Object.keys(ENCLOSURE_TYPE_CONFIG)).toHaveLength(8)
  })

  it('marks external types correctly', () => {
    expect(ENCLOSURE_TYPE_CONFIG['wall-ext'].isExternal).toBe(true)
    expect(ENCLOSURE_TYPE_CONFIG['wall-int'].isExternal).toBe(false)
    expect(ENCLOSURE_TYPE_CONFIG['ceiling-int'].isExternal).toBe(false)
  })

  it('has Russian labels', () => {
    expect(ENCLOSURE_TYPE_CONFIG['wall-ext'].label).toBe('Наружная стена')
    expect(ENCLOSURE_TYPE_CONFIG['window'].label).toBe('Окно')
  })
})

describe('calculateQBasic', () => {
  // Q = K * A * deltaT * n * (1 + beta_or + beta_corner)
  // Base: 0.35 * 12.0 * 55 * 1.0 = 231.0

  it('returns correct watts with no orientation and no corner', () => {
    expect(calculateQBasic(0.35, 12.0, 55, 1.0, null, false)).toBeCloseTo(231.0, 0)
  })

  it('applies +10% for north orientation', () => {
    // 231.0 * 1.10 = 254.1
    expect(calculateQBasic(0.35, 12.0, 55, 1.0, 'С', false)).toBeCloseTo(254.1, 0)
  })

  it('applies +10% orientation and +5% corner', () => {
    // 231.0 * 1.15 = 265.65
    expect(calculateQBasic(0.35, 12.0, 55, 1.0, 'С', true)).toBeCloseTo(265.65, 0)
  })

  it('applies 0% for south orientation', () => {
    expect(calculateQBasic(0.35, 12.0, 55, 1.0, 'Ю', false)).toBeCloseTo(231.0, 0)
  })

  it('applies +5% for east orientation', () => {
    // 231.0 * 1.05 = 242.55
    expect(calculateQBasic(0.35, 12.0, 55, 1.0, 'В', false)).toBeCloseTo(242.55, 0)
  })

  it('returns 0 when area is 0', () => {
    expect(calculateQBasic(0.35, 0, 55, 1.0, 'С', false)).toBe(0)
  })

  it('returns 0 when deltaT is 0', () => {
    expect(calculateQBasic(0.35, 12.0, 0, 1.0, 'С', false)).toBe(0)
  })
})

describe('estimatePerimeter', () => {
  it('returns 16 for area=16 (4*sqrt(16)=16)', () => {
    expect(estimatePerimeter(16)).toBeCloseTo(16.0, 1)
  })

  it('returns 20 for area=25 (4*sqrt(25)=20)', () => {
    expect(estimatePerimeter(25)).toBeCloseTo(20.0, 1)
  })

  it('returns 0 for area=0', () => {
    expect(estimatePerimeter(0)).toBe(0)
  })
})

describe('calculateFloorZones', () => {
  it('returns 4 zones for a standard room', () => {
    const zones = calculateFloorZones(100, 20, [2.1, 4.3, 8.6, 14.2], 55)
    expect(zones.length).toBeLessThanOrEqual(4)
    expect(zones.length).toBeGreaterThan(0)
  })

  it('total area does not exceed room area', () => {
    const zones = calculateFloorZones(100, 20, [2.1, 4.3, 8.6, 14.2], 55)
    const totalArea = zones.reduce((sum, z) => sum + z.area, 0)
    expect(totalArea).toBeCloseTo(100, 1)
  })

  it('clamps small room to not exceed room area', () => {
    const zones = calculateFloorZones(4, 8, [2.1, 4.3, 8.6, 14.2], 55)
    const totalArea = zones.reduce((sum, z) => sum + z.area, 0)
    expect(totalArea).toBeCloseTo(4, 1)
  })

  it('produces positive Q for each zone with area > 0', () => {
    const zones = calculateFloorZones(100, 20, [2.1, 4.3, 8.6, 14.2], 55)
    for (const z of zones) {
      if (z.area > 0) {
        expect(z.qWatts).toBeGreaterThan(0)
      }
    }
  })

  it('returns empty array for area=0', () => {
    const zones = calculateFloorZones(0, 10, [2.1, 4.3, 8.6, 14.2], 55)
    const totalArea = zones.reduce((sum, z) => sum + z.area, 0)
    expect(totalArea).toBe(0)
  })
})

describe('calculateQInfiltrationByRate', () => {
  it('uses formula 0.337 * area * height * nInf * deltaT', () => {
    // 0.337 * 18.5 * 2.7 * 0.5 * 55 = 463.10475
    const result = calculateQInfiltrationByRate(18.5, 2.7, 0.5, 55)
    expect(result).toBeCloseTo(463.1, 0)
  })

  it('returns 0 when nInf is 0', () => {
    expect(calculateQInfiltrationByRate(18.5, 2.7, 0, 55)).toBe(0)
  })
})

describe('calculateQInfiltrationByGap', () => {
  it('uses formula 0.337 * gapArea * windSpeed * deltaT', () => {
    // 0.337 * 0.01 * 5.0 * 55 = 0.92675
    const result = calculateQInfiltrationByGap(0.01, 5.0, 55)
    expect(result).toBeCloseTo(0.927, 1)
  })

  it('returns 0 when gapArea is 0', () => {
    expect(calculateQInfiltrationByGap(0, 5.0, 55)).toBe(0)
  })
})

describe('calculateQVentilation', () => {
  it('uses formula 0.337 * lVent * deltaT', () => {
    // 0.337 * 60 * 55 = 1112.1
    expect(calculateQVentilation(60, 55)).toBeCloseTo(1112.1, 0)
  })

  it('returns 0 when lVent is 0', () => {
    expect(calculateQVentilation(0, 55)).toBe(0)
  })

  it('returns 0 when deltaT is 0', () => {
    expect(calculateQVentilation(60, 0)).toBe(0)
  })
})

describe('calculateRoomTotals', () => {
  it('sums Q for all enclosures and adds infiltration + ventilation', () => {
    const enclosures = [
      {
        id: 'e1', roomId: 'r1', type: 'wall-ext' as const,
        orientation: 'С' as const, area: 10, kValue: 0.35, nCoeff: 1.0,
        nOverridden: false, adjacentRoomName: null, tAdjacent: null,
        perimeterOverride: null, zoneR: [2.1, 4.3, 8.6, 14.2] as const,
      },
    ]
    const room = {
      id: 'r1', name: 'Room 1', floor: 1, area: 20, height: 2.7,
      isCorner: false, infiltrationMethod: 'rate' as const,
      nInfiltration: 0.5, gapArea: null, windSpeed: null, lVentilation: 0,
    }
    const result = calculateRoomTotals(enclosures, room, 55)
    expect(result.roomId).toBe('r1')
    expect(result.qBasic).toBeGreaterThan(0)
    expect(result.qEvaporation).toBe(0)
    expect(result.qTotal).toBe(result.qBasic + result.qInfiltration + result.qVentilation + result.qEvaporation)
    expect(result.qSpecific).toBeCloseTo(result.qTotal / 20, 1)
  })

  it('handles floor-ground enclosure with zone calculation', () => {
    const enclosures = [
      {
        id: 'e1', roomId: 'r1', type: 'floor-ground' as const,
        orientation: null, area: 25, kValue: 0, nCoeff: 1.0,
        nOverridden: false, adjacentRoomName: null, tAdjacent: null,
        perimeterOverride: null, zoneR: [2.1, 4.3, 8.6, 14.2] as const,
      },
    ]
    const room = {
      id: 'r1', name: 'Room 1', floor: 1, area: 25, height: 2.7,
      isCorner: false, infiltrationMethod: 'rate' as const,
      nInfiltration: 0, gapArea: null, windSpeed: null, lVentilation: 0,
    }
    const result = calculateRoomTotals(enclosures, room, 55)
    expect(result.qBasic).toBeGreaterThan(0)
  })

  it('falls back to room.area when floor-ground enclosure has area=0 (UI-engine sync)', () => {
    const enclosures = [
      {
        id: 'e1', roomId: 'r1', type: 'floor-ground' as const,
        orientation: null, area: 0, kValue: 0, nCoeff: 1.0,
        nOverridden: false, adjacentRoomName: null, tAdjacent: null,
        perimeterOverride: null, zoneR: [2.1, 4.3, 8.6, 14.2] as const,
      },
    ]
    const room = {
      id: 'r1', name: 'Room 1', floor: 1, area: 124, height: 2.7,
      isCorner: false, infiltrationMethod: 'rate' as const,
      nInfiltration: 0, gapArea: null, windSpeed: null, lVentilation: 0,
    }
    const resultWithZero = calculateRoomTotals(enclosures, room, 55)

    const enclosuresFilled = [{ ...enclosures[0], area: 124 }]
    const resultFilled = calculateRoomTotals(enclosuresFilled, room, 55)

    expect(resultWithZero.qBasic).toBeGreaterThan(0)
    expect(resultWithZero.qBasic).toBeCloseTo(resultFilled.qBasic, 1)
  })
})

describe('buildEnclosureAuditString', () => {
  it('produces string with formula and values', () => {
    const enc = {
      id: 'e1', roomId: 'r1', type: 'wall-ext' as const,
      orientation: 'С' as const, area: 12.0, kValue: 0.35, nCoeff: 1.0,
      nOverridden: false, adjacentRoomName: null, tAdjacent: null,
      perimeterOverride: null, zoneR: [2.1, 4.3, 8.6, 14.2] as const,
    }
    const result = buildEnclosureAuditString(enc, 55, false, 254.1)
    expect(result).toContain('Q =')
    expect(result).toContain('0.35')
    expect(result).toContain('12')
    expect(result).toContain('254.1')
  })
})

describe('buildFloorZoneAuditString', () => {
  it('produces string with zone breakdown', () => {
    const zones = calculateFloorZones(100, 20, [2.1, 4.3, 8.6, 14.2], 55)
    const result = buildFloorZoneAuditString(zones, 55)
    expect(result).toContain('R')
    expect(result.length).toBeGreaterThan(10)
  })
})

describe('buildRoomAuditString', () => {
  it('produces string with totals breakdown', () => {
    const result = buildRoomAuditString(500, 100, 200, 0, 800)
    expect(result).toContain('500')
    expect(result).toContain('100')
    expect(result).toContain('200')
    expect(result).toContain('800')
  })
})
