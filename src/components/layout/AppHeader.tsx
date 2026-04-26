/**
 * Fixed application header: logo, city indicator, theme toggle, export slot.
 * Height: 48px. Sticky at top.
 */

import { Logo } from '../Logo'
import { ThemeToggle } from './ThemeToggle'
import { ExportDropdown } from './ExportDropdown'
import { useProjectStore } from '../../store/projectStore'

export function AppHeader() {
  const city = useProjectStore(s => s.city)

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-12 px-4 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
      {/* Left: logo + title */}
      <div className="flex items-center gap-2">
        <Logo className="w-6 h-6" />
        <span className="text-base font-semibold text-[var(--color-text-primary)]">
          {'\u0422\u0435\u043F\u043B\u043E\u041F\u0440\u043E\u0435\u043A\u0442'}
        </span>
      </div>

      {/* Center: city indicator */}
      {city && (
        <div className="hidden sm:flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <span>{city.name}</span>
          <span className="font-mono text-[var(--color-text-primary)]">
            {`t\u043D\u0430\u0440=${city.tOutside}\u00B0C`}
          </span>
        </div>
      )}

      {/* Right: theme toggle + ExportDropdown slot */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <ExportDropdown />
      </div>
    </header>
  )
}
