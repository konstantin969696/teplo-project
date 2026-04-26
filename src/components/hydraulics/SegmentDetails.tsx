/**
 * SegmentDetails — expanded content строки участка.
 * Показывает d_расч/Re/λ/R/ΣКМС + FormulaAudit для каждой формулы.
 * Подтягивает coolant/pipe/deltaT сам через stores — замкнутый компонент.
 *
 * Decision D-16: аудит формул — подстановка значений как в Phase 2 D-05.
 * Сигнатуры функций строго из Plan 01.
 */

import { useShallow } from 'zustand/react/shallow'
import { FormulaAudit } from '../heatLoss/FormulaAudit'
import { ColumnHint } from '../ColumnHint'
import { HYDRO_HINTS } from './glossary'
import { buildFlowAuditString } from '../../engine/hydraulics'
import { buildReynoldsAuditString } from '../../engine/reynolds'
import { buildFrictionAuditString, buildPressureLossAuditString } from '../../engine/darcyWeisbach'
import { useKmsCatalogStore } from '../../store/kmsCatalogStore'
import { useCoolantCatalogStore } from '../../store/coolantCatalogStore'
import { useProjectStore } from '../../store/projectStore'
import type { Segment } from '../../types/hydraulics'
import type { SegmentCalcResult } from '../../engine/hydraulics'

interface SegmentDetailsProps {
  readonly segment: Segment
  readonly calcResult: SegmentCalcResult | undefined
  readonly onOpenKmsPicker: () => void
}

export function SegmentDetails({ segment, calcResult, onOpenKmsPicker }: SegmentDetailsProps) {
  const kmsCatalog = useKmsCatalogStore(useShallow(s => s.elements))
  const coolantId = useProjectStore(s => s.coolantId)
  const coolant = useCoolantCatalogStore(s => coolantId ? s.coolants[coolantId] : undefined)
  const tSupply = useProjectStore(s => s.tSupply ?? 80)
  const tReturn = useProjectStore(s => s.tReturn ?? 60)
  const deltaT = Math.max(1, tSupply - tReturn)

  return (
    <div className="p-3 bg-[var(--color-surface)] border-b border-[var(--color-border)] text-sm">
      {/* Технические параметры */}
      <div className="grid grid-cols-4 gap-4 mb-3 font-mono text-xs">
        <div>
          <span className="text-[var(--color-text-secondary)]"><ColumnHint label="d_расч:" hint={HYDRO_HINTS.d_calc} /> </span>
          {calcResult?.selectedPipe?.innerDiameterMm.toFixed(1) ?? '—'} мм
        </div>
        <div>
          <span className="text-[var(--color-text-secondary)]"><ColumnHint label="Re:" hint={HYDRO_HINTS.Re} /> </span>
          {calcResult?.re.toFixed(0) ?? '—'}
        </div>
        <div>
          <span className="text-[var(--color-text-secondary)]"><ColumnHint label="λ:" hint={HYDRO_HINTS.lambda} /> </span>
          {calcResult?.lambda.toFixed(4) ?? '—'}
        </div>
        <div>
          <span className="text-[var(--color-text-secondary)]"><ColumnHint label="R:" hint={HYDRO_HINTS.R} /> </span>
          {calcResult?.rPaPerM.toFixed(0) ?? '—'} Па/м
        </div>
      </div>

      {/* КМС конструктор */}
      <div className="mb-3">
        <div className="text-xs text-[var(--color-text-secondary)] mb-1">
          <ColumnHint label="КМС конструктор:" hint={HYDRO_HINTS.kms_builder} />
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {Object.entries(segment.kmsCounts).map(([kmsId, count]) => {
            const kms = kmsCatalog[kmsId]
            if (!kms || count <= 0) return null
            return (
              <span key={kmsId}
                className="px-2 py-1 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded font-mono">
                {kms.name} ({count}) ζ={kms.zeta.toFixed(2)}
              </span>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-xs">
            <ColumnHint label="ΣКМС" hint={HYDRO_HINTS.sum_zeta} /> = {calcResult?.sumZeta.toFixed(2) ?? '0.00'}
          </span>
          <button
            type="button"
            onClick={onOpenKmsPicker}
            className="text-[var(--color-accent)] hover:underline text-xs"
          >
            Изменить КМС →
          </button>
        </div>
      </div>

      {/* Аудит формул — только когда есть данные */}
      {calcResult && coolant && calcResult.selectedPipe && (
        <>
          <FormulaAudit
            auditString={buildFlowAuditString(
              calcResult.qWatts,
              coolant.cKjKgK,
              deltaT,
              calcResult.flowKgH
            )}
            label="Показать расчёт"
          />
          <FormulaAudit
            auditString={buildReynoldsAuditString(
              calcResult.velocityMS,
              calcResult.selectedPipe.innerDiameterMm / 1000,
              coolant.nuM2S,
              calcResult.re
            )}
            label="Показать расчёт"
          />
          <FormulaAudit
            auditString={buildFrictionAuditString(
              calcResult.re,
              calcResult.selectedPipe.roughnessMm,
              calcResult.selectedPipe.innerDiameterMm,
              calcResult.lambda
            )}
            label="Показать расчёт"
          />
          <FormulaAudit
            auditString={buildPressureLossAuditString(
              calcResult.lambda,
              segment.lengthM,
              calcResult.selectedPipe.innerDiameterMm / 1000,
              coolant.rhoKgM3,
              calcResult.velocityMS,
              calcResult.sumZeta,
              calcResult.deltaPLinearPa,
              calcResult.deltaPLocalPa
            )}
            label="Показать расчёт"
          />
        </>
      )}
    </div>
  )
}
