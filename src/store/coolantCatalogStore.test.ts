import { describe, it, expect, beforeEach } from 'vitest'
import { useCoolantCatalogStore, SEED_COOLANT_COUNT } from './coolantCatalogStore'

beforeEach(() => {
  useCoolantCatalogStore.getState().resetToSeed()
  localStorage.clear()
})

describe('useCoolantCatalogStore', () => {
  describe('seed initialization', () => {
    it('Test 10: contains 3 coolants with correct properties', () => {
      const state = useCoolantCatalogStore.getState()
      expect(SEED_COOLANT_COUNT).toBe(3)
      expect(Object.keys(state.coolants).length).toBe(3)
    })

    it('water coolant has correct rho/c/nu at 50°C', () => {
      const state = useCoolantCatalogStore.getState()
      const water = state.coolants['water']
      expect(water).toBeDefined()
      expect(water.name).toBe('Вода')
      expect(water.rhoKgM3).toBe(988)
      expect(water.cKjKgK).toBe(4.181)
      expect(water.nuM2S).toBeCloseTo(5.53e-7, 12)
    })

    it('glycol-30 has correct properties', () => {
      const state = useCoolantCatalogStore.getState()
      const g30 = state.coolants['glycol-30']
      expect(g30).toBeDefined()
      expect(g30.rhoKgM3).toBe(1040)
      expect(g30.cKjKgK).toBe(3.89)
    })

    it('glycol-40 has correct properties', () => {
      const state = useCoolantCatalogStore.getState()
      const g40 = state.coolants['glycol-40']
      expect(g40).toBeDefined()
      expect(g40.rhoKgM3).toBe(1060)
      expect(g40.cKjKgK).toBe(3.69)
      expect(g40.nuM2S).toBeCloseTo(1.3e-6, 12)
    })

    it('seed coolants have isCustom=false', () => {
      const state = useCoolantCatalogStore.getState()
      expect(state.coolants['water'].isCustom).toBe(false)
      expect(state.coolants['glycol-30'].isCustom).toBe(false)
      expect(state.coolants['glycol-40'].isCustom).toBe(false)
    })
  })

  describe('addCoolant', () => {
    it('creates custom coolant with isCustom=true', () => {
      const id = useCoolantCatalogStore.getState().addCoolant({
        name: 'Гликоль 50%',
        rhoKgM3: 1070,
        cKjKgK: 3.5,
        nuM2S: 2.0e-6
      })
      const state = useCoolantCatalogStore.getState()
      expect(typeof id).toBe('string')
      expect(state.coolants[id]).toBeDefined()
      expect(state.coolants[id].isCustom).toBe(true)
      expect(state.coolants[id].rhoKgM3).toBe(1070)
      expect(state.userOverrides[id]).toBeDefined()
    })

    it('count increases by 1', () => {
      const before = Object.keys(useCoolantCatalogStore.getState().coolants).length
      useCoolantCatalogStore.getState().addCoolant({ name: 'Test', rhoKgM3: 1000, cKjKgK: 4.0, nuM2S: 1e-6 })
      expect(Object.keys(useCoolantCatalogStore.getState().coolants).length).toBe(before + 1)
    })
  })

  describe('updateCoolant', () => {
    it('updating seed coolant sets isCustom=true', () => {
      useCoolantCatalogStore.getState().updateCoolant('water', { rhoKgM3: 990 })
      const state = useCoolantCatalogStore.getState()
      expect(state.coolants['water'].rhoKgM3).toBe(990)
      expect(state.coolants['water'].isCustom).toBe(true)
    })

    it('is a no-op for nonexistent id', () => {
      const before = Object.keys(useCoolantCatalogStore.getState().coolants).length
      useCoolantCatalogStore.getState().updateCoolant('nonexistent', { rhoKgM3: 0 })
      expect(Object.keys(useCoolantCatalogStore.getState().coolants).length).toBe(before)
    })
  })

  describe('deleteCoolant', () => {
    it('deleting seed coolant adds to deletedSeedIds', () => {
      useCoolantCatalogStore.getState().deleteCoolant('water')
      const state = useCoolantCatalogStore.getState()
      expect(state.coolants['water']).toBeUndefined()
      expect(state.deletedSeedIds).toContain('water')
    })

    it('deleting custom coolant does not add to deletedSeedIds', () => {
      const id = useCoolantCatalogStore.getState().addCoolant({ name: 'Custom', rhoKgM3: 999, cKjKgK: 4.0, nuM2S: 1e-6 })
      useCoolantCatalogStore.getState().deleteCoolant(id)
      expect(useCoolantCatalogStore.getState().coolants[id]).toBeUndefined()
      expect(useCoolantCatalogStore.getState().deletedSeedIds).not.toContain(id)
    })
  })

  describe('resetToSeed', () => {
    it('resets to 3 seed coolants, clears overrides', () => {
      useCoolantCatalogStore.getState().addCoolant({ name: 'Exotic', rhoKgM3: 900, cKjKgK: 2.0, nuM2S: 3e-7 })
      useCoolantCatalogStore.getState().deleteCoolant('water')

      useCoolantCatalogStore.getState().resetToSeed()

      const state = useCoolantCatalogStore.getState()
      expect(Object.keys(state.coolants).length).toBe(SEED_COOLANT_COUNT)
      expect(Object.keys(state.userOverrides)).toHaveLength(0)
      expect(state.deletedSeedIds).toHaveLength(0)
      expect(state.coolants['water']).toBeDefined()
    })
  })

  describe('persistence key isolation', () => {
    it('Test 11c: persist key is teplo-coolant-catalog', () => {
      useCoolantCatalogStore.getState().addCoolant({ name: 'Test', rhoKgM3: 1000, cKjKgK: 4.0, nuM2S: 1e-6 })
      expect(localStorage.getItem('teplo-coolant-catalog')).not.toBeNull()
      expect(localStorage.getItem('teplo-catalog')).toBeNull()
      expect(localStorage.getItem('teplo-kms-catalog')).toBeNull()
    })
  })
})
