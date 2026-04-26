import { describe, it, expect } from 'vitest'
import {
  calculateLMTD,
  correctQNominal,
  calculateSections,
  selectPanelSize,
  buildLMTDAuditString,
  buildCorrectionAuditString,
  buildSectionsAuditString,
  CONNECTION_SCHEME_COEFF,
  INSTALLATION_COEFF,
  DEFAULT_N_EXPONENT,
  NOMINAL_DELTA_T,
} from './equipment'
import type { PanelCatalogModel } from '../types/project'

describe('NOMINAL_DELTA_T', () => {
  it('equals 70 per EN 442 baseline', () => {
    expect(NOMINAL_DELTA_T).toBe(70)
  })
})

describe('CONNECTION_SCHEME_COEFF', () => {
  // Per CONTEXT.md D-05 specifics
  it('side connection has coefficient 1.0', () => {
    expect(CONNECTION_SCHEME_COEFF.side).toBe(1.0)
  })
  it('bottom connection has coefficient 0.88', () => {
    expect(CONNECTION_SCHEME_COEFF.bottom).toBe(0.88)
  })
  it('diagonal connection has coefficient 0.95', () => {
    expect(CONNECTION_SCHEME_COEFF.diagonal).toBe(0.95)
  })
})

describe('INSTALLATION_COEFF', () => {
  // Per CONTEXT.md D-06 specifics
  it('open installation has coefficient 1.0', () => {
    expect(INSTALLATION_COEFF.open).toBe(1.0)
  })
  it('niche installation has coefficient 0.9', () => {
    expect(INSTALLATION_COEFF.niche).toBe(0.9)
  })
  it('under-sill installation has coefficient 0.95', () => {
    expect(INSTALLATION_COEFF['under-sill']).toBe(0.95)
  })
})

describe('DEFAULT_N_EXPONENT', () => {
  it('has entries for all EquipmentKind values', () => {
    expect(DEFAULT_N_EXPONENT.panel).toBeGreaterThan(0)
    expect(DEFAULT_N_EXPONENT.bimetal).toBeGreaterThan(0)
    expect(DEFAULT_N_EXPONENT.aluminum).toBeGreaterThan(0)
    expect(DEFAULT_N_EXPONENT['cast-iron']).toBeGreaterThan(0)
    expect(DEFAULT_N_EXPONENT['underfloor-convector']).toBeGreaterThan(0)
  })
})

describe('calculateLMTD', () => {
  // LMTD = (Δt₁ - Δt₂) / ln(Δt₁ / Δt₂)
  // Δt₁ = tSupply - tRoom, Δt₂ = tReturn - tRoom

  // LMTD-01: Δt₁=60, Δt₂=40, (60-40)/ln(60/40) = 49.326
  it('LMTD-01: returns ~49.33 for 80/60/20 classic case', () => {
    expect(calculateLMTD(80, 60, 20)).toBeCloseTo(49.33, 1)
  })

  // LMTD-02: Δt₁=55, Δt₂=45, (55-45)/ln(55/45) = 49.83
  it('LMTD-02: returns ~49.83 for 75/65/20 EN 442 baseline', () => {
    expect(calculateLMTD(75, 65, 20)).toBeCloseTo(49.83, 1)
  })

  // LMTD-03: Δt₁=35, Δt₂=25, (35-25)/ln(35/25) = 29.73
  it('LMTD-03: returns ~29.73 for 55/45/20 low-temp case', () => {
    expect(calculateLMTD(55, 45, 20)).toBeCloseTo(29.73, 1)
  })

  // LMTD-04: tSupply == tReturn → degenerate case, ln(1)=0 (Pitfall 1)
  // Fall back to arithmetic mean (which equals dt1 when dt1==dt2).
  it('LMTD-04: returns 40 for degenerate 60/60/20 case', () => {
    expect(calculateLMTD(60, 60, 20)).toBeCloseTo(40, 1)
  })

  it('LMTD-edge1: returns 0 when tSupply < tRoom (system inoperable)', () => {
    expect(calculateLMTD(15, 10, 20)).toBe(0)
  })

  it('LMTD-edge2: returns 0 when tRoom == tSupply (dt2 negative)', () => {
    expect(calculateLMTD(80, 60, 80)).toBe(0)
  })

  it('LMTD-edge3: degenerate micro-difference guard returns ~60', () => {
    // Δt₁ ≈ Δt₂ ≈ 60 → fallback to dt1
    expect(calculateLMTD(80.0001, 80, 20)).toBeCloseTo(60, 0)
  })
})

