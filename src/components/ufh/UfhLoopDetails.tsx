/**
 * Expanded-row content for UfhLoopRow. Shows:
 * 1) t_пол_ср / Q_тп / L_контура / N_контуров / ΔP_конт
 * 2) FormulaAudit (buildUfhAuditString)
 * 3) UfhWarnings (amber Q < Q_пом + red t_пол > норма)
 *
 * Paттерн P11 (EquipmentDetails adapted for UFH).
 * Heavy computations done here (loop length, hydraulics) — not in store.
 *
 * Phase 04.1 Plan 06: per-system источники данных (D-14).
 *   - tSupplyUfh/tReturnUfh → useUfhSystemTemps(loop.id)
 *   - coolantId → из HeatingSystem, привязанной к loop.systemId
 */

import { FormulaAudit } from '../heatLoss/FormulaAudit'
import { ColumnHint } from '../ColumnHint'
import { UFH_HINTS } from '../hydraulics/glossary'
import {
  calculateLoopLength,
  calculateLoopCount,
  calculateLoopHydraulics,
  buildUfhAuditString,
} from '../../engine/ufh'
import { usePipeCatalogStore } from '../../store/pipeCatalogStore'
import { useCoolantCatalogStore } from '../../store/coolantCatalogStore'
import { useSystemStore } from '../../store/systemStore'
import { useUfhSystemTemps } from '../../hooks/useUfhSystemTemps'
import { UfhWarnings } from './UfhWarning'
import type { Room } from '../../types/project'
import type { UfhLoop } from '../../types/hydraulics'
import { formatFloorTemp, formatLoopLength } from './ufh-help'

interface UfhLoopDetailsProps {
  readonly room: Room
  readonly loop: UfhLoop
  readonly qPerM2: number
  readonly qTpW: number
  readonly floorTempC: number
  readonly qRoomW: number
  readonly threshold: number
  readonly isBathroom: boolean
}

export function UfhLoopDetails({
  room,
  loop,
  qPerM2,
  qTpW,
  floorTempC,
  qRoomW,
  threshold,
  isBathroom,
}: UfhLoopDetailsProps) {
  const pipe = usePipeCatalogStore(s => s.pipes[loop.pipeId])
  // Per-system: берём coolant из системы, к которой привязан loop.
  const system = useSystemStore(s => s.systems[loop.systemId])
  const coolant = useCoolantCatalogStore(s => (system ? s.coolants[system.coolantId] : undefined))
  const { tSupply: tSupplyUfh, tReturn: tReturnUfh } = useUfhSystemTemps(loop.id)

  if (!pipe || !coolant) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-secondary)]">
        Труба или теплоноситель не найдены в каталоге
      </div>
    )
  }

  const loopLengthM = calculateLoopLength(loop.activeAreaM2, loop.stepCm, loop.leadInM)
  const maxLen = pipe.maxLoopLengthM ?? 90
  const loopCount = calculateLoopCount(loopLengthM, maxLen)
  const hydr = calculateLoopHydraulics(qTpW, tSupplyUfh, tReturnUfh, pipe, coolant, loopLengthM)

  const auditString = buildUfhAuditString(
    tSupplyUfh,
    tReturnUfh,
    room.tInside,
    loop.covering,
    loop.activeAreaM2,
    loop.stepCm,
    qPerM2,
    qTpW,
    floorTempC,
    loopLengthM,
    loopCount,
  )

  return (
    <div className="p-3 bg-[var(--color-surface)] border-b border-[var(--color-border)] text-sm">
      <div className="grid grid-cols-4 gap-4 mb-3 font-mono text-xs">
        <div>
          <span className="text-[var(--color-text-secondary)]"><ColumnHint label="t_пол_ср:" hint={UFH_HINTS.t_floor} /> </span>
          {formatFloorTemp(floorTempC)}°C{' '}
          <span className="text-[var(--color-text-secondary)]">(≤ {threshold}°C)</span>
        </div>
        <div>
          <span className="text-[var(--color-text-secondary)]"><ColumnHint label="Q_тп:" hint={UFH_HINTS.Q_tp} /> </span>
          {qTpW.toFixed(0)} Вт
        </div>
        <div>
          <span className="text-[var(--color-text-secondary)]"><ColumnHint label="L_контура:" hint={UFH_HINTS.L_loop} /> </span>
          {formatLoopLength(loopLengthM)} м
        </div>
        <div>
          <span className="text-[var(--color-text-secondary)]"><ColumnHint label="N_контуров:" hint={UFH_HINTS.N_loops} /> </span>
          {loopCount}
        </div>
        <div className="col-span-2">
          <span className="text-[var(--color-text-secondary)]"><ColumnHint label="ΔP_конт:" hint={UFH_HINTS.deltaP_loop} /> </span>
          {(hydr.deltaPTotalPa / 1000).toFixed(2)} кПа
        </div>
      </div>
      <FormulaAudit auditString={auditString} label="Расчёт UFH — показать" />
      <div className="mt-3">
        <UfhWarnings
          qTpWatts={qTpW}
          qRoomWatts={qRoomW}
          floorTempC={floorTempC}
          floorTempThresholdC={threshold}
          isBathroom={isBathroom}
        />
      </div>
    </div>
  )
}
