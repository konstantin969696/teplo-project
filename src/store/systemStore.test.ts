/**
 * RED scaffold: systemStore CRUD + cascade + selectors.
 * These tests WILL FAIL until systemStore is implemented in Plan 02.
 * They define the exact contract Wave 1+ must satisfy.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useSystemStore, selectOrderedSystems } from './systemStore'
import type { HeatingSystem } from '../types/system'

beforeEach(() => {
  useSystemStore.setState({ systems: {}, systemOrder: [] })
  localStorage.clear()
})

const makeSystem = (overrides?: Partial<Omit<HeatingSystem, 'id'>>): Omit<HeatingSystem, 'id'> => ({
  name: 'Система 1',
  schemaType: 'two-pipe-dead-end',
  pipeMaterialId: 'steel-vgp-dn20',
  coolantId: 'water',
  tSupply: 80,
  tReturn: 60,
  tSupplyUfh: 45,
  tReturnUfh: 35,
  sourceLabel: '',
  ...overrides
})

describe('useSystemStore', () => {
  describe('addSystem', () => {
    it('returns string id', () => {
      const id = useSystemStore.getState().addSystem(makeSystem())
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('adds to systems record with correct fields', () => {
      const id = useSystemStore.getState().addSystem(makeSystem({ name: 'Система A' }))
      const state = useSystemStore.getState()
      expect(state.systems[id]).toBeDefined()
      expect(state.systems[id].id).toBe(id)
      expect(state.systems[id].name).toBe('Система A')
      expect(state.systems[id].tSupply).toBe(80)
    })

    it('appends id to systemOrder', () => {
      const id1 = useSystemStore.getState().addSystem(makeSystem({ name: 'A' }))
      const id2 = useSystemStore.getState().addSystem(makeSystem({ name: 'B' }))
      const state = useSystemStore.getState()
      expect(state.systemOrder).toHaveLength(2)
      expect(state.systemOrder[0]).toBe(id1)
      expect(state.systemOrder[1]).toBe(id2)
    })

    it('does not mutate previous state reference', () => {
      const stateBefore = useSystemStore.getState()
      const prevSystems = stateBefore.systems
      useSystemStore.getState().addSystem(makeSystem())
      const stateAfter = useSystemStore.getState()
      expect(stateAfter.systems).not.toBe(prevSystems)
    })
  })

  describe('updateSystem', () => {
    it('merges changes immutably', () => {
      const id = useSystemStore.getState().addSystem(makeSystem())
      const original = useSystemStore.getState().systems[id]
      useSystemStore.getState().updateSystem(id, { name: 'Новое имя', tSupply: 90 })
      const updated = useSystemStore.getState().systems[id]
      expect(updated.name).toBe('Новое имя')
      expect(updated.tSupply).toBe(90)
      expect(updated.tReturn).toBe(60) // unchanged
      expect(updated).not.toBe(original) // new reference
    })

    it('is no-op for unknown id', () => {
      useSystemStore.getState().addSystem(makeSystem())
      const before = useSystemStore.getState().systemOrder.length
      useSystemStore.getState().updateSystem('nonexistent', { name: 'X' })
      expect(useSystemStore.getState().systemOrder.length).toBe(before)
    })
  })

  describe('deleteSystem', () => {
    it('removes from systems and systemOrder', () => {
      const id1 = useSystemStore.getState().addSystem(makeSystem({ name: 'A' }))
      const id2 = useSystemStore.getState().addSystem(makeSystem({ name: 'B' }))
      useSystemStore.getState().deleteSystem(id1)
      const state = useSystemStore.getState()
      expect(state.systems[id1]).toBeUndefined()
      expect(state.systemOrder).not.toContain(id1)
      expect(state.systems[id2]).toBeDefined()
      expect(state.systemOrder).toContain(id2)
    })

    it('is NOT cascade — does not delete segments/equipment (cascade is a helper)', () => {
      // deleteSystem only removes the system entry itself.
      // cascade is handled by cascadeDeleteSystem helper (Plan 02).
      const id = useSystemStore.getState().addSystem(makeSystem())
      useSystemStore.getState().deleteSystem(id)
      // Just verify system is gone, no side effects on other stores expected here.
      expect(useSystemStore.getState().systems[id]).toBeUndefined()
    })
  })

  describe('reorderSystems', () => {
    it('replaces systemOrder array', () => {
      const id1 = useSystemStore.getState().addSystem(makeSystem({ name: 'A' }))
      const id2 = useSystemStore.getState().addSystem(makeSystem({ name: 'B' }))
      const id3 = useSystemStore.getState().addSystem(makeSystem({ name: 'C' }))
      useSystemStore.getState().reorderSystems([id3, id1, id2])
      expect(useSystemStore.getState().systemOrder).toEqual([id3, id1, id2])
    })
  })

  describe('selectOrderedSystems', () => {
    it('returns HeatingSystem[] in systemOrder order', () => {
      const id1 = useSystemStore.getState().addSystem(makeSystem({ name: 'First' }))
      const id2 = useSystemStore.getState().addSystem(makeSystem({ name: 'Second' }))
      const state = useSystemStore.getState()
      const ordered = selectOrderedSystems(state)
      expect(ordered).toHaveLength(2)
      expect(ordered[0].id).toBe(id1)
      expect(ordered[0].name).toBe('First')
      expect(ordered[1].id).toBe(id2)
      expect(ordered[1].name).toBe('Second')
    })

    it('returns empty array for empty store', () => {
      const state = useSystemStore.getState()
      expect(selectOrderedSystems(state)).toEqual([])
    })
  })
})

describe('systemStore persistence', () => {
  it('uses teplo-systems as localStorage key', () => {
    useSystemStore.getState().addSystem(makeSystem())
    const stored = localStorage.getItem('teplo-systems')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.systemOrder).toHaveLength(1)
  })

  it('persist round-trip: rehydrates from persisted state', () => {
    const id = useSystemStore.getState().addSystem(makeSystem({ tSupply: 90 }))
    const stored = localStorage.getItem('teplo-systems')!
    const parsed = JSON.parse(stored)
    useSystemStore.setState({
      systems: parsed.state.systems,
      systemOrder: parsed.state.systemOrder
    })
    const state = useSystemStore.getState()
    expect(state.systems[id].tSupply).toBe(90)
    expect(state.systemOrder).toContain(id)
  })
})
