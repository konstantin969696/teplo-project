/**
 * Unit tests for ProjectSidebar.
 * Covers: render list, active highlight, new project dialog, inline rename,
 * delete with confirm, duplicate, mobile open/close overlay.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ProjectSidebar } from './ProjectSidebar'
import { useProjectsRegistryStore } from '../../store/projectsRegistryStore'
import { useProjectsSnapshotsStore } from '../../store/projectsSnapshotsStore'
import { useProjectStore, defaultProjectData } from '../../store/projectStore'
import { useEnclosureStore } from '../../store/enclosureStore'
import { useSystemStore } from '../../store/systemStore'
import { useSegmentStore } from '../../store/segmentStore'
import { useEquipmentStore } from '../../store/equipmentStore'
import { useUfhLoopStore } from '../../store/ufhLoopStore'

// Mock worker (ProjectSidebar transitively renders nothing that uses it, but
// some store imports chain through — mock to be safe)
vi.mock('../../workers/useEngineWorker', () => ({
  getEngineWorker: () => ({ heatLossForRooms: async () => [] }),
}))

function seedRegistry(projects: Array<{ id: string; name: string; active?: boolean }>) {
  const now = Date.now()
  const projRecord: Record<string, { id: string; name: string; createdAt: number; updatedAt: number }> = {}
  const order: string[] = []
  let activeId: string | null = null
  for (const p of projects) {
    projRecord[p.id] = { id: p.id, name: p.name, createdAt: now, updatedAt: now }
    order.push(p.id)
    if (p.active) activeId = p.id
  }
  useProjectsRegistryStore.setState({ projects: projRecord, projectOrder: order, activeId })
}

function resetAll() {
  useProjectsRegistryStore.setState({ projects: {}, projectOrder: [], activeId: null })
  useProjectsSnapshotsStore.setState({ snapshots: {} })
  useProjectStore.setState({ ...defaultProjectData, activeTab: 0 })
  useEnclosureStore.setState({ enclosures: {}, enclosureOrder: [] })
  useSystemStore.setState({ systems: {}, systemOrder: [] })
  useSegmentStore.setState({ segments: {}, segmentOrder: [] })
  useEquipmentStore.setState({ equipment: {}, equipmentOrder: [] })
  useUfhLoopStore.setState({ loops: {}, loopsByRoom: {} })
  localStorage.clear()
}

function renderSidebar(open = true) {
  const onClose = vi.fn()
  const result = render(<ProjectSidebar open={open} onClose={onClose} />)
  return { ...result, onClose }
}

beforeEach(resetAll)

describe('ProjectSidebar — render list', () => {
  it('renders all projects from registry', () => {
    seedRegistry([
      { id: 'p1', name: 'Проект A', active: true },
      { id: 'p2', name: 'Проект B' },
      { id: 'p3', name: 'Проект C' },
    ])
    renderSidebar()
    expect(screen.getByText('Проект A')).toBeDefined()
    expect(screen.getByText('Проект B')).toBeDefined()
    expect(screen.getByText('Проект C')).toBeDefined()
  })

  it('marks active project with data-testid', () => {
    seedRegistry([
      { id: 'p1', name: 'Активный', active: true },
      { id: 'p2', name: 'Неактивный' },
    ])
    renderSidebar()
    expect(screen.getByTestId('project-item-active')).toBeDefined()
    // active has aria-pressed=true
    const activeEl = screen.getByTestId('project-item-active')
    expect(activeEl.getAttribute('aria-pressed')).toBe('true')
  })

  it('renders empty list gracefully when no projects', () => {
    renderSidebar()
    const list = screen.getByTestId('project-list')
    expect(list.children).toHaveLength(0)
  })
})

describe('ProjectSidebar — new project dialog', () => {
  it('opens dialog on "+ Новый проект" click', () => {
    seedRegistry([{ id: 'p1', name: 'Проект 1', active: true }])
    renderSidebar()
    fireEvent.click(screen.getByTestId('new-project-btn'))
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByLabelText('Название проекта')).toBeDefined()
  })

  it('creates project and closes dialog on "Создать" click', () => {
    seedRegistry([{ id: 'p1', name: 'Проект 1', active: true }])
    renderSidebar()

    fireEvent.click(screen.getByTestId('new-project-btn'))
    const input = screen.getByLabelText('Название проекта')
    fireEvent.change(input, { target: { value: 'Новый' } })
    fireEvent.click(screen.getByLabelText('Создать проект'))

    // Dialog closes
    expect(screen.queryByRole('dialog')).toBeNull()
    // New project name appears in list
    expect(screen.getByText('Новый')).toBeDefined()
  })

  it('creates project on Enter key', () => {
    seedRegistry([{ id: 'p1', name: 'Проект 1', active: true }])
    renderSidebar()

    fireEvent.click(screen.getByTestId('new-project-btn'))
    const input = screen.getByLabelText('Название проекта')
    fireEvent.change(input, { target: { value: 'Enter-проект' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Enter-проект')).toBeDefined()
  })

  it('cancels dialog on "Отмена"', () => {
    seedRegistry([{ id: 'p1', name: 'Проект 1', active: true }])
    renderSidebar()

    fireEvent.click(screen.getByTestId('new-project-btn'))
    fireEvent.click(screen.getByText('Отмена'))

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('ProjectSidebar — inline rename', () => {
  it('shows input on double-click', async () => {
    seedRegistry([{ id: 'p1', name: 'Оригинал', active: true }])
    renderSidebar()

    fireEvent.dblClick(screen.getByTestId('project-item-active'))

    await waitFor(() => {
      expect(screen.getByTestId('rename-input')).toBeDefined()
    })
  })

  it('renames on blur with new value', async () => {
    seedRegistry([{ id: 'p1', name: 'Старое имя', active: true }])
    renderSidebar()

    fireEvent.dblClick(screen.getByTestId('project-item-active'))
    await waitFor(() => screen.getByTestId('rename-input'))

    const input = screen.getByTestId('rename-input')
    fireEvent.change(input, { target: { value: 'Новое имя' } })
    fireEvent.blur(input)

    expect(useProjectsRegistryStore.getState().projects['p1'].name).toBe('Новое имя')
  })

  it('cancels rename on Escape', async () => {
    seedRegistry([{ id: 'p1', name: 'Не меняй', active: true }])
    renderSidebar()

    fireEvent.dblClick(screen.getByTestId('project-item-active'))
    await waitFor(() => screen.getByTestId('rename-input'))

    const input = screen.getByTestId('rename-input')
    fireEvent.change(input, { target: { value: 'Изменённое' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(useProjectsRegistryStore.getState().projects['p1'].name).toBe('Не меняй')
  })
})

describe('ProjectSidebar — "..." menu', () => {
  it('renders menu on button click', () => {
    seedRegistry([{ id: 'p1', name: 'Проект A', active: true }])
    renderSidebar()

    fireEvent.click(screen.getByTestId('menu-btn-p1'))
    expect(screen.getByTestId('project-menu')).toBeDefined()
  })

  it('delete → confirm dialog appears → confirm → project removed', () => {
    seedRegistry([
      { id: 'p1', name: 'Удалить меня', active: true },
      { id: 'p2', name: 'Оставить', },
    ])
    renderSidebar()

    // Open menu
    fireEvent.click(screen.getByTestId('menu-btn-p1'))
    // Click delete
    fireEvent.click(screen.getByTestId('menu-delete'))
    // Confirm dialog should appear
    expect(screen.getByText(/Удалить проект «Удалить меня»/)).toBeDefined()
    // Confirm
    fireEvent.click(screen.getByText('Удалить'))

    // Project removed from registry
    expect(useProjectsRegistryStore.getState().projects['p1']).toBeUndefined()
    // Other project still there
    expect(useProjectsRegistryStore.getState().projects['p2']).toBeDefined()
  })

  it('cancel delete → project stays', () => {
    seedRegistry([
      { id: 'p1', name: 'Остаюсь', active: true },
      { id: 'p2', name: 'Второй' },
    ])
    renderSidebar()

    fireEvent.click(screen.getByTestId('menu-btn-p1'))
    fireEvent.click(screen.getByTestId('menu-delete'))
    fireEvent.click(screen.getByText('Отмена'))

    expect(useProjectsRegistryStore.getState().projects['p1']).toBeDefined()
  })

  it('duplicate → copy appears in list with "(копия)" suffix', () => {
    seedRegistry([{ id: 'p1', name: 'Оригинал', active: true }])
    renderSidebar()

    fireEvent.click(screen.getByTestId('menu-btn-p1'))
    fireEvent.click(screen.getByText('Дублировать'))

    // Check registry
    const { projectOrder, projects } = useProjectsRegistryStore.getState()
    expect(projectOrder).toHaveLength(2)
    const copyId = projectOrder.find(id => id !== 'p1')!
    expect(projects[copyId].name).toBe('Оригинал (копия)')
    // Active should NOT change
    expect(useProjectsRegistryStore.getState().activeId).toBe('p1')
  })
})

describe('ProjectSidebar — mobile overlay', () => {
  it('renders overlay when open=true', () => {
    seedRegistry([{ id: 'p1', name: 'Проект', active: true }])
    renderSidebar(true)
    expect(screen.getByTestId('sidebar-overlay')).toBeDefined()
  })

  it('does NOT render overlay when open=false', () => {
    seedRegistry([{ id: 'p1', name: 'Проект', active: true }])
    renderSidebar(false)
    expect(screen.queryByTestId('sidebar-overlay')).toBeNull()
  })

  it('calls onClose when overlay clicked', () => {
    seedRegistry([{ id: 'p1', name: 'Проект', active: true }])
    const { onClose } = renderSidebar(true)
    fireEvent.click(screen.getByTestId('sidebar-overlay'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('sidebar has -translate-x-full class when closed on mobile', () => {
    seedRegistry([{ id: 'p1', name: 'Проект', active: true }])
    renderSidebar(false)
    const sidebar = screen.getByTestId('project-sidebar')
    expect(sidebar.className).toContain('-translate-x-full')
  })

  it('sidebar has translate-x-0 class when open', () => {
    seedRegistry([{ id: 'p1', name: 'Проект', active: true }])
    renderSidebar(true)
    const sidebar = screen.getByTestId('project-sidebar')
    expect(sidebar.className).toContain('translate-x-0')
  })
})

describe('ProjectSidebar — collapse', () => {
  it('collapses to icon-only on collapse button click', () => {
    seedRegistry([{ id: 'p1', name: 'Проект A', active: true }])
    renderSidebar()

    // In expanded mode, project name is visible
    expect(screen.getByText('Проект A')).toBeDefined()

    fireEvent.click(screen.getByTestId('collapse-btn'))

    // After collapse, name text is hidden (collapsed renders badge with first letter only)
    expect(screen.queryByText('Проект A')).toBeNull()
    // Badge with 'П' should appear
    expect(screen.getByText('П')).toBeDefined()
  })
})

describe('AppHeader — project name', () => {
  it('displays active project name from registry', async () => {
    // Import AppHeader inline to test it
    const { AppHeader } = await import('./AppHeader')
    seedRegistry([{ id: 'p1', name: 'Мой Проект', active: true }])

    render(<AppHeader onMenuClick={vi.fn()} />)
    expect(screen.getByTestId('header-project-name').textContent).toBe('Мой Проект')
  })

  it('displays "Без проекта" when registry is empty', async () => {
    const { AppHeader } = await import('./AppHeader')
    render(<AppHeader onMenuClick={vi.fn()} />)
    expect(screen.getByTestId('header-project-name').textContent).toBe('Без проекта')
  })
})
