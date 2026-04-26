/**
 * Summary results table showing Q_osn / Q_inf / Q_vent / Q_total / Wt/m2 per room.
 * Footer row shows building totals. Row tints by specific heat loss severity.
 * Primary visual anchor of the Heat Loss tab (HLOSS-11).
 */

import { useMemo } from 'react'
import type { Room, RoomHeatLossResult } from '../../types/project'
import { useEnclosureStore } from '../../store/enclosureStore'
import { calculateRoomTotals, buildRoomAuditString } from '../../engine/heatLoss'
import { FormulaAudit } from './FormulaAudit'
import { ColumnHint } from '../ColumnHint'

interface ResultsTableProps {
  rooms: Record<string, Room>
  roomOrder: readonly string[]
  tOutside: number | null
}

function getSeverityTint(qSpecific: number): string {
  if (qSpecific > 100) return 'rgba(220,38,38,0.06)'
  if (qSpecific >= 60) return 'rgba(217,119,6,0.06)'
  return ''
}

export function ResultsTable({ rooms, roomOrder, tOutside }: ResultsTableProps) {
  const enclosures = useEnclosureStore(s => s.enclosures)
  const enclosureOrder = useEnclosureStore(s => s.enclosureOrder)

  const results = useMemo((): RoomHeatLossResult[] => {
    if (tOutside === null) return []
    return roomOrder.map(rid => {
      const room = rooms[rid]
      if (!room) return null
      const deltaT = room.tInside - tOutside
      const roomEncs = enclosureOrder
        .filter(eid => enclosures[eid]?.roomId === rid)
        .map(eid => enclosures[eid])
        .filter((e): e is NonNullable<typeof e> => e != null)
      return calculateRoomTotals(roomEncs, room, deltaT)
    }).filter((r): r is RoomHeatLossResult => r !== null)
  }, [rooms, roomOrder, enclosures, enclosureOrder, tOutside])

  const totals = useMemo(() => {
    if (results.length === 0) return null
    const sums = results.reduce(
      (acc, r) => ({
        qBasic: acc.qBasic + r.qBasic,
        qInfiltration: acc.qInfiltration + r.qInfiltration,
        qVentilation: acc.qVentilation + r.qVentilation,
        qTotal: acc.qTotal + r.qTotal,
        area: acc.area + r.area
      }),
      { qBasic: 0, qInfiltration: 0, qVentilation: 0, qTotal: 0, area: 0 }
    )
    return {
      ...sums,
      qSpecific: sums.area > 0 ? sums.qTotal / sums.area : 0
    }
  }, [results])

  if (roomOrder.length === 0) return null

  return (
    <div className="mt-6">
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
        Результаты расчёта теплопотерь
      </h2>

      <div className="overflow-x-auto border border-[var(--color-border)] rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface)] align-bottom">
              <th className="px-3 py-2 min-w-[160px]">Помещение</th>
              <th className="px-3 py-2 text-right min-w-[48px]">Этаж</th>
              <th className="px-3 py-2 text-right min-w-[90px] font-mono">
                <ColumnHint label="Q_осн Вт" hint="Основные теплопотери через ограждения: сумма Q = K·A·Δt·n·(1+β_ор+β_угл) по всем стенам/окнам/дверям/перекрытиям/полу комнаты." />
              </th>
              <th className="px-3 py-2 text-right min-w-[90px] font-mono">
                <ColumnHint label="Q_инф Вт" hint="Теплопотери на инфильтрацию наружного воздуха через неплотности. Q = 0.337·A·h·n·Δt (по кратности) или 0.337·S_щ·v·Δt (по щелям)." />
              </th>
              <th className="px-3 py-2 text-right min-w-[90px] font-mono">
                <ColumnHint label="Q_вент Вт" hint="Теплопотери на нагрев приточного вентиляционного воздуха. Q = 0.337·L·Δt, где L — расход приточки, м³/ч." />
              </th>
              <th className="px-3 py-2 text-right min-w-[90px] font-mono">
                <ColumnHint label="Q_итого Вт" hint="Суммарные теплопотери комнаты: Q_осн + Q_инф + Q_вент. Именно это значение идёт в подбор отопительных приборов." />
              </th>
              <th className="px-3 py-2 text-right min-w-[88px] font-mono">
                <ColumnHint label={`Вт/м${'\u00B2'}`} hint="Удельные теплопотери на квадратный метр площади: Q_итого / площадь комнаты. Индикатор качества утепления: хорошо <60, средне 60–100, плохо >100." />
              </th>
            </tr>
          </thead>
          <tbody>
            {roomOrder.map(rid => {
              const room = rooms[rid]
              if (!room) return null
              const result = results.find(r => r.roomId === rid)

              const bgTint = result ? getSeverityTint(result.qSpecific) : ''

              return (
                <tr
                  key={rid}
                  className="border-t border-[var(--color-border)]"
                  style={bgTint ? { background: bgTint } : undefined}
                >
                  <td className="px-3 py-2 text-[var(--color-text-primary)]">
                    {room.name || '\u2014'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--color-text-primary)]">
                    {room.floor}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--color-text-primary)]">
                    {result ? Math.round(result.qBasic) : '\u2014'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--color-text-primary)]">
                    {result ? Math.round(result.qInfiltration) : '\u2014'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--color-text-primary)]">
                    {result ? Math.round(result.qVentilation) : '\u2014'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-[var(--color-text-primary)]">
                    <div className="flex items-center justify-end gap-2">
                      <span>{result ? Math.round(result.qTotal) : '\u2014'}</span>
                      {result && (
                        <FormulaAudit
                          auditString={buildRoomAuditString(
                            result.qBasic, result.qInfiltration,
                            result.qVentilation, result.qTotal
                          )}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--color-text-primary)]">
                    {result ? Math.round(result.qSpecific) : '\u2014'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {totals && (
            <tfoot>
              <tr className="font-semibold border-t-2 border-[var(--color-text-secondary)]">
                <td className="px-3 py-2 text-[var(--color-text-primary)]" scope="row">
                  Итого по зданию
                </td>
                <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">{'\u2014'}</td>
                <td className="px-3 py-2 text-right font-mono text-[var(--color-text-primary)]">
                  {Math.round(totals.qBasic)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[var(--color-text-primary)]">
                  {Math.round(totals.qInfiltration)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[var(--color-text-primary)]">
                  {Math.round(totals.qVentilation)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[var(--color-text-primary)]">
                  {Math.round(totals.qTotal)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[var(--color-text-primary)]">
                  {Math.round(totals.qSpecific)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
