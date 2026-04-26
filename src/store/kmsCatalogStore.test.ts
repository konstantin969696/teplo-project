import { describe, it, expect, beforeEach } from 'vitest'
import { useKmsCatalogStore, SEED_KMS_COUNT } from './kmsCatalogStore'

beforeEach(() => {
  useKmsCatalogStore.getState().resetToSeed()
  localStorage.clear()
})

describe('useKmsCatalogStore', () => {
  describe('seed initialization', () => {
    it('Test 9: loads 10+ KMS elements from seed', () => {
      const state = useKmsCatalogStore.getState()
      expect(Object.keys(state.elements).length).toBe(SEED_KMS_COUNT)
      expect(SEED_KMS_COUNT).toBeGreaterThanOrEqual(10)
    })

    it('seed contains elbow-90-smooth with zeta=1.1', () => {
      const state = useKmsCatalogStore.getState()
      const elem = state.elements['elbow-90-smooth']
      expect(elem).toBeDefined()
      expect(elem.zeta).toBe(1.1)
      expect(elem.name).toBe('Колено 90° (гладкое)')
    })

    it('seed contains valve-ball with zeta=0.15', () => {
      const state = useKmsCatalogStore.getState()
      expect(state.elements['valve-ball'].zeta).toBe(0.15)
    })

    it('seed elements have isCustom=false', () => {
      const state = useKmsCatalogStore.getState()
      expect(state.elements['elbow-90-smooth'].isCustom).toBe(false)
      expect(state.elements['check-valve'].isCustom).toBe(false)
    })
  })

  describe('addKms', () => {
    it('creates custom KMS item with isCustom=true and generated id', () => {
      const id = useKmsCatalogStore.getState().addKms({ name: 'Кран угловой', zeta: 2.0 })
      const state = useKmsCatalogStore.getState()
      expect(typeof id).toBe('string')
      expect(state.elements[id]).toBeDefined()
      expect(state.elements[id].isCustom).toBe(true)
      expect(state.elements[id].zeta).toBe(2.0)
      expect(state.userOverrides[id]).toBeDefined()
    })

    it('count increases by 1 after addKms', () => {
      const before = Object.keys(useKmsCatalogStore.getState().elements).length
      useKmsCatalogStore.getState().addKms({ name: 'Заглушка', zeta: 0.0 })
      expect(Object.keys(useKmsCatalogStore.getState().elements).length).toBe(before + 1)
    })
  })

  describe('updateKms', () => {
    it('updating seed element sets isCustom=true', () => {
      useKmsCatalogStore.getState().updateKms('elbow-90-smooth', { zeta: 1.2 })
      const state = useKmsCatalogStore.getState()
      expect(state.elements['elbow-90-smooth'].zeta).toBe(1.2)
      expect(state.elements['elbow-90-smooth'].isCustom).toBe(true)
    })

    it('is a no-op for nonexistent id', () => {
      const before = Object.keys(useKmsCatalogStore.getState().elements).length
      useKmsCatalogStore.getState().updateKms('nonexistent', { zeta: 99 })
      expect(Object.keys(useKmsCatalogStore.getState().elements).length).toBe(before)
    })
  })

  describe('deleteKms', () => {
    it('deleting seed element adds to deletedSeedIds', () => {
      useKmsCatalogStore.getState().deleteKms('valve-ball')
      const state = useKmsCatalogStore.getState()
      expect(state.elements['valve-ball']).toBeUndefined()
      expect(state.deletedSeedIds).toContain('valve-ball')
    })

    it('deleting custom element does not add to deletedSeedIds', () => {
      const id = useKmsCatalogStore.getState().addKms({ name: 'Кастомный', zeta: 1.0 })
      useKmsCatalogStore.getState().deleteKms(id)
      expect(useKmsCatalogStore.getState().elements[id]).toBeUndefined()
      expect(useKmsCatalogStore.getState().deletedSeedIds).not.toContain(id)
    })
  })

  describe('resetToSeed', () => {
    it('resets to seed: clears overrides and deletions', () => {
      useKmsCatalogStore.getState().addKms({ name: 'Custom', zeta: 99 })
      useKmsCatalogStore.getState().deleteKms('valve-ball')

      useKmsCatalogStore.getState().resetToSeed()

      const state = useKmsCatalogStore.getState()
      expect(Object.keys(state.elements).length).toBe(SEED_KMS_COUNT)
      expect(Object.keys(state.userOverrides)).toHaveLength(0)
      expect(state.deletedSeedIds).toHaveLength(0)
      expect(state.elements['valve-ball']).toBeDefined()
    })
  })

  describe('persistence key isolation', () => {
    it('Test 11b: persist key is teplo-kms-catalog', () => {
      useKmsCatalogStore.getState().addKms({ name: 'Test', zeta: 1.0 })
      expect(localStorage.getItem('teplo-kms-catalog')).not.toBeNull()
      expect(localStorage.getItem('teplo-catalog')).toBeNull()
      expect(localStorage.getItem('teplo-pipe-catalog')).toBeNull()
    })
  })
})
