import { describe, it, expect, beforeEach } from 'vitest'
import { useEnclosureStore, selectEnclosuresByRoom } from './enclosureStore'
import { useProjectStore } from './projectStore'
import type { Enclosure } from '../types/project'

// Reset stores before each test
beforeEach(() => {
  useEnclosureStore.setState({ enclosures: {}, enclosureOrder: [] })
  useProjectStore.setState({ rooms: {}, roomOrder: [] })
  localStorage.clear()
})

const makeEnclosure = (roomId: string, overrides?: Partial<Omit<Enclosure, 'id'>>): Omit<Enclosure, 'id'> => ({
  roomId,
  type: 'wall-ext',
  orientation: 'С',
  area: 12,
  kValue: 0.35,
  nCoeff: 1.0,
  nOverridden: false,
  adjacentRoomName: null,
  tAdjacent: null,
  perimeterOverride: null,
  zoneR: [2.1, 4.3, 8.6, 14.2],
  ...overrides
})

describe('useEnclosureStore', () => {
  describe('addEnclosure', () => {
    it('creates enclosure with crypto.randomUUID() id', () => {
      useEnclosureStore.getState().addEnclosure(makeEnclosure('room-1'))
      const state = useEnclosureStore.getState()
      const ids = state.enclosureOrder
      expect(ids).toHaveLength(1)
      expect(state.enclosures[ids[0]].id).toBeDefined()
      expect(state.enclosures[ids[0]].id.length).toBeGreaterThan(0)
    })

    it('appends id to enclosureOrder', () => {
      useEnclosureStore.getState().addEnclosure(makeEnclosure('room-1'))
      useEnclosureStore.getState().addEnclosure(makeEnclosure('room-1', { type: 'window' }))
      const state = useEnclosureStore.getState()
      expect(state.enclosureOrder).toHaveLength(2)
      expect(state.enclosures[state.enclosureOrder[0]].type).toBe('wall-ext')
      expect(state.enclosures[state.enclosureOrder[1]].type).toBe('window')
    })
  })

  describe('updateEnclosure', () => {
    it('merges partial changes immutably', () => {
      useEnclosureStore.getState().addEnclosure(makeEnclosure('room-1'))
      const id = useEnclosureStore.getState().enclosureOrder[0]
      const original = useEnclosureStore.getState().enclosures[id]
      useEnclosureStore.getState().updateEnclosure(id, { area: 20, kValue: 0.5 })
      const updated = useEnclosureStore.getState().enclosures[id]
      expect(updated.area).toBe(20)
      expect(updated.kValue).toBe(0.5)
      expect(updated.type).toBe('wall-ext') // unchanged
      expect(updated).not.toBe(original)
    })
  })

  describe('deleteEnclosure', () => {
    it('removes from enclosures record and enclosureOrder', () => {
      useEnclosureStore.getState().addEnclosure(makeEnclosure('room-1'))
      useEnclosureStore.getState().addEnclosure(makeEnclosure('room-1', { type: 'window' }))
      const ids = useEnclosureStore.getState().enclosureOrder
      useEnclosureStore.getState().deleteEnclosure(ids[0])
      const state = useEnclosureStore.getState()
      expect(state.enclosureOrder).toHaveLength(1)
      expect(state.enclosures[ids[0]]).toBeUndefined()
      expect(state.enclosures[ids[1]].type).toBe('window')
    })
  })

  describe('deleteEnclosuresByRoom', () => {
    it('removes all enclosures where roomId matches', () => {
      useEnclosureStore.getState().addEnclosure(makeEnclosure('room-1'))
      useEnclosureStore.getState().addEnclosure(makeEnclosure('room-1', { type: 'window' }))
      useEnclosureStore.getState().addEnclosure(makeEnclosure('room-2'))
      expect(useEnclosureStore.getState().enclosureOrder).toHaveLength(3)
      useEnclosureStore.getState().deleteEnclosuresByRoom('room-1')
      const state = useEnclosureStore.getState()
      expect(state.enclosureOrder).toHaveLength(1)
      expect(state.enclosures[state.enclosureOrder[0]].roomId).toBe('room-2')
    })

    it('does nothing when no enclosures match roomId', () => {
      useEnclosureStore.getState().addEnclosure(makeEnclosure('room-1'))
      useEnclosureStore.getState().deleteEnclosuresByRoom('room-999')
      expect(useEnclosureStore.getState().enclosureOrder).toHaveLength(1)
    })
  })

  describe('copyFloor', () => {
    it('creates new rooms on target floor with "(копия)" suffix', () => {
      // Set up source rooms in projectStore
      useProjectStore.setState({
        rooms: {
          'r1': { id: 'r1', name: 'Гостиная', floor: 1, area: 20, height: 2.7, isCorner: false, infiltrationMethod: 'rate', nInfiltration: 0.5, gapArea: null, windSpeed: null, lVentilation: 0 },
          'r2': { id: 'r2', name: 'Кухня', floor: 1, area: 12, height: 2.7, isCorner: true, infiltrationMethod: 'rate', nInfiltration: 0.5, gapArea: null, windSpeed: null, lVentilation: 0 },
          'r3': { id: 'r3', name: 'Ванная', floor: 2, area: 8, height: 2.7, isCorner: false, infiltrationMethod: 'rate', nInfiltration: 0.5, gapArea: null, windSpeed: null, lVentilation: 0 }
        },
        roomOrder: ['r1', 'r2', 'r3']
      })

      // Add enclosures for floor 1 rooms
      useEnclosureStore.getState().addEnclosure(makeEnclosure('r1'))
      useEnclosureStore.getState().addEnclosure(makeEnclosure('r2', { type: 'window', area: 3 }))

      // Copy floor 1 to floor 3
      useEnclosureStore.getState().copyFloor(1, 3)

      const projectState = useProjectStore.getState()
      const newRooms = Object.values(projectState.rooms).filter(r => r.floor === 3)
      expect(newRooms).toHaveLength(2)
      expect(newRooms.map(r => r.name).sort()).toEqual(['Гостиная (копия)', 'Кухня (копия)'])
    })

    it('clones all enclosures from source floor rooms with new IDs and new roomIds', () => {
      useProjectStore.setState({
        rooms: {
          'r1': { id: 'r1', name: 'Гостиная', floor: 1, area: 20, height: 2.7, isCorner: false, infiltrationMethod: 'rate', nInfiltration: 0.5, gapArea: null, windSpeed: null, lVentilation: 0 }
        },
        roomOrder: ['r1']
      })

      useEnclosureStore.getState().addEnclosure(makeEnclosure('r1'))
      useEnclosureStore.getState().addEnclosure(makeEnclosure('r1', { type: 'window', area: 3 }))

      useEnclosureStore.getState().copyFloor(1, 2)

      const encState = useEnclosureStore.getState()
      // Original 2 + cloned 2 = 4
      expect(encState.enclosureOrder).toHaveLength(4)

      // Cloned enclosures should have different IDs and point to new room
      const projectState = useProjectStore.getState()
      const newRoom = Object.values(projectState.rooms).find(r => r.floor === 2)
      expect(newRoom).toBeDefined()

      const clonedEncs = encState.enclosureOrder
        .map(id => encState.enclosures[id])
        .filter(e => e.roomId === newRoom!.id)
      expect(clonedEncs).toHaveLength(2)
      expect(clonedEncs[0].type).toBe('wall-ext')
      expect(clonedEncs[1].type).toBe('window')
    })

    it('does not modify source floor rooms or enclosures', () => {
      useProjectStore.setState({
        rooms: {
          'r1': { id: 'r1', name: 'Гостиная', floor: 1, area: 20, height: 2.7, isCorner: false, infiltrationMethod: 'rate', nInfiltration: 0.5, gapArea: null, windSpeed: null, lVentilation: 0 }
        },
        roomOrder: ['r1']
      })
      useEnclosureStore.getState().addEnclosure(makeEnclosure('r1'))

      const encBefore = { ...useEnclosureStore.getState().enclosures }
      const roomBefore = { ...useProjectStore.getState().rooms }

      useEnclosureStore.getState().copyFloor(1, 2)

      // Source enclosure unchanged
      const originalEncId = Object.keys(encBefore)[0]
      expect(useEnclosureStore.getState().enclosures[originalEncId]).toEqual(encBefore[originalEncId])
      // Source room unchanged
      expect(useProjectStore.getState().rooms['r1']).toEqual(roomBefore['r1'])
    })

    it('does nothing when source floor has no rooms', () => {
      useProjectStore.setState({ rooms: {}, roomOrder: [] })
      useEnclosureStore.getState().copyFloor(1, 2)
      expect(useProjectStore.getState().roomOrder).toHaveLength(0)
      expect(useEnclosureStore.getState().enclosureOrder).toHaveLength(0)
    })
  })
})