describe('correctQNominal', () => {
  // Q_факт = Q_ном * (LMTD / 70)^n * k_подкл * k_устан

  // CORR-01: Rifar Base 500 @ 80/60/20 (LMTD=49.33, n=1.3, side, open)
  // (49.33/70)^1.3 = 0.63449; 197 × 0.63449 = 124.99 W (≈125)
  // План в RESEARCH указывал "~126" с промежуточным округлением — реальный расчёт даёт 125.
  it('CORR-01: Rifar Base 500 @ 80/60 returns ~125 W', () => {
    expect(correctQNominal(197, 1.3, 49.33, 'side', 'open')).toBeCloseTo(125, 0)
  })

  // CORR-02: same radiator @ 55/45/20 low-temp (LMTD=29.73)
  // (29.73/70)^1.3 = 0.3285; 197 × 0.3285 = 64.71 W (≈65)
  it('CORR-02: low-temp system yields ~65 W per section', () => {
    expect(correctQNominal(197, 1.3, 29.73, 'side', 'open')).toBeCloseTo(65, 0)
  })

  // CORR-03: bottom connection applies 0.88 multiplier vs CORR-01
  // 125 × 0.88 = 110
  it('CORR-03: bottom connection yields ~110 W (CORR-01 × 0.88)', () => {
    expect(correctQNominal(197, 1.3, 49.33, 'bottom', 'open')).toBeCloseTo(110, 0)
  })

  it('CORR-edge: LMTD=0 returns 0 (Pitfall 5 guard)', () => {
    expect(correctQNominal(197, 1.3, 0, 'side', 'open')).toBe(0)
  })

  it('CORR-edge2: qNominal=0 returns 0', () => {
    expect(correctQNominal(0, 1.3, 49.33, 'side', 'open')).toBe(0)
  })

  // Pitfall 5: formula direction check. LMTD < 70 should REDUCE Q, not increase.
  // If formula were inverted: (70/35)^1.3 = 2.46 → 100 * 2.46 ≈ 246 (WRONG!)
  // Correct: (35/70)^1.3 ≈ 0.406 → 100 * 0.406 ≈ 40.6 (< 100 — correct direction)
  it('CORR-direction: LMTD<70 must REDUCE Q, not increase', () => {
    const q = correctQNominal(100, 1.3, 35, 'side', 'open')
    expect(q).toBeLessThan(100)
    expect(q).toBeCloseTo(40.6, 0)
  })
})

describe('calculateSections', () => {
  // SEL-01: Q_req=990, Rifar Base 500 (197 W/sec @ΔT70, n=1.3)
  // @ LMTD=49.33: Q_fact/sec ≈ 124.99, calc = 990/124.99 ≈ 7.92 → ceil 8
  // (Plan specified Q=1000 but that hits 8.0005 → ceil 9; Q=990 is the same inspection case
  // with stable ceiling result — preserves the SEL-01 intent: "8 sections for 1kW Rifar".)
  it('SEL-01: ~990W / Rifar @ 80/60 gives 8 sections', () => {
    const result = calculateSections(990, 197, 1.3, 49.33, 'side', 'open')
    expect(result.accepted).toBe(8)
    expect(result.calculated).toBeCloseTo(7.92, 1)
  })

  it('SEL-roundup: 991W same case still gives 8', () => {
    expect(calculateSections(991, 197, 1.3, 49.33, 'side', 'open').accepted).toBe(8)
  })

  // Edge: exactly 1000W hits rounding boundary (calc = 8.0005) → ceil 9
  it('SEL-boundary: Q=1000 hits calc=8.0005 → ceil 9 (documents boundary behavior)', () => {
    expect(calculateSections(1000, 197, 1.3, 49.33, 'side', 'open').accepted).toBe(9)
  })

  // Pitfall 6: minimum 1 section when Q_required == 0
  it('SEL-min: Q_required=0 gives minimum 1 section', () => {
    expect(calculateSections(0, 197, 1.3, 49.33, 'side', 'open').accepted).toBe(1)
  })

  // LMTD=0 case: system inoperable, return 0/0 so UI can display '—'
  it('SEL-zero-lmtd: LMTD=0 returns {calculated:0, accepted:0}', () => {
    const result = calculateSections(1000, 197, 1.3, 0, 'side', 'open')
    expect(result.calculated).toBe(0)
    expect(result.accepted).toBe(0)
  })
})

