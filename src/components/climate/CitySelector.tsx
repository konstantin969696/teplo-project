/**
 * Combobox for city selection with search filtering.
 * Reads/writes city from project store.
 * Full ARIA combobox pattern with keyboard navigation.
 * Custom cities appear first in the list with "(свой)" label.
 * Edit/delete buttons shown when a custom city is selected.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { CITIES } from '../../data/cities'
import { useProjectStore } from '../../store/projectStore'
import type { CityData, CustomCityData } from '../../types/project'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { CityFormDialog } from './CityFormDialog'

const MAX_VISIBLE = 8
const ITEM_HEIGHT = 32
const BLUR_DELAY = 150

type AnyCity = CityData | CustomCityData

export function CitySelector() {
  const city = useProjectStore(s => s.city)
  const setCity = useProjectStore(s => s.setCity)
  const customCities = useProjectStore(s => s.customCities)
  const deleteCustomCity = useProjectStore(s => s.deleteCustomCity)

  const [query, setQuery] = useState(city?.name ?? '')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [editingCity, setEditingCity] = useState<CustomCityData | null>(null)
  const [deletingCity, setDeletingCity] = useState<CustomCityData | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Merge: custom cities first, then SP 131 cities
  const allCities: AnyCity[] = [...customCities, ...CITIES]
  const filtered: AnyCity[] = query.trim() === ''
    ? allCities
    : allCities.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))

  const openDropdown = useCallback(() => {
    setIsOpen(true)
    setHighlightIndex(-1)
  }, [])

  const closeDropdown = useCallback(() => {
    setIsOpen(false)
    setHighlightIndex(-1)
  }, [])

  const selectCity = useCallback((c: AnyCity) => {
    setCity(c)
    setQuery(c.name)
    closeDropdown()
  }, [setCity, closeDropdown])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    if (!isOpen) openDropdown()
    setHighlightIndex(-1)
  }

  const handleInputFocus = () => {
    if (blurTimerRef.current !== undefined) {
      clearTimeout(blurTimerRef.current)
    }
    openDropdown()
  }

  const handleInputBlur = () => {
    blurTimerRef.current = setTimeout(() => {
      closeDropdown()
      if (city) {
        setQuery(city.name)
      }
    }, BLUR_DELAY)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        openDropdown()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        const next = highlightIndex < filtered.length - 1 ? highlightIndex + 1 : 0
        setHighlightIndex(next)
        scrollToItem(next)
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const prev = highlightIndex > 0 ? highlightIndex - 1 : filtered.length - 1
        setHighlightIndex(prev)
        scrollToItem(prev)
        break
      }
      case 'Enter': {
        e.preventDefault()
        const selected = filtered[highlightIndex]
        if (highlightIndex >= 0 && selected) {
          selectCity(selected)
        }
        break
      }
      case 'Escape': {
        e.preventDefault()
        closeDropdown()
        if (city) setQuery(city.name)
        break
      }
    }
  }

  const scrollToItem = (index: number) => {
    const list = listRef.current
    if (!list) return
    const top = index * ITEM_HEIGHT
    if (top < list.scrollTop) {
      list.scrollTop = top
    } else if (top + ITEM_HEIGHT > list.scrollTop + list.clientHeight) {
      list.scrollTop = top + ITEM_HEIGHT - list.clientHeight
    }
  }

  const handleItemMouseDown = (c: AnyCity) => {
    if (blurTimerRef.current !== undefined) {
      clearTimeout(blurTimerRef.current)
    }
    selectCity(c)
    inputRef.current?.focus()
  }

  useEffect(() => {
    return () => {
      if (blurTimerRef.current !== undefined) {
        clearTimeout(blurTimerRef.current)
      }
    }
  }, [])

  const listboxId = 'city-listbox'
  const activeDescendant = highlightIndex >= 0 ? `city-option-${highlightIndex}` : undefined

  // Check if current city is a custom one
  const isCustomCitySelected = Boolean(city && 'isCustom' in city && city.isCustom)

  return (
    <div className="relative w-full sm:w-[280px]">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeDescendant}
        aria-autocomplete="list"
        aria-label="Выберите город"
        placeholder="Выберите город"
        value={query}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        className="w-full border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm bg-[var(--color-bg)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors"
      />

      {/* Edit/delete actions for selected custom city */}
      {isCustomCitySelected && (
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={() => setEditingCity(city as CustomCityData)}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            Редактировать
          </button>
          <button
            type="button"
            onClick={() => setDeletingCity(city as CustomCityData)}
            className="text-xs text-[var(--color-destructive)] hover:underline"
          >
            Удалить
          </button>
        </div>
      )}

      {isOpen && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Список городов"
          className="absolute z-50 mt-1 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md shadow-lg overflow-y-auto"
          style={{ maxHeight: `${MAX_VISIBLE * ITEM_HEIGHT}px` }}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">
              Город не найден
            </li>
          ) : (
            filtered.map((c, i) => (
              <li
                key={'id' in c ? c.id : c.name}
                id={`city-option-${i}`}
                role="option"
                aria-selected={highlightIndex === i}
                onMouseDown={() => handleItemMouseDown(c)}
                onMouseEnter={() => setHighlightIndex(i)}
                className={[
                  'px-3 py-1.5 text-sm cursor-pointer',
                  highlightIndex === i
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]'
                ].join(' ')}
                style={{ height: `${ITEM_HEIGHT}px`, lineHeight: `${ITEM_HEIGHT}px`, padding: '0 12px' }}
              >
                {c.name}
                {'isCustom' in c && c.isCustom && (
                  <span className="ml-1 text-xs text-[var(--color-accent)] opacity-70">(свой)</span>
                )}
                <span className="ml-2 text-xs opacity-70">
                  {`${c.tOutside}\u00B0C`}
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      {/* Edit modal for custom city */}
      <CityFormDialog
        open={editingCity !== null}
        onClose={() => setEditingCity(null)}
        editCity={editingCity}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deletingCity !== null}
        title="Удалить город"
        message={`Удалить город "${deletingCity?.name}"? Это действие нельзя отменить.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        variant="destructive"
        onConfirm={() => {
          if (deletingCity) {
            deleteCustomCity(deletingCity.id)
          }
          setDeletingCity(null)
        }}
        onCancel={() => setDeletingCity(null)}
      />
    </div>
  )
}
