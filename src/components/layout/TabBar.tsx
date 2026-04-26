/**
 * 5-tab navigation with ARIA tablist pattern.
 * Compact names on mobile (< 640px).
 * Keyboard: ArrowLeft/ArrowRight to navigate, Enter/Space to select.
 */

import { useRef, useCallback } from 'react'
import { useProjectStore } from '../../store/projectStore'

const TABS = ['Теплопотери', 'Приборы отопления', 'Гидравлика', 'Тёплый пол', 'Сводка'] as const
const TABS_COMPACT = ['Потери', 'Приборы', 'Гидр.', 'Т.пол', 'Сводка'] as const
const TAB_COUNT = TABS.length

export function TabBar() {
  const activeTab = useProjectStore(s => s.activeTab)
  const setActiveTab = useProjectStore(s => s.setActiveTab)
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([])

  const focusTab = useCallback((index: number) => {
    tabsRef.current[index]?.focus()
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    let next = index

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      next = (index + 1) % TAB_COUNT
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      next = (index - 1 + TAB_COUNT) % TAB_COUNT
    } else if (e.key === 'Home') {
      e.preventDefault()
      next = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      next = TAB_COUNT - 1
    } else {
      return
    }

    setActiveTab(next)
    focusTab(next)
  }, [setActiveTab, focusTab])

  return (
    <div
      role="tablist"
      aria-label="Разделы проекта"
      className="flex border-b border-[var(--color-border)] bg-[var(--color-bg)] sticky top-12 z-30"
    >
      {TABS.map((name, i) => {
        const isActive = activeTab === i
        return (
          <button
            key={name}
            ref={el => { tabsRef.current[i] = el }}
            id={`tab-${i}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`tabpanel-${i}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => setActiveTab(i)}
            onKeyDown={e => handleKeyDown(e, i)}
            className={[
              'flex-1 text-center h-10 text-sm transition-colors duration-150 outline-none',
              'focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset',
              isActive
                ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            ].join(' ')}
          >
            <span className="hidden sm:inline">{name}</span>
            <span className="sm:hidden">{TABS_COMPACT[i]}</span>
          </button>
        )
      })}
    </div>
  )
}
