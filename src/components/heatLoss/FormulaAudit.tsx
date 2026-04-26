/**
 * Expandable formula display with substituted values in monospace.
 * Toggle button shows/hides audit block with slide-down animation (D-05).
 * Accessibility: aria-expanded on trigger, aria-live on content.
 */

import { useState } from 'react'

interface FormulaAuditProps {
  auditString: string
  label?: string
}

export function FormulaAudit({ auditString, label = 'Показать расчёт' }: FormulaAuditProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="inline-block">
      <button
        onClick={e => { e.stopPropagation(); setIsOpen(prev => !prev) }}
        className="text-[var(--color-accent)] text-[12px] underline-offset-2 hover:underline"
        aria-expanded={isOpen}
      >
        {isOpen ? 'Скрыть расчёт' : label}
      </button>

      <div
        className="overflow-hidden transition-all duration-200 ease-out"
        style={{ maxHeight: isOpen ? '500px' : '0px' }}
      >
        <div
          className="mt-1 bg-[var(--color-surface)] border-l-[3px] border-[var(--color-accent)] p-3"
          aria-live="polite"
        >
          <pre className="font-mono text-sm text-[var(--color-text-primary)] whitespace-pre leading-relaxed">
            {auditString}
          </pre>
        </div>
      </div>
    </div>
  )
}
