/**
 * PanelSizeFields — type/height/length selects for panel radiators,
 * or manual Q_ном + n inputs when model is null (D-02).
 * Height options from model.variants unique heightMm;
 * Length options cascade from selected heightMm.
 */

import type { Equipment, PanelCatalogModel, PanelType } from '../../types/project'
import { INPUT_CLASS } from './equipment-help'

const PANEL_TYPES: readonly PanelType[] = ['11', '21', '22', '33']

interface PanelSizeFieldsProps {
  equipment: Equipment
  model: PanelCatalogModel | null
  onChange: (changes: Partial<Equipment>) => void
}

export function PanelSizeFields({ equipment, model, onChange }: PanelSizeFieldsProps) {
  if (model === null) {
    // D-02 manual entry
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
        <label className="text-xs text-[var(--color-text-secondary)]">
          n:
          <input
            type="number"
            min={1.0}
            max={2.0}
            step={0.01}
            value={equipment.manualNExponent ?? ''}
            onChange={e => {
              const v = parseFloat(e.target.value)
              onChange({ manualNExponent: Number.isFinite(v) ? v : null })
            }}
            onClick={e => e.stopPropagation()}
            className={`${INPUT_CLASS} w-16 ml-1 font-mono`}
            title="Показатель степени n"
          />
        </label>
      </div>
    )
  }

  const uniqueHeights = [...new Set(model.variants.map(v => v.heightMm))].sort((a, b) => a - b)
  const lengthsForHeight = model.variants
    .filter(v => v.heightMm === equipment.panelHeightMm)
    .map(v => v.lengthMm)
    .sort((a, b) => a - b)

  return (
    <div className="flex gap-1 items-center">
      <select
        value={equipment.panelType ?? model.panelType}
        onChange={e => onChange({ panelType: e.target.value as PanelType })}
        onClick={e => e.stopPropagation()}
        className={`${INPUT_CLASS} w-16`}
        title="Тип панели"
      >
        {PANEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select
        value={equipment.panelHeightMm ?? uniqueHeights[0] ?? ''}
        onChange={e => {
          const v = parseInt(e.target.value)
          if (Number.isFinite(v)) onChange({ panelHeightMm: v })
        }}
        onClick={e => e.stopPropagation()}
        className={`${INPUT_CLASS} w-20 font-mono`}
        title="Высота, мм"
      >
        {uniqueHeights.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <select
        value={equipment.panelLengthMm ?? lengthsForHeight[0] ?? ''}
        onChange={e => {
          const v = parseInt(e.target.value)
          if (Number.isFinite(v)) onChange({ panelLengthMm: v })
        }}
        onClick={e => e.stopPropagation()}
        className={`${INPUT_CLASS} w-24 font-mono`}
        title="Длина, мм"
        disabled={lengthsForHeight.length === 0}
      >
        {lengthsForHeight.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
    </div>
  )
}
