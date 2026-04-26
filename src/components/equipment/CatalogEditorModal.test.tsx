/**
 * Integration tests for CatalogEditorModal.
 * Cover: open/close, add flow, validation (Save disabled), delete seed → deletedSeedIds,
 *        resetToSeed, BLOCKER-4 populate form on row click + update without changes.
 * Zustand stores are reset between tests via resetToSeed/clear.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { CatalogEditorModal } from './CatalogEditorModal'
import { useCatalogStore } from '../../store/catalogStore'

// Silence sonner toasts in test output
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

beforeEach(() => {
  act(() => {
    useCatalogStore.getState().resetToSeed()
  })
  // window.confirm returns true by default — мы тестируем «positive» path
  vi.spyOn(window, 'confirm').mockImplementation(() => true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CatalogEditorModal', () => {
  it('returns null when open=false', () => {
    const { container } = render(<CatalogEditorModal open={false} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders header and form fields when open=true', () => {
    render(<CatalogEditorModal open={true} onClose={() => {}} />)
    expect(screen.getByText('Каталог приборов')).toBeInTheDocument()
    expect(screen.getByLabelText('Производитель')).toBeInTheDocument()
    expect(screen.getByLabelText('Серия')).toBeInTheDocument()
    expect(screen.getByLabelText('Показатель n')).toBeInTheDocument()
  })

  it('adds a new model via the form (Save → addModel → isCustom=true)', () => {
    render(<CatalogEditorModal open={true} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('Производитель'), {
      target: { value: 'TestBrand' },
    })
    fireEvent.change(screen.getByLabelText('Серия'), {
      target: { value: 'Model-X-500' },
    })

    const saveBtn = screen.getByRole('button', { name: /Добавить$/i })
    expect(saveBtn).not.toBeDisabled()

    act(() => {
      fireEvent.click(saveBtn)
    })

    const models = Object.values(useCatalogStore.getState().models)
    const added = models.find(m => m.manufacturer === 'TestBrand' && m.series === 'Model-X-500')
    expect(added).toBeDefined()
    expect(added?.isCustom).toBe(true)
  })

  it('disables Save button when required fields are empty or invalid', () => {
    render(<CatalogEditorModal open={true} onClose={() => {}} />)
    // EMPTY_FORM defaults — manufacturer/series are empty → invalid
    const saveBtn = screen.getByRole('button', { name: /Добавить$/i })
    expect(saveBtn).toBeDisabled()

    // Fill only manufacturer — still invalid (series missing)
    fireEvent.change(screen.getByLabelText('Производитель'), { target: { value: 'X' } })
    expect(saveBtn).toBeDisabled()
  })

  it('adds seed model id to deletedSeedIds when seed is deleted via trash button', () => {
    render(<CatalogEditorModal open={true} onClose={() => {}} />)
    // Rifar Base 500 — seed model
    const delBtn = screen.getByRole('button', { name: /Удалить Base 500/i })
    act(() => {
      fireEvent.click(delBtn)
    })
    expect(useCatalogStore.getState().deletedSeedIds).toContain('rifar-base-500')
  })

  it('resets catalog via "Сбросить к умолчанию"', () => {
    // Сначала добавим пользовательскую модель
    act(() => {
      useCatalogStore.getState().addModel({
        kind: 'bimetal',
        manufacturer: 'TempBrand',
        series: 'Temp-500',
        nExponent: 1.3,
        qPerSectionAt70: 150,
        heightMm: 500,
        sectionWidthMm: 80,
        maxSections: 14,
      })
    })
    expect(Object.keys(useCatalogStore.getState().userOverrides).length).toBe(1)

    render(<CatalogEditorModal open={true} onClose={() => {}} />)
    const resetBtn = screen.getByRole('button', { name: /Сбросить к умолчанию/i })
    act(() => {
      fireEvent.click(resetBtn)
    })

    expect(Object.keys(useCatalogStore.getState().userOverrides).length).toBe(0)
    expect(useCatalogStore.getState().deletedSeedIds).toEqual([])
  })

  it('BLOCKER-4: clicking a seed row populates the form with its fields', () => {
    render(<CatalogEditorModal open={true} onClose={() => {}} />)

    // Click на Rifar Base 500 (seed)
    const rifarBtn = screen.getByRole('button', { name: /Редактировать Rifar Base 500/i })
    act(() => {
      fireEvent.click(rifarBtn)
    })

    // Форма должна быть заполнена значениями из seed (manufacturer=Rifar, qPerSectionAt70=197, heightMm=500)
    const manufacturerInput = screen.getByLabelText('Производитель') as HTMLInputElement
    const seriesInput = screen.getByLabelText('Серия') as HTMLInputElement
    const qInput = screen.getByLabelText('Q на секцию при ΔT=70') as HTMLInputElement
    expect(manufacturerInput.value).toBe('Rifar')
    expect(seriesInput.value).toBe('Base 500')
    expect(Number(qInput.value)).toBe(197)

    // Нажимаем "Обновить" БЕЗ изменений — модель должна остаться целой (не затерта EMPTY_FORM)
    const updateBtn = screen.getByRole('button', { name: /^Обновить$/i })
    act(() => {
      fireEvent.click(updateBtn)
    })

    const after = useCatalogStore.getState().models['rifar-base-500']
    expect(after).toBeDefined()
    // @ts-expect-error — sectional discriminant guarantees these at runtime
    expect(after.qPerSectionAt70).toBe(197)
    // @ts-expect-error
    expect(after.heightMm).toBe(500)
    expect(after.manufacturer).toBe('Rifar')
  })
})
