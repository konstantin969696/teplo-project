/**
 * Fixed application header: hamburger (mobile), logo, project name, city, theme toggle, export.
 * Height: 48px. Sticky at top.
 */

import { Menu } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Logo } from '../Logo'
import { ThemeToggle } from './ThemeToggle'
import { ExportDropdown } from './ExportDropdown'
import { useProjectStore } from '../../store/projectStore'
import { useProjectsRegistryStore } from '../../store/projectsRegistryStore'

interface AppHeaderProps {
  readonly onMenuClick?: () => void
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const city = useProjectStore(s => s.city)
  const { projects, activeId } = useProjectsRegistryStore(
    useShallow(s => ({ projects: s.projects, activeId: s.activeId }))
  )
  const projectName = activeId ? (projects[activeId]?.name ?? '') : ''

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-12 px-4 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
      {/* Left: hamburger (mobile only) + logo + app name */}
      <div className="flex items-center gap-2">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Открыть список проектов"
            data-testid="hamburger-btn"
            className="md:hidden p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
          >
            <Menu size={20} />
          </button>
        )}
        <Logo className="w-6 h-6" />
        <span className="text-base font-semibold text-[var(--color-text-primary)]">
          ТеплоПроект
        </span>
      </div>

      {/* Center: project name + city */}
      <div className="hidden sm:flex flex-col items-center leading-tight">
        {projectName ? (
          <span
            className="text-sm font-medium text-[var(--color-text-primary)] truncate max-w-48"
            data-testid="header-project-name"
          >
            {projectName}
          </span>
        ) : (
          <span className="text-sm text-[var(--color-text-secondary)]" data-testid="header-project-name">
            Без проекта
          </span>
        )}
        {city && (
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            {city.name} · tнар={city.tOutside}°C
          </span>
        )}
      </div>

      {/* Right: theme toggle + ExportDropdown */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <ExportDropdown />
      </div>
    </header>
  )
}
