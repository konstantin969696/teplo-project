/**
 * Rooms table with expandable rows (accordion) grouped by floor.
 * Each floor renders as a collapsible group header + nested RoomRow tbody +
 * a floor-footer row with an inline "+N add rooms on this floor" control.
 * Semantic HTML: thead + one tbody per floor (valid HTML — multiple tbody allowed).
 * Horizontal scroll on mobile via overflow-x-auto.
 */

import { useMemo, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import type { Room } from '../../types/project'
import { RoomRow } from './RoomRow'
import { groupByFloor, pluralizeRooms } from '../room-floor-grouping'
import { addRoomsToFloor } from '../room-actions'
import { ColumnHint } from '../ColumnHint'
import { INPUT_CLASS } from '../equipment/equipment-help'

interface RoomsTableProps {
  rooms: Record<string, Room>
  roomOrder: readonly string[]
  tOutside: number | null
}

const TOTAL_COLUMNS = 11

interface FloorFooterRowProps {
  readonly floor: number
  readonly colSpan: number
}

function FloorFooterRow({ floor, colSpan }: FloorFooterRowProps) {
  const [count, setCount] = useState<number>(1)
  const handleAdd = () => {
    const n = Number.isFinite(count) ? Math.max(1, Math.min(50, Math.round(count))) : 1
    addRoomsToFloor(floor, n)
  }
  return (
    <tr className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
      <td className="px-2 py-2" />
      <td colSpan={colSpan} className="px-2 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            Сколько:
            <input
              type="number"
              min={1}
              max={50}
              step={1}
              value={count}
              onChange={e => {
                const v = parseInt(e.target.value, 10)
                if (Number.isFinite(v)) setCount(v)
              }}
              className={`${INPUT_CLASS} w-16 font-mono`}
              aria-label={`Количество добавляемых помещений на этаж ${floor}`}
            />
          </label>
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline"
            aria-label={`Добавить ${count} ${pluralizeRooms(count)} на этаж ${floor}`}
          >
            <Plus size={14} aria-hidden="true" />
            Добавить помещение{count > 1 ? ` ×${count}` : ''}
          </button>
        </div>
      </td>
    </tr>
  )
}

export function RoomsTable({ rooms, roomOrder, tOutside }: RoomsTableProps) {
  const groups = useMemo(() => groupByFloor(rooms, roomOrder), [rooms, roomOrder])

  // Collapsed floor numbers — default: all expanded (empty set).
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set())

  const toggleFloor = (floor: number) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(floor)) next.delete(floor)
      else next.add(floor)
      return next
    })
  }

  // Track running room index across groups so the No. column stays continuous.
  let runningIndex = 0

  return (
    <div className="overflow-x-auto border border-[var(--color-border)] rounded-md">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface)] text-left text-xs text-[var(--color-text-secondary)] align-bottom">
            <th className="px-2 py-2 w-8">{/* chevron */}</th>
            <th className="px-2 py-2 w-24">
              <ColumnHint label={'\u2116'} hint="Номер помещения по плану (например, 101, 205). Правь вручную — произвольное число до 9999." />
            </th>
            <th className="px-2 py-2 min-w-[160px]">Помещение</th>
            <th className="px-2 py-2 min-w-[56px]">
              <ColumnHint label="Эт." hint="Этаж, на котором находится помещение. Группирует помещения в таблице и задаёт префикс автономера (этаж·100 + N)." />
            </th>
            <th className="px-2 py-2 min-w-[84px]">
              <ColumnHint label={`Пл. м${'\u00B2'}`} hint="Площадь помещения в квадратных метрах. Идёт в расчёт Q_инф по кратности, Q_вент и удельных теплопотерь (Вт/м²)." />
            </th>
            <th className="px-2 py-2 min-w-[80px]">
              <ColumnHint label="Выс. м" hint="Высота помещения в метрах (по умолчанию 2,7). Используется в формуле Q_инф = 0.337·A·h·n·Δt." />
            </th>
            <th className="px-2 py-2 min-w-[52px]">
              <ColumnHint label="Угл." hint="Угловое помещение — галочка добавляет поправку β_угл = 0.05 к теплопотерям через ограждения (СП 50.13330)." />
            </th>
            <th className="px-2 py-2 min-w-[68px]">
              <ColumnHint label="t°C" hint="Расчётная температура внутри помещения (по СП 60.13330). Обычно 20°C для жилых, 18°C для коридоров, 25°C для ванных." />
            </th>
            <th className="px-2 py-2 min-w-[84px] text-right font-mono">
              <ColumnHint label="Q_осн Вт" hint="Основные теплопотери через ограждения комнаты. Сумма Q = K·A·Δt·n·(1+β_ор+β_угл) по стенам, окнам, дверям, перекрытиям." />
            </th>
            <th className="px-2 py-2 min-w-[90px] text-right font-mono">
              <ColumnHint label="Q_итого Вт" hint="Суммарные теплопотери: Q_осн + Q_инф + Q_вент. Это значение подставляется в таб «Приборы отопления» как Q_пом." />
            </th>
            <th className="px-2 py-2 w-10">{/* actions: clone + delete */}</th>
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
                  Этаж {group.floor}
                  <span className="ml-2 text-xs font-normal text-[var(--color-text-secondary)]">
                    {group.roomIds.length} {pluralizeRooms(group.roomIds.length)}
                  </span>
                </td>
              </tr>
              {!isCollapsed && group.roomIds.map((id, idxInGroup) => {
                const room = rooms[id]
                if (!room) return null
                return (
                  <RoomRow
                    key={id}
                    room={room}
                    index={groupStartIndex + idxInGroup}
                    tOutside={tOutside}
                  />
                )
              })}
              {!isCollapsed && (
                <FloorFooterRow floor={group.floor} colSpan={TOTAL_COLUMNS - 1} />
              )}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}
