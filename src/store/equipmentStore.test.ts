import { describe, it, expect, beforeEach } from 'vitest'
import { useEquipmentStore, selectEquipmentByRoom } from './equipmentStore'
import type { Equipment } from '../types/project'

beforeEach(() => {
  useEquipmentStore.setState({ equipment: {}, equipmentOrder: [] })
  localStorage.clear()
})

const makeEquipment = (roomId: string, overrides?: Partial<Omit<Equipment, 'id'>>): Omit<Equipment, 'id'> => ({
  roomId,
  systemId: 'sys-1',
  kind: 'bimetal',
  catalogModelId: 'rifar-base-500',
  connection: 'side',
  installation: 'open',
  panelType: null,
  panelHeightMm: null,
  panelLengthMm: null,
  sectionsOverride: null,
  convectorLengthMm: null,
  manualQNominal: null,
  manualNExponent: null,
  ...overrides
})

describe('useEquipmentStore', () => {
  describe('addEquipment', () => {
    it('creates equipment with crypto.randomUUID() id', () => {
      const id = useEquipmentStore.getState().addEquipment(makeEquipment('room-1'))
      const state = useEquipmentStore.getState()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
      expect(state.equipmentOrder).toHaveLength(1)
      expect(state.equipment[id].id).toBe(id)
      expect(state.equipment[id].roomId).toBe('room-1')
    })

    it('appends id to equipmentOrder', () => {
      useEquipmentStore.getState().addEquipment(makeEquipment('room-1'))
      useEquipmentStore.getState().addEquipment(makeEquipment('room-1', { kind: 'panel' }))
      const state = useEquipmentStore.getState()
      expect(state.equipmentOrder).toHaveLength(2)
      expect(state.equipment[state.equipmentOrder[0]].kind).toBe('bimetal')
      expect(state.equipment[state.equipmentOrder[1]].kind).toBe('panel')
    })

    it('returns the new id (not void)', () => {
      const result = useEquipmentStore.getState().addEquipment(makeEquipment('room-1'))
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('updateEquipment', () => {
    it('merges partial changes immutably', () => {
      const id = useEquipmentStore.getState().addEquipment(makeEquipment('room-1'))
      const original = useEquipmentStore.getState().equipment[id]
      useEquipmentStore.getState().updateEquipment(id, { sectionsOverride: 10 })
      const updated = useEquipmentStore.getState().equipment[id]
      expect(updated.sectionsOverride).toBe(10)
      expect(updated.kind).toBe('bimetal') // unchanged
      expect(updated.roomId).toBe('room-1') // unchanged
      expect(updated).not.toBe(original) // new reference (immutability)
    })

    it('is a no-op for nonexistent id', () => {
      useEquipmentStore.getState().updateEquipment('nonexistent', { sectionsOverride: 5 })
      expect(Object.keys(useEquipmentStore.getState().equipment)).toHaveLength(0)
    })
  })

  describe('deleteEquipment', () => {
    it('removes from equipment record and equipmentOrder', () => {
      const id1 = useEquipmentStore.getState().addEquipment(makeEquipment('room-1'))
      const id2 = useEquipmentStore.getState().addEquipment(makeEquipment('room-1', { kind: 'panel' }))
      useEquipmentStore.getState().deleteEquipment(id1)
      const state = useEquipmentStore.getState()
      expect(state.equipmentOrder).toHaveLength(1)
      expect(state.equipment[id1]).toBeUndefined()
      expect(state.equipment[id2].kind).toBe('panel')
    })
  })

  describe('deleteEquipmentByRoom', () => {
    it('removes all equipment where roomId matches (cascade)', () => {
      useEquipmentStore.getState().addEquipment(makeEquipment('room-A'))
      useEquipmentStore.getState().addEquipment(makeEquipment('room-A', { kind: 'panel' }))
      useEquipmentStore.getState().addEquipment(makeEquipment('room-A', { kind: 'cast-iron' }))
      useEquipmentStore.getState().addEquipment(makeEquipment('room-B'))
      useEquipmentStore.getState().addEquipment(makeEquipment('room-B', { kind: 'aluminum' }))
      expect(useEquipmentStore.getState().equipmentOrder).toHaveLength(5)

      useEquipmentStore.getState().deleteEquipmentByRoom('room-A')

      const state = useEquipmentStore.getState()
      expect(state.equipmentOrder).toHaveLength(2)
      const remaining = state.equipmentOrder.map(id => state.equipment[id])
      expect(remaining.every(e => e.roomId === 'room-B')).toBe(true)
    })

    it('does nothing when no equipment matches roomId (no-op for zombie roomId)', () => {
      useEquipmentStore.getState().addEquipment(makeEquipment('room-1'))
      const before = useEquipmentStore.getState()
      useEquipmentStore.getState().deleteEquipmentByRoom('room-zombie')
      const after = useEquipmentStore.getState()
      expect(after.equipmentOrder).toEqual(before.equipmentOrder)
      expect(after.equipment).toEqual(before.equipment)
    })
  })
})

describe('selectEquipmentByRoom', () => {
  it('returns only equipment for the given roomId in order', () => {
    useEquipmentStore.getState().addEquipment(makeEquipment('room-A'))
    useEquipmentStore.getState().addEquipment(makeEquipment('room-B'))
    useEquipmentStore.getState().addEquipment(makeEquipment('room-A', { kind: 'panel' }))

    const state = useEquipmentStore.getState()
    const roomA = selectEquipmentByRoom('room-A')(state)
    expect(roomA).toHaveLength(2)
    expect(roomA[0].kind).toBe('bimetal')
    expect(roomA[1].kind).toBe('panel')
    expect(roomA.every(e => e.roomId === 'room-A')).toBe(true)
  })

  it('returns empty array for room with no equipment', () => {
    const state = useEquipmentStore.getState()
    expect(selectEquipmentByRoom('nonexistent')(state)).toEqual([])
  })
})

describe('equipmentStore persistence', () => {
  it('uses teplo-equipment as localStorage key', () => {
    useEquipmentStore.getState().addEquipment(makeEquipment('room-1'))
    const stored = localStorage.getItem('teplo-equipment')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.equipmentOrder).toHaveLength(1)
  })

  it('persist round-trip: rehydrates equipment from persisted state', () => {
    const id = useEquipmentStore.getState().addEquipment(makeEquipment('room-1', { sectionsOverride: 8 }))
    const stored = localStorage.getItem('teplo-equipment')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    // Simulate rehydrate: set state from partialize blob (merge, not replace —
    // иначе стираются экшены, так как Zustand хранит их в том же state-объекте)
    useEquipmentStore.setState({
      equipment: parsed.state.equipment,
      equipmentOrder: parsed.state.equipmentOrder
    })
    const state = useEquipmentStore.getState()
    expect(state.equipment[id].sectionsOverride).toBe(8)
    expect(state.equipmentOrder).toContain(id)
  })
})
