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
 *
 * Phase comfort-ufh: если переданы tSupplyEff/tReturnEff — используются вместо
 * системных (computed from inverse problem in UfhLoopRow).
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
  readonly qRoomW: number | null
  readonly threshold: number
  readonly isBathroom: boolean
  /** Effective supply temp for this loop (comfort mode: computed from inverse problem). */
  readonly tSupplyEff?: number
  /** Effective return temp for this loop (comfort mode: computed from inverse problem). */
  readonly tReturnEff?: number
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
  tSupplyEff,
  tReturnEff,
}: UfhLoopDetailsProps) {
  const pipe = usePipeCatalogStore(s => s.pipes[loop.pipeId])
  // Per-system: берём coolant из системы, к которой привязан loop.
  const system = useSystemStore(s => s.systems[loop.systemId])
  const coolant = useCoolantCatalogStore(s => (system ? s.coolants[system.coolantId] : undefined))
  const { tSupply: tSupplySystem, tReturn: tReturnSystem } = useUfhSystemTemps(loop.id)

  // Effective temps: from comfort inverse problem (if provided) or system defaults.
  const tSup = tSupplyEff ?? tSupplySystem
  const tRet = tReturnEff ?? tReturnSystem

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
  // Гидравлика считается на ОДИН контур: полная мощность и длина делятся на N контуров.
  // Иначе при большой площади (бассейн, склад) ΔP уходит в кубические нелинейности (≈100 МПа).
  const qPerLoop = loopCount > 0 ? qTpW / loopCount : qTpW
  const lengthPerLoop = loopCount > 0 ? loopLengthM / loopCount : loopLengthM
  const hydr = calculateLoopHydraulics(qPerLoop, tSup, tRet, pipe, coolant, lengthPerLoop)

  const auditString = buildUfhAuditString(
    tSup,
    tRet,
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

  const isComfort = loop.mode === 'comfort' && loop.targetFloorTempC != null
  const comfortTempsAdjusted = isComfort && tSupplyEff != null

  return (
    <div className="p-3 bg-[var(--color-surface)] border-b border-[var(--color-border)] text-sm">
      {/* Comfort-mode info banner */}
      {isComfort && (
        <div className="mb-3 px-3 py-2 rounded-md bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-xs text-[var(--color-text-primary)]">
          {comfortTempsAdjusted ? (
            <>
              Комфорт-режим: подобрано{' '}
              <span className="font-mono font-semibold">{tSup.toFixed(1)}/{tRet.toFixed(1)}°C</span>{' '}
              для t_пола{' '}
              <span className="font-mono font-semibold">{loop.targetFloorTempC}°C</span>
            </>
          ) : (
            <span className="text-[var(--color-destructive)]">
              Комфорт-режим: невозможно — целевая t_пола ({loop.targetFloorTempC}°C) ≤ t_воздуха ({room.tInside}°C). Используются системные температуры.
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-3 font-mono text-xs">
        <div>
          <span className="text-[var(--color-text-secondary)]"><ColumnHint label="t_пол_ср:" hint={UFH_HINTS.t_floor} /> </span>
          {isComfort && loop.targetFloorTempC != null && comfortTempsAdjusted
            ? <span className="font-semibold">{loop.targetFloorTempC.toFixed(1)}</span>
            : formatFloorTemp(floorTempC)
          }°C{' '}
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
