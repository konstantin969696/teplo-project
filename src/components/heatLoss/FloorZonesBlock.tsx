/**
 * 4-zone floor decomposition display for floor-ground enclosures.
 * Shows auto-calculated perimeter with manual override (D-03),
 * editable R values per zone (D-04), and zone Q breakdown.
 */

import { useMemo } from 'react'
import type { Enclosure } from '../../types/project'
import { useEnclosureStore } from '../../store/enclosureStore'
import { calculateFloorZones, estimatePerimeter, DEFAULT_ZONE_R } from '../../engine/heatLoss'

interface FloorZonesBlockProps {
  enclosure: Enclosure
  deltaT: number | null
  roomArea: number
}

const ZONE_LABELS = ['I', 'II', 'III', 'IV'] as const

export function FloorZonesBlock({ enclosure, deltaT, roomArea }: FloorZonesBlockProps) {
  const perimeter = enclosure.perimeterOverride ?? estimatePerimeter(roomArea)
  const isPerimeterOverridden = enclosure.perimeterOverride !== null

  const zones = useMemo(() => {
    if (deltaT === null) return null
    return calculateFloorZones(roomArea, perimeter, enclosure.zoneR, deltaT)
  }, [roomArea, perimeter, enclosure.zoneR, deltaT])

  const totalQ = zones ? zones.reduce((s, z) => s + z.qWatts, 0) : null

  const handlePerimeterToggle = () => {
    if (isPerimeterOverridden) {
      useEnclosureStore.getState().updateEnclosure(enclosure.id, { perimeterOverride: null })
    } else {
      useEnclosureStore.getState().updateEnclosure(enclosure.id, { perimeterOverride: perimeter })
    }
  }

  const handlePerimeterChange = (value: string) => {
    const num = parseFloat(value)
    if (Number.isFinite(num) && num > 0) {
      useEnclosureStore.getState().updateEnclosure(enclosure.id, { perimeterOverride: num })
    }
  }

  const handleZoneRChange = (zoneIndex: number, value: string) => {
    const num = parseFloat(value)
    if (!Number.isFinite(num) || num < 0.1) return
    const newZoneR = [...enclosure.zoneR] as [number, number, number, number]
    newZoneR[zoneIndex] = num
    useEnclosureStore.getState().updateEnclosure(enclosure.id, { zoneR: newZoneR })
  }

  const isROverridden = (idx: number) => enclosure.zoneR[idx] !== DEFAULT_ZONE_R[idx]

  return (
    <div className="bg-[var(--color-surface)] border-t border-[var(--color-border)] px-3 py-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Пол по грунту — Зоны
        </span>
        <span className="text-[12px] text-[var(--color-text-secondary)]">
          ({isPerimeterOverridden ? 'ред.' : 'авто'})
        </span>
      </div>

      {/* Perimeter */}
      <div className="flex items-center gap-2 mb-2 text-sm">
        <span className="text-[var(--color-text-secondary)]">Периметр:</span>
        {isPerimeterOverridden ? (
          <input
            type="number"
            value={enclosure.perimeterOverride ?? ''}
            onChange={e => handlePerimeterChange(e.target.value)}
            onClick={e => e.stopPropagation()}
            min={0.1}
            step={0.1}
            className="w-[72px] border border-[var(--color-border)] rounded px-2 py-0.5 text-sm font-mono bg-[var(--color-bg)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
            aria-label="Периметр помещения"
          />
        ) : (
          <span className="font-mono text-sm text-[var(--color-text-primary)]">
            {perimeter.toFixed(1)} м
          </span>
        )}
        {isPerimeterOverridden && (
          <span className="text-[12px] text-amber-600">ред.</span>
        )}
        <button
          onClick={e => { e.stopPropagation(); handlePerimeterToggle() }}
          className="text-[12px] text-[var(--color-accent)] hover:underline underline-offset-2"
        >
          {isPerimeterOverridden ? 'Авто' : 'Переопределить'}
        </button>
      </div>

      {/* Zones table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            <th className="text-left px-1 py-0.5 w-12">Зона</th>
            <th className="text-right px-1 py-0.5 w-16">Ширина</th>
            <th className="text-right px-1 py-0.5 w-16">Площадь</th>
            <th className="text-right px-1 py-0.5 w-20">R_ред</th>
            <th className="text-right px-1 py-0.5 w-20">Q Вт</th>
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3].map(i => {
            const zone = zones?.[i]
            return (
              <tr key={i}>
                <td className="text-left px-1 py-0.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                  {ZONE_LABELS[i]}
                </td>
                <td className="text-right px-1 py-0.5 font-mono text-[var(--color-text-primary)]">
                  {i < 3 ? '2.0м' : 'остат.'}
                </td>
                <td className="text-right px-1 py-0.5 font-mono text-[var(--color-text-primary)]">
                  {zone ? zone.area.toFixed(1) : '\u2014'}
                </td>
                <td className="text-right px-1 py-0.5">
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      value={enclosure.zoneR[i]}
                      onChange={e => handleZoneRChange(i, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      min={0.1}
                      step={0.1}
                      className="w-[52px] text-right border border-[var(--color-border)] rounded px-1 py-0.5 text-sm font-mono bg-[var(--color-bg)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                      aria-label={`R для зоны ${ZONE_LABELS[i]}`}
                    />
                    {isROverridden(i) && (
                      <span className="text-[12px] text-amber-600">ред.</span>
                    )}
                  </div>
                </td>
                <td className="text-right px-1 py-0.5 font-mono text-[var(--color-text-primary)]">
                  {zone ? Math.round(zone.qWatts) : '\u2014'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Total */}
      <div className="text-right mt-1 font-semibold font-mono text-sm text-[var(--color-text-primary)]">
        Q_пол = {totalQ !== null ? `${Math.round(totalQ)} Вт` : '\u2014'}
      </div>
    </div>
  )
}
