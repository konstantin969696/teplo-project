import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useUfhLoopStore, selectLoopByRoom } from './ufhLoopStore'
import type { UfhLoop } from '../types/hydraulics'

const makeLoop = (overrides: Partial<Omit<UfhLoop, 'id'>> = {}): Omit<UfhLoop, 'id'> => ({
  roomId: 'room-1',
  systemId: 'sys-1',
  enabled: true,
  activeAreaM2: 12,
  covering: 'tile',
  pipeId: 'pe-x-16-2',
  stepCm: 20,
  leadInM: 3,
  ...overrides
})

beforeEach(() => {
  useUfhLoopStore.setState({ loops: {}, loopsByRoom: {} })
  localStorage.clear()
})

describe('useUfhLoopStore', () => {
  describe('addLoop', () => {
    it('Test 7: returns id, loop has enabled=true and activeArea', () => {
      const id = useUfhLoopStore.getState().addLoop(makeLoop())
      const state = useUfhLoopStore.getState()
      expect(typeof id).toBe('string')
      expect(state.loops[id]).toBeDefined()
      expect(state.loops[id].enabled).toBe(true)
      expect(state.loops[id].activeAreaM2).toBe(12)
      expect(state.loops[id].roomId).toBe('room-1')
    })

    it('creates loopsByRoom index entry', () => {
      const id = useUfhLoopStore.getState().addLoop(makeLoop({ roomId: 'room-2' }))
      expect(useUfhLoopStore.getState().loopsByRoom['room-2']).toBe(id)
    })

    it('second addLoop for same room returns same id (upsert)', () => {
      const id1 = useUfhLoopStore.getState().addLoop(makeLoop({ activeAreaM2: 10 }))
      const id2 = useUfhLoopStore.getState().addLoop(makeLoop({ activeAreaM2: 15 }))
      // Same room → update existing
      expect(id2).toBe(id1)
      expect(useUfhLoopStore.getState().loops[id1].activeAreaM2).toBe(15)
      expect(Object.keys(useUfhLoopStore.getState().loops)).toHaveLength(1)
    })

    it('different rooms create separate loops', () => {
      const id1 = useUfhLoopStore.getState().addLoop(makeLoop({ roomId: 'room-A' }))
      const id2 = useUfhLoopStore.getState().addLoop(makeLoop({ roomId: 'room-B' }))
      expect(id1).not.toBe(id2)
      expect(Object.keys(useUfhLoopStore.getState().loops)).toHaveLength(2)
    })
  })

  describe('updateLoop', () => {
    it('Test 8: partial update preserves other fields', () => {
      const id = useUfhLoopStore.getState().addLoop(makeLoop({ stepCm: 15 }))
      useUfhLoopStore.getState().updateLoop(id, { covering: 'laminate' })
      const loop = useUfhLoopStore.getState().loops[id]
      expect(loop.covering).toBe('laminate')
      expect(loop.stepCm).toBe(15)
      expect(loop.pipeId).toBe('pe-x-16-2')
    })

    it('is a no-op for nonexistent id', () => {
      const before = Object.keys(useUfhLoopStore.getState().loops).length
      useUfhLoopStore.getState().updateLoop('nonexistent', { stepCm: 30 })
      expect(Object.keys(useUfhLoopStore.getState().loops).length).toBe(before)
    })
  })

  describe('deleteLoop', () => {
    it('removes loop and loopsByRoom entry', () => {
      const id = useUfhLoopStore.getState().addLoop(makeLoop({ roomId: 'room-3' }))
      useUfhLoopStore.getState().deleteLoop(id)
      const state = useUfhLoopStore.getState()
      expect(state.loops[id]).toBeUndefined()
      expect(state.loopsByRoom['room-3']).toBeUndefined()
    })

    it('no-op for nonexistent id', () => {
      useUfhLoopStore.getState().addLoop(makeLoop())
      const before = Object.keys(useUfhLoopStore.getState().loops).length
      useUfhLoopStore.getState().deleteLoop('nonexistent')
      expect(Object.keys(useUfhLoopStore.getState().loops).length).toBe(before)
    })
  })

  describe('deleteLoopByRoom', () => {
    it('Test 10: cascade delete by roomId', () => {
      const id = useUfhLoopStore.getState().addLoop(makeLoop({ roomId: 'room-5' }))
      useUfhLoopStore.getState().deleteLoopByRoom('room-5')
      const state = useUfhLoopStore.getState()
      expect(state.loops[id]).toBeUndefined()
      expect(state.loopsByRoom['room-5']).toBeUndefined()
    })

    it('no-op when room has no loop', () => {
      useUfhLoopStore.getState().addLoop(makeLoop({ roomId: 'room-X' }))
      const before = Object.keys(useUfhLoopStore.getState().loops).length
      useUfhLoopStore.getState().deleteLoopByRoom('room-nonexistent')
      expect(Object.keys(useUfhLoopStore.getState().loops).length).toBe(before)
    })
  })

  describe('toggleEnabled', () => {
    it('toggles enabled flag', () => {
      const id = useUfhLoopStore.getState().addLoop(makeLoop({ enabled: true }))
      useUfhLoopStore.getState().toggleEnabled(id)
      expect(useUfhLoopStore.getState().loops[id].enabled).toBe(false)
      useUfhLoopStore.getState().toggleEnabled(id)
      expect(useUfhLoopStore.getState().loops[id].enabled).toBe(true)
    })
  })

  describe('persist key isolation', () => {
    it('persist key is teplo-ufh-loops', () => {
      useUfhLoopStore.getState().addLoop(makeLoop())
      expect(localStorage.getItem('teplo-ufh-loops')).not.toBeNull()
    })
  })
})

