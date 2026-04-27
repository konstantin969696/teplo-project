/**
 * Equipment results summary table — project-wide rollup (EQUIP-09).
 * One row per room aggregating ALL equipment installed: combined Q_факт,
 * comma-joined типоразмер line, single surplus% against the room's Q_пом.
 * Supports multi-equipment rooms (radiator + underfloor convector, 2 radiators,
 * etc.) by summing per-equipment Q_факт via deriveEquipmentQActual.
 * Footer: Σ Q_пом / Σ Q_факт across all rooms.
 */

import { useEffect, useMemo, useState } from 'react'
import type {
  CatalogModel,
  Equipment,
  Room,
} from '../../types/project'
import type { HeatingSystem } from '../../types/system'
import { useProjectStore } from '../../store/projectStore'
import { useEnclosureStore } from '../../store/enclosureStore'
import { useEquipmentStore } from '../../store/equipmentStore'
import { useCatalogStore } from '../../store/catalogStore'
import { useSystemStore } from '../../store/systemStore'
import { getEngineWorker } from '../../workers/useEngineWorker'
import { calculateLMTD } from '../../engine/equipment'
import { deriveEquipmentQActual, formatSurplusPct } from './equipment-help'
import { ColumnHint } from '../ColumnHint'

interface Row {
  readonly roomId: string
  readonly roomName: string
  readonly qRequired: number | null
  readonly tDelta: string
  readonly typeSize: string
  readonly qActual: number | null
  readonly equipmentCount: number
  readonly surplusPct: string
  readonly insufficient: boolean
}

function describeOne(
  equipment: Equipment,
  model: CatalogModel | null,
  sectionsComputed: number | null,
): string {
  if (model === null) {
    const q = equipment.manualQNominal
    return `Ручной (Q=${q !== null ? Math.round(q) : '—'} Вт)`
  }
  if (model.kind === 'panel') {
    const h = equipment.panelHeightMm ?? '—'
    const l = equipment.panelLengthMm ?? '—'
    return `${model.manufacturer} ${model.series} ${h}×${l}`
  }
  if (model.kind === 'underfloor-convector') {
    const len = equipment.convectorLengthMm ?? '—'
    return `${model.manufacturer} ${model.series} ×${len}мм`
  }
  const sections = equipment.sectionsOverride ?? sectionsComputed ?? 0
  return `${model.manufacturer} ${model.series} × ${sections} секц.`
}

function computeRow(
  room: Room,
  qRequired: number | null,
  roomEquipment: readonly Equipment[],
  models: Record<string, CatalogModel>,
  systemsMap: Record<string, HeatingSystem>,
): Row {
  if (roomEquipment.length === 0) {
    return {
      roomId: room.id,
      roomName: room.name,
      qRequired,
      tDelta: '—',
      typeSize: '—',
      qActual: null,
      equipmentCount: 0,
      surplusPct: '—',
      insufficient: false,
    }
  }

  // tDelta display: use first equipment's system temps, fall back to 80/60
  const firstSys = roomEquipment[0].systemId ? systemsMap[roomEquipment[0].systemId] : undefined
  const displayTSup = firstSys?.tSupply ?? 80
  const displayTRet = firstSys?.tReturn ?? 60
  const tDelta = `${displayTSup}-${displayTRet}`

  // Split target load across equipment for sectional auto-pick
  const target = qRequired !== null ? qRequired / roomEquipment.length : null

  let qActualSum = 0
  let anyValid = false
  const parts: string[] = []
  for (const eq of roomEquipment) {
    const sys = eq.systemId ? systemsMap[eq.systemId] : undefined
    const tSup = sys?.tSupply ?? 80
    const tRet = sys?.tReturn ?? 60
    const lmtd = calculateLMTD(tSup, tRet, room.tInside)
    const model = eq.catalogModelId ? models[eq.catalogModelId] ?? null : null
    const { qActual, sectionsAccepted } = deriveEquipmentQActual(eq, model, target, lmtd)
    if (qActual !== null) {
      qActualSum += qActual
      anyValid = true
    }
    parts.push(describeOne(eq, model, sectionsAccepted))
  }

  const qActual = anyValid ? qActualSum : null
  const insufficient = qActual !== null && qRequired !== null && qActual < qRequired

  return {
    roomId: room.id,
    roomName: room.name,
    qRequired,
    tDelta,
    typeSize: parts.join(' + '),
    qActual,
    equipmentCount: roomEquipment.length,
    surplusPct:
      qActual !== null && qRequired !== null ? formatSurplusPct(qActual, qRequired) : '—',
    insufficient,
  }
}

