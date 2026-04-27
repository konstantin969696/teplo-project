/**
 * Unit tests for ExportDropdown import flow:
 * mode dialog, "Создать новый", "Заменить активный", cancel, no-active shortcut.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const mockImportJSON = vi.fn()
const mockExportJSON = vi.fn()
const mockCreateProject = vi.fn().mockReturnValue('new-id')

// Mutable state for per-test control
const registryState: { activeId: string | null } = { activeId: 'p1' }

vi.mock('../../store/projectStore', () => ({
  useProjectStore: (_selector: (s: unknown) => unknown) => {
    const state = { importJSON: mockImportJSON, exportJSON: mockExportJSON }
    return typeof _selector === 'function' ? _selector(state) : state
  },
}))

vi.mock('../../store/projectsRegistryStore', () => ({
  useProjectsRegistryStore: () => ({
    createProject: mockCreateProject,
    activeId: registryState.activeId,
  }),
}))

vi.mock('../../workers/useEngineWorker', () => ({
  getEngineWorker: () => ({ heatLossForRooms: async () => [] }),
}))

import { ExportDropdown } from './ExportDropdown'

const mockProjectData = { city: null, tInside: 20, rooms: {}, roomOrder: [] }

// Sets up a FileReader mock that fires onload synchronously with `data`.
function setupFileReaderMock(data: unknown) {
  let onloadFn: ((e: unknown) => void) | null = null
  const reader = {
    readAsText: vi.fn().mockImplementation(function () {
      onloadFn?.({ target: { result: JSON.stringify(data) } })
    }),
    onerror: null as unknown,
  }
  Object.defineProperty(reader, 'onload', {
    set(fn: (e: unknown) => void) { onloadFn = fn },
    get() { return onloadFn },
    configurable: true,
  })
  vi.spyOn(global, 'FileReader').mockImplementation(() => reader as unknown as FileReader)
  return reader
}

function triggerFileInput(fileName: string) {
  const input = screen.getByTestId('import-file-input')
  const file = new File(['{}'], fileName, { type: 'application/json' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
}

beforeEach(() => {
  registryState.activeId = 'p1'
  vi.clearAllMocks()
  mockCreateProject.mockReturnValue('new-id')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ExportDropdown — import mode dialog', () => {
  it('shows mode dialog when registry has an active project', async () => {
    setupFileReaderMock(mockProjectData)
    render(<ExportDropdown />)
    triggerFileInput('myproject.json')

    await waitFor(() => {
      expect(screen.getByTestId('import-mode-dialog')).toBeDefined()
    })
  })

  it('"Создать новый" — calls createProject(filename) then importJSON, closes dialog', async () => {
    setupFileReaderMock(mockProjectData)
    render(<ExportDropdown />)
    triggerFileInput('myproject.json')
    await waitFor(() => screen.getByTestId('import-mode-dialog'))

    fireEvent.click(screen.getByTestId('import-mode-new'))

    expect(mockCreateProject).toHaveBeenCalledWith('myproject')
    expect(mockImportJSON).toHaveBeenCalledWith(mockProjectData)
    expect(screen.queryByTestId('import-mode-dialog')).toBeNull()
  })

  it('"Заменить активный" — opens replace confirm dialog', async () => {
    setupFileReaderMock(mockProjectData)
    render(<ExportDropdown />)
    triggerFileInput('myproject.json')
    await waitFor(() => screen.getByTestId('import-mode-dialog'))

    fireEvent.click(screen.getByTestId('import-mode-replace'))

    expect(screen.queryByTestId('import-mode-dialog')).toBeNull()
    expect(screen.getByText('Заменить активный проект')).toBeDefined()
  })

  it('confirm replace — importJSON called without createProject', async () => {
    setupFileReaderMock(mockProjectData)
    render(<ExportDropdown />)
    triggerFileInput('myproject.json')
    await waitFor(() => screen.getByTestId('import-mode-dialog'))
    fireEvent.click(screen.getByTestId('import-mode-replace'))
    fireEvent.click(screen.getByText('Заменить'))

    expect(mockImportJSON).toHaveBeenCalledWith(mockProjectData)
    expect(mockCreateProject).not.toHaveBeenCalled()
  })

  it('cancel mode dialog — no store calls', async () => {
    setupFileReaderMock(mockProjectData)
    render(<ExportDropdown />)
    triggerFileInput('myproject.json')
    await waitFor(() => screen.getByTestId('import-mode-dialog'))

    fireEvent.click(screen.getByText('Отмена'))

    expect(screen.queryByTestId('import-mode-dialog')).toBeNull()
    expect(mockImportJSON).not.toHaveBeenCalled()
    expect(mockCreateProject).not.toHaveBeenCalled()
  })

  it('no active project — skips dialog, creates new immediately', async () => {
    registryState.activeId = null
    setupFileReaderMock(mockProjectData)
    render(<ExportDropdown />)
    triggerFileInput('autoproject.json')

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith('autoproject')
      expect(mockImportJSON).toHaveBeenCalledWith(mockProjectData)
    })
    expect(screen.queryByTestId('import-mode-dialog')).toBeNull()
  })

  it('strips .json extension from filename when passed to createProject', async () => {
    setupFileReaderMock(mockProjectData)
    render(<ExportDropdown />)
    triggerFileInput('Объект_Садовая.json')
    await waitFor(() => screen.getByTestId('import-mode-dialog'))

    fireEvent.click(screen.getByTestId('import-mode-new'))

    expect(mockCreateProject).toHaveBeenCalledWith('Объект_Садовая')
  })
})
