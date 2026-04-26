import { describe, it, expect } from 'vitest'
import {
  altschulFriction,
  frictionFactor,
  pressureLossLinear,
  pressureLossLocal,
  buildFrictionAuditString,
  buildPressureLossAuditString,
} from './darcyWeisbach'

describe('frictionFactor', () => {
  it('ламинарный режим Re=1000: λ = 64/1000 = 0.064', () => {
    const lambda = frictionFactor(1000, 0.2, 20)
    expect(lambda).toBeCloseTo(0.064, 5)
  })

  it('турбулентный режим Re=18083: λ ≈ 0.0377 (Альтшуль, Δ=0.2мм, d=20мм)', () => {
    // λ = 0.11·(0.2/20 + 68/18083)^0.25 = 0.11·(0.01 + 0.00376)^0.25 ≈ 0.03767
    // Примечание: reference value в RESEARCH.md (0.0336) содержит арифметическую ошибку
    const lambda = frictionFactor(18083, 0.2, 20)
    expect(lambda).toBeCloseTo(0.0377, 3)
  })

  it('guard: Re=0 → 0', () => {
    expect(frictionFactor(0, 0.2, 20)).toBe(0)
  })

  it('guard: Re < 0.001 → 0', () => {
    expect(frictionFactor(0.0001, 0.2, 20)).toBe(0)
  })

  it('guard: diameterMm <= 0 → 0', () => {
    expect(frictionFactor(5000, 0.2, 0)).toBe(0)
    expect(frictionFactor(5000, 0.2, -5)).toBe(0)
  })

  it('переходная зона Re=2300: использует Альтшуль', () => {
    const lambda = frictionFactor(2300, 0.2, 20)
    // Re=2300 — граница, должен переключиться на Альтшуль
    expect(lambda).toBeGreaterThan(0)
    expect(lambda).toBeLessThan(1)
  })
})

describe('altschulFriction', () => {
  it('Re=18083, Δ=0.2мм, d=20мм → ≈ 0.0377', () => {
    // λ = 0.11·(0.01 + 68/18083)^0.25 ≈ 0.03767
    const lambda = altschulFriction(18083, 0.2, 20)
    expect(lambda).toBeCloseTo(0.0377, 3)
  })

  it('guard: re < 0.001 → 0', () => {
    expect(altschulFriction(0, 0.2, 20)).toBe(0)
  })

  it('guard: diameterMm <= 0 → 0', () => {
    expect(altschulFriction(5000, 0.2, 0)).toBe(0)
  })
})

describe('pressureLossLinear', () => {
  it('reference value: ΔP_лин ≈ 2490 Па', () => {
    // λ=0.0336, L=12м, d=0.02м, ρ=988 кг/м³, v=0.5 м/с
    // ΔP = 0.0336·12/0.02·988·0.5²/2 = 20.16·123.5 ≈ 2490 Па
    const dp = pressureLossLinear(0.0336, 12, 0.02, 988, 0.5)
    expect(dp).toBeCloseTo(2490, -1)
  })

  it('guard: diameterM <= 0 → 0', () => {
    expect(pressureLossLinear(0.04, 10, 0, 988, 0.5)).toBe(0)
  })

  it('guard: velocity = 0 → 0', () => {
    expect(pressureLossLinear(0.04, 10, 0.02, 988, 0)).toBe(0)
  })

  it('guard: lambda = 0 → 0', () => {
    expect(pressureLossLinear(0, 10, 0.02, 988, 0.5)).toBe(0)
  })
})

describe('pressureLossLocal', () => {
  it('reference value: ΔP_мест ≈ 494 Па', () => {
    // Σζ=4.0, ρ=988, v=0.5: 4.0·988·0.5²/2 = 4.0·123.5 = 494 Па
    const dp = pressureLossLocal(4.0, 988, 0.5)
    expect(dp).toBeCloseTo(494, 0)
  })

  it('guard: Σζ = 0 → 0', () => {
    expect(pressureLossLocal(0, 988, 0.5)).toBe(0)
  })

  it('guard: velocity = 0 → 0', () => {
    expect(pressureLossLocal(4.0, 988, 0)).toBe(0)
  })

  it('guard: rho = 0 → 0', () => {
    expect(pressureLossLocal(4.0, 0, 0.5)).toBe(0)
  })
})

describe('buildFrictionAuditString', () => {
  it('ламинарный режим — упоминает ламинарный в тексте', () => {
    const audit = buildFrictionAuditString(1000, 0.2, 20, 0.064)
    expect(audit).toContain('ламинарный режим')
    expect(audit).toContain('64')
    expect(audit).toContain('1000')
  })

  it('турбулентный режим — упоминает Альтшуль', () => {
    const audit = buildFrictionAuditString(18083, 0.2, 20, 0.0336)
    expect(audit).toContain('Альтшуль')
    expect(audit).toContain('18083')
  })
})

describe('buildPressureLossAuditString', () => {
  it('возвращает многострочный текст с лин и мест потерями', () => {
    const audit = buildPressureLossAuditString(0.0336, 12, 0.02, 988, 0.5, 4.0, 2490, 494)
    expect(audit).toContain('ΔP_лин')
    expect(audit).toContain('ΔP_мест')
    expect(audit).toContain('ΔP_итого')
    expect(audit).toContain('2490')
    expect(audit).toContain('494')
  })
})
