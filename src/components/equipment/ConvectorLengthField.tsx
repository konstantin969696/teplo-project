/**
 * ConvectorLengthField — length select for underfloor convectors from catalog variants,
 * or manual Q_ном input when model is null (D-02).
 */

import type { ConvectorCatalogModel, Equipment } from '../../types/project'
import { INPUT_CLASS } from './equipment-help'

interface ConvectorLengthFieldProps {
  equipment: Equipment
  model: ConvectorCatalogModel | null
  onChange: (changes: Partial<Equipment>) => void
}

export function ConvectorLengthField({ equipment, model, onChange }: ConvectorLengthFieldProps) {
  if (model === null) {
    return (
      <div className="flex gap-2 items-center">
        <label className="text-xs text-[var(--color-text-secondary)]">
          Q_ном, Вт:
          <input
            type="number"
            min={10}
            max={100000}
            step={1}
            value={equipment.manualQNominal ?? ''}
            onChange={e => {
              const v = parseFloat(e.target.value)
              onChange({ manualQNominal: Number.isFinite(v) ? v : null })
            }}
            onClick={e => e.stopPropagation()}
            className={`${INPUT_CLASS} w-24 ml-1 font-mono`}
            title="Номинальная мощность при ΔT=70°C"
          />
        </label>
      </div>
    )
  }

  const lengths = [...new Set(model.variants.map(v => v.lengthMm))].sort((a, b) => a - b)

  return (
    <select
      value={equipment.convectorLengthMm ?? lengths[0] ?? ''}
      onChange={e => {
        const v = parseInt(e.target.value)
        if (Number.isFinite(v)) onChange({ convectorLengthMm: v })
      }}
      onClick={e => e.stopPropagation()}
      className={`${INPUT_CLASS} w-24 font-mono`}
      title="Длина конвектора, мм"
      aria-label="Длина конвектора"
    >
      {lengths.map(l => <option key={l} value={l}>{l}</option>)}
    </select>
  )
}
