/**
 * ModelPicker — catalog model dropdown filtered by kind.
 * Provides "— Ввести вручную —" option (value='' → onChange(null)) per D-02.
 * Uses useShallow on selector so referential equality keeps row renders cheap.
 */

import { useShallow } from 'zustand/react/shallow'
import type { EquipmentKind } from '../../types/project'
import { selectModelsByKind, useCatalogStore } from '../../store/catalogStore'
import { INPUT_CLASS } from './equipment-help'

interface ModelPickerProps {
  kind: EquipmentKind
  value: string | null
  onChange: (modelId: string | null) => void
}

export function ModelPicker({ kind, value, onChange }: ModelPickerProps) {
  const models = useCatalogStore(useShallow(selectModelsByKind(kind)))

  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
      onClick={e => e.stopPropagation()}
      className={`${INPUT_CLASS} min-w-[180px]`}
      aria-label="Модель прибора из каталога"
    >
      <option value="">— Ввести вручную —</option>
      {models.map(m => (
        <option key={m.id} value={m.id}>{m.manufacturer} {m.series}</option>
      ))}
    </select>
  )
}
