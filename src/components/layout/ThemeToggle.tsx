/**
 * Light/dark theme toggle button.
 * Persists choice to localStorage key 'teplo-theme'.
 * Sets data-theme attribute on <html> for CSS custom properties.
 */

import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  const stored = document.documentElement.getAttribute('data-theme')
  return stored === 'dark' ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  const handleToggle = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('teplo-theme', next) } catch { /* storage blocked — ignore */ }
    setTheme(next)
  }

  const isLight = theme === 'light'
  const label = isLight
    ? 'Переключить на тёмную тему'
    : 'Переключить на светлую тему'

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={label}
      className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--color-surface)] transition-colors duration-150"
    >
      {isLight ? (
        <Sun size={20} className="transition-opacity duration-200" />
      ) : (
        <Moon size={20} className="transition-opacity duration-200" />
      )}
    </button>
  )
}
