import { describe, it, expect, beforeEach } from 'vitest'
import { collectSnapshot, restoreSnapshot, resetAllStores, runRegistryMigration } from './projectSnapshot'
import { useProjectStore, defaultProjectData } from '../store/projectStore'
import { useEnclosureStore, defaultEnclosureData } from '../store/enclosureStore'
import { useSystemStore, defaultSystemData } from '../store/systemStore'
import { useSegmentStore, defaultSegmentData } from '../store/segmentStore'
import { useEquipmentStore, defaultEquipmentData } from '../store/equipmentStore'
import { useUfhLoopStore, defaultUfhLoopData } from '../store/ufhLoopStore'
import { useProjectsRegistryStore } from '../store/projectsRegistryStore'
import type { Room, Enclosure } from '../types/project'

const baseRoom: Room = {
  id: 'r1', number: 1, name: 'Зал', floor: 1, area: 20, height: 2.7,
  isCorner: false, infiltrationMethod: 'rate', nInfiltration: 0.5,
  gapArea: null, windSpeed: null, lVentilation: 0, tInside: 20,
}

const baseEnclosure: Omit<Enclosure, 'id'> = {
  roomId: 'r1', type: 'wall-ext', orientation: 'С',
  area: 10, kValue: 0.5, nCoeff: 1.0, nOverridden: false,
  adjacentRoomName: null, tAdjacent: null, perimeterOverride: null,
  zoneR: [2.1, 4.3, 8.6, 14.2], parentEnclosureId: null, constructionId: null,
}

function seedStores() {
  useProjectStore.setState({
    ...defaultProjectData,
    city: { name: 'Москва', tOutside: -25, gsop: 4943, humidityZone: 'Б' },
    tInside: 21,
    rooms: { r1: baseRoom },
    roomOrder: ['r1'],
  })
  useEnclosureStore.getState().addEnclosure(baseEnclosure)
}

beforeEach(() => {
  useProjectStore.setState({ ...defaultProjectData, activeTab: 0 })
  useEnclosureStore.setState({ enclosures: {}, enclosureOrder: [] })
  useSystemStore.setState({ systems: {}, systemOrder: [] })
  useSegmentStore.setState({ segments: {}, segmentOrder: [] })
  useEquipmentStore.setState({ equipment: {}, equipmentOrder: [] })
  useUfhLoopStore.setState({ loops: {}, loopsByRoom: {} })
  useProjectsRegistryStore.setState({ projects: {}, projectOrder: [], activeId: null })
  localStorage.clear()
})

describe('collectSnapshot', () => {
  it('captures project data', () => {
    seedStores()
    const snap = collectSnapshot()
    expect(snap.version).toBe(1)
    expect(snap.project.tInside).toBe(21)
    expect(snap.project.rooms['r1']).toEqual(baseRoom)
    expect(snap.project.city?.name).toBe('Москва')
  })

  it('captures enclosures', () => {
    seedStores()
    const snap = collectSnapshot()
    const encIds = Object.keys(snap.enclosures.enclosures)
    expect(encIds).toHaveLength(1)
    expect(snap.enclosures.enclosures[encIds[0]].roomId).toBe('r1')
  })

  it('captures empty stores correctly', () => {
    const snap = collectSnapshot()
    expect(snap.project.rooms).toEqual({})
    expect(Object.keys(snap.enclosures.enclosures)).toHaveLength(0)
    expect(Object.keys(snap.systems.systems)).toHaveLength(0)
  })
})

