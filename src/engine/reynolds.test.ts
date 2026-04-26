import { describe, it, expect } from 'vitest'
import { reynolds, buildReynoldsAuditString } from './reynolds'

describe('reynolds', () => {
  it('вычисляет Re для воды 50°C (reference value из RESEARCH.md)', () => {
    // Re = 0.5·0.02/5.53e-7 = 18083
    const re = reynolds(0.5, 0.02, 5.53e-7)
    expect(re).toBeCloseTo(18083, -1)
  })

  it('возвращает 0 при нулевой скорости (guard)', () => {
    expect(reynolds(0, 0.02, 5.53e-7)).toBe(0)
  })

  it('возвращает 0 при нулевом диаметре (guard)', () => {
    expect(reynolds(0.5, 0, 5.53e-7)).toBe(0)
  })

  it('возвращает 0 при нулевой вязкости (guard)', () => {
    expect(reynolds(0.5, 0.02, 0)).toBe(0)
  })

  it('возвращает 0 при NaN входе (guard)', () => {
    expect(reynolds(NaN, 0.02, 5.53e-7)).toBe(0)
    expect(reynolds(0.5, NaN, 5.53e-7)).toBe(0)
    expect(reynolds(0.5, 0.02, NaN)).toBe(0)
  })

  it('возвращает 0 при отрицательных значениях (guard)', () => {
    expect(reynolds(-1, 0.02, 5.53e-7)).toBe(0)
    expect(reynolds(0.5, -0.01, 5.53e-7)).toBe(0)
    expect(reynolds(0.5, 0.02, -1e-7)).toBe(0)
  })

  it('корректно считает ламинарный режим (Re < 2300)', () => {
    // v=0.1 м/с, d=0.02 м, ν=5.53e-7: Re = 0.1·0.02/5.53e-7 ≈ 3617 (турб)
    // Для ламинара: v=0.05, d=0.01, ν=5e-6: Re = 0.05·0.01/5e-6 = 100
    const re = reynolds(0.05, 0.01, 5e-6)
    expect(re).toBeCloseTo(100, 0)
  })
})

describe('buildReynoldsAuditString', () => {
  it('возвращает многострочный текст с подстановкой', () => {
    const re = reynolds(0.5, 0.02, 5.53e-7)
    const audit = buildReynoldsAuditString(0.5, 0.02, 5.53e-7, re)
    expect(audit).toContain('Re = v·d/ν')
    expect(audit).toContain('0.500')
    expect(audit).toContain('0.0200')
    // Должен содержать итоговое Re
    expect(audit).toMatch(/\d{4,5}/)
  })

  it('разбит на 3 строки через \\n', () => {
    const audit = buildReynoldsAuditString(0.5, 0.02, 5.53e-7, 18083)
    const lines = audit.split('\n')
    expect(lines.length).toBe(3)
  })
})
