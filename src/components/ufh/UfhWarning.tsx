/**
 * Inline warnings for UFH loop.
 * Two separate blocks: amber if Q_тп < Q_пом, red if t_пол > 29/33°C.
 * role="alert" для accessibility.
 * Паттерн P10 (InsufficientWarning адаптированный для UFH — два варианта).
 */

import { AlertTriangle } from 'lucide-react'

export interface UfhWarningsProps {
  readonly qTpWatts: number
  readonly qRoomWatts: number
  readonly floorTempC: number
  readonly floorTempThresholdC: number
  readonly isBathroom: boolean
}

export function UfhWarnings({
  qTpWatts,
  qRoomWatts,
  floorTempC,
  floorTempThresholdC,
  isBathroom,
}: UfhWarningsProps) {
  const insufficientQ = qRoomWatts > 0 && qTpWatts < qRoomWatts
  const exceedsTemp = floorTempC > floorTempThresholdC

  if (!insufficientQ && !exceedsTemp) return null

  const coveragePct = qRoomWatts > 0 ? Math.round((qTpWatts / qRoomWatts) * 100) : 0

  return (
    <div className="space-y-2">
      {insufficientQ && (
        <div
          className="bg-[var(--color-surface)] border border-[var(--color-warning)] rounded p-2 text-xs flex gap-2 items-start"
          role="alert"
        >
          <AlertTriangle
            size={14}
            className="text-[var(--color-warning)] mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div className="text-[var(--color-text-primary)]">
            <span className="text-[var(--color-warning)] font-semibold">Недостаточная теплоотдача. </span>
            Q_тп = {qTpWatts.toFixed(0)} Вт &lt; Q_пом = {qRoomWatts.toFixed(0)} Вт — тёплый пол покрывает {coveragePct}% тепловой нагрузки
          </div>
        </div>
      )}
      {exceedsTemp && (
        <div
          className="bg-[var(--color-surface)] border border-[var(--color-destructive)] rounded p-2 text-xs flex gap-2 items-start"
          role="alert"
        >
          <AlertTriangle
            size={14}
            className="text-[var(--color-destructive)] mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div className="text-[var(--color-text-primary)]">
            <span className="text-[var(--color-destructive)] font-semibold">Перегрев пола. </span>
            Температура пола {floorTempC.toFixed(1)}°C превышает норму {floorTempThresholdC}°C{' '}
            {isBathroom ? '(ванные/влажные помещения, СП 60)' : '(жилые помещения, СП 60)'}
          </div>
        </div>
      )}
    </div>
  )
}
