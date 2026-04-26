/**
 * Inline warning отображается когда ни один типоразмер не покрывает Q_required (D-05),
 * или когда qActual < qRequired. AlertTriangle + конкретные рекомендации по увеличению
 * мощности системы.
 */

import { AlertTriangle } from 'lucide-react'
import type { EquipmentKind } from '../../types/project'
import { KIND_LABELS } from './equipment-help'

interface InsufficientWarningProps {
  qRequired: number
  kind: EquipmentKind
}

export function InsufficientWarning({ qRequired, kind }: InsufficientWarningProps) {
  const kindLabel = (KIND_LABELS[kind] ?? kind).toLowerCase()
  return (
    <div
      className="bg-[var(--color-surface)] border border-[var(--color-destructive)] rounded p-2 text-xs flex gap-2 items-start"
      role="alert"
    >
      <AlertTriangle
        size={14}
        className="text-[var(--color-destructive)] mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <div className="text-[var(--color-text-primary)]">
        <span className="text-[var(--color-destructive)] font-semibold">Нет типоразмера</span>{' '}
        {kindLabel} с достаточной мощностью для Q={qRequired.toFixed(0)} Вт.
        <br />
        <span className="text-[var(--color-text-secondary)]">
          Рекомендации: (1) повысить tподача; (2) выбрать другой тип прибора (например, панельный с большей высотой); (3) ввести прибор вручную (комбинацию).
        </span>
      </div>
    </div>
  )
}
