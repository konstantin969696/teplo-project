/**
 * Equipment table — renders header + one EquipmentRow per room in roomOrder,
 * grouped by floor with collapsible group headers (mirrors RoomsTable UX).
 * Column layout: chevron | name | Q_пом | приборов | Σ Q_факт | запас% | +add.
 * Each room row is expandable and contains its own EquipmentSubTable with
 * per-equipment edit fields (multi-equipment support).
 * Semantic HTML: thead + one <tbody> per floor (valid HTML — multiple tbody allowed).
 */

import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Room } from '../../types/project'
import { EquipmentRow } from './EquipmentRow'
import { groupByFloor, pluralizeRooms } from '../room-floor-grouping'
import { ColumnHint } from '../ColumnHint'

interface EquipmentTableProps {
  rooms: Record<string, Room>
  roomOrder: readonly string[]
}

const TOTAL_COLUMNS = 7

export function EquipmentTable({ rooms, roomOrder }: EquipmentTableProps) {
  const groups = useMemo(() => groupByFloor(rooms, roomOrder), [rooms, roomOrder])

  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set())

  const toggleFloor = (floor: number) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(floor)) next.delete(floor)
      else next.add(floor)
      return next
    })
  }

  let runningIndex = 0

  return (
    <div className="overflow-x-auto border border-[var(--color-border)] rounded-md">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface)] text-left text-xs text-[var(--color-text-secondary)] align-bottom">
            <th className="px-2 py-2 w-8">{/* chevron */}</th>
            <th className="px-2 py-2 min-w-[180px]">Помещение</th>
            <th className="px-2 py-2 min-w-[92px] text-right font-mono">
              <ColumnHint label="Q_пом, Вт" hint="Требуемая тепловая мощность помещения — Q_итого из таба «Теплопотери». Сумма всех приборов в комнате должна её покрыть." />
            </th>
            <th className="px-2 py-2 min-w-[88px] text-center">
              <ColumnHint label="Приборов" hint="Сколько отопительных приборов установлено в помещении. Раскрой строку, чтобы увидеть их список и добавить ещё." />
            </th>
            <th className="px-2 py-2 min-w-[96px] text-right font-mono">
              <ColumnHint label="Σ Q_факт" hint="Суммарная фактическая мощность всех приборов в помещении. Считается как Σ по каждому прибору с учётом LMTD и коэффициентов." />
            </th>
            <th className="px-2 py-2 min-w-[84px] text-right font-mono">
              <ColumnHint label="Запас" hint="(Σ Q_факт − Q_пом) / Q_пом · 100%. Отрицательный — приборы не вытягивают нагрузку, красный. Норма 10–20%." />
            </th>
            <th className="px-2 py-2 w-10">{/* +add button */}</th>
          </tr>
        </thead>
        {groups.map(group => {
          const isCollapsed = collapsed.has(group.floor)
          const groupStartIndex = runningIndex
          runningIndex += group.roomIds.length
          return (
            <tbody key={group.floor}>
              <tr
                className="bg-[var(--color-surface)] border-t border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-border)] transition-colors"
                onClick={() => toggleFloor(group.floor)}
                aria-expanded={!isCollapsed}
              >
                <td className="px-2 py-2">
                  <ChevronRight
                    size={14}
                    className={`transition-transform duration-200 text-[var(--color-text-secondary)] ${isCollapsed ? '' : 'rotate-90'}`}
                    aria-hidden="true"
                  />
                </td>
                <td
                  colSpan={TOTAL_COLUMNS - 1}
                  className="px-2 py-2 font-semibold text-[var(--color-text-primary)]"
                >
                  <span className="inline-flex items-center gap-2">
                    Этаж {group.floor}
                    <span className="text-xs font-normal text-[var(--color-text-secondary)]">
                      {group.roomIds.length} {pluralizeRooms(group.roomIds.length)}
                    </span>
                    {/* TODO(phase-7): verify ColumnHint renders cleanly with empty label (no stray empty span). */}
                    <ColumnHint
                      label=""
                      hint="Помещения добавляются и клонируются в табе «Теплопотери»: там в футере каждого этажа есть «+ Добавить помещение», а на строке помещения — иконка копирования (клонирует помещение со всеми стенами, окнами и приборами)."
                    />
                  </span>
                </td>
              </tr>
              {!isCollapsed && group.roomIds.map((id, idxInGroup) => {
                const room = rooms[id]
                if (!room) return null
                return (
                  <EquipmentRow
                    key={id}
                    room={room}
                    index={groupStartIndex + idxInGroup}
                  />
                )
              })}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}
