/**
 * Equipment row — ONE row per ROOM (not per equipment).
 * Summary cells: chevron | name | Q_пом | N приборов | Σ Q_факт | запас% | +add.
 * Expanded: renders EquipmentSubTable with all devices for this room.
 * Multi-equipment is first-class: rooms can have 2+ radiators, mix types,
 * combine radiator + underfloor convector, etc. Σ Q_факт compared to Q_пом.
 * Q_пом DERIVED via calculateRoomTotals (D-07) — never stored.
 *
 * Phase 04.1 Plan 06:
 *   - Температуры системы теперь per-equipment (D-27): Σ Q_факт суммируется по
 *     приборам, каждый использует LMTD своей системы.
 *   - UFH-cascade (D-17): Q_тп берём по системе loop (если есть), иначе 0.
 *   - addEquipment проставляет systemId = первая система.
 *   - В EquipmentRow (per-room) НЕТ System dropdown: разные приборы одной
 *     комнаты могут принадлежать разным системам (D-10).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { Enclosure, Equipment, Room } from '../../types/project'
import { useProjectStore } from '../../store/projectStore'
import { useEnclosureStore } from '../../store/enclosureStore'
import { useEquipmentStore } from '../../store/equipmentStore'
import { useCatalogStore } from '../../store/catalogStore'
import { useSystemStore, selectOrderedSystems } from '../../store/systemStore'
import { useUfhLoopStore, selectLoopByRoom } from '../../store/ufhLoopStore'
import { getEngineWorker } from '../../workers/useEngineWorker'
import { calculateLMTD } from '../../engine/equipment'
import { calculateHeatFlux } from '../../engine/ufh'
import { deriveEquipmentQActual, formatSurplusPct } from './equipment-help'
import { EquipmentSubTable } from './EquipmentSubTable'

interface EquipmentRowProps {
  room: Room
  index: number
}

export function EquipmentRow({ room, index }: EquipmentRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const tOutside = useProjectStore(s => s.city?.tOutside ?? null)
  const ufhLoop = useUfhLoopStore(useShallow(selectLoopByRoom(room.id)))

  // Map систем для быстрого per-equipment lookup температур.
  const systemsMap = useSystemStore(s => s.systems)
  const orderedSystems = useSystemStore(useShallow(selectOrderedSystems))
  const defaultSystemId = orderedSystems[0]?.id ?? ''

  const enclosures = useEnclosureStore(
    useShallow(state => {
      const out: typeof state.enclosures[string][] = []
      for (const id of state.enclosureOrder) {
        const e = state.enclosures[id]
        if (e && e.roomId === room.id) out.push(e)
      }
      return out
    })
  )

  const equipmentList = useEquipmentStore(
    useShallow(state => {
      const out: typeof state.equipment[string][] = []
      for (const id of state.equipmentOrder) {
        const e = state.equipment[id]
        if (e && e.roomId === room.id) out.push(e)
      }
      return out
    })
  )

  // Catalog lookup — subscribe to the whole models map so that updates to any
  // referenced catalog entry re-render this row. Cheap because models changes
  // are rare after load.
  const modelsMap = useCatalogStore(s => s.models)

  // UFH cascade (D-17): Q_тп из системы loop'а.
  // Защита от зомби-loops: если systemId указан, но на удалённую систему —
  // loop считается отключённым (он всё равно не виден в accordion тёплого пола).
  // Пустой systemId (legacy/до миграции) → дефолтные температуры 45/35.
  // Активная площадь clamped к room.area — ТП физически не может быть больше пола.
  const qUfhActive = useMemo(() => {
    if (!ufhLoop || !ufhLoop.enabled) return 0
    if (ufhLoop.systemId && !systemsMap[ufhLoop.systemId]) return 0
    const ufhSystem = ufhLoop.systemId ? systemsMap[ufhLoop.systemId] : undefined
    const tSupplyUfh = ufhSystem?.tSupplyUfh ?? 45
    const tReturnUfh = ufhSystem?.tReturnUfh ?? 35
    const q = calculateHeatFlux(tSupplyUfh, tReturnUfh, room.tInside, ufhLoop.covering)
    const safeArea = Math.max(0, Math.min(room.area, ufhLoop.activeAreaM2))
    return q * safeArea
  }, [ufhLoop, systemsMap, room.tInside, room.area])

  // qRoom — полные теплопотери комнаты (до распределения на ТП и радиаторы).
  const [qRoom, setQRoom] = useState<number | null>(null)
  useEffect(() => {
    if (tOutside === null) { setQRoom(null); return }
    const dt = room.tInside - tOutside
    if (dt <= 0) { setQRoom(null); return }
    let cancelled = false
    const enclosureRecord: Record<string, Enclosure> = {}
    const enclosureIds: string[] = []
    for (const e of enclosures) { enclosureRecord[e.id] = e; enclosureIds.push(e.id) }
    getEngineWorker()
      .heatLossForRooms(enclosureRecord, enclosureIds, { [room.id]: room }, [room.id], tOutside)
      .then(([res]) => { if (!cancelled && res) setQRoom(res.qTotal) })
    return () => { cancelled = true }
  }, [enclosures, room, tOutside])

  const qRequired = useMemo(() => {
    if (qRoom === null) return null
    return Math.max(0, qRoom - qUfhActive)  // D-06: UFH даёт максимум, остаток → радиатор
  }, [qRoom, qUfhActive])

  // Σ Q_факт across all equipment in the room — per-equipment LMTD (D-27).
  const qActualSum = useMemo(() => {
    if (equipmentList.length === 0 || qRequired === null) return null
    const target = qRequired / equipmentList.length
    let sum = 0
    let anyValid = false
    for (const eq of equipmentList) {
      const sys = eq.systemId ? systemsMap[eq.systemId] : undefined
      const tSup = sys?.tSupply ?? 80
      const tRet = sys?.tReturn ?? 60
      const eqLmtd = calculateLMTD(tSup, tRet, room.tInside)
      if (eqLmtd <= 0) continue
      const model = eq.catalogModelId ? modelsMap[eq.catalogModelId] ?? null : null
      const { qActual } = deriveEquipmentQActual(eq, model, target, eqLmtd)
      if (qActual !== null) {
        sum += qActual
        anyValid = true
      }
    }
    return anyValid ? sum : null
  }, [equipmentList, qRequired, modelsMap, systemsMap, room.tInside])

  const handleAddFirstEquipment = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    useEquipmentStore.getState().addEquipment({
      roomId: room.id,
      systemId: defaultSystemId,
      kind: 'bimetal',
      catalogModelId: null,
      connection: 'side',
      installation: 'open',
      panelType: null,
      panelHeightMm: null,
      panelLengthMm: null,
      sectionsOverride: null,
      convectorLengthMm: null,
      manualQNominal: null,
      manualNExponent: null,
    } as unknown as Omit<Equipment, 'id'>)
    setIsExpanded(true)
  }, [room.id, defaultSystemId])

  const toggleExpand = useCallback(() => setIsExpanded(prev => !prev), [])

  const zebraClass = index % 2 === 0 ? 'bg-[var(--color-bg)]' : 'bg-[var(--color-surface)]'
  const isEmpty = equipmentList.length === 0
  const insufficient = qRequired !== null && qActualSum !== null && qActualSum < qRequired

  return (
    <>
      <tr
        className={`h-10 cursor-pointer hover:bg-[var(--color-surface)] ${zebraClass}`}
        onClick={toggleExpand}
        aria-expanded={isExpanded}
      >
        <td className="px-2 py-1">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); toggleExpand() }}
            aria-label={isExpanded ? `Свернуть приборы в ${room.name || 'помещение'}` : `Развернуть приборы в ${room.name || 'помещение'}`}
            aria-expanded={isExpanded}
            className="inline-flex items-center p-0 bg-transparent border-0 cursor-pointer"
          >
            <ChevronRight
              size={14}
              className={`transition-transform duration-200 text-[var(--color-text-secondary)] ${isExpanded ? 'rotate-90' : ''}`}
              aria-hidden="true"
            />
          </button>
        </td>
        <td className="px-2 py-1 text-[var(--color-text-primary)]">
          {room.name || `Комната ${index + 1}`}
        </td>
        <td className="px-2 py-1 text-right font-mono text-[var(--color-text-primary)] align-top">
          {qRoom === null ? (
            <span data-testid="q-required">—</span>
          ) : qUfhActive > 0 ? (
            <div className="flex flex-col items-end leading-tight">
              <span
                className="text-xs text-[var(--color-text-secondary)]"
                title="Общие теплопотери комнаты (Q_пом)"
              >
                Q_пом: {Math.round(qRoom)}
              </span>
              <span className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                ТП: {Math.round(qUfhActive)} · Приб.:{' '}
                <span
                  className="font-semibold text-[var(--color-text-primary)] text-xs"
                  data-testid="q-required"
                >
                  {Math.round(qRequired ?? 0)}
                </span>
              </span>
            </div>
          ) : (
            <span className="font-semibold" data-testid="q-required">
              {Math.round(qRequired ?? 0)}
            </span>
          )}
        </td>
        <td className="px-2 py-1 text-center font-mono text-[var(--color-text-secondary)]" data-testid="equipment-count">
          {isEmpty ? '—' : equipmentList.length}
        </td>
        <td
          className="px-2 py-1 text-right font-mono font-semibold text-[var(--color-text-primary)]"
          data-testid="q-actual-sum"
        >
          {qActualSum !== null ? Math.round(qActualSum) : '—'}
        </td>
        <td className="px-2 py-1 text-right font-mono" data-testid="surplus-pct">
          {qActualSum !== null && qRequired !== null ? (
            <span className={insufficient ? 'text-[var(--color-destructive)]' : 'text-[var(--color-text-primary)]'}>
              {formatSurplusPct(qActualSum, qRequired)}
            </span>
          ) : '—'}
        </td>
        <td className="px-2 py-1">
          <button
            onClick={handleAddFirstEquipment}
            className="p-1 text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
            aria-label={`Добавить прибор для ${room.name || 'помещение'}`}
            title={isEmpty ? 'Добавить прибор' : 'Добавить ещё прибор'}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={7} className="p-0">
            <EquipmentSubTable
              room={room}
              qRequired={qRequired}
            />
          </td>
        </tr>
      )}
    </>
  )
}

/** Convenience re-export so tests/imports continue to resolve. */
export type { Equipment }