describe('selectLoopByRoom', () => {
  beforeEach(() => {
    useUfhLoopStore.setState({ loops: {}, loopsByRoom: {} })
  })

  it('Test 9: returns loop for roomId', () => {
    const id = useUfhLoopStore.getState().addLoop(makeLoop({ roomId: 'room-sel' }))
    const state = useUfhLoopStore.getState()
    const loop = selectLoopByRoom('room-sel')(state)
    expect(loop).not.toBeNull()
    expect(loop!.id).toBe(id)
    expect(loop!.roomId).toBe('room-sel')
  })

  it('returns null when room has no loop', () => {
    const state = useUfhLoopStore.getState()
    const loop = selectLoopByRoom('room-nonexistent')(state)
    expect(loop).toBeNull()
  })
})

describe('ufhLoopStore — comfort-ufh поля', () => {
  beforeEach(() => {
    useUfhLoopStore.setState({ loops: {}, loopsByRoom: {} })
  })

  it('addLoop проставляет дефолты mode=heating, targetFloorTempC=null', () => {
    const id = useUfhLoopStore.getState().addLoop(makeLoop())
    const loop = useUfhLoopStore.getState().loops[id]
    expect(loop.mode).toBe('heating')
    expect(loop.targetFloorTempC).toBeNull()
  })

  it('addLoop сохраняет явно заданный mode=comfort', () => {
    const id = useUfhLoopStore.getState().addLoop(makeLoop({ mode: 'comfort', targetFloorTempC: 30 }))
    const loop = useUfhLoopStore.getState().loops[id]
    expect(loop.mode).toBe('comfort')
    expect(loop.targetFloorTempC).toBe(30)
  })
})

describe('ufhLoopStore — persist migration v2 → v3', () => {
  const PERSIST_KEY = 'teplo-ufh-loops'

  afterEach(() => {
    localStorage.clear()
  })

  it('loops без mode/targetFloorTempC получают дефолты после миграции', async () => {
    // State persisted in version 2 format (no mode, no targetFloorTempC)
    localStorage.setItem(PERSIST_KEY, JSON.stringify({
      state: {
        loops: {
          'loop-old': {
            id: 'loop-old',
            roomId: 'room-1',
            systemId: 'sys-1',
            enabled: true,
            activeAreaM2: 12,
            covering: 'tile',
            pipeId: 'pe-x-16-2',
            stepCm: 20,
            leadInM: 3,
            // no mode, no targetFloorTempC
          }
        },
        loopsByRoom: { 'room-1': 'loop-old' }
      },
      version: 2
    }))

    vi.resetModules()
    const { useUfhLoopStore: freshStore } = await import('./ufhLoopStore')
    const loop = freshStore.getState().loops['loop-old']

    expect(loop).toBeDefined()
    expect(loop.mode).toBe('heating')
    expect(loop.targetFloorTempC).toBeNull()
  })
})
