import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectsSnapshotsStore } from './projectsSnapshotsStore'
import type { ProjectSnapshot } from '../types/project'

const makeSnap = (overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  version: 1,
  project: {
    city: null,
    tInside: 20,
    rooms: {},
    roomOrder: [],
    customCities: [],
    schemaVersion: '1.1',
  },
  enclosures: { enclosures: {}, enclosureOrder: [] },
  systems: { systems: {}, systemOrder: [] },
  segments: { segments: {}, segmentOrder: [] },
  equipment: { equipment: {}, equipmentOrder: [] },
  ufhLoops: { loops: {}, loopsByRoom: {} },
  ...overrides,
})

beforeEach(() => {
  useProjectsSnapshotsStore.setState({ snapshots: {} })
  localStorage.clear()
})

describe('useProjectsSnapshotsStore', () => {
  describe('saveSnapshot', () => {
    it('stores snapshot under the given id', () => {
      const snap = makeSnap()
      useProjectsSnapshotsStore.getState().saveSnapshot('proj-1', snap)
      expect(useProjectsSnapshotsStore.getState().snapshots['proj-1']).toEqual(snap)
    })

    it('overwrites existing snapshot for same id', () => {
      useProjectsSnapshotsStore.getState().saveSnapshot('proj-1', makeSnap())
      const snap2 = makeSnap({
        project: { city: null, tInside: 22, rooms: {}, roomOrder: [], customCities: [], schemaVersion: '1.1' }
      })
      useProjectsSnapshotsStore.getState().saveSnapshot('proj-1', snap2)
      expect(useProjectsSnapshotsStore.getState().snapshots['proj-1'].project.tInside).toBe(22)
    })

    it('does not affect other snapshots', () => {
      useProjectsSnapshotsStore.getState().saveSnapshot('a', makeSnap())
      useProjectsSnapshotsStore.getState().saveSnapshot('b', makeSnap())
      expect(Object.keys(useProjectsSnapshotsStore.getState().snapshots)).toHaveLength(2)
    })
  })

  describe('getSnapshot', () => {
    it('returns saved snapshot', () => {
      const snap = makeSnap()
      useProjectsSnapshotsStore.getState().saveSnapshot('proj-1', snap)
      expect(useProjectsSnapshotsStore.getState().getSnapshot('proj-1')).toEqual(snap)
    })

    it('returns undefined for unknown id', () => {
      expect(useProjectsSnapshotsStore.getState().getSnapshot('ghost')).toBeUndefined()
    })
  })

  describe('deleteSnapshot', () => {
    it('removes the snapshot', () => {
      useProjectsSnapshotsStore.getState().saveSnapshot('proj-1', makeSnap())
      useProjectsSnapshotsStore.getState().deleteSnapshot('proj-1')
      expect(useProjectsSnapshotsStore.getState().snapshots['proj-1']).toBeUndefined()
    })

    it('no-ops on unknown id', () => {
      useProjectsSnapshotsStore.getState().saveSnapshot('proj-1', makeSnap())
      useProjectsSnapshotsStore.getState().deleteSnapshot('ghost')
      expect(useProjectsSnapshotsStore.getState().snapshots['proj-1']).toBeDefined()
    })

    it('does not affect other snapshots', () => {
      useProjectsSnapshotsStore.getState().saveSnapshot('a', makeSnap())
      useProjectsSnapshotsStore.getState().saveSnapshot('b', makeSnap())
      useProjectsSnapshotsStore.getState().deleteSnapshot('a')
      expect(useProjectsSnapshotsStore.getState().snapshots['b']).toBeDefined()
    })
  })
})
