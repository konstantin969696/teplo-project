/**
 * Confirmation dialog for destructive actions.
 * Closes on Escape key, auto-focuses Cancel button.
 */

import { useEffect, useRef } from 'react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'default' | 'destructive'
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Продолжить',
  cancelLabel = 'Отмена',
  onConfirm,
  onCancel,
  variant = 'default'
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    cancelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="max-w-md w-full mx-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-6"
        onClick={e => e.stopPropagation()}
      >
        <h3
          id="confirm-dialog-title"
          className="text-base font-semibold text-[var(--color-text-primary)]"
        >
          {title}
        </h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            ref={cancelRef}
            variant="secondary"
            size="sm"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'primary'}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