describe('selectEnclosuresByRoom', () => {
  it('returns only enclosures for the given roomId in order', () => {
    useEnclosureStore.getState().addEnclosure(makeEnclosure('room-1'))
    useEnclosureStore.getState().addEnclosure(makeEnclosure('room-2'))
    useEnclosureStore.getState().addEnclosure(makeEnclosure('room-1', { type: 'window' }))

    const state = useEnclosureStore.getState()
    const room1Encs = selectEnclosuresByRoom('room-1')(state)
    expect(room1Encs).toHaveLength(2)
    expect(room1Encs[0].type).toBe('wall-ext')
    expect(room1Encs[1].type).toBe('window')
    expect(room1Encs.every(e => e.roomId === 'room-1')).toBe(true)
  })

  it('returns empty array for room with no enclosures', () => {
    const state = useEnclosureStore.getState()
    const result = selectEnclosuresByRoom('nonexistent')(state)
    expect(result).toEqual([])
  })
})

describe('enclosureStore persistence', () => {
  it('uses teplo-enclosures as localStorage key', () => {
    useEnclosureStore.getState().addEnclosure(makeEnclosure('room-1'))
    // Zustand persist middleware writes to this key
    const stored = localStorage.getItem('teplo-enclosures')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.enclosureOrder).toHaveLength(1)
  })
})
