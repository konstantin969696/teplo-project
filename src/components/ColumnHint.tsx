/**
 * Shared column-header helper: label + small HelpCircle icon with native title tooltip.
 * Used in all tables where column labels are abbreviated (Q_осн, K, n, Δt ...).
 */

import { HelpCircle } from 'lucide-react'

interface ColumnHintProps {
  label: React.ReactNode
  hint: string
}

export function ColumnHint({ label, hint }: ColumnHintProps) {
  return (
    <span className="inline-flex items-center gap-1" title={hint}>
      {label}
      <HelpCircle
        size={12}
        aria-hidden="true"
        className="text-[var(--color-text-secondary)] opacity-60 hover:opacity-100 cursor-help"
      />
      <span className="sr-only">{hint}</span>
    </span>
  )
}