describe('selectPanelSize', () => {
  // Kermi FKO Type 22, height=500: variants 400..2000mm long
  const model: PanelCatalogModel = {
    id: 'kermi-fko-22-500',
    manufacturer: 'Kermi',
    series: 'FKO Type 22',
    kind: 'panel',
    panelType: '22',
    nExponent: 1.3,
    isCustom: false,
    variants: [
      { heightMm: 500, lengthMm: 400, qAt70: 652 },
      { heightMm: 500, lengthMm: 600, qAt70: 978 },
      { heightMm: 500, lengthMm: 800, qAt70: 1304 },
      { heightMm: 500, lengthMm: 1000, qAt70: 1630 },
      { heightMm: 500, lengthMm: 1200, qAt70: 1956 },
    ],
  }

  // PANEL-01a: Q_req=1200 @ LMTD=49.33
  // qActual ≈ qAt70 * (49.33/70)^1.3 ≈ qAt70 * 0.641
  // 400→418, 600→627, 800→836, 1000→1045, 1200→1254
  // First >= 1200 is lengthMm=1200 (1254 >= 1200)
  it('PANEL-01a: Q=1200 picks 1200mm variant', () => {
    const result = selectPanelSize(1200, model, 49.33, 'side', 'open')
    expect(result.chosen).not.toBeNull()
    expect(result.chosen?.lengthMm).toBe(1200)
  })

  // PANEL-01b: Q_req=800 @ LMTD=49.33. 800mm gives 836 (>=800), smallest matching
  it('PANEL-01b: Q=800 picks 800mm variant', () => {
    const result = selectPanelSize(800, model, 49.33, 'side', 'open')
    expect(result.chosen).not.toBeNull()
    expect(result.chosen?.lengthMm).toBe(800)
  })

  // D-05 trigger: no variant meets Q_required → chosen null, alternatives populated (top-3)
  it('PANEL-insufficient: impossible Q_required returns chosen=null with alternatives', () => {
    const result = selectPanelSize(99999, model, 49.33, 'side', 'open')
    expect(result.chosen).toBeNull()
    expect(result.alternatives.length).toBeGreaterThan(0)
    expect(result.alternatives.length).toBeLessThanOrEqual(3)
  })

  // Low-temp: LMTD=29.73 pulls qActual down, must pick larger variant OR signal insufficient.
  // At LMTD=29.73, qActual ≈ qAt70 × 0.329; even the largest 1200mm variant gives only ≈643W.
  // Q_required=400 is satisfiable: 1200×0.329 ≈ 643 >= 400 (1000mm: 1630×0.329 ≈ 536 >= 400).
  it('PANEL-low-temp: LMTD=29.73 requires larger variant than at LMTD=49.33', () => {
    const highTemp = selectPanelSize(400, model, 49.33, 'side', 'open')
    const lowTemp = selectPanelSize(400, model, 29.73, 'side', 'open')
    expect(highTemp.chosen).not.toBeNull()
    expect(lowTemp.chosen).not.toBeNull()
    if (lowTemp.chosen && highTemp.chosen) {
      expect(lowTemp.chosen.lengthMm).toBeGreaterThanOrEqual(highTemp.chosen.lengthMm)
    }
  })
})

describe('buildLMTDAuditString', () => {
  it('includes formula, substitutions, and result', () => {
    const s = buildLMTDAuditString(80, 60, 20, 49.33)
    expect(s).toContain('LMTD = (Δt₁ - Δt₂) / ln(Δt₁ / Δt₂)')
    expect(s).toContain('(60.0 - 40.0) / ln(60.0 / 40.0)')
    expect(s).toContain('49.33')
    expect(s).toContain('°C')
  })
})

describe('buildCorrectionAuditString', () => {
  it('includes correction formula and numeric substitutions', () => {
    const s = buildCorrectionAuditString(197, 1.3, 49.33, 1.0, 1.0, 126)
    expect(s).toContain('Q_факт = Q_ном × (LMTD/70)^n × k_подкл × k_устан')
    expect(s).toContain('197')
    expect(s).toContain('1.3')
    expect(s).toContain('49.33')
    expect(s).toContain('126')
  })
})

describe('buildSectionsAuditString', () => {
  it('includes division, result, and ceiling', () => {
    const s = buildSectionsAuditString(1000, 126, 7.94, 8)
    expect(s).toContain('1000 / 126')
    expect(s).toContain('7.94')
    expect(s).toContain('округление вверх = 8')
  })
})
