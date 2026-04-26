/**
 * BalancingBlock — таблица балансировки параллельных ветвей per-system (D-12, Phase 04.1).
 * Показывает: ветвь / ΔP / невязка% / требуемый Kvs.
 * Ветви = сегменты системы с parentSegmentId !== null, не входящие в ГЦК.
 */

import { useSegmentStore } from '../../store/segmentStore'
import { useSystemStore } from '../../store/systemStore'
import { useCoolantCatalogStore } from '../../store/coolantCatalogStore'
import { useGckPath } from './useGckPath'
import { calculateBranchImbalance } from '../../engine/hydraulics'
import { ColumnHint } from '../ColumnHint'
import { HYDRO_HINTS } from './glossary'

interface Props {
  readonly systemId: string
}

export function BalancingBlock({ systemId }: Props) {
  const { segmentResults, gckPath, deltaPGckPa } = useGckPath(systemId)
  const segments = useSegmentStore(s => s.segments)
  const system = useSystemStore(s => s.systems[systemId])
  const coolant = useCoolantCatalogStore(s => (system ? s.coolants[system.coolantId] : undefined))

  const gckSet = new Set(gckPath)
  const branches: Array<{ branchId: string; deltaPPa: number; flowKgH: number }> = []

  for (const [id, seg] of Object.entries(segments)) {
    if (seg.systemId !== systemId) continue
    if (gckSet.has(id)) continue
    if (seg.parentSegmentId === null) continue
    const res = segmentResults[id]
    if (!res) continue
    branches.push({ branchId: id, deltaPPa: res.deltaPTotalPa, flowKgH: res.flowKgH })
  }

  if (branches.length === 0 || !coolant) {
    return (
      <div
        className="border border-[var(--color-border)] rounded bg-[var(--color-surface)] p-4"
        data-testid="balancing-block"
      >
        <h4 className="text-sm font-semibold mb-1">Балансировка параллельных ветвей</h4>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Добавьте параллельные ветви для расчёта балансировки
        </p>
      </div>
    )
  }

  const imbalances = calculateBranchImbalance(branches, deltaPGckPa, coolant.rhoKgM3)

  return (
    <div
      className="border border-[var(--color-border)] rounded bg-[var(--color-surface)] p-4"
      data-testid="balancing-block"
    >
      <h4 className="text-sm font-semibold mb-2">Балансировка параллельных ветвей</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
            <th className="text-left py-1">Ветвь</th>
            <th className="text-right py-1"><ColumnHint label="ΔP_ветви, Па" hint={HYDRO_HINTS.deltaP_branch} /></th>
            <th className="text-right py-1"><ColumnHint label="Невязка %" hint="Относительное расхождение ΔP этой ветви с ΔP_ГЦК. Норма ≤ 15%. Больше — нужна балансировка" /></th>
            <th className="text-right py-1"><ColumnHint label="Kvs требуемый, м³/ч" hint="Пропускная способность балансировочного клапана при полном открытии для выравнивания ΔP ветви" /></th>
          </tr>
        </thead>
        <tbody>
          {imbalances.map(b => {
            const abs = Math.abs(b.imbalancePct)
            const colorClass = abs > 30
              ? 'text-[var(--color-destructive)]'
              : abs > 15 ? 'text-[var(--color-warning)]'
              : 'text-[var(--color-text-primary)]'
            return (
              <tr key={b.branchId} className="h-9">
                <td className="py-1">{segments[b.branchId]?.name ?? b.branchId.slice(-4)}</td>
                <td className="text-right font-mono py-1">{b.deltaPPa.toFixed(0)}</td>
                <td className={`text-right font-mono py-1 ${colorClass}`}>{b.imbalancePct.toFixed(0)}%</td>
                <td className="text-right font-mono py-1">{b.requiredKvs.toFixed(2)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
