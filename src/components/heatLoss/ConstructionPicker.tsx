/**
 * Construction picker — dropdown listing reusable enclosure constructions
 * filtered by the enclosure's type, grouped by category.
 * Selecting a construction auto-fills K (kValue) on the host enclosure.
 * Selecting «— ручной ввод —» clears the link so the engineer may type K freely.
 */

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { CatalogConstruction, EnclosureType } from '../../types/project'
import { useConstructionStore } from '../../store/constructionStore'

interface ConstructionPickerProps {
  type: EnclosureType
  value: string | null           // current constructionId
  onPick: (constructionId: string | null, kValue: number | null) => void
  className?: string
}

const inputClass =
  'border border-[var(--color-border)] rounded px-2 py-1 text-sm bg-[var(--color-bg)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors'

export function ConstructionPicker({ type, value, onPick, className }: ConstructionPickerProps) {
  const candidates = useConstructionStore(
    useShallow(s => Object.values(s.models).filter(m => m.type === type))
  )

  // Group by category for a readable dropdown
  const grouped = useMemo(() => {
    const map = new Map<string, CatalogConstruction[]>()
    for (const c of candidates) {
      const cat = c.category ?? 'Прочее'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(c)
    }
    // Sort categories alphabetically; within a category — by name
    const ordered = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'))
    for (const [, items] of ordered) {
      items.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    }
    return ordered
  }, [candidates])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value || null
    if (!id) {
      onPick(null, null)
      return
    }
    const found = candidates.find(c => c.id === id)
    onPick(id, found?.kValue ?? null)
  }

  return (
    <select
      value={value ?? ''}
      onChange={handleChange}
      onClick={e => e.stopPropagation()}
      className={`${inputClass} text-[11px] py-0.5 px-1 ${className ?? ''}`}
      aria-label="Готовая конструкция из каталога"
      title="Выбери готовый пирог — K подставится автоматически. Выбери «— ручной ввод —» чтобы вводить K вручную."
    >
      <option value="">— ручной ввод K —</option>
      {grouped.map(([category, items]) => (
        <optgroup key={category} label={category}>
          {items.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} · K={c.kValue.toFixed(2)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
