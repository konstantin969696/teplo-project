/**
 * Copy floor dialog: select source floor, enter target floor number.
 * Duplicates rooms with "(копия)" suffix via enclosureStore.copyFloor.
 * Follows ConfirmDialog modal pattern (D-08).
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '../ui/Button'
import { useProjectStore } from '../../store/projectStore'
import { useEnclosureStore } from '../../store/enclosureStore'

interface CopyFloorModalProps {
  open: boolean
  onClose: () => void
}

export function CopyFloorModal({ open, onClose }: CopyFloorModalProps) {
  const rooms = useProjectStore(s => s.rooms)
  const cancelRef = useRef<HTMLButtonElement>(null)

  const uniqueFloors = useMemo(() => {
    const floors = new Set<number>()
    for (const room of Object.values(rooms)) {
      floors.add(room.floor)
    }
    return Array.from(floors).sort((a, b) => a - b)
  }, [rooms])

  const [sourceFloor, setSourceFloor] = useState<number | null>(null)
  const [targetFloor, setTargetFloor] = useState<string>('')

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setSourceFloor(uniqueFloors[0] ?? null)
      setTargetFloor('')
    }
  }, [open, uniqueFloors])

  // Escape key + auto-focus
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    cancelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const targetNum = parseInt(targetFloor) || 0
  const isSameFloor = sourceFloor !== null && targetNum === sourceFloor
  const isValid = sourceFloor !== null && targetNum >= 1 && !isSameFloor

  const sourceRoomCount = sourceFloor !== null
    ? Object.values(rooms).filter(r => r.floor === sourceFloor).length
    : 0

  const handleConfirm = () => {
    if (!isValid || sourceFloor === null) return
    useEnclosureStore.getState().copyFloor(sourceFloor, targetNum)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-floor-title"
    >
      <div
        className="max-w-[360px] w-full mx-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-6"
        onClick={e => e.stopPropagation()}
      >
        <h3
          id="copy-floor-title"
          className="text-base font-semibold text-[var(--color-text-primary)]"
        >
          Копировать этаж
        </h3>

        <div className="mt-4 space-y-3">
          {/* Source floor */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)]" htmlFor="source-floor">
              Исходный этаж
            </label>
            <select
              id="source-floor"
              value={sourceFloor ?? ''}
              onChange={e => setSourceFloor(parseInt(e.target.value) || null)}
              className="w-full border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm bg-[var(--color-bg)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors"
            >
              {uniqueFloors.map(f => (
                <option key={f} value={f}>Этаж {f}</option>
              ))}
            </select>
          </div>

          {/* Target floor */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)]" htmlFor="target-floor">
              Новый этаж №
            </label>
            <input
              id="target-floor"
              type="number"
              value={targetFloor}
              onChange={e => setTargetFloor(e.target.value)}
              min={1}
              step={1}
              placeholder="2"
              className="w-full border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm bg-[var(--color-bg)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors"
            />
            {isSameFloor && (
              <span className="text-xs text-[var(--color-destructive)]">
                Новый этаж совпадает с исходным
              </span>
            )}
          </div>

          {/* Preview */}
          {sourceFloor !== null && sourceRoomCount > 0 && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Будет скопировано: {sourceRoomCount} помещений с ограждениями
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            ref={cancelRef}
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Отмена
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={!isValid}
          >
            Копировать этаж
          </Button>
        </div>
      </div>
    </div>
  )
}
