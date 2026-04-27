import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProjectStore, selectDeltaT } from './projectStore'

// Reset store before each test
beforeEach(() => {
  const store = useProjectStore.getState()
  store.resetProject()
  useProjectStore.setState({ activeTab: 0 })
  localStorage.clear()
})

describe('useProjectStore', () => {
  describe('setCity', () => {
    it('sets city data', () => {
      const city = { name: 'Москва', tOutside: -28, gsop: 4943, humidityZone: 'Б' as const }
      useProjectStore.getState().setCity(city)
      expect(useProjectStore.getState().city).toEqual(city)
    })

    it('clears city with null', () => {
      const city = { name: 'Москва', tOutside: -28, gsop: 4943, humidityZone: 'Б' as const }
      useProjectStore.getState().setCity(city)
      useProjectStore.getState().setCity(null)
      expect(useProjectStore.getState().city).toBeNull()
    })
  })

  describe('setTInside', () => {
    it('sets temperature within range', () => {
      useProjectStore.getState().setTInside(22)
      expect(useProjectStore.getState().tInside).toBe(22)
    })

    it('clamps below minimum to 10', () => {
      useProjectStore.getState().setTInside(5)
      expect(useProjectStore.getState().tInside).toBe(10)
    })

    it('clamps above maximum to 60', () => {
      useProjectStore.getState().setTInside(65)
      expect(useProjectStore.getState().tInside).toBe(60)
    })
  })

  describe('setActiveTab', () => {
    it('sets active tab index', () => {
      useProjectStore.getState().setActiveTab(3)
      expect(useProjectStore.getState().activeTab).toBe(3)
    })
  })

  describe('importJSON', () => {
    it('loads valid project data', () => {
      const data = {
        city: { name: 'Москва', tOutside: -28, gsop: 4943, humidityZone: 'Б' },
        tInside: 22,
        rooms: {},
        roomOrder: []
      }
      useProjectStore.getState().importJSON(data)
      expect(useProjectStore.getState().city?.name).toBe('Москва')
      expect(useProjectStore.getState().tInside).toBe(22)
    })

    it('rejects invalid data (does not change state)', () => {
      const city = { name: 'Москва', tOutside: -28, gsop: 4943, humidityZone: 'Б' as const }
      useProjectStore.getState().setCity(city)
      useProjectStore.getState().importJSON({ invalid: true })
      // City should remain unchanged
      expect(useProjectStore.getState().city?.name).toBe('Москва')
    })
  })

  describe('resetProject', () => {
    it('resets all project data to defaults', () => {
      const city = { name: 'Москва', tOutside: -28, gsop: 4943, humidityZone: 'Б' as const }
      useProjectStore.getState().setCity(city)
      useProjectStore.getState().setTInside(25)
      useProjectStore.getState().resetProject()
      expect(useProjectStore.getState().city).toBeNull()
      expect(useProjectStore.getState().tInside).toBe(20)
      expect(useProjectStore.getState().rooms).toEqual({})
      expect(useProjectStore.getState().roomOrder).toEqual([])
    })
  })

  describe('Room CRUD', () => {
    const sampleRoom = {
      number: 101,
      name: 'Гостиная',
      floor: 1,
      area: 20,
      height: 2.7,
      isCorner: false,
      infiltrationMethod: 'rate' as const,
      nInfiltration: 0.5,
      gapArea: null,
      windSpeed: null,
      lVentilation: 0,
      tInside: 20
    }

    it('addRoom creates room with UUID and appends to roomOrder', () => {
      useProjectStore.getState().addRoom(sampleRoom)
      const state = useProjectStore.getState()
      const ids = state.roomOrder
      expect(ids).toHaveLength(1)
      const room = state.rooms[ids[0]]
      expect(room.name).toBe('Гостиная')
      expect(room.id).toBeDefined()
      expect(room.id.length).toBeGreaterThan(0)
    })

    it('updateRoom merges changes immutably', () => {
      useProjectStore.getState().addRoom(sampleRoom)
      const id = useProjectStore.getState().roomOrder[0]
      const originalRoom = useProjectStore.getState().rooms[id]
      useProjectStore.getState().updateRoom(id, { name: 'Кухня', area: 15 })
      const updated = useProjectStore.getState().rooms[id]
      expect(updated.name).toBe('Кухня')
      expect(updated.area).toBe(15)
      expect(updated.height).toBe(2.7) // unchanged
      expect(updated).not.toBe(originalRoom) // new reference
    })

    it('deleteRoom removes from rooms and roomOrder', () => {
      useProjectStore.getState().addRoom(sampleRoom)
      useProjectStore.getState().addRoom({ ...sampleRoom, name: 'Спальня' })
      const ids = useProjectStore.getState().roomOrder
      expect(ids).toHaveLength(2)
      useProjectStore.getState().deleteRoom(ids[0])
      const state = useProjectStore.getState()
      expect(state.roomOrder).toHaveLength(1)
      expect(state.rooms[ids[0]]).toBeUndefined()
      expect(state.rooms[ids[1]].name).toBe('Спальня')
    })

    it('addRoom sets Phase 2 fields when provided', () => {
      const cornerRoom = { ...sampleRoom, isCorner: true, infiltrationMethod: 'gap' as const, gapArea: 0.01, windSpeed: 3.5 }
      useProjectStore.getState().addRoom(cornerRoom)
      const id = useProjectStore.getState().roomOrder[0]
      const room = useProjectStore.getState().rooms[id]
      expect(room.isCorner).toBe(true)
      expect(room.infiltrationMethod).toBe('gap')
      expect(room.gapArea).toBe(0.01)
      expect(room.windSpeed).toBe(3.5)
    })
  })

  describe('importJSON backward compatibility', () => {
    it('imports Phase 1 rooms without Phase 2 fields and applies defaults', () => {
      const data = {
        city: null,
        tInside: 20,
        rooms: {
          'r1': { id: 'r1', name: 'Комната', floor: 1, area: 18, height: 2.7 }
        },
        roomOrder: ['r1']
      }
      useProjectStore.getState().importJSON(data)
      const room = useProjectStore.getState().rooms['r1']
      expect(room.isCorner).toBe(false)
      expect(room.infiltrationMethod).toBe('rate')
      expect(room.nInfiltration).toBeNull()
      expect(room.gapArea).toBeNull()
      expect(room.windSpeed).toBeNull()
      expect(room.lVentilation).toBe(0)
    })
  })

  describe('Phase 04.1: schemaVersion + clearLegacyV10Fields', () => {
    it('default state has schemaVersion=1.1', () => {
      expect(useProjectStore.getState().schemaVersion).toBe('1.1')
    })

    it('resetProject preserves schemaVersion=1.1', () => {
      useProjectStore.getState().resetProject()
      expect(useProjectStore.getState().schemaVersion).toBe('1.1')
    })

    it('clearLegacyV10Fields removes legacy fields from state', () => {
      // Simulate state with legacy fields (as if migrated from v1.0)
      useProjectStore.setState({
        tSupply: 80,
        tReturn: 60,
        tSupplyUfh: 45,
        tReturnUfh: 35,
        schemaType: 'two-pipe-dead-end',
        pipeMaterialId: 'steel-vgp-dn20',
        coolantId: 'water'
      } as unknown as ReturnType<typeof useProjectStore.getState>)
      expect((useProjectStore.getState() as Record<string, unknown>).tSupply).toBe(80)

      useProjectStore.getState().clearLegacyV10Fields()

      const state = useProjectStore.getState() as Record<string, unknown>
      expect(state.tSupply).toBeUndefined()
      expect(state.tReturn).toBeUndefined()
      expect(state.tSupplyUfh).toBeUndefined()
      expect(state.tReturnUfh).toBeUndefined()
      expect(state.schemaType).toBeUndefined()
      expect(state.pipeMaterialId).toBeUndefined()
      expect(state.coolantId).toBeUndefined()
    })

    it('clearLegacyV10Fields is idempotent — second call is safe', () => {
      // Set legacy fields first, then clear twice
      useProjectStore.setState({
        tSupply: 80,
        tReturn: 60
      } as unknown as ReturnType<typeof useProjectStore.getState>)
      useProjectStore.getState().clearLegacyV10Fields()
      useProjectStore.getState().clearLegacyV10Fields()
      const state = useProjectStore.getState() as Record<string, unknown>
      expect(state.tSupply).toBeUndefined()
    })

    it('clearLegacyV10Fields не уничтожает экшены стора (F03)', () => {
      useProjectStore.getState().clearLegacyV10Fields()
      const state = useProjectStore.getState()
      expect(typeof state.addRoom).toBe('function')
      expect(typeof state.updateRoom).toBe('function')
      expect(typeof state.deleteRoom).toBe('function')
      expect(typeof state.setCity).toBe('function')
      expect(typeof state.resetProject).toBe('function')
    })

    it('persist.version is 3', () => {
      // After setCity, localStorage should have version 3
      useProjectStore.getState().setCity({ name: 'X', tOutside: -10, gsop: 3000, humidityZone: 'Б' })
      const stored = localStorage.getItem('teplo-project')
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed.version).toBe(3)
    })
  })
})

