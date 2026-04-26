/**
 * Expandable room row with inline editing and enclosure sub-table accordion.
 * Click row to expand/collapse. Inputs stop propagation to prevent toggling.
 * Accessibility: aria-expanded on trigger.
 */

import { useState, useCallback, useMemo } from 'react'
import { ChevronRight, Copy, Trash2 } from 'lucide-react'
import type { Room } from '../../types/project'
import { useProjectStore } from '../../store/projectStore'
import { useEnclosureStore } from '../../store/enclosureStore'
import { useEquipmentStore } from '../../store/equipmentStore'
import { useShallow } from 'zustand/react/shallow'
import { calculateRoomTotals, buildRoomAuditString } from '../../engine/heatLoss'
import { cloneRoom } from '../room-actions'
import { EnclosureSubTable } from './EnclosureSubTable'
import { InfiltrationSection } from './InfiltrationSection'
import { FormulaAudit } from './FormulaAudit'

interface RoomRowProps {
  room: Room
  index: number
  tOutside: number | null
}

const inputClass = 'border border-[var(--color-border)] rounded px-2 py-1 text-sm bg-[var(--color-bg)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors'

export function RoomRow({ room, index, tOutside }: RoomRowProps) {
  const deltaT = tOutside !== null ? room.tInside - tOutside : null
  const [isExpanded, setIsExpanded] = useState(false)
  const enclosures = useEnclosureStore(
    useShallow(s =>
      s.enclosureOrder
        .filter(id => s.enclosures[id]?.roomId === room.id)
        .map(id => s.enclosures[id])
        .filter((e): e is NonNullable<typeof e> => e != null)
    )
  )

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  const handleUpdate = useCallback((changes: Partial<Omit<Room, 'id'>>) => {
    useProjectStore.getState().updateRoom(room.id, changes)
  }, [room.id])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    useProjectStore.getState().deleteRoom(room.id)
    useEnclosureStore.getState().deleteEnclosuresByRoom(room.id)
    // Phase 3: cascade delete equipment for this room (avoid zombie records — Pitfall 3)
    useEquipmentStore.getState().deleteEquipmentByRoom(room.id)
  }, [room.id])

  const handleClone = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    cloneRoom(room.id)
  }, [room.id])

  const handleNumberCommit = useCallback((e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.currentTarget
    const raw = parseInt(target.value, 10)
    if (!Number.isFinite(raw) || raw < 1 || raw > 9999) {
      // Restore displayed value if input is invalid
      target.value = String(room.number)
      return
    }
    useProjectStore.getState().updateRoom(room.id, { number: raw })
  }, [room.id, room.number])

  // Compute room totals (Q_basic + Q_inf + Q_vent) via engine
  const roomTotals = useMemo(() => {
    if (deltaT === null) return null
    return calculateRoomTotals(enclosures, room, deltaT)
  }, [enclosures, room, deltaT])

  const qBasic = roomTotals?.qBasic ?? null
  const qTotal = roomTotals?.qTotal ?? null

  const zebraClass = index % 2 === 0 ? 'bg-[var(--color-bg)]' : 'bg-[var(--color-surface)]'

  return (
    <>
      <tr
        className={`h-10 cursor-pointer hover:bg-[var(--color-surface)] ${zebraClass}`}
        onClick={toggleExpand}
        aria-expanded={isExpanded}
      >
        {/* Chevron */}
        <td className="px-2 py-1">
          <ChevronRight
            size={14}
            className={`transition-transform duration-200 text-[var(--color-text-secondary)] ${isExpanded ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
        </td>

        {/* Room number (editable, 1..9999 per RU blueprint convention) */}
        <td className="px-2 py-1" onClick={e => e.stopPropagation()}>
          <input
            type="number"
            min={1}
            max={9999}
            step={1}
            defaultValue={room.number}
            key={`${room.id}-${room.number}`}
            onBlur={handleNumberCommit}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleNumberCommit(e)
                ;(e.currentTarget as HTMLInputElement).blur()
              }
            }}
            className={`${inputClass} w-20 text-center font-mono`}
            aria-label={`Номер помещения, текущий ${room.number}`}
            title="Номер помещения по плану"
          />
        </td>

        {/* Name */}
        <td className="px-2 py-1">
          <input
            type="text"
            value={room.name}
            onChange={e => handleUpdate({ name: e.target.value })}
            onClick={e => e.stopPropagation()}
            placeholder="Комната 1"
            className={`${inputClass} min-w-[140px]`}
            aria-label={`Название помещения ${index + 1}`}
          />
        </td>

        {/* Floor */}
        <td className="px-2 py-1">
          <input
            type="number"
            value={room.floor}
            onChange={e => handleUpdate({ floor: Math.max(1, parseInt(e.target.value) || 1) })}
            onClick={e => e.stopPropagation()}
            min={1}
            step={1}
            className={`${inputClass} w-[48px]`}
            aria-label={`Этаж для ${room.name || 'помещение'}`}
          />
        </td>

        {/* Area */}
        <td className="px-2 py-1">
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={room.area || ''}
              onChange={e => handleUpdate({ area: Math.max(0, parseFloat(e.target.value) || 0) })}
              onClick={e => e.stopPropagation()}
              min={0}
              step={0.1}
              placeholder="0.0"
              className={`${inputClass} w-[72px] font-mono`}
              aria-label={`Площадь для ${room.name || 'помещение'}`}
            />
            <span className="text-xs text-[var(--color-text-secondary)]">м{'\u00B2'}</span>
          </div>
        </td>

        {/* Height */}
        <td className="px-2 py-1">
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={room.height}
              onChange={e => handleUpdate({ height: Math.max(2, Math.min(5, parseFloat(e.target.value) || 2.7)) })}
              onClick={e => e.stopPropagation()}
              min={2}
              max={5}
              step={0.1}
              className={`${inputClass} w-[60px] font-mono`}
              aria-label={`Высота для ${room.name || 'помещение'}`}
            />
            <span className="text-xs text-[var(--color-text-secondary)]">м</span>
          </div>
        </td>

        {/* Corner checkbox */}
        <td className="px-2 py-1 text-center">
          <input
            type="checkbox"
            checked={room.isCorner}
            onChange={e => handleUpdate({ isCorner: e.target.checked })}
            onClick={e => e.stopPropagation()}
            className="w-4 h-4 accent-[var(--color-accent)]"
            aria-label={`Угловое помещение ${room.name || ''}`}
          />
        </td>

        {/* tInside */}
        <td className="px-2 py-1">
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={room.tInside}
              onChange={e => handleUpdate({ tInside: parseFloat(e.target.value) || 20 })}
              onClick={e => e.stopPropagation()}
              min={5}
              max={35}
              step={1}
              className={`${inputClass} w-[56px] font-mono`}
              aria-label={`Температура для ${room.name || 'помещение'}`}
            />
            <span className="text-xs text-[var(--color-text-secondary)]">{'\u00B0'}C</span>
          </div>
        </td>

        {/* Q_basic */}
        <td className="px-2 py-1 text-right font-mono text-[var(--color-text-primary)]">
          {qBasic !== null ? Math.round(qBasic) : '\u2014'}
        </td>

        {/* Q_total */}
        <td className="px-2 py-1 text-right font-mono font-semibold text-[var(--color-text-primary)]">
          {qTotal !== null ? Math.round(qTotal) : '\u2014'}
        </td>

        {/* Actions: clone + delete */}
        <td className="px-2 py-1">
          <div className="flex items-center gap-1">
            <button
              onClick={handleClone}
              className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
              aria-label={`Клонировать помещение ${room.name || ''} со всеми ограждениями и приборами`}
              title="Клонировать помещение (со всеми настройками, стенами и приборами)"
            >
              <Copy size={14} aria-hidden="true" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-destructive)] transition-colors"
              aria-label={`Удалить помещение ${room.name || ''}`}
              title="Удалить"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded enclosure sub-table + infiltration + room audit */}
      {isExpanded && (
        <tr>
          <td colSpan={11} className="p-0">
            <div role="region" aria-label={`Ограждения для ${room.name || 'помещение'}`}>
              <EnclosureSubTable
                roomId={room.id}
                deltaT={deltaT}
                isCorner={room.isCorner}
                roomArea={room.area}
              />

              <InfiltrationSection room={room} deltaT={deltaT} />

              {roomTotals && (
                <div className="ml-4 mb-2 mt-1">
                  <FormulaAudit
                    auditString={buildRoomAuditString(
                      roomTotals.qBasic, roomTotals.qInfiltration,
                      roomTotals.qVentilation, roomTotals.qTotal
                    )}
                  />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
