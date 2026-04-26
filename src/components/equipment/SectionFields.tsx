/**
 * SectionFields — read-only calculated section count + editable "accepted" input.
 * If user matches the auto value (ceil) → clears override (sectionsOverride=null).
 * Disabled when sectionsCalculated is null (system inoperable / no catalog data).
 */

import type { Equipment } from '../../types/project'
import { INPUT_CLASS } from './equipment-help'

interface SectionFieldsProps {
  equipment: Equipment
  sectionsCalculated: number | null
  onChange: (changes: Partial<Equipment>) => void
}

export function SectionFields({ equipment, sectionsCalculated, onChange }: SectionFieldsProps) {
  const calcDisplay = sectionsCalculated !== null ? sectionsCalculated.toFixed(2) : '—'
  const auto = sectionsCalculated !== null ? Math.max(1, Math.ceil(sectionsCalculated)) : 1
  const displayed = equipment.sectionsOverride ?? auto

  return (
    <div className="flex gap-2 items-center">
      <span
        className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap"
        title="Расчётное число секций (до округления)"
      >
        Расч.: <span className="text-[var(--color-text-primary)] font-mono">{calcDisplay}</span>
      </span>
      <input
        type="number"
        min={1}
        max={30}
        step={1}
        value={displayed}
        onChange={e => {
          const v = parseInt(e.target.value)
          if (!Number.isFinite(v) || v < 1) return
          onChange({ sectionsOverride: v === auto ? null : v })
        }}
        onClick={e => e.stopPropagation()}
        disabled={sectionsCalculated === null}
        className={`${INPUT_CLASS} w-16 font-mono`}
        title="Принятое число секций (по умолчанию — ceil от расчётного)"
        aria-label="Принятое число секций"
      />
    </div>
  )
}