describe('restoreSnapshot + collectSnapshot round-trip', () => {
  it('restores project data exactly', () => {
    seedStores()
    const snap = collectSnapshot()

    // clear stores then restore
    useProjectStore.setState({ ...defaultProjectData, activeTab: 0 })
    useEnclosureStore.setState({ enclosures: {}, enclosureOrder: [] })

    restoreSnapshot(snap)

    const after = collectSnapshot()
    expect(after.project.tInside).toBe(snap.project.tInside)
    expect(after.project.rooms).toEqual(snap.project.rooms)
    expect(after.project.city).toEqual(snap.project.city)
  })

  it('restores enclosures exactly', () => {
    seedStores()
    const snap = collectSnapshot()

    useEnclosureStore.setState({ enclosures: {}, enclosureOrder: [] })
    restoreSnapshot(snap)

    const after = collectSnapshot()
    expect(after.enclosures.enclosures).toEqual(snap.enclosures.enclosures)
    expect([...after.enclosures.enclosureOrder]).toEqual([...snap.enclosures.enclosureOrder])
  })

  it('full round-trip: collect → restore → collect yields equal snapshots', () => {
    seedStores()
    const snap1 = collectSnapshot()

    resetAllStores()
    restoreSnapshot(snap1)
    const snap2 = collectSnapshot()

    expect(snap2.project).toEqual(snap1.project)
    expect(snap2.enclosures).toEqual(snap1.enclosures)
    expect(snap2.systems).toEqual(snap1.systems)
    expect(snap2.segments).toEqual(snap1.segments)
    expect(snap2.equipment).toEqual(snap1.equipment)
    expect(snap2.ufhLoops).toEqual(snap1.ufhLoops)
  })
})

describe('resetAllStores', () => {
  it('resets projectStore to defaults', () => {
    seedStores()
    resetAllStores()
    const p = useProjectStore.getState()
    expect(p.rooms).toEqual(defaultProjectData.rooms)
    expect(p.roomOrder).toEqual([...defaultProjectData.roomOrder])
    expect(p.city).toBeNull()
    expect(p.tInside).toBe(defaultProjectData.tInside)
  })

  it('resets enclosureStore to defaults', () => {
    seedStores()
    resetAllStores()
    const enc = useEnclosureStore.getState()
    expect(enc.enclosures).toEqual(defaultEnclosureData.enclosures)
    expect([...enc.enclosureOrder]).toEqual(defaultEnclosureData.enclosureOrder)
  })

  it('resets all 6 stores', () => {
    seedStores()
    resetAllStores()
    expect(Object.keys(useEnclosureStore.getState().enclosures)).toHaveLength(0)
    expect(Object.keys(useSystemStore.getState().systems)).toHaveLength(0)
    expect(Object.keys(useSegmentStore.getState().segments)).toHaveLength(0)
    expect(Object.keys(useEquipmentStore.getState().equipment)).toHaveLength(0)
    expect(Object.keys(useUfhLoopStore.getState().loops)).toHaveLength(0)
    expect(Object.keys(useProjectStore.getState().rooms)).toHaveLength(0)
    // verify defaults match exactly
    expect(useSegmentStore.getState().segments).toEqual(defaultSegmentData.segments)
    expect(useEquipmentStore.getState().equipment).toEqual(defaultEquipmentData.equipment)
    expect(useUfhLoopStore.getState().loops).toEqual(defaultUfhLoopData.loops)
  })
})

describe('runRegistryMigration', () => {
  it('creates "Проект 1" and sets activeId when registry is empty and data exists', () => {
    seedStores()
    runRegistryMigration()
    const { projects, projectOrder, activeId } = useProjectsRegistryStore.getState()
    expect(projectOrder).toHaveLength(1)
    expect(activeId).toBe(projectOrder[0])
    expect(projects[projectOrder[0]].name).toBe('Проект 1')
  })

  it('does not create project when registry already has projects', () => {
    seedStores()
    useProjectsRegistryStore.getState().createProject('Уже есть')
    const orderBefore = [...useProjectsRegistryStore.getState().projectOrder]
    runRegistryMigration()
    const orderAfter = [...useProjectsRegistryStore.getState().projectOrder]
    expect(orderAfter).toEqual(orderBefore)
  })

  it('does not create project when stores are empty', () => {
    // no seedStores()
    runRegistryMigration()
    expect(useProjectsRegistryStore.getState().projectOrder).toHaveLength(0)
    expect(useProjectsRegistryStore.getState().activeId).toBeNull()
  })
})
