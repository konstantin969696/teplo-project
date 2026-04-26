import { describe, it, expect } from 'vitest'
import { calculateDeltaT, clampTemperature } from './climate'

describe('calculateDeltaT', () => {
  it('returns tInside - tOutside for positive delta', () => {
    expect(calculateDeltaT(20, -28)).toBe(48)
  })

  it('returns tInside - tOutside for zero delta', () => {
    expect(calculateDeltaT(20, 20)).toBe(0)
  })

  it('returns negative when tOutside > tInside', () => {
    expect(calculateDeltaT(20, 25)).toBe(-5)
  })
})

describe('clampTemperature', () => {
  it('clamps below minimum to 10', () => {
    expect(clampTemperature(5)).toBe(10)
  })

  it('clamps above maximum to 60', () => {
    expect(clampTemperature(65)).toBe(60)
  })

  it('passes through in-range value', () => {
    expect(clampTemperature(20)).toBe(20)
  })

  it('uses custom range', () => {
    expect(clampTemperature(5, 0, 50)).toBe(5)
  })
})
