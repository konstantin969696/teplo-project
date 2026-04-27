/**
 * Summary tab — read-only consolidated report across heat loss, systems,
 * equipment, UFH loops, and aggregate hydraulic numbers. Foundation for
 * future PDF/Excel export (Phases 06/07).
 *
 * Phase 05: stays read-only and on-screen only — no export buttons yet.
 */

import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useSystemStore } from '../../store/systemStore'
import { useEnclosureStore } from '../../store/enclosureStore'
import { useEquipmentStore } from '../../store/equipmentStore'
import { useUfhLoopStore } from '../../store/ufhLoopStore'
import { getEngineWorker } from '../../workers/useEngineWorker'
import type { RoomHeatLossResult, Room } from '../../types/project'
import { useExportPreview } from '../../export/useExportPreview'
import { buildSummaryDocument } from '../../export/content/builders'

const SCHEMA_LABEL: Record<string, string> = {
  'two-pipe-dead-end': 'Двухтруб. тупиковая',
  'two-pipe-flow-through': 'Двухтруб. попутная',
  'one-pipe-vertical': 'Однотруб. вертикальная',
  'one-pipe-horizontal': 'Однотруб. горизонтальная',
  'collector': 'Лучевая (коллекторная)'
}

function formatW(w: number): string {
  return Math.round(w).toLocaleString('ru-RU')
}

function formatKw(w: number): string {
  return (w / 1000).toFixed(2)
}

interface RoomSummaryRow {
  readonly room: Room
  readonly result: RoomHeatLossResult
}

