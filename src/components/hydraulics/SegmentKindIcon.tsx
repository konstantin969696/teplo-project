/**
 * SegmentKindIcon — короткий текстовый label типа сегмента (D-06).
 * Заменил 12×12 lucide-иконку (Minus/ArrowUpDown/GitBranch/Circle) на короткое
 * русское сокращение — по UX feedback: иконки не читались глазом.
 */

import type { Segment } from '../../types/hydraulics'

const KIND_SHORT_LABEL: Record<Segment['kind'], string> = {
  trunk: 'Маг.',
  riser: 'Ст.',
  branch: 'Отв.',
  connection: 'Под.'
}

const KIND_FULL_LABEL: Record<Segment['kind'], string> = {
  trunk: 'Магистраль',
  riser: 'Стояк',
  branch: 'Ответвление',
  connection: 'Подводка'
}

interface Props {
  readonly kind: Segment['kind']
  readonly className?: string
}

export function SegmentKindIcon({ kind, className = '' }: Props) {
  return (
    <span
      aria-label={KIND_FULL_LABEL[kind]}
      title={KIND_FULL_LABEL[kind]}
      className={`inline-block text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)] min-w-[28px] text-center ${className}`}
    >
      {KIND_SHORT_LABEL[kind]}
    </span>
  )
}