describe('persist migration v2 → v3 (floorTempThresholdC)', () => {
  const KEY = 'teplo-project'

  it('rooms без floorTempThresholdC получают null после миграции', async () => {
    localStorage.setItem(KEY, JSON.stringify({
      state: {
        city: null, tInside: 20, customCities: [], schemaVersion: '1.1',
        rooms: {
          'r1': {
            id: 'r1', number: 101, name: 'Гостиная', floor: 1, area: 20, height: 2.7,
            isCorner: false, infiltrationMethod: 'rate', nInfiltration: null,
            gapArea: null, windSpeed: null, lVentilation: 0, tInside: 20
            // нет floorTempThresholdC
          }
        },
        roomOrder: ['r1']
      },
      version: 2
    }))

    vi.resetModules()
    const { useProjectStore: freshStore } = await import('./projectStore')
    const room = freshStore.getState().rooms['r1']
    expect(room).toBeDefined()
    expect(room.floorTempThresholdC).toBeNull()
  })
})

describe('selectDeltaT', () => {
  it('returns tInside - tOutside when city is set', () => {
    const state = {
      ...useProjectStore.getState(),
      city: { name: 'Москва', tOutside: -28, gsop: 4943, humidityZone: 'Б' as const },
      tInside: 20
    }
    expect(selectDeltaT(state)).toBe(48)
  })

  it('returns null when city is null', () => {
    const state = { ...useProjectStore.getState(), city: null, tInside: 20 }
    expect(selectDeltaT(state)).toBeNull()
  })
})
