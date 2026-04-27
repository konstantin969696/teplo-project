/**
 * Phase 2 switch-logic tests for projectsRegistryStore.
 * Verifies snapshot round-trip, duplicate, and delete-with-auto-switch.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectsRegistryStore } from './projectsRegistryStore'
import { useProjectsSnapshotsStore } from './projectsSnapshotsStore'
import { useProjectStore, defaultProjectData } from './projectStore'
import { useEnclosureStore } from './enclosureStore'
import { useSystemStore } from './systemStore'
import { useSegmentStore } from './segmentStore'
import { useEquipmentStore } from './equipmentStore'
import { useUfhLoopStore } from './ufhLoopStore'
import type { Room } from '../types/project'

function resetAll() {
  useProjectsRegistryStore.setState({ projects: {}, projectOrder: [], activeId: null })
  useProjectsSnapshotsStore.setState({ snapshots: {} })
  useProjectStore.setState({ ...defaultProjectData, activeTab: 0 })
  useEnclosureStore.setState({ enclosures: {}, enclosureOrder: [] })
  useSystemStore.setState({ systems: {}, systemOrder: [] })
  useSegmentStore.setState({ segments: {}, segmentOrder: [] })
  useEquipmentStore.setState({ equipment: {}, equipmentOrder: [] })
  useUfhLoopStore.setState({ loops: {}, loopsByRoom: {} })
}

const roomA: Room = {
  id: 'r-a', number: 1, name: 'Комната A', floor: 1, area: 20, height: 2.7,
  isCorner: false, infiltrationMethod: 'rate', nInfiltration: 0.5,
  gapArea: null, windSpeed: null, lVentilation: 0, tInside: 20,
}

const roomB: Room = {
  id: 'r-b', number: 2, name: 'Комната B', floor: 1, area: 15, height: 2.7,
  isCorner: false, infiltrationMethod: 'rate', nInfiltration: 0.5,
  gapArea: null, windSpeed: null, lVentilation: 0, tInside: 22,
}

beforeEach(() => {
  resetAll()
  localStorage.clear()
})

describe('createProject (Phase 2 — with snapshot)', () => {
  it('saves active project snapshot before creating new', () => {
    const idA = useProjectsRegistryStore.getState().createProject('A')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    useProjectsRegistryStore.getState().createProject('B')

    const snapA = useProjectsSnapshotsStore.getState().getSnapshot(idA)
    expect(snapA).toBeDefined()
    expect(snapA?.project.rooms['r-a']).toBeDefined()
  })

  it('resets working stores so new project starts blank', () => {
    useProjectsRegistryStore.getState().createProject('A')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    useProjectsRegistryStore.getState().createProject('B')

    expect(Object.keys(useProjectStore.getState().rooms)).toHaveLength(0)
  })

  it('does not save snapshot when no active project exists', () => {
    // activeId is null initially
    useProjectsRegistryStore.getState().createProject('First')
    expect(Object.keys(useProjectsSnapshotsStore.getState().snapshots)).toHaveLength(0)
  })
})

describe('switchProject', () => {
  it('round-trip: A data → create B → switch A → A data restored', () => {
    const idA = useProjectsRegistryStore.getState().createProject('A')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    useProjectsRegistryStore.getState().createProject('B')
    expect(Object.keys(useProjectStore.getState().rooms)).toHaveLength(0)

    useProjectsRegistryStore.getState().switchProject(idA)

    expect(useProjectStore.getState().rooms['r-a']).toEqual(roomA)
    expect(useProjectsRegistryStore.getState().activeId).toBe(idA)
  })

  it('round-trip: switch A → switch B restores B correctly', () => {
    const idA = useProjectsRegistryStore.getState().createProject('A')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    const idB = useProjectsRegistryStore.getState().createProject('B')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-b': roomB }, roomOrder: ['r-b'] })

    useProjectsRegistryStore.getState().switchProject(idA)
    expect(useProjectStore.getState().rooms['r-a']).toEqual(roomA)
    expect(useProjectStore.getState().rooms['r-b']).toBeUndefined()

    useProjectsRegistryStore.getState().switchProject(idB)
    expect(useProjectStore.getState().rooms['r-b']).toEqual(roomB)
    expect(useProjectStore.getState().rooms['r-a']).toBeUndefined()
    expect(useProjectsRegistryStore.getState().activeId).toBe(idB)
  })

  it('no-ops when switching to the already active project', () => {
    const idA = useProjectsRegistryStore.getState().createProject('A')
    const snapsBefore = { ...useProjectsSnapshotsStore.getState().snapshots }

    useProjectsRegistryStore.getState().switchProject(idA)

    expect(useProjectsSnapshotsStore.getState().snapshots).toEqual(snapsBefore)
    expect(useProjectsRegistryStore.getState().activeId).toBe(idA)
  })

  it('removes snapshot from store after restoring it', () => {
    const idA = useProjectsRegistryStore.getState().createProject('A')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    useProjectsRegistryStore.getState().createProject('B')
    expect(useProjectsSnapshotsStore.getState().getSnapshot(idA)).toBeDefined()

    useProjectsRegistryStore.getState().switchProject(idA)
    expect(useProjectsSnapshotsStore.getState().getSnapshot(idA)).toBeUndefined()
  })

  it('starts with empty stores if switched-to project has no snapshot', () => {
    // Manually inject a project without a snapshot
    useProjectsRegistryStore.setState({
      projects: {
        'p-ghost': { id: 'p-ghost', name: 'Ghost', createdAt: 1, updatedAt: 1 },
        'p-active': { id: 'p-active', name: 'Active', createdAt: 2, updatedAt: 2 },
      },
      projectOrder: ['p-ghost', 'p-active'],
      activeId: 'p-active',
    })
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    useProjectsRegistryStore.getState().switchProject('p-ghost')

    expect(Object.keys(useProjectStore.getState().rooms)).toHaveLength(0)
  })
})

describe('duplicateProject (Phase 2)', () => {
  it('saves active project data as snapshot of the copy', () => {
    const idA = useProjectsRegistryStore.getState().createProject('A')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    const copyId = useProjectsRegistryStore.getState().duplicateProject(idA)

    const snap = useProjectsSnapshotsStore.getState().getSnapshot(copyId)
    expect(snap?.project.rooms['r-a']).toEqual(roomA)
  })

  it('copy data is independent from original (deep clone)', () => {
    const idA = useProjectsRegistryStore.getState().createProject('A')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    const copyId = useProjectsRegistryStore.getState().duplicateProject(idA)

    // Clear working stores (simulating a switch) — copy's snapshot must not be affected
    useProjectStore.setState({ ...defaultProjectData })

    const snap = useProjectsSnapshotsStore.getState().getSnapshot(copyId)
    expect(snap?.project.rooms['r-a']).toEqual(roomA)
  })

  it('does not activate the copy (activeId unchanged)', () => {
    const idA = useProjectsRegistryStore.getState().createProject('A')
    useProjectsRegistryStore.getState().duplicateProject(idA)
    expect(useProjectsRegistryStore.getState().activeId).toBe(idA)
  })

  it('copies data of non-active project from its snapshot', () => {
    const idA = useProjectsRegistryStore.getState().createProject('A')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    const idB = useProjectsRegistryStore.getState().createProject('B')
    // A's snapshot was saved when B was created
    expect(useProjectsSnapshotsStore.getState().getSnapshot(idA)).toBeDefined()

    const copyId = useProjectsRegistryStore.getState().duplicateProject(idA)
    expect(useProjectsRegistryStore.getState().activeId).toBe(idB)

    const snap = useProjectsSnapshotsStore.getState().getSnapshot(copyId)
    expect(snap?.project.rooms['r-a']).toEqual(roomA)
  })

  it('full scenario: create → duplicate → rename copy → delete original → copy data lives', () => {
    const idA = useProjectsRegistryStore.getState().createProject('Оригинал')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    const copyId = useProjectsRegistryStore.getState().duplicateProject(idA)
    expect(useProjectsRegistryStore.getState().projects[copyId].name).toBe('Оригинал (копия)')

    useProjectsRegistryStore.getState().renameProject(copyId, 'Копия')
    expect(useProjectsRegistryStore.getState().projects[copyId].name).toBe('Копия')

    useProjectsRegistryStore.getState().deleteProject(idA)
    // idA was active, should switch to copyId
    expect(useProjectsRegistryStore.getState().activeId).toBe(copyId)
    expect(useProjectsRegistryStore.getState().projects[idA]).toBeUndefined()

    // Copy's data (roomA) should be restored in working stores
    expect(useProjectStore.getState().rooms['r-a']).toEqual(roomA)
  })
})

describe('deleteProject (Phase 2)', () => {
  it('switches to next project when active is deleted', () => {
    const idA = useProjectsRegistryStore.getState().createProject('A')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    const idB = useProjectsRegistryStore.getState().createProject('B')
    useProjectsRegistryStore.getState().switchProject(idA)
    // idA is now active with roomA data

    useProjectsRegistryStore.getState().deleteProject(idA)

    expect(useProjectsRegistryStore.getState().activeId).toBe(idB)
    expect(useProjectsRegistryStore.getState().projects[idA]).toBeUndefined()
  })

  it('discards deleted active project data (does not carry over to next)', () => {
    const idA = useProjectsRegistryStore.getState().createProject('A')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    useProjectsRegistryStore.getState().createProject('B')
    useProjectsRegistryStore.getState().switchProject(idA)

    useProjectsRegistryStore.getState().deleteProject(idA)

    // Switched to B which was empty
    expect(Object.keys(useProjectStore.getState().rooms)).toHaveLength(0)
  })

  it('creates "Проект 1" and makes it active when last project deleted', () => {
    const idA = useProjectsRegistryStore.getState().createProject('Единственный')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    useProjectsRegistryStore.getState().deleteProject(idA)

    const { projects, projectOrder, activeId } = useProjectsRegistryStore.getState()
    expect(projectOrder).toHaveLength(1)
    expect(activeId).toBe(projectOrder[0])
    expect(projects[projectOrder[0]].name).toBe('Проект 1')
    expect(projects[idA]).toBeUndefined()
    // "Проект 1" starts blank
    expect(Object.keys(useProjectStore.getState().rooms)).toHaveLength(0)
  })

  it('removes snapshot of deleted project from snapshot store', () => {
    const idA = useProjectsRegistryStore.getState().createProject('A')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    const idB = useProjectsRegistryStore.getState().createProject('B')
    // idA's snapshot is now in snapshotsStore
    expect(useProjectsSnapshotsStore.getState().getSnapshot(idA)).toBeDefined()

    useProjectsRegistryStore.getState().switchProject(idA)
    useProjectsRegistryStore.getState().deleteProject(idA)

    expect(useProjectsSnapshotsStore.getState().getSnapshot(idA)).toBeUndefined()
    expect(useProjectsRegistryStore.getState().activeId).toBe(idB)
  })

  it('does not affect working stores when non-active project deleted', () => {
    useProjectsRegistryStore.getState().createProject('A')
    useProjectStore.setState({ ...defaultProjectData, rooms: { 'r-a': roomA }, roomOrder: ['r-a'] })

    const idB = useProjectsRegistryStore.getState().createProject('B')
    const idC = useProjectsRegistryStore.getState().createProject('C')
    // B has a snapshot, C is active (empty)

    useProjectsRegistryStore.getState().deleteProject(idB)

    expect(useProjectsRegistryStore.getState().activeId).toBe(idC)
    expect(useProjectsRegistryStore.getState().projects[idB]).toBeUndefined()
    // Working stores unchanged (still empty since C is active)
    expect(Object.keys(useProjectStore.getState().rooms)).toHaveLength(0)
  })
})
