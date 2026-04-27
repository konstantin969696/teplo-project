/**
 * Tests for GostStampForm component.
 * Covers: initial render, field changes, stageCode dropdown, required-field highlight.
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GostStampForm } from '../GostStampForm'
import { EMPTY_GOST_STAMP } from '../../../export/store/exportStore'
import type { GostStampParams } from '../../../export/types'

const noop = () => {}

function renderForm(overrides?: Partial<GostStampParams>, onChange = vi.fn()) {
  const stamp = { ...EMPTY_GOST_STAMP, ...overrides }
  render(<GostStampForm stamp={stamp} onChange={onChange} onReset={noop} />)
  return { stamp, onChange }
}

describe('GostStampForm', () => {
  it('рендерится без ошибок с пустым штампом', () => {
    renderForm()
    expect(screen.getByLabelText('Шифр объекта')).toBeInTheDocument()
    expect(screen.getByLabelText('Разработал')).toBeInTheDocument()
    expect(screen.getByLabelText('Стадия')).toBeInTheDocument()
  })

  it('показывает предупреждение когда обязательные поля пусты', () => {
    renderForm({ objectCode: '', authorName: '' })
    expect(screen.getByText(/обязательные поля/i)).toBeInTheDocument()
  })

  it('не показывает предупреждение когда обязательные поля заполнены', () => {
    renderForm({ objectCode: '70-2025', authorName: 'Иванов И.И.' })
    expect(screen.queryByText(/обязательные поля/i)).not.toBeInTheDocument()
  })

  it('вызывает onChange при изменении objectCode', () => {
    const onChange = vi.fn()
    renderForm({}, onChange)
    fireEvent.change(screen.getByLabelText('Шифр объекта'), { target: { value: '70-2025' } })
    expect(onChange).toHaveBeenCalledWith('objectCode', '70-2025')
  })

  it('вызывает onChange при изменении stageCode', () => {
    const onChange = vi.fn()
    renderForm({ stageCode: 'Р' }, onChange)
    fireEvent.change(screen.getByLabelText('Стадия'), { target: { value: 'П' } })
    expect(onChange).toHaveBeenCalledWith('stageCode', 'П')
  })

  it('вызывает onChange при изменении authorName', () => {
    const onChange = vi.fn()
    renderForm({}, onChange)
    fireEvent.change(screen.getByLabelText('Разработал'), { target: { value: 'Петров' } })
    expect(onChange).toHaveBeenCalledWith('authorName', 'Петров')
  })

  it('кнопка сброса вызывает onReset', () => {
    const onReset = vi.fn()
    render(<GostStampForm stamp={EMPTY_GOST_STAMP} onChange={noop} onReset={onReset} />)
    fireEvent.click(screen.getByText(/сбросить параметры штампа/i))
    expect(onReset).toHaveBeenCalled()
  })

  it('drawingTitle отображается и редактируется', () => {
    const onChange = vi.fn()
    renderForm({ drawingTitle: 'Расчёт теплопотерь' }, onChange)
    const input = screen.getByLabelText('Название документа')
    expect(input).toHaveValue('Расчёт теплопотерь')
    fireEvent.change(input, { target: { value: 'Гидравлика' } })
    expect(onChange).toHaveBeenCalledWith('drawingTitle', 'Гидравлика')
  })

  it('стадия П выбирается в dropdown', () => {
    const onChange = vi.fn()
    renderForm({ stageCode: 'П' }, onChange)
    expect(screen.getByLabelText('Стадия')).toHaveValue('П')
  })
})
