import { describe, it, expect, beforeEach } from 'vitest'
import { usePipeCatalogStore, selectPipesByMaterial, SEED_PIPE_COUNT } from './pipeCatalogStore'

beforeEach(() => {
  usePipeCatalogStore.getState().resetToSeed()
  localStorage.clear()
})

describe('usePipeCatalogStore', () => {
  describe('seed initialization', () => {
    it('Test 4: loads 16+ pipe entries from seed', () => {
      const state = usePipeCatalogStore.getState()
      expect(Object.keys(state.pipes).length).toBe(SEED_PIPE_COUNT)
      expect(SEED_PIPE_COUNT).toBeGreaterThanOrEqual(16)
    })

    it('seed contains pe-x-16-2 with maxLoopLengthM=90', () => {
      const state = usePipeCatalogStore.getState()
      const pipe = state.pipes['pe-x-16-2']
      expect(pipe).toBeDefined()
      expect(pipe.material).toBe('pe-x')
      expect(pipe.innerDiameterMm).toBe(12)
      expect(pipe.maxLoopLengthM).toBe(90)
    })

    it('seed contains steel-vgp-dn20 with correct dimensions', () => {
      const state = usePipeCatalogStore.getState()
      const pipe = state.pipes['steel-vgp-dn20']
      expect(pipe).toBeDefined()
      expect(pipe.material).toBe('steel-vgp')
      expect(pipe.innerDiameterMm).toBe(20.9)
      expect(pipe.roughnessMm).toBe(0.2)
    })

    it('seed pipes have isCustom=false', () => {
      const state = usePipeCatalogStore.getState()
      expect(state.pipes['steel-vgp-dn15'].isCustom).toBe(false)
      expect(state.pipes['pe-x-16-2'].isCustom).toBe(false)
    })

    it('has steel-vgp, copper, pe-x, pe-rt, mlcp, ppr materials', () => {
      const state = usePipeCatalogStore.getState()
      const materials = new Set(Object.values(state.pipes).map(p => p.material))
      expect(materials.has('steel-vgp')).toBe(true)
      expect(materials.has('copper')).toBe(true)
      expect(materials.has('pe-x')).toBe(true)
      expect(materials.has('pe-rt')).toBe(true)
      expect(materials.has('mlcp')).toBe(true)
      expect(materials.has('ppr')).toBe(true)
    })
  })

  describe('addPipe', () => {
    it('Test 5: adds custom pipe with isCustom=true and generated id', () => {
      const id = usePipeCatalogStore.getState().addPipe({
        material: 'copper',
        dnMm: 35,
        innerDiameterMm: 32,
        roughnessMm: 0.0015,
        wallThicknessMm: 1.5,
        maxLoopLengthM: null
      })
      const state = usePipeCatalogStore.getState()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
      expect(state.pipes[id]).toBeDefined()
      expect(state.pipes[id].isCustom).toBe(true)
      expect(state.pipes[id].material).toBe('copper')
      expect(state.userOverrides[id]).toBeDefined()
    })

    it('adds custom pipe: count increases by 1', () => {
      const before = Object.keys(usePipeCatalogStore.getState().pipes).length
      usePipeCatalogStore.getState().addPipe({
        material: 'ppr',
        dnMm: 32,
        innerDiameterMm: 21,
        roughnessMm: 0.007,
        wallThicknessMm: 5.4,
        maxLoopLengthM: null
      })
      const after = Object.keys(usePipeCatalogStore.getState().pipes).length
      expect(after).toBe(before + 1)
    })
  })

  describe('updatePipe', () => {
    it('Test 6: updating seed pipe sets isCustom=true', () => {
      usePipeCatalogStore.getState().updatePipe('steel-vgp-dn15', { roughnessMm: 0.5 })
      const state = usePipeCatalogStore.getState()
      expect(state.pipes['steel-vgp-dn15'].roughnessMm).toBe(0.5)
      expect(state.pipes['steel-vgp-dn15'].isCustom).toBe(true)
      expect(state.userOverrides['steel-vgp-dn15']).toBeDefined()
    })

    it('updating non-seed (custom) pipe preserves isCustom=true', () => {
      const id = usePipeCatalogStore.getState().addPipe({
        material: 'mlcp',
        dnMm: 25,
        innerDiameterMm: 20,
        roughnessMm: 0.007,
        wallThicknessMm: 2.5,
        maxLoopLengthM: 150
      })
      usePipeCatalogStore.getState().updatePipe(id, { roughnessMm: 0.01 })
      expect(usePipeCatalogStore.getState().pipes[id].isCustom).toBe(true)
      expect(usePipeCatalogStore.getState().pipes[id].roughnessMm).toBe(0.01)
    })

    it('is a no-op for nonexistent id', () => {
      const before = Object.keys(usePipeCatalogStore.getState().pipes).length
      usePipeCatalogStore.getState().updatePipe('nonexistent', { roughnessMm: 1.0 })
      expect(Object.keys(usePipeCatalogStore.getState().pipes).length).toBe(before)
    })
  })

  describe('deletePipe', () => {
    it('Test 7: deleting seed pipe adds to deletedSeedIds', () => {
      usePipeCatalogStore.getState().deletePipe('steel-vgp-dn15')
      const state = usePipeCatalogStore.getState()
      expect(state.pipes['steel-vgp-dn15']).toBeUndefined()
      expect(state.deletedSeedIds).toContain('steel-vgp-dn15')
    })

    it('deleting custom pipe does not add to deletedSeedIds', () => {
      const id = usePipeCatalogStore.getState().addPipe({
        material: 'copper',
        dnMm: 12,
        innerDiameterMm: 10,
        roughnessMm: 0.0015,
        wallThicknessMm: 1,
        maxLoopLengthM: null
      })
      usePipeCatalogStore.getState().deletePipe(id)
      const state = usePipeCatalogStore.getState()
      expect(state.pipes[id]).toBeUndefined()
      expect(state.deletedSeedIds).not.toContain(id)
    })
  })

  describe('resetToSeed', () => {
    it('Test 8: resetToSeed clears overrides and deletions', () => {
      usePipeCatalogStore.getState().addPipe({
        material: 'pe-x',
        dnMm: 25,
        innerDiameterMm: 20,
        roughnessMm: 0.007,
        wallThicknessMm: 2.5,
        maxLoopLengthM: 150
      })
      usePipeCatalogStore.getState().deletePipe('steel-vgp-dn15')
      usePipeCatalogStore.getState().updatePipe('copper-15-1', { roughnessMm: 0.5 })

      usePipeCatalogStore.getState().resetToSeed()

      const state = usePipeCatalogStore.getState()
      expect(Object.keys(state.pipes).length).toBe(SEED_PIPE_COUNT)
      expect(Object.keys(state.userOverrides)).toHaveLength(0)
      expect(state.deletedSeedIds).toHaveLength(0)
      expect(state.pipes['steel-vgp-dn15']).toBeDefined()
      expect(state.pipes['steel-vgp-dn15'].isCustom).toBe(false)
    })
  })

  describe('persistence key isolation', () => {
    it('Test 11a: persist key is teplo-pipe-catalog (not teplo-catalog)', () => {
      usePipeCatalogStore.getState().addPipe({
        material: 'ppr',
        dnMm: 32,
        innerDiameterMm: 21,
        roughnessMm: 0.007,
        wallThicknessMm: 5.4,
        maxLoopLengthM: null
      })
      expect(localStorage.getItem('teplo-pipe-catalog')).not.toBeNull()
      expect(localStorage.getItem('teplo-catalog')).toBeNull()
    })
  })
})

describe('selectPipesByMaterial', () => {
  it('returns only pe-x pipes', () => {
    const state = usePipeCatalogStore.getState()
    const pex = selectPipesByMaterial('pe-x')(state)
    expect(pex.length).toBeGreaterThanOrEqual(2)
    expect(pex.every(p => p.material === 'pe-x')).toBe(true)
  })

  it('returns only steel-vgp pipes', () => {
    const state = usePipeCatalogStore.getState()
    const steel = selectPipesByMaterial('steel-vgp')(state)
    expect(steel.length).toBeGreaterThanOrEqual(4)
    expect(steel.every(p => p.material === 'steel-vgp')).toBe(true)
  })
})
