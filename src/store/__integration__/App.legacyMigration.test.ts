/**
 * Integration tests for the legacy-to-registry migration logic (Phase 1).
 * Tests runRegistryMigration() in isolation — verifies that existing project
 * data is correctly registered as "Проект 1" when the registry is empty.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { runRegistryMigration } from '../../services/registryMigration'
import { useProjectStore, defaultProjectData } from '../../store/projectStore'
import { useEnclosureStore } from '../../store/enclosureStore'
import { useSystemStore } from '../../store/systemStore'
import { useProjectsRegistryStore } from '../../store/projectsRegistryStore'
import type { Room } from '../../types/project'

const testRoom: Room = {
  id: 'r1', number: 1, name: 'Комната', floor: 1, area: 15, height: 2.7,
  isCorner: false, infiltrationMethod: 'rate', nInfiltration: 0.5,
  gapArea: null, windSpeed: null, lVentilation: 0, tInside: 20,
}

beforeEach(() => {
  useProjectStore.setState({ ...defaultProjectData, activeTab: 0 })
  useEnclosureStore.setState({ enclosures: {}, enclosureOrder: [] })
  useSystemStore.setState({ systems: {}, systemOrder: [] })
  useProjectsRegistryStore.setState({ projects: {}, projectOrder: [], activeId: null })
  localStorage.clear()
})

describe('runRegistryMigration (legacy migration)', () => {
  it('registers existing rooms as "Проект 1" when registry is empty', () => {
    useProjectStore.setState({
      ...defaultProjectData,
      rooms: { r1: testRoom },
      roomOrder: ['r1'],
      city: { name: 'Москва', tOutside: -25, gsop: 4943, humidityZone: 'Б' },
    })

    runRegistryMigration()

    const { projects, projectOrder, activeId } = useProjectsRegistryStore.getState()
    expect(projectOrder).toHaveLength(1)
    const pid = projectOrder[0]
    expect(activeId).toBe(pid)
    expect(projects[pid].name).toBe('Проект 1')
    expect(projects[pid].createdAt).toBeGreaterThan(0)
  })

  it('registers when only enclosures exist (rooms may be empty)', () => {
    useEnclosureStore.getState().addEnclosure({
      roomId: 'r1', type: 'wall-ext', orientation: 'С',
      area: 12, kValue: 0.5, nCoeff: 1.0, nOverridden: false,
      adjacentRoomName: null, tAdjacent: null, perimeterOverride: null,
      zoneR: [2.1, 4.3, 8.6, 14.2], parentEnclosureId: null, constructionId: null,
    })

    runRegistryMigration()

    expect(useProjectsRegistryStore.getState().projectOrder).toHaveLength(1)
  })

  it('registers when only systems exist', () => {
    useSystemStore.getState().addSystem({
      name: 'Система 1', schemaType: 'two-pipe-dead-end',
      pipeMaterialId: 'pe-x-16-2', coolantId: 'water',
      tSupply: 80, tReturn: 60, tSupplyUfh: 45, tReturnUfh: 35, sourceLabel: '',
    })

    runRegistryMigration()

    expect(useProjectsRegistryStore.getState().projectOrder).toHaveLength(1)
  })

  it('does NOT create project when all stores are empty', () => {
    runRegistryMigration()

    const { projectOrder, activeId } = useProjectsRegistryStore.getState()
    expect(projectOrder).toHaveLength(0)
    expect(activeId).toBeNull()
  })

  it('is idempotent — does not run when registry already has a project', () => {
    useProjectStore.setState({
      ...defaultProjectData,
      rooms: { r1: testRoom },
      roomOrder: ['r1'],
    })
    useProjectsRegistryStore.getState().createProject('Существующий')
    const orderBefore = [...useProjectsRegistryStore.getState().projectOrder]

    runRegistryMigration()

    expect([...useProjectsRegistryStore.getState().projectOrder]).toEqual(orderBefore)
  })

  it('migration runs twice but only creates one project (idempotent)', () => {
    useProjectStore.setState({
      ...defaultProjectData,
      rooms: { r1: testRoom },
      roomOrder: ['r1'],
    })

    runRegistryMigration()
    runRegistryMigration()  // second call should be no-op

    expect(useProjectsRegistryStore.getState().projectOrder).toHaveLength(1)
  })
})
