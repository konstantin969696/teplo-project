/**
 * Compliance badge — tiny icon + colour indicator of whether the current K
 * passes СП 50.13330 nominal resistance for the city's ГСОП.
 * Hover reveals the full hint built by engine/normative.ts.
 */

import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react'
import type { NormativeVerdict } from '../../engine/normative'

interface ComplianceBadgeProps {
  verdict: NormativeVerdict
  compact?: boolean  // show only icon (for tight table cells)
}

export function ComplianceBadge({ verdict, compact = false }: ComplianceBadgeProps) {
  if (verdict.tier === 'not-applicable' && compact) return null

  const config = {
    pass: {
      icon: CheckCircle2,
      bg: 'bg-green-100 dark:bg-green-900/30',
      fg: 'text-green-700 dark:text-green-300',
      text: `Проходит · R=${verdict.rActual.toFixed(2)}`,
    },
    marginal: {
      icon: AlertTriangle,
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      fg: 'text-amber-700 dark:text-amber-300',
      text: `Погран. · R=${verdict.rActual.toFixed(2)} < ${verdict.rNormative.toFixed(2)}`,
    },
    fail: {
      icon: XCircle,
      bg: 'bg-red-100 dark:bg-red-900/30',
      fg: 'text-red-700 dark:text-red-300',
      text: `Не проходит · R=${verdict.rActual.toFixed(2)} < ${verdict.rNormative.toFixed(2)}`,
    },
    'not-applicable': {
      icon: MinusCircle,
      bg: 'bg-[var(--color-surface)]',
      fg: 'text-[var(--color-text-secondary)]',
      text: 'н/п',
    },
  }[verdict.tier]

  const Icon = config.icon

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-mono ${config.bg} ${config.fg}`}
      title={verdict.hint}
    >
      <Icon size={12} aria-hidden="true" />
      {!compact && <span>{config.text}</span>}
    </span>
  )
}
