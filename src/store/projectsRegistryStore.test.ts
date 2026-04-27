import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectsRegistryStore } from './projectsRegistryStore'

beforeEach(() => {
  useProjectsRegistryStore.setState({ projects: {}, projectOrder: [], activeId: null })
  localStorage.clear()
})

describe('useProjectsRegistryStore', () => {
  describe('createProject', () => {
    it('returns a non-empty string id', () => {
      const id = useProjectsRegistryStore.getState().createProject('Проект 1')
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('adds entry to projects with correct fields', () => {
      const before = Date.now()
      const id = useProjectsRegistryStore.getState().createProject('Тестовый')
      const after = Date.now()
      const { projects } = useProjectsRegistryStore.getState()
      expect(projects[id]).toBeDefined()
      expect(projects[id].id).toBe(id)
      expect(projects[id].name).toBe('Тестовый')
      expect(projects[id].createdAt).toBeGreaterThanOrEqual(before)
      expect(projects[id].createdAt).toBeLessThanOrEqual(after)
      expect(projects[id].updatedAt).toBe(projects[id].createdAt)
    })

    it('appends to projectOrder', () => {
      const id1 = useProjectsRegistryStore.getState().createProject('A')
      const id2 = useProjectsRegistryStore.getState().createProject('B')
      const { projectOrder } = useProjectsRegistryStore.getState()
      expect(projectOrder).toHaveLength(2)
      expect(projectOrder[0]).toBe(id1)
      expect(projectOrder[1]).toBe(id2)
    })

    it('sets activeId to the new project', () => {
      const id = useProjectsRegistryStore.getState().createProject('Проект')
      expect(useProjectsRegistryStore.getState().activeId).toBe(id)
    })

    it('last created is the active one', () => {
      useProjectsRegistryStore.getState().createProject('A')
      const id2 = useProjectsRegistryStore.getState().createProject('B')
      expect(useProjectsRegistryStore.getState().activeId).toBe(id2)
    })
  })

  describe('renameProject', () => {
    it('updates name', () => {
      const id = useProjectsRegistryStore.getState().createProject('Старое')
      useProjectsRegistryStore.getState().renameProject(id, 'Новое')
      expect(useProjectsRegistryStore.getState().projects[id].name).toBe('Новое')
    })

    it('updates updatedAt', () => {
      const id = useProjectsRegistryStore.getState().createProject('Проект')
      const { createdAt } = useProjectsRegistryStore.getState().projects[id]
      // nudge time
      const before = Date.now()
      useProjectsRegistryStore.getState().renameProject(id, 'Переименованный')
      const { updatedAt } = useProjectsRegistryStore.getState().projects[id]
      expect(updatedAt).toBeGreaterThanOrEqual(before)
      expect(updatedAt).toBeGreaterThanOrEqual(createdAt)
    })

    it('no-ops on unknown id', () => {
      const id = useProjectsRegistryStore.getState().createProject('Проект')
      const snap = useProjectsRegistryStore.getState().projects[id]
      useProjectsRegistryStore.getState().renameProject('does-not-exist', 'X')
      expect(useProjectsRegistryStore.getState().projects[id]).toEqual(snap)
    })
  })

  describe('duplicateProject', () => {
    it('returns a new id', () => {
      const id = useProjectsRegistryStore.getState().createProject('Оригинал')
      const newId = useProjectsRegistryStore.getState().duplicateProject(id)
      expect(newId).not.toBe(id)
    })

    it('creates entry with "(копия)" suffix', () => {
      const id = useProjectsRegistryStore.getState().createProject('Оригинал')
      const newId = useProjectsRegistryStore.getState().duplicateProject(id)
      const { projects } = useProjectsRegistryStore.getState()
      expect(projects[newId].name).toBe('Оригинал (копия)')
    })

    it('appends to projectOrder', () => {
      const id = useProjectsRegistryStore.getState().createProject('Оригинал')
      const newId = useProjectsRegistryStore.getState().duplicateProject(id)
      const { projectOrder } = useProjectsRegistryStore.getState()
      expect(projectOrder).toContain(newId)
      expect(projectOrder.indexOf(newId)).toBeGreaterThan(projectOrder.indexOf(id))
    })

    it('does NOT change activeId', () => {
      const id = useProjectsRegistryStore.getState().createProject('Оригинал')
      useProjectsRegistryStore.getState().duplicateProject(id)
      expect(useProjectsRegistryStore.getState().activeId).toBe(id)
    })

    it('no-ops entry on unknown id', () => {
      const countBefore = Object.keys(useProjectsRegistryStore.getState().projects).length
      useProjectsRegistryStore.getState().duplicateProject('ghost-id')
      const countAfter = Object.keys(useProjectsRegistryStore.getState().projects).length
      expect(countAfter).toBe(countBefore)
    })
  })

  describe('deleteProject', () => {
    it('removes from projects and projectOrder', () => {
      const id = useProjectsRegistryStore.getState().createProject('Удалить')
      useProjectsRegistryStore.getState().deleteProject(id)
      const { projects, projectOrder } = useProjectsRegistryStore.getState()
      expect(projects[id]).toBeUndefined()
      expect(projectOrder).not.toContain(id)
    })

    it('does not affect other projects', () => {
      const id1 = useProjectsRegistryStore.getState().createProject('A')
      const id2 = useProjectsRegistryStore.getState().createProject('B')
      useProjectsRegistryStore.getState().deleteProject(id1)
      const { projects, projectOrder } = useProjectsRegistryStore.getState()
      expect(projects[id2]).toBeDefined()
      expect(projectOrder).toContain(id2)
    })

    it('sets activeId to null when deleting the only project', () => {
      const id = useProjectsRegistryStore.getState().createProject('Единственный')
      useProjectsRegistryStore.getState().deleteProject(id)
      expect(useProjectsRegistryStore.getState().activeId).toBeNull()
    })

    it('switches activeId to next project when active deleted', () => {
      const id1 = useProjectsRegistryStore.getState().createProject('A')
      const id2 = useProjectsRegistryStore.getState().createProject('B')
      // activeId is now id2 (last created)
      expect(useProjectsRegistryStore.getState().activeId).toBe(id2)
      useProjectsRegistryStore.getState().deleteProject(id2)
      // should fall back to id1 (only remaining)
      expect(useProjectsRegistryStore.getState().activeId).toBe(id1)
    })

    it('keeps activeId unchanged when non-active project deleted', () => {
      const id1 = useProjectsRegistryStore.getState().createProject('A')
      const id2 = useProjectsRegistryStore.getState().createProject('B')
      // manually set active to id1
      useProjectsRegistryStore.setState({ activeId: id1 })
      useProjectsRegistryStore.getState().deleteProject(id2)
      expect(useProjectsRegistryStore.getState().activeId).toBe(id1)
    })
  })

  describe('projectOrder', () => {
    it('reflects insertion order', () => {
      const ids = ['A', 'B', 'C'].map(n =>
        useProjectsRegistryStore.getState().createProject(n)
      )
      const { projectOrder } = useProjectsRegistryStore.getState()
      expect([...projectOrder]).toEqual(ids)
    })
  })
})
