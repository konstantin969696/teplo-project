/**
 * KindSelector — dropdown for the 5 EquipmentKind values.
 * Click events stop propagation so this does not toggle the enclosing row.
 */

import type { EquipmentKind } from '../../types/project'
import { INPUT_CLASS, KIND_LABELS } from './equipment-help'

const KINDS: readonly EquipmentKind[] = [
  'panel',
  'bimetal',
  'aluminum',
  'cast-iron',
  'underfloor-convector',
]

interface KindSelectorProps {
  value: EquipmentKind
  onChange: (kind: EquipmentKind) => void
}

export function KindSelector({ value, onChange }: KindSelectorProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as EquipmentKind)}
      onClick={e => e.stopPropagation()}
      className={`${INPUT_CLASS} min-w-[140px]`}
      aria-label="Тип отопительного прибора"
    >
      {KINDS.map(k => (
        <option key={k} value={k}>{KIND_LABELS[k]}</option>
      ))}
    </select>
  )
}