export function EquipmentResultsTable() {
  const rooms = useProjectStore(s => s.rooms)
  const roomOrder = useProjectStore(s => s.roomOrder)
  const tOutside = useProjectStore(s => s.city?.tOutside ?? null)

  const enclosuresAll = useEnclosureStore(s => s.enclosures)
  const enclosureOrder = useEnclosureStore(s => s.enclosureOrder)

  const equipmentAll = useEquipmentStore(s => s.equipment)
  const equipmentOrder = useEquipmentStore(s => s.equipmentOrder)

  const models = useCatalogStore(s => s.models)
  const systemsMap = useSystemStore(s => s.systems)

  const [roomQMap, setRoomQMap] = useState<Readonly<Record<string, number | null>>>({})

  useEffect(() => {
    if (tOutside === null) { setRoomQMap({}); return }
    let cancelled = false
    getEngineWorker()
      .heatLossForRooms(enclosuresAll, enclosureOrder, rooms, roomOrder, tOutside)
      .then(results => {
        if (!cancelled) {
          const map: Record<string, number | null> = {}
          roomOrder.forEach((rid, i) => { map[rid] = results[i]?.qTotal ?? null })
          setRoomQMap(map)
        }
      })
    return () => { cancelled = true }
  }, [tOutside, enclosuresAll, enclosureOrder, rooms, roomOrder])

  const rowData = useMemo<readonly Row[]>(() => {
    return roomOrder
      .map(rid => {
        const room = rooms[rid]
        if (!room) return null
        const roomEquipment: Equipment[] = equipmentOrder
          .map(eid => equipmentAll[eid])
          .filter((e): e is Equipment => e != null && e.roomId === rid)
        const qRequired = roomQMap[rid] ?? null
        return computeRow(room, qRequired, roomEquipment, models, systemsMap)
      })
      .filter((r): r is Row => r !== null)
  }, [
    rooms,
    roomOrder,
    roomQMap,
    equipmentAll,
    equipmentOrder,
    models,
    systemsMap,
  ])

  const { sumQRequired, sumQActual } = useMemo(() => {
    let sumQReq = 0
    let sumQAct = 0
    for (const r of rowData) {
      if (r.qRequired !== null) sumQReq += r.qRequired
      if (r.qActual !== null) sumQAct += r.qActual
    }
    return { sumQRequired: sumQReq, sumQActual: sumQAct }
  }, [rowData])

  if (roomOrder.length === 0) return null

  return (
    <div className="mt-6">
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
        Итоги подбора приборов
      </h2>

      <div className="overflow-x-auto border border-[var(--color-border)] rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface)] align-bottom">
              <th className="px-3 py-2 min-w-[160px]">Помещение</th>
              <th className="px-3 py-2 text-right min-w-[100px] font-mono">
                <ColumnHint label="Q_пом, Вт" hint="Требуемая тепловая мощность помещения — Q_итого из таба «Теплопотери»." />
              </th>
              <th className="px-3 py-2 text-center min-w-[96px] font-mono">
                <ColumnHint label="tп − tо, °C" hint="Разность температур подачи и обратки в системе отопления. Определяет температурный напор (LMTD) для подбора прибора." />
              </th>
              <th className="px-3 py-2 text-left min-w-[240px]">
                <ColumnHint label="Типоразмер" hint="Список установленных приборов в комнате через «+». «—» — ни одного прибора не добавлено." />
              </th>
              <th className="px-3 py-2 text-right min-w-[100px] font-mono">
                <ColumnHint label="Σ Q_факт, Вт" hint="Суммарная фактическая мощность всех приборов помещения. Складывается по каждому прибору с учётом LMTD и коэффициентов." />
              </th>
              <th className="px-3 py-2 text-right min-w-[92px] font-mono">
                <ColumnHint label="Запас, %" hint="(Σ Q_факт − Q_пом) / Q_пом · 100%. Отрицательный → приборы не вытягивают нагрузку." />
              </th>
            </tr>
          </thead>
          <tbody>
            {rowData.map(r => (
              <tr
                key={r.roomId}
                data-testid={`results-row-${r.roomId}`}
                data-insufficient={r.insufficient || undefined}
                className={`border-t border-[var(--color-border)] ${
                  r.insufficient
                    ? 'text-[var(--color-destructive)]'
                    : 'text-[var(--color-text-primary)]'
                }`}
              >
                <td className="px-3 py-2">
                  {r.roomName || '—'}
                  {r.equipmentCount > 1 && (
                    <span className="ml-2 text-[11px] text-[var(--color-text-secondary)] font-mono">
                      ({r.equipmentCount} приборов)
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {r.qRequired !== null ? Math.round(r.qRequired) : '—'}
                </td>
                <td className="px-3 py-2 text-center font-mono">{r.tDelta}</td>
                <td className="px-3 py-2 text-xs">{r.typeSize}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">
                  {r.qActual !== null ? Math.round(r.qActual) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono">{r.surplusPct}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold border-t-2 border-[var(--color-text-secondary)] bg-[var(--color-surface)]">
              <td className="px-3 py-2 text-[var(--color-text-primary)]" scope="row">
                Σ по проекту
              </td>
              <td
                className="px-3 py-2 text-right font-mono text-[var(--color-text-primary)]"
                data-testid="sum-q-required"
              >
                {Math.round(sumQRequired)}
              </td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2"></td>
              <td
                className="px-3 py-2 text-right font-mono text-[var(--color-text-primary)]"
                data-testid="sum-q-actual"
              >
                {Math.round(sumQActual)}
              </td>
              <td className="px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
