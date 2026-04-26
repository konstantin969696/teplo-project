/**
 * Infiltration toggle (rate/gap) + ventilation input with normative tooltip.
 * Collapsible sub-section in expanded room row (D-06, D-07).
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { Info, ChevronDown } from 'lucide-react'
import type { Room } from '../../types/project'
import { useProjectStore } from '../../store/projectStore'
import {
  calculateQInfiltrationByRate,
  calculateQInfiltrationByGap,
  calculateQVentilation
} from '../../engine/heatLoss'

interface InfiltrationSectionProps {
  room: Room
  deltaT: number | null
}

const inputClass = 'border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm bg-[var(--color-bg)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors'

const VENT_NORMS = [
  { room: 'Жилые комнаты', norm: '3 м\u00B3/ч/м\u00B2' },
  { room: 'Кухня', norm: '60 м\u00B3/ч' },
  { room: 'Ванная/санузел', norm: '25 м\u00B3/ч' },
  { room: 'Туалет', norm: '25 м\u00B3/ч' },
  { room: 'Кладовая', norm: 'не норм.' }
] as const

export function InfiltrationSection({ room, deltaT }: InfiltrationSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipBtnRef = useRef<HTMLButtonElement>(null)

  const handleUpdate = useCallback((changes: Partial<Omit<Room, 'id'>>) => {
    useProjectStore.getState().updateRoom(room.id, changes)
  }, [room.id])

  // Close tooltip on click outside or Escape
  useEffect(() => {
    if (!showTooltip) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
        tooltipBtnRef.current && !tooltipBtnRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false)
      }
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTooltip(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [showTooltip])

  const qInf = deltaT !== null
    ? room.infiltrationMethod === 'gap'
      ? calculateQInfiltrationByGap(room.gapArea ?? 0, room.windSpeed ?? 0, deltaT)
      : calculateQInfiltrationByRate(room.area, room.height, room.nInfiltration ?? 0, deltaT)
    : null

  const qVent = deltaT !== null
    ? calculateQVentilation(room.lVentilation, deltaT)
    : null

  return (
    <div className="mt-2 ml-4 border border-[var(--color-border)] rounded bg-[var(--color-surface)]">
      {/* Toggle heading */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg)]/50 transition-colors"
        aria-expanded={isOpen}
      >
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 text-[var(--color-text-secondary)] ${isOpen ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
        Инфильтрация и вентиляция
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-3">
          {/* Infiltration method toggle */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-[var(--color-text-secondary)]">Инфильтрация:</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-primary)] cursor-pointer">
                <input
                  type="radio"
                  name={`infiltration-${room.id}`}
                  value="rate"
                  checked={room.infiltrationMethod === 'rate'}
                  onChange={() => handleUpdate({ infiltrationMethod: 'rate' })}
                  className="accent-[var(--color-accent)]"
                />
                Кратность
              </label>
              <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-primary)] cursor-pointer">
                <input
                  type="radio"
                  name={`infiltration-${room.id}`}
                  value="gap"
                  checked={room.infiltrationMethod === 'gap'}
                  onChange={() => handleUpdate({ infiltrationMethod: 'gap' })}
                  className="accent-[var(--color-accent)]"
                />
                Площадь щелей
              </label>
            </div>
          </div>

          {/* Infiltration inputs */}
          {room.infiltrationMethod === 'rate' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-secondary)]">n_инф:</span>
              <input
                type="number"
                value={room.nInfiltration ?? ''}
                onChange={e => {
                  const raw = e.target.value
                  if (raw === '') return handleUpdate({ nInfiltration: null })
                  const parsed = parseFloat(raw)
                  if (!Number.isFinite(parsed)) return handleUpdate({ nInfiltration: null })
                  handleUpdate({ nInfiltration: Math.max(0, Math.min(5, parsed)) })
                }}
                onClick={e => e.stopPropagation()}
                min={0}
                max={5}
                step={0.1}
                className={`${inputClass} w-[64px] font-mono`}
                aria-label="Кратность инфильтрации"
              />
              <span className="text-xs text-[var(--color-text-secondary)]">кр/ч</span>
              <span className="mx-2 text-[var(--color-text-secondary)]">{'\u2192'}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">Q_инф:</span>
              <span className="font-mono text-sm text-[var(--color-text-primary)]">
                {qInf !== null ? `${Math.round(qInf)} Вт` : '\u2014'}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--color-text-secondary)]">{'\u0394'}a_н:</span>
              <input
                type="number"
                value={room.gapArea ?? ''}
                onChange={e => handleUpdate({ gapArea: Math.max(0, parseFloat(e.target.value) || 0) })}
                onClick={e => e.stopPropagation()}
                min={0}
                step={0.01}
                className={`${inputClass} w-[72px] font-mono`}
                aria-label="Площадь щелей"
              />
              <span className="text-xs text-[var(--color-text-secondary)]">м{'\u00B2'}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">U_пр:</span>
              <input
                type="number"
                value={room.windSpeed ?? ''}
                onChange={e => handleUpdate({ windSpeed: Math.max(0, parseFloat(e.target.value) || 0) })}
                onClick={e => e.stopPropagation()}
                min={0}
                step={0.1}
                className={`${inputClass} w-[64px] font-mono`}
                aria-label="Скорость ветра"
              />
              <span className="text-xs text-[var(--color-text-secondary)]">м/с</span>
              <span className="mx-2 text-[var(--color-text-secondary)]">{'\u2192'}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">Q_инф:</span>
              <span className="font-mono text-sm text-[var(--color-text-primary)]">
                {qInf !== null ? `${Math.round(qInf)} Вт` : '\u2014'}
              </span>
            </div>
          )}

          {/* Ventilation */}
          <div className="flex items-center gap-2 relative">
            <span className="text-xs text-[var(--color-text-secondary)]">L_пр:</span>
            <input
              type="number"
              value={room.lVentilation || ''}
              onChange={e => handleUpdate({ lVentilation: Math.max(0, parseFloat(e.target.value) || 0) })}
              onClick={e => e.stopPropagation()}
              min={0}
              step={1}
              placeholder="0"
              className={`${inputClass} w-[80px] font-mono`}
              aria-label="Вентиляционный расход"
            />
            <span className="text-xs text-[var(--color-text-secondary)]">м{'\u00B3'}/ч</span>

            {/* Info tooltip button */}
            <button
              ref={tooltipBtnRef}
              onClick={e => { e.stopPropagation(); setShowTooltip(prev => !prev) }}
              className="text-[var(--color-accent)] hover:opacity-80"
              aria-label="Нормативные расходы вентиляции"
            >
              <Info size={16} />
            </button>

            {/* Tooltip popover */}
            {showTooltip && (
              <div
                ref={tooltipRef}
                className="absolute left-[200px] top-0 z-30 bg-[var(--color-bg)] border border-[var(--color-border)] shadow-md rounded-md p-2 max-w-[240px]"
              >
                <div className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                  Нормативные расходы вентиляции
                </div>
                <table className="text-xs w-full">
                  <tbody>
                    {VENT_NORMS.map(row => (
                      <tr key={row.room}>
                        <td className="pr-2 py-0.5 text-[var(--color-text-primary)]">{row.room}</td>
                        <td className="py-0.5 font-mono text-[var(--color-text-secondary)]">{row.norm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <span className="mx-2 text-[var(--color-text-secondary)]">{'\u2192'}</span>
            <span className="text-xs text-[var(--color-text-secondary)]">Q_вент:</span>
            <span className="font-mono text-sm text-[var(--color-text-primary)]">
              {qVent !== null ? `${Math.round(qVent)} Вт` : '\u2014'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
