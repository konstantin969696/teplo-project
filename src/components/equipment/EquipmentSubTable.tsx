/**
 * Inner table shown when an EquipmentRow is expanded — lists all equipment
 * in the room + a button to add another device. Enables multi-equipment
 * rooms (e.g., 2 radiators under 2 windows; radiator + underfloor convector).
 *
 * Phase 04.1 Plan 06:
 *   - Добавлен столбец "Система" (D-10 + PATTERNS §18).
 *   - tSupply/tReturn больше не пробрасываются через props — каждый SubRow
 *     берёт их через useEquipmentSystemTemps (D-27).
 *   - addEquipment проставляет systemId = первая система из orderedSystems.
 */

import { useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { Equipment, Room } from '../../types/project'
import { useEquipmentStore } from '../../store/equipmentStore'
import { useSystemStore, selectOrderedSystems } from '../../store/systemStore'
import { EquipmentSubRow } from './EquipmentSubRow'

interface EquipmentSubTableProps {
  room: Room
  qRequired: number | null
}

export function EquipmentSubTable({ room, qRequired }: EquipmentSubTableProps) {
  const equipmentList = useEquipmentStore(
    useShallow(state => {
      const out: typeof state.equipment[string][] = []
      for (const id of state.equipmentOrder) {
        const e = state.equipment[id]
        if (e && e.roomId === room.id) out.push(e)
      }
      return out
    })
  )

  const orderedSystems = useSystemStore(useShallow(selectOrderedSystems))
  const defaultSystemId = orderedSystems[0]?.id ?? ''

  const handleAddEquipment = useCallback(() => {
    useEquipmentStore.getState().addEquipment({
      roomId: room.id,
      systemId: defaultSystemId,
      kind: 'bimetal',
      catalogModelId: null,
      connection: 'side',
      installation: 'open',
      panelType: null,
      panelHeightMm: null,
      panelLengthMm: null,
      sectionsOverride: null,
      convectorLengthMm: null,
      manualQNominal: null,
      manualNExponent: null,
    } as unknown as Omit<Equipment, 'id'>)
  }, [room.id, defaultSystemId])

  // For sectional kinds' auto-pick: when user added a single prib, they
  // usually expect it to cover the full room load. When multiple priborov
  // exist, the auto-pick target is split equally. User can override
  // sections manually to tune.
  const qRequiredPerEquipment = qRequired !== null && equipmentList.length > 0
    ? qRequired / equipmentList.length
    : qRequired

  return (
    <div className="ml-4 my-2 bg-[var(--color-surface)] rounded border border-[var(--color-border)]">
      {equipmentList.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-secondary)] align-bottom">
                <th className="px-2 py-1.5 w-8">{/* chevron */}</th>
                <th className="px-2 py-1.5 min-w-[120px]">Система</th>
                <th className="px-2 py-1.5 min-w-[150px]">Тип</th>
                <th className="px-2 py-1.5 min-w-[190px]">Модель</th>
                <th className="px-2 py-1.5 min-w-[180px]">Параметры</th>
                <th className="px-2 py-1.5 min-w-[260px]">Схема / Установка</th>
                <th className="px-2 py-1.5 min-w-[92px] text-right font-mono">Q_факт, Вт</th>
                <th className="px-2 py-1.5 w-8">{/* delete */}</th>
              </tr>
            </thead>
            <tbody>
              {equipmentList.map((eq: Equipment, idx: number) => (
                <EquipmentSubRow
                  key={eq.id}
                  equipment={eq}
                  room={room}
                  qRequiredForSectionPick={qRequiredPerEquipment}
                  index={idx}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          Приборы не добавлены. Нажми «+ Добавить прибор» ниже.
        </p>
      )}

      <div className="px-2 py-2 border-t border-[var(--color-border)]">
        <button
          onClick={handleAddEquipment}
          className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline"
          aria-label={`Добавить прибор для ${room.name || 'помещение'}`}
        >
          <Plus size={14} aria-hidden="true" />
          Добавить прибор
        </button>
      </div>
    </div>
  )
}