export function SummaryTab() {
  const city = useProjectStore(s => s.city)
  const tInside = useProjectStore(s => s.tInside)
  const rooms = useProjectStore(s => s.rooms)
  const roomOrder = useProjectStore(s => s.roomOrder)
  const systemsMap = useSystemStore(s => s.systems)
  const systemOrder = useSystemStore(s => s.systemOrder)
  const enclosures = useEnclosureStore(s => s.enclosures)
  const enclosureOrder = useEnclosureStore(s => s.enclosureOrder)
  const equipment = useEquipmentStore(s => s.equipment)
  const equipmentOrder = useEquipmentStore(s => s.equipmentOrder)
  const loops = useUfhLoopStore(s => s.loops)

  const deltaT = city != null ? tInside - city.tOutside : null
  const systems = useMemo(
    () => systemOrder.map(id => systemsMap[id]).filter((s): s is NonNullable<typeof s> => s != null),
    [systemsMap, systemOrder]
  )

  const [results, setResults] = useState<readonly RoomHeatLossResult[]>([])
  const [calculating, setCalculating] = useState(false)

  useEffect(() => {
    if (city == null) {
      setResults([])
      return
    }
    let cancelled = false
    setCalculating(true)
    getEngineWorker()
      .heatLossForRooms(enclosures, enclosureOrder, rooms, roomOrder, city.tOutside)
      .then(res => {
        if (!cancelled) {
          setResults(res)
          setCalculating(false)
        }
      })
      .catch(() => {
        if (!cancelled) setCalculating(false)
      })
    return () => {
      cancelled = true
    }
  }, [city, rooms, roomOrder, enclosures, enclosureOrder])

  const rows = useMemo<readonly RoomSummaryRow[]>(() => {
    if (city == null) return []
    // Worker фильтрует roomOrder по rooms[id] != null -- мы должны индексироваться по той же выборке.
    const existingRoomIds = roomOrder.filter(id => rooms[id] != null)
    return existingRoomIds
      .map((rid, idx): RoomSummaryRow | null => {
        const room = rooms[rid]
        const result = results[idx]
        if (!room || !result) return null
        return { room, result }
      })
      .filter((r): r is RoomSummaryRow => r !== null)
  }, [city, rooms, roomOrder, results])

  const totalQ = useMemo(
    () => rows.reduce((acc, r) => acc + r.result.qTotal, 0),
    [rows]
  )

  const equipmentList = useMemo(
    () => equipmentOrder.map(id => equipment[id]).filter((e): e is NonNullable<typeof e> => e != null),
    [equipment, equipmentOrder]
  )

  const exportUI = useExportPreview(buildSummaryDocument)

  const loopList = useMemo(
    () => Object.values(loops).filter(l => l.enabled),
    [loops]
  )

  const hasAnything = rows.length > 0 || systems.length > 0 || equipmentList.length > 0 || loopList.length > 0

  if (!hasAnything) {
    return (
      <div className="py-12 text-center text-[var(--color-text-secondary)]">
        <p className="text-sm">Заполни вкладки «Теплопотери» и «Приборы отопления» — здесь появится сводка по объекту.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">{exportUI.button}</div>
      {exportUI.modal}
      {/* ─── Шапка объекта ─── */}
      <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="text-base font-semibold mb-3">Объект</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <DLPair label="Город" value={city?.name ?? '—'} />
          <DLPair label="t наружная" value={city ? `${city.tOutside} °C` : '—'} />
          <DLPair label="t внутри (по умолч.)" value={`${tInside} °C`} />
          <DLPair label="ΔT" value={deltaT != null ? `${deltaT} K` : '—'} />
          <DLPair label="ГСОП" value={city?.gsop != null ? `${city.gsop}` : '—'} />
          <DLPair label="Зона влажности" value={city?.humidityZone ?? '—'} />
          <DLPair label="Помещений" value={`${rows.length}`} />
          <DLPair label="Систем" value={`${systems.length}`} />
        </dl>
      </section>

      {/* ─── Теплопотери ─── */}
      {rows.length > 0 && (
        <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-base font-semibold">Теплопотери</h2>
            <div className="text-sm">
              Итого по объекту:{' '}
              <span className="font-mono font-semibold text-[var(--color-text-primary)]">
                {formatW(totalQ)} Вт
              </span>{' '}
              <span className="text-[var(--color-text-secondary)]">({formatKw(totalQ)} кВт)</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="text-left py-1.5 px-2">Помещение</th>
                  <th className="text-center py-1.5 px-2">Эт.</th>
                  <th className="text-right py-1.5 px-2">Пл. м²</th>
                  <th className="text-right py-1.5 px-2 font-mono">Q_осн, Вт</th>
                  <th className="text-right py-1.5 px-2 font-mono">Q_инф, Вт</th>
                  <th className="text-right py-1.5 px-2 font-mono">Q_вент, Вт</th>
                  <th className="text-right py-1.5 px-2 font-mono">Q_итого, Вт</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ room, result }) => (
                  <tr key={room.id} className="border-t border-[var(--color-border)]/60">
                    <td className="py-1 px-2">{room.name || `№${room.number}`}</td>
                    <td className="py-1 px-2 text-center">{room.floor}</td>
                    <td className="py-1 px-2 text-right font-mono">{room.area}</td>
                    <td className="py-1 px-2 text-right font-mono">{formatW(result.qBasic)}</td>
                    <td className="py-1 px-2 text-right font-mono">{formatW(result.qInfiltration)}</td>
                    <td className="py-1 px-2 text-right font-mono">{formatW(result.qVentilation)}</td>
                    <td className="py-1 px-2 text-right font-mono font-semibold">{formatW(result.qTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── Системы отопления ─── */}
      {systems.length > 0 && (
        <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="text-base font-semibold mb-3">Системы отопления</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {systems.map(sys => (
              <div key={sys.id} className="rounded border border-[var(--color-border)]/70 p-3">
                <div className="font-medium mb-2">{sys.name}</div>
                <dl className="grid grid-cols-2 gap-1.5 text-xs">
                  <DLPair label="Схема" value={SCHEMA_LABEL[sys.schemaType] ?? sys.schemaType} />
                  <DLPair label="t подачи / обратки" value={`${sys.tSupply} / ${sys.tReturn} °C`} />
                  <DLPair label="t тёпл. пол подача / обр." value={`${sys.tSupplyUfh} / ${sys.tReturnUfh} °C`} />
                  <DLPair label="Теплоноситель" value={sys.coolantId} />
                  <DLPair label="Материал труб" value={sys.pipeMaterialId} />
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Приборы отопления ─── */}
      {equipmentList.length > 0 && (
        <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="text-base font-semibold mb-3">Приборы отопления — {equipmentList.length} шт.</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="text-left py-1.5 px-2">Помещение</th>
                  <th className="text-left py-1.5 px-2">Тип</th>
                  <th className="text-left py-1.5 px-2">Подключение</th>
                  <th className="text-left py-1.5 px-2">Установка</th>
                  <th className="text-left py-1.5 px-2">Модель</th>
                </tr>
              </thead>
              <tbody>
                {equipmentList.map(eq => {
                  const room = rooms[eq.roomId]
                  return (
                    <tr key={eq.id} className="border-t border-[var(--color-border)]/60">
                      <td className="py-1 px-2">{room?.name ?? '—'}</td>
                      <td className="py-1 px-2">{eq.kind}</td>
                      <td className="py-1 px-2">{eq.connection}</td>
                      <td className="py-1 px-2">{eq.installation}</td>
                      <td className="py-1 px-2 text-[var(--color-text-secondary)]">{eq.catalogModelId ?? 'ручной ввод'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── Тёплый пол ─── */}
      {loopList.length > 0 && (
        <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="text-base font-semibold mb-3">Тёплый пол — {loopList.length} петл.</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="text-left py-1.5 px-2">Помещение</th>
                  <th className="text-right py-1.5 px-2">F_тп, м²</th>
                  <th className="text-right py-1.5 px-2">Шаг, см</th>
                  <th className="text-left py-1.5 px-2">Покрытие</th>
                  <th className="text-left py-1.5 px-2">Труба</th>
                </tr>
              </thead>
              <tbody>
                {loopList.map(loop => {
                  const room = rooms[loop.roomId]
                  return (
                    <tr key={loop.id} className="border-t border-[var(--color-border)]/60">
                      <td className="py-1 px-2">{room?.name ?? '—'}</td>
                      <td className="py-1 px-2 text-right font-mono">{loop.activeAreaM2}</td>
                      <td className="py-1 px-2 text-right font-mono">{loop.stepCm}</td>
                      <td className="py-1 px-2">{loop.covering}</td>
                      <td className="py-1 px-2 text-[var(--color-text-secondary)]">{loop.pipeId}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs text-[var(--color-text-secondary)] italic">
        Сводка обновляется автоматически по мере заполнения вкладок.
      </p>
    </div>
  )
}

function DLPair({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</dt>
      <dd className="text-sm font-medium text-[var(--color-text-primary)]">{value}</dd>
    </div>
  )
}
