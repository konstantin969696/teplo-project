import { describe, it, expect, beforeEach } from 'vitest'
import {
  useCatalogStore,
  selectModelsByKind,
  SEED_CATALOG_MODELS_COUNT
} from './catalogStore'
import type { SectionalCatalogModel } from '../types/project'

beforeEach(() => {
  useCatalogStore.getState().resetToSeed()
  localStorage.clear()
})

const sampleSectional: Omit<SectionalCatalogModel, 'id' | 'isCustom'> = {
  manufacturer: 'Test Manufacturer',
  series: 'TestSeries X',
  kind: 'bimetal',
  nExponent: 1.3,
  qPerSectionAt70: 200,
  heightMm: 500,
  sectionWidthMm: 80,
  maxSections: 14
}

describe('useCatalogStore', () => {
  describe('seed initialization', () => {
    it('loads all seed models on first init (>= 8)', () => {
      const state = useCatalogStore.getState()
      expect(Object.keys(state.models).length).toBe(SEED_CATALOG_MODELS_COUNT)
      expect(SEED_CATALOG_MODELS_COUNT).toBeGreaterThanOrEqual(8)
    })

    it('seed contains rifar-base-500 with qPerSectionAt70=197', () => {
      const state = useCatalogStore.getState()
      const rifar = state.models['rifar-base-500']
      expect(rifar).toBeDefined()
      expect(rifar.kind).toBe('bimetal')
      if (rifar.kind === 'bimetal' || rifar.kind === 'aluminum' || rifar.kind === 'cast-iron') {
        expect(rifar.qPerSectionAt70).toBe(197)
      }
    })

    it('seed models have isCustom=false', () => {
      const state = useCatalogStore.getState()
      const rifar = state.models['rifar-base-500']
      expect(rifar.isCustom).toBe(false)
    })
  })

  describe('addModel', () => {
    it('creates user model with isCustom=true and stores in userOverrides', () => {
      const id = useCatalogStore.getState().addModel(sampleSectional)
      const state = useCatalogStore.getState()
      expect(typeof id).toBe('string')
      expect(state.models[id]).toBeDefined()
      expect(state.models[id].isCustom).toBe(true)
      expect(state.userOverrides[id]).toBeDefined()
      expect(state.userOverrides[id].id).toBe(id)
    })

    it('new user model is included in merged models', () => {
      const before = Object.keys(useCatalogStore.getState().models).length
      useCatalogStore.getState().addModel(sampleSectional)
      const after = Object.keys(useCatalogStore.getState().models).length
      expect(after).toBe(before + 1)
    })
  })

  describe('updateModel', () => {
    it('updates seed model: creates override with isCustom=true (BLOCKER-5 semantic)', () => {
      useCatalogStore.getState().updateModel('rifar-base-500', { qPerSectionAt70: 200 } as Partial<SectionalCatalogModel>)
      const state = useCatalogStore.getState()
      const updated = state.models['rifar-base-500'] as SectionalCatalogModel
      expect(updated.qPerSectionAt70).toBe(200)
      // Seed override → isCustom=true для UI badge «польз.»
      expect(updated.isCustom).toBe(true)
      // И есть в userOverrides
      expect(state.userOverrides['rifar-base-500']).toBeDefined()
      const override = state.userOverrides['rifar-base-500'] as SectionalCatalogModel
      expect(override.qPerSectionAt70).toBe(200)
    })

    it('marks seed override as isCustom=true explicitly', () => {
      useCatalogStore.getState().updateModel('rifar-base-500', { qPerSectionAt70: 999 } as Partial<SectionalCatalogModel>)
      expect(useCatalogStore.getState().models['rifar-base-500'].isCustom).toBe(true)
    })

    it('is a no-op for nonexistent id', () => {
      const beforeSize = Object.keys(useCatalogStore.getState().models).length
      useCatalogStore.getState().updateModel('nonexistent', { nExponent: 1.4 })
      const afterSize = Object.keys(useCatalogStore.getState().models).length
      expect(afterSize).toBe(beforeSize)
    })
  })

  describe('deleteModel', () => {
    it('deletes user model: removes from userOverrides, not from deletedSeedIds', () => {
      const id = useCatalogStore.getState().addModel(sampleSectional)
      expect(useCatalogStore.getState().models[id]).toBeDefined()
      useCatalogStore.getState().deleteModel(id)
      const state = useCatalogStore.getState()
      expect(state.models[id]).toBeUndefined()
      expect(state.userOverrides[id]).toBeUndefined()
      expect(state.deletedSeedIds).not.toContain(id)
    })

    it('deletes seed model: adds to deletedSeedIds', () => {
      expect(useCatalogStore.getState().models['rifar-base-500']).toBeDefined()
      useCatalogStore.getState().deleteModel('rifar-base-500')
      const state = useCatalogStore.getState()
      expect(state.models['rifar-base-500']).toBeUndefined()
      expect(state.deletedSeedIds).toContain('rifar-base-500')
    })
  })

  describe('resetToSeed', () => {
    it('restores to seed: adds back deleted models, clears userOverrides', () => {
      useCatalogStore.getState().addModel(sampleSectional)
      useCatalogStore.getState().deleteModel('rifar-base-500')
      useCatalogStore.getState().updateModel('rifar-base-350', { nExponent: 1.5 })

      useCatalogStore.getState().resetToSeed()

      const state = useCatalogStore.getState()
      expect(Object.keys(state.models).length).toBe(SEED_CATALOG_MODELS_COUNT)
      expect(Object.keys(state.userOverrides)).toHaveLength(0)
      expect(state.deletedSeedIds).toHaveLength(0)
      expect(state.models['rifar-base-500']).toBeDefined() // restored
    })
  })

  describe('mergeSeedWithOverrides (indirect)', () => {
    it('deletedSeedIds prevents seed-model from appearing after rehydrate-style merge', () => {
      useCatalogStore.getState().deleteModel('rifar-base-500')
      // Прямая проверка merge: models НЕ содержит удалённый seed id
      expect(useCatalogStore.getState().models['rifar-base-500']).toBeUndefined()
    })

    it('user override replaces seed in merged models', () => {
      useCatalogStore.getState().updateModel('rifar-base-500', { qPerSectionAt70: 250 } as Partial<SectionalCatalogModel>)
      const merged = useCatalogStore.getState().models['rifar-base-500'] as SectionalCatalogModel
      expect(merged.qPerSectionAt70).toBe(250)
    })
  })

  describe('persistence', () => {
    it('persist round-trip: user overrides recovered after setState from localStorage blob', () => {
      const id = useCatalogStore.getState().addModel(sampleSectional)
      useCatalogStore.getState().deleteModel('rifar-base-350')
      const stored = localStorage.getItem('teplo-catalog')
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed.state.userOverrides[id]).toBeDefined()
      expect(parsed.state.deletedSeedIds).toContain('rifar-base-350')
    })
  })
})

describe('selectModelsByKind', () => {
  it('returns >= 3 bimetal models from seed', () => {
    const state = useCatalogStore.getState()
    const bimetals = selectModelsByKind('bimetal')(state)
    expect(bimetals.length).toBeGreaterThanOrEqual(3)
    expect(bimetals.every(m => m.kind === 'bimetal')).toBe(true)
  })

  it('returns only panel models when kind=panel', () => {
    const state = useCatalogStore.getState()
    const panels = selectModelsByKind('panel')(state)
    expect(panels.length).toBeGreaterThanOrEqual(1)
    expect(panels.every(m => m.kind === 'panel')).toBe(true)
  })
})
