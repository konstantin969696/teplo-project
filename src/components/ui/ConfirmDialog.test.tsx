import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    title: 'Подтверждение',
    message: 'Вы уверены?',
    onConfirm: vi.fn(),
    onCancel: vi.fn()
  }

  it('renders title and message when open', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Подтверждение')).toBeDefined()
    expect(screen.getByText('Вы уверены?')).toBeDefined()
  })

  it('renders nothing when closed', () => {
    const { container } = render(<ConfirmDialog {...defaultProps} open={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByText('Продолжить'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Отмена'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel on Escape key', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
