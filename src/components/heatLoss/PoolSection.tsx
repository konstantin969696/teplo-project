/**
 * Pool evaporation parameters sub-section in expanded room row.
 * Collapsible; parameters only shown when pool is enabled.
 */

import { useState, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Room, PoolMode, PoolParams } from '../../types/project'
import { useProjectStore } from '../../store/projectStore'
import { BETA_BY_MODE, calculatePoolEvaporationHeat } from '../../engine/poolEvaporation'

interface PoolSectionProps {
  room: Room
  deltaT: number | null
}

const inputClass = 'border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm bg-[var(--color-bg)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors'

const MODE_LABELS: Record<PoolMode, string> = {
  active:  'Купание',
  idle:    'Покой',
  covered: 'Покрытие',
}

const DEFAULT_POOL_PARAMS: PoolParams = {
  enabled: true,
  fMirrorM2: 0,
  tWaterC: 28,
  phi: 0.6,
  mode: 'active',
}

export function PoolSection({ room, deltaT }: PoolSectionProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleUpdate = useCallback((changes: Partial<Omit<Room, 'id'>>) => {
    useProjectStore.getState().updateRoom(room.id, changes)
  }, [room.id])

  const handlePoolUpdate = useCallback((changes: Partial<PoolParams>) => {
    if (!room.poolParams) return
    handleUpdate({ poolParams: { ...room.poolParams, ...changes } })
  }, [room.poolParams, handleUpdate])

  const handleToggle = useCallback((checked: boolean) => {
    if (checked) {
      handleUpdate({
        poolParams: room.poolParams
          ? { ...room.poolParams, enabled: true }
          : DEFAULT_POOL_PARAMS,
      })
    } else {
      handleUpdate({ poolParams: undefined })
    }
  }, [room.poolParams, handleUpdate])

  const enabled = room.poolParams?.enabled ?? false
  const pool = room.poolParams

  const qEvap = (pool?.enabled && deltaT !== null)
    ? calculatePoolEvaporationHeat(pool, room.tInside)
    : null

  return (
    <div className="mt-2 ml-4 border border-[var(--color-border)] rounded bg-[var(--color-surface)]">
      {/* Section heading with toggle chevron + enable checkbox */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setIsOpen(prev => !prev)}
          className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] hover:opacity-80 transition-opacity"
          aria-expanded={isOpen}
        >
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 text-[var(--color-text-secondary)] ${isOpen ? '' : '-rotate-90'}`}
            aria-hidden="true"
          />
          Бассейн
        </button>
        <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-primary)] cursor-pointer ml-1">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => { e.stopPropagation(); handleToggle(e.target.checked) }}
            className="w-4 h-4 accent-[var(--color-accent)]"
            aria-label="Бассейн в помещении"
          />
          в помещении
        </label>
        {qEvap !== null && qEvap > 0 && (
          <span className="ml-auto text-xs font-mono text-[var(--color-text-secondary)]">
            Q_исп: {Math.round(qEvap)} Вт
          </span>
        )}
      </div>

      {isOpen && enabled && pool && (
        <div className="px-3 pb-3 space-y-3">
          {/* Mirror area */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-secondary)] w-28">Площадь зеркала:</span>
            <input
              type="number"
              value={pool.fMirrorM2 || ''}
              onChange={e => handlePoolUpdate({ fMirrorM2: Math.max(0, parseFloat(e.target.value) || 0) })}
              onClick={e => e.stopPropagation()}
              min={0}
              step={0.1}
              placeholder="0.0"
              className={`${inputClass} w-[80px] font-mono`}
              aria-label="Площадь зеркала бассейна"
            />
            <span className="text-xs text-[var(--color-text-secondary)]">м²</span>
          </div>

          {/* Water temperature */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-secondary)] w-28">t_воды:</span>
            <input
              type="number"
              value={pool.tWaterC}
              onChange={e => handlePoolUpdate({ tWaterC: Math.min(35, Math.max(20, parseFloat(e.target.value) || 28)) })}
              onClick={e => e.stopPropagation()}
              min={20}
              max={35}
              step={1}
              className={`${inputClass} w-[72px] font-mono`}
              aria-label="Температура воды бассейна"
            />
            <span className="text-xs text-[var(--color-text-secondary)]">°C</span>
          </div>

          {/* Humidity */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-secondary)] w-28">Влажность φ:</span>
            <input
              type="number"
              value={Math.round(pool.phi * 100)}
              onChange={e => {
                const pct = parseFloat(e.target.value) || 60
                handlePoolUpdate({ phi: Math.min(1, Math.max(0, pct / 100)) })
              }}
              onClick={e => e.stopPropagation()}
              min={30}
              max={90}
              step={5}
              className={`${inputClass} w-[72px] font-mono`}
              aria-label="Относительная влажность воздуха"
            />
            <span className="text-xs text-[var(--color-text-secondary)]">%</span>
          </div>

          {/* Mode radio buttons */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-secondary)]">Режим эксплуатации:</span>
            <div className="flex flex-wrap items-center gap-4">
              {(Object.keys(MODE_LABELS) as PoolMode[]).map(mode => (
                <label key={mode} className="flex items-center gap-1.5 text-sm text-[var(--color-text-primary)] cursor-pointer">
                  <input
                    type="radio"
                    name={`pool-mode-${room.id}`}
                    value={mode}
                    checked={pool.mode === mode}
                    onChange={() => handlePoolUpdate({ mode })}
                    className="accent-[var(--color-accent)]"
                    aria-label={`Режим ${MODE_LABELS[mode]}`}
                  />
                  {MODE_LABELS[mode]}
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-mono">
                    (β={BETA_BY_MODE[mode]})
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Hint */}
          <p className="text-xs text-[var(--color-text-secondary)]">
            Q_исп добавляется в теплопотери комнаты
          </p>
        </div>
      )}

      {isOpen && !enabled && (
        <p className="px-3 pb-3 text-xs text-[var(--color-text-secondary)]">
          Включите бассейн, чтобы задать параметры
        </p>
      )}
    </div>
  )
}
