/**
 * Tests for ufh-help utilities.
 * Covers: COVERING_LABELS keys, isBathroomRoom heuristic.
 */

import { describe, it, expect } from 'vitest'
import {
  COVERING_LABELS,
  isBathroomRoom,
  floorTempThresholdC,
  formatFloorTemp,
  formatQPerM2,
  formatLoopLength,
} from './ufh-help'

describe('COVERING_LABELS', () => {
  it('Test 1a: содержит ключ tile', () => {
    expect(COVERING_LABELS.tile).toBe('Плитка')
  })

  it('Test 1b: содержит ключ laminate', () => {
    expect(COVERING_LABELS.laminate).toBe('Ламинат')
  })

  it('Test 1c: содержит ключ parquet', () => {
    expect(COVERING_LABELS.parquet).toBe('Паркет')
  })

  it('Test 1d: содержит ключ linoleum', () => {
    expect(COVERING_LABELS.linoleum).toBe('Линолеум')
  })
})

describe('isBathroomRoom', () => {
  it('Test 2a: "ванная" → true', () => {
    expect(isBathroomRoom('Ванная')).toBe(true)
  })

  it('Test 2b: "WC" → true (case insensitive)', () => {
    expect(isBathroomRoom('WC')).toBe(true)
  })

  it('Test 2c: "санузел" → true', () => {
    expect(isBathroomRoom('Санузел')).toBe(true)
  })

  it('Test 2d: "туалет" → true', () => {
    expect(isBathroomRoom('Туалет')).toBe(true)
  })

  it('Test 2e: "душевая" → true', () => {
    expect(isBathroomRoom('Душевая')).toBe(true)
  })

  it('Test 2f: "Гостиная" → false', () => {
    expect(isBathroomRoom('Гостиная')).toBe(false)
  })

  it('Test 2g: "Спальня" → false', () => {
    expect(isBathroomRoom('Спальня')).toBe(false)
  })
})

describe('floorTempThresholdC', () => {
  it('ванная → 33°C', () => {
    expect(floorTempThresholdC('Ванная')).toBe(33)
  })

  it('жилая → 29°C', () => {
    expect(floorTempThresholdC('Гостиная')).toBe(29)
  })
})

describe('format helpers', () => {
  it('formatFloorTemp: нулевое значение → "—"', () => {
    expect(formatFloorTemp(0)).toBe('—')
  })

  it('formatFloorTemp: 28.7 → "28.7"', () => {
    expect(formatFloorTemp(28.7)).toBe('28.7')
  })

  it('formatQPerM2: 0 → "—"', () => {
    expect(formatQPerM2(0)).toBe('—')
  })

  it('formatQPerM2: 215.4 → "215"', () => {
    expect(formatQPerM2(215.4)).toBe('215')
  })

  it('formatLoopLength: 0 → "—"', () => {
    expect(formatLoopLength(0)).toBe('—')
  })

  it('formatLoopLength: 47.0 → "47.0"', () => {
    expect(formatLoopLength(47.0)).toBe('47.0')
  })
})
