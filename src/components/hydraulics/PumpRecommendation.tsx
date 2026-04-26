/**
 * PumpRecommendation — info-box рекомендации насоса по ГЦК (per-system, Phase 04.1).
 * Показывает ΔP_ГЦК и напор H. При отсутствии ГЦК — подсказка инженеру.
 */

import { CheckCircle } from 'lucide-react'
import { useGckPath } from './useGckPath'
import { useSystemStore } from '../../store/systemStore'
import { useCoolantCatalogStore } from '../../store/coolantCatalogStore'
import { recommendPump } from '../../engine/hydraulics'
import { ColumnHint } from '../ColumnHint'
import { HYDRO_HINTS } from './glossary'

interface Props {
  readonly systemId: string
}

export function PumpRecommendation({ systemId }: Props) {
  const { gckPath, deltaPGckPa, totalFlowKgH } = useGckPath(systemId)
  const system = useSystemStore(s => s.systems[systemId])
  const coolant = useCoolantCatalogStore(s => (system ? s.coolants[system.coolantId] : undefined))

  if (gckPath.length === 0 || !coolant) {
    return (
      <div
        className="border border-[var(--color-border)] rounded bg-[var(--color-surface)] p-4"
        data-testid="pump-recommendation"
      >
        <h4 className="text-sm font-semibold mb-1">Рекомендация насоса</h4>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Определите главное циркуляционное кольцо
        </p>
      </div>
    )
  }

  const pump = recommendPump(deltaPGckPa, coolant.rhoKgM3, totalFlowKgH)

  return (
    <div
      className="border border-[var(--color-border)] rounded bg-[var(--color-surface)] p-4"
      data-testid="pump-recommendation"
    >
      <h4 className="text-sm font-semibold mb-2">Рекомендация насоса</h4>
      <p className="font-mono text-base font-semibold">
        <ColumnHint label="ΔP_ГЦК" hint={HYDRO_HINTS.deltaP_gck} /> = {deltaPGckPa.toFixed(0)} Па →{' '}
        <ColumnHint label="H" hint={HYDRO_HINTS.H} /> = {pump.headM.toFixed(2)} м.вод.
      </p>
      <p className="flex items-center gap-1 text-xs text-[var(--color-success)] mt-1">
        <CheckCircle size={14} aria-hidden="true" /> Насос рекомендован
      </p>
    </div>
  )
}
