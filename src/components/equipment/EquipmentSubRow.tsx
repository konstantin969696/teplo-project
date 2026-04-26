/**
 * Single equipment sub-row — one device inside a room's EquipmentSubTable.
 * Expandable: chevron reveals EquipmentDetails (formula + alternatives).
 * Inline editing of kind/model/type-specific-params/connection/installation.
 * Q_факт computed locally via deriveEquipmentQActual (pure).
 *
 * Phase 04.1 Plan 06:
 *   - per-equipment tSupply/tReturn via useEquipmentSystemTemps(eq.id) — D-27
 *   - System dropdown в row cells (D-10 + PATTERNS §18: per-equipment, NOT per-room)
 *   - data-testid="lmtd-value" для Wave 0 RED tests
 */

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ChevronRight, Trash2 } from 'lucide-react'
import type {
  ConvectorCatalogModel,
  Equipment,
  PanelCatalogModel,
  Room,
} from '../../types/project'
import { useCatalogStore } from '../../store/catalogStore'
import { useEquipmentStore } from '../../store/equipmentStore'
import { useSystemStore, selectOrderedSystems } from '../../store/systemStore'
import { useEquipmentSystemTemps } from '../../hooks/useEquipmentSystemTemps'
import { calculateLMTD } from '../../engine/equipment'
import { ConnectionInstallBlock } from './ConnectionInstallBlock'
import { ConvectorLengthField } from './ConvectorLengthField'
import { EquipmentDetails } from './EquipmentDetails'
import { KindSelector } from './KindSelector'
import { ModelPicker } from './ModelPicker'
import { PanelSizeFields } from './PanelSizeFields'
import { SectionFields } from './SectionFields'
import { INPUT_CLASS, deriveEquipmentQActual } from './equipment-help'

interface EquipmentSubRowProps {
  equipment: Equipment
  room: Room
  qRequiredForSectionPick: number | null  // see equipment-help for semantics
  index: number
}

export function EquipmentSubRow({
  equipment, room, qRequiredForSectionPick, index
}: EquipmentSubRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const model = useCatalogStore(s =>
    equipment.catalogModelId ? s.models[equipment.catalogModelId] ?? null : null
  )

  // Per-system температуры для этого прибора (D-27).
  const { tSupply, tReturn } = useEquipmentSystemTemps(equipment.id)

  const orderedSystems = useSystemStore(useShallow(selectOrderedSystems))

  const lmtd = useMemo(
    () => calculateLMTD(tSupply, tReturn, room.tInside),
    [tSupply, tReturn, room.tInside]
  )

  const derived = useMemo(
    () => deriveEquipmentQActual(equipment, model, qRequiredForSectionPick, lmtd),
    [equipment, model, qRequiredForSectionPick, lmtd]
  )

  const handleUpdate = useCallback((changes: Partial<Omit<Equipment, 'id' | 'roomId'>>) => {
    useEquipmentStore.getState().updateEquipment(equipment.id, changes)
  }, [equipment.id])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    useEquipmentStore.getState().deleteEquipment(equipment.id)
  }, [equipment.id])

  const toggleExpand = useCallback(() => setIsExpanded(prev => !prev), [])

  let paramsField: React.ReactNode = null
  if (equipment.kind === 'panel') {
    const panelModel = model && model.kind === 'panel' ? (model as PanelCatalogModel) : null
    paramsField = <PanelSizeFields equipment={equipment} model={panelModel} onChange={handleUpdate} />
  } else if (equipment.kind === 'underfloor-convector') {
    const convModel = model && model.kind === 'underfloor-convector' ? (model as ConvectorCatalogModel) : null
    paramsField = <ConvectorLengthField equipment={equipment} model={convModel} onChange={handleUpdate} />
  } else {
    paramsField = <SectionFields equipment={equipment} sectionsCalculated={derived.sectionsCalc} onChange={handleUpdate} />
  }

  const zebraClass = index % 2 === 0 ? '' : 'bg-[var(--color-surface)]'

  return (
    <>
      <tr
        className={`cursor-pointer hover:bg-[var(--color-surface)] ${zebraClass}`}
        onClick={toggleExpand}
        aria-expanded={isExpanded}
      >
        <td className="px-2 py-1 align-top">
          <ChevronRight
            size={14}
            className={`transition-transform duration-200 text-[var(--color-text-secondary)] ${isExpanded ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
        </td>
        <td className="px-2 py-1 align-top">
          <select
            value={equipment.systemId}
            onClick={e => e.stopPropagation()}
            onChange={e => handleUpdate({ systemId: e.target.value })}
            className={INPUT_CLASS}
            aria-label="Выберите систему отопления для прибора"
          >
            {orderedSystems.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </td>
        <td className="px-2 py-1 align-top">
          <KindSelector
            value={equipment.kind}
            onChange={kind => handleUpdate({
              kind,
              catalogModelId: null,
              panelType: null,
              panelHeightMm: null,
              panelLengthMm: null,
              convectorLengthMm: null,
              sectionsOverride: null,
            })}
          />
        </td>
        <td className="px-2 py-1 align-top">
          <ModelPicker
            kind={equipment.kind}
            value={equipment.catalogModelId}
            onChange={modelId => handleUpdate({ catalogModelId: modelId })}
          />
        </td>
        <td className="px-2 py-1 align-top">{paramsField}</td>
        <td className="px-2 py-1 align-top">
          <ConnectionInstallBlock
            connection={equipment.connection}
            installation={equipment.installation}
            onChange={handleUpdate}
          />
        </td>
        <td
          className="px-2 py-1 align-top text-right font-mono font-semibold text-[var(--color-text-primary)]"
          data-testid="q-actual"
        >
          {derived.qActual !== null ? Math.round(derived.qActual) : '—'}
          <span
            data-testid="lmtd-value"
            className="sr-only"
            aria-hidden="true"
          >
            {lmtd.toFixed(2)}
          </span>
        </td>
        <td className="px-2 py-1 align-top">
          <button
            onClick={handleDelete}
            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-destructive)] transition-colors"
            aria-label={`Удалить прибор для ${room.name || 'помещение'}`}
            title="Удалить прибор"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <div role="region" aria-label={`Детали подбора для ${room.name || 'помещение'}`}>
              <div className="ml-4 mt-1 text-xs text-[var(--color-text-secondary)] font-mono">
                LMTD: <span>{lmtd.toFixed(2)}</span>°C
              </div>
              <EquipmentDetails
                equipment={equipment}
                room={room}
                qRequired={qRequiredForSectionPick}
                lmtd={lmtd}
                qActual={derived.qActual}
                sectionsCalc={derived.sectionsCalc}
                tSupply={tSupply}
                tReturn={tReturn}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
