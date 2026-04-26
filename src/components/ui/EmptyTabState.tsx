/**
 * Placeholder for inactive tabs (phases 2-5 content).
 * Shown when tab content is not yet implemented.
 */

import { Construction } from 'lucide-react'

interface EmptyTabStateProps {
  tabName: string
}

export function EmptyTabState({ tabName }: EmptyTabStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Construction
        size={48}
        className="text-[var(--color-text-secondary)]"
        aria-hidden="true"
      />
      <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
        Раздел в разработке
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)]">
        {`Раздел \u00AB${tabName}\u00BB будет доступен в следующих версиях`}
      </p>
    </div>
  )
}
