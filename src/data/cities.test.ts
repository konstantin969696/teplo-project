import { describe, it, expect } from 'vitest'
import { CITIES } from './cities'

describe('CITIES climate data', () => {
  it('contains at least 35 cities', () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(35)
  })

  it('each city has required fields', () => {
    for (const city of CITIES) {
      expect(typeof city.name).toBe('string')
      expect(city.name.length).toBeGreaterThan(0)
      expect(typeof city.tOutside).toBe('number')
      expect(typeof city.gsop).toBe('number')
      expect(['А', 'Б', 'В']).toContain(city.humidityZone)
    }
  })

  it('contains Москва with tOutside=-23 per SP 131.13330.2025', () => {
    const moscow = CITIES.find(c => c.name === 'Москва')
    expect(moscow).toBeDefined()
    expect(moscow!.tOutside).toBe(-23)
  })

  it('contains Якутск as coldest city', () => {
    const yakutsk = CITIES.find(c => c.name === 'Якутск')
    expect(yakutsk).toBeDefined()
    expect(yakutsk!.tOutside).toBeLessThanOrEqual(-50)
  })

  it('cities are sorted alphabetically', () => {
    const names = CITIES.map(c => c.name)
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'ru'))
    expect(names).toEqual(sorted)
  })
})
