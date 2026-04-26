/**
 * KmsPicker — modal со spinner-списком КМС.
 * Показывает все КМС из каталога с счётчиками (−/N/+).
 * Live-обновление ΣКМС. «Применить» → updateSegment({kmsCounts}).
 * Escape закрывает; клик по overlay закрывает.
 *
 * Decision D-13: picker из справочника (не ввод ζ вручную).
 * T-04-14 mitigation: counts строится из kmsCatalog ids, не принимается из внешнего источника.
 */

import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSegmentStore } from '../../store/segmentStore'
import { useKmsCatalogStore } from '../../store/kmsCatalogStore'
import { Button } from '../ui/Button'
import { HYDRO_HINTS } from './glossary'

interface KmsPickerProps {
  readonly segmentId: string
  readonly open: boolean
  readonly onClose: () => void
}

export function KmsPicker({ segmentId, open, onClose }: KmsPickerProps) {
  const segment = useSegmentStore(s => s.segments[segmentId])
  const kmsCatalog = useKmsCatalogStore(useShallow(s => Object.values(s.elements)))
  const updateSegment = useSegmentStore(s => s.updateSegment)

  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (open && segment) {
      setCounts({ ...segment.kmsCounts })
    }
  }, [open, segment])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !segment) return null

  const sumZeta = kmsCatalog.reduce((s, k) => s + (counts[k.id] ?? 0) * k.zeta, 0)

  const handleApply = () => {
    updateSegment(segmentId, { kmsCounts: counts })
    onClose()
  }

  const step = (id: string, delta: number) =>
    setCounts(c => ({ ...c, [id]: Math.max(0, Math.min(20, (c[id] ?? 0) + delta)) }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Местные сопротивления участка"
    >
      <div
        className="max-w-[580px] w-full mx-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-6 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-3">Местные сопротивления участка</h3>
        <ul className="overflow-y-auto flex-1 divide-y divide-[var(--color-border)]">
          {kmsCatalog.map(kms => (
            <li key={kms.id} className="flex items-center justify-between py-2">
              <span className="text-sm">
                {kms.name}{' '}
                <span className="text-[var(--color-text-secondary)] text-xs">(ζ={kms.zeta.toFixed(2)})</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => step(kms.id, -1)}
                  className="w-6 h-6 border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] text-sm"
                  aria-label={`Убавить ${kms.name}`}
                >
                  −
                </button>
                <span className="font-mono w-6 text-center text-sm">{counts[kms.id] ?? 0}</span>
                <button
                  type="button"
                  onClick={() => step(kms.id, 1)}
                  className="w-6 h-6 border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] text-sm"
                  aria-label={`Прибавить ${kms.name}`}
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-[var(--color-border)]">
          <span className="font-mono font-semibold text-base" title={HYDRO_HINTS.sum_zeta}>
            ΣКМС = {sumZeta.toFixed(2)}
          </span>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleApply}>Применить</Button>
            <Button variant="secondary" size="sm" onClick={onClose}>Отмена</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
