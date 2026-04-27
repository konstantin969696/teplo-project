/**
 * UFH loop row — accordion row per room.
 * Compact: checkbox | name | F_тп input | покрытие select | труба select | шаг input | q | warn-icon
 * Expanded: UfhLoopDetails (t_пол, Q_тп, L, N, ΔP, FormulaAudit, UfhWarnings)
 *   + System dropdown (D-11) — переместить контур в другую систему.
 *
 * Paттерн P5 (EquipmentRow accordion) + P6 (derived selector).
 * Derived: qPerM2, qTpW, floorTempC, qRoomW — через useMemo, не хранятся в store.
 * Pipe filter: только трубы с maxLoopLengthM !== null (PE-X/PE-RT/MLCP).
 * F_тп default: Math.round(room.area * 0.8 * 10) / 10 (D-07).
 *
 * Phase 04.1 Plan 06:
 *   - tSupplyUfh/tReturnUfh теперь берутся через useUfhSystemTemps(loopId) (D-14).
 *   - В expanded block добавлен System dropdown (D-11).
 *
 * Threats mitigated:
 *   T-04-15: React escapes room.name in JSX automatically.
 *   T-04-16: useMemo guards against re-computation on every render.
 *   T-04-17: handleAreaCommit clamps F_тп to [0, room.area].
 */

import { useState, useMemo, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ChevronRight, AlertTriangle, Sparkles } from 'lucide-react'
import type { Enclosure, Room } from '../../types/project'
import type { FloorCovering } from '../../types/hydraulics'
import { useUfhLoopStore, selectLoopByRoom } from '../../store/ufhLoopStore'
import { useProjectStore } from '../../store/projectStore'
import { useSystemStore, selectOrderedSystems } from '../../store/systemStore'
import { usePipeCatalogStore } from '../../store/pipeCatalogStore'
import { useEnclosureStore, selectEnclosuresByRoom } from '../../store/enclosureStore'
import { useUfhSystemTemps } from '../../hooks/useUfhSystemTemps'
import { calculateHeatFlux, calculateFloorTemp, calculateRequiredCoolantMeanTemp } from '../../engine/ufh'
import { getEngineWorker } from '../../workers/useEngineWorker'
import {
  COVERING_LABELS,
  INPUT_CLASS,
  isBathroomRoom,
  resolveFloorThreshold,
  formatQPerM2,
} from './ufh-help'
import { PIPE_MATERIAL_LABELS } from '../hydraulics/hydraulics-help'
import { UfhLoopDetails } from './UfhLoopDetails'

interface UfhLoopRowProps {
  readonly room: Room
  readonly index: number
}

export function UfhLoopRow({ room, index }: UfhLoopRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const loop = useUfhLoopStore(useShallow(selectLoopByRoom(room.id)))
  const addLoop = useUfhLoopStore(s => s.addLoop)
  // Phase 04.1 Plan 06: локальный алиас updateUfhLoop для читаемости + соответствия плану.
  const updateUfhLoop = useUfhLoopStore(s => s.updateLoop)
  const toggleEnabled = useUfhLoopStore(s => s.toggleEnabled)

  // Per-system температуры (D-14). Для несуществующего loop systemId → fallback 45/35.
  const { tSupply: tSupplyUfh, tReturn: tReturnUfh } = useUfhSystemTemps(loop?.id ?? '')

  const tOutside = useProjectStore(s => s.city?.tOutside ?? null)

  // Список систем для dropdown.
  const orderedSystems = useSystemStore(useShallow(selectOrderedSystems))
  const defaultSystemId = orderedSystems[0]?.id ?? ''

  // Only UFH-compatible pipes (PE-X / PE-RT / MLCP): maxLoopLengthM !== null
  const pipes = usePipeCatalogStore(
    useShallow(s => Object.values(s.pipes).filter(p => p.maxLoopLengthM !== null))
  )

  const enclosures = useEnclosureStore(useShallow(selectEnclosuresByRoom(room.id)))

  // D-07: F_тп default = 80% of room area, min 1 m²
  const defaultAreaM2 = Math.max(1, Math.round(room.area * 0.8 * 10) / 10)
  const defaultPipeId = pipes[0]?.id ?? ''

  /**
   * Ensures a loop exists in the store for this room.
   * Returns the loop (existing or freshly created stub).
   */
  const ensureLoop = () => {
    if (loop) return loop
    const id = addLoop({
      roomId: room.id,
      systemId: defaultSystemId,
      enabled: true,
      activeAreaM2: defaultAreaM2,
      covering: 'tile',
      pipeId: defaultPipeId,
      stepCm: 20,
      leadInM: 3,
    })
    return {
      id,
      roomId: room.id,
      systemId: defaultSystemId,
      enabled: true,
      activeAreaM2: defaultAreaM2,
      covering: 'tile' as FloorCovering,
      pipeId: defaultPipeId,
      stepCm: 20,
      leadInM: 3,
    }
  }

  // Sync: qPerM2, qTpW, floorTempC — не требуют calculateRoomTotals
  const { qPerM2, qTpW, floorTempC, tSupplyEff, tReturnEff } = useMemo(() => {
    const effectiveCovering = loop?.covering ?? 'tile'
    const effectiveArea = loop?.activeAreaM2 ?? defaultAreaM2
    const isEnabled = loop?.enabled ?? false

    // Comfort mode: подбираем t_теплоносителя через обратную задачу (UFH-08).
    let tSup = tSupplyUfh
    let tRet = tReturnUfh
    if (loop?.mode === 'comfort' && loop.targetFloorTempC != null) {
      const tMean = calculateRequiredCoolantMeanTemp(loop.targetFloorTempC, room.tInside, effectiveCovering)
      if (tMean !== null) {
        const dt = Math.max(1, tSupplyUfh - tReturnUfh)
        tSup = tMean + dt / 2
        tRet = tMean - dt / 2
      }
    }

    const q = calculateHeatFlux(tSup, tRet, room.tInside, effectiveCovering)
    const tFloor = calculateFloorTemp(q, room.tInside)
    if (!isEnabled) return { qPerM2: q, qTpW: 0, floorTempC: tFloor, tSupplyEff: tSup, tReturnEff: tRet }
    return { qPerM2: q, qTpW: q * effectiveArea, floorTempC: tFloor, tSupplyEff: tSup, tReturnEff: tRet }
  }, [loop, tSupplyUfh, tReturnUfh, room, defaultAreaM2])

  // Async: qRoomW — теплопотери комнаты через worker (нужны только для warn-условия qTpW < qRoomW)
  const [qRoomW, setQRoomW] = useState<number | null>(null)
  useEffect(() => {
    const isEnabled = loop?.enabled ?? false
    if (!isEnabled || tOutside === null) { setQRoomW(null); return }
    const dt = Math.max(0, room.tInside - tOutside)
    if (dt <= 0) { setQRoomW(null); return }
    let cancelled = false
    const enclosureRecord: Record<string, Enclosure> = {}
    const enclosureIds: string[] = []
    for (const e of enclosures) { enclosureRecord[e.id] = e; enclosureIds.push(e.id) }
    getEngineWorker()
      .heatLossForRooms(enclosureRecord, enclosureIds, { [room.id]: room }, [room.id], tOutside)
      .then(([res]) => { if (!cancelled && res) setQRoomW(res.qTotal) })
    return () => { cancelled = true }
  }, [loop?.enabled, enclosures, room, tOutside])

  const threshold = resolveFloorThreshold(room)
  const bathroom = isBathroomRoom(room.name)
  // Предупреждения — только для включённых петель (для preview q не имеет смысла).
  const hasWarning =
    loop?.enabled === true &&
    ((qTpW > 0 && qRoomW !== null && qRoomW > 0 && qTpW < qRoomW) || floorTempC > threshold)

  const zebraClass = index % 2 === 0 ? 'bg-[var(--color-bg)]' : 'bg-[var(--color-surface)]'

  // T-04-17: clamp F_тп to [0, room.area]
  const handleAreaCommit = (v: number) => {
    const safe = Math.max(0, Math.min(room.area, v))
    const existing = ensureLoop()
    updateUfhLoop(existing.id, { activeAreaM2: safe })
  }

  return (
    <>
      <tr
        className={`h-10 cursor-pointer hover:bg-[var(--color-surface)] ${zebraClass}`}
        onClick={() => setIsExpanded(v => !v)}
        aria-expanded={isExpanded}
      >
        <td className="px-2 py-1">
          <ChevronRight
            size={14}
            className={`transition-transform duration-200 text-[var(--color-text-secondary)] ${isExpanded ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
        </td>
        <td className="px-2 py-1">
          <label
            className="flex items-center gap-2"
            onClick={e => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={loop?.enabled ?? false}
              onChange={() => {
                const l = ensureLoop()
                toggleEnabled(l.id)
              }}
              aria-label={`Включить тёплый пол для ${room.name}`}
            />
            <span className="text-sm text-[var(--color-text-primary)]">
              {room.name}
            </span>
            {loop?.mode === 'comfort' && (
              <Sparkles
                size={12}
                className="text-[var(--color-accent)] flex-shrink-0"
                aria-label="Комфортный режим ТП"
                title={`Комфортный режим: t_пола = ${loop.targetFloorTempC ?? '?'}°C`}
              />
            )}
          </label>
        </td>
        <td className="px-2 py-1 text-right">
          <input
            type="number"
            step={0.1}
            min={0}
            max={room.area}
            defaultValue={loop?.activeAreaM2 ?? defaultAreaM2}
            key={loop?.id ?? 'default-area'}
            onClick={e => e.stopPropagation()}
            onBlur={e => handleAreaCommit(parseFloat(e.target.value) || 0)}
            className={`${INPUT_CLASS} w-20 text-right font-mono`}
            aria-label="F_тп, м²"
          />
        </td>
        <td className="px-2 py-1">
          <select
            value={loop?.covering ?? 'tile'}
            onClick={e => e.stopPropagation()}
            onChange={e => {
              const l = ensureLoop()
              updateUfhLoop(l.id, { covering: e.target.value as FloorCovering })
            }}
            className={INPUT_CLASS}
            aria-label="Покрытие"
          >
            {(Object.entries(COVERING_LABELS) as [FloorCovering, string][]).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </td>
        <td className="px-2 py-1">
          <select
            value={loop?.pipeId ?? defaultPipeId}
            onClick={e => e.stopPropagation()}
            onChange={e => {
              const l = ensureLoop()
              updateUfhLoop(l.id, { pipeId: e.target.value })
            }}
            className={INPUT_CLASS}
            aria-label="Труба ТП"
          >
            {pipes.map(p => (
              <option key={p.id} value={p.id}>
                {PIPE_MATERIAL_LABELS[p.material] ?? p.material} {p.dnMm}×{p.wallThicknessMm}
              </option>
            ))}
          </select>
        </td>
        <td className="px-2 py-1 text-right">
          <input
            type="number"
            min={10}
            max={30}
            step={5}
            defaultValue={loop?.stepCm ?? 20}
            key={loop?.id ?? 'default-step'}
            onClick={e => e.stopPropagation()}
            onBlur={e => {
              const l = ensureLoop()
              updateUfhLoop(l.id, { stepCm: parseFloat(e.target.value) || 20 })
            }}
            className={`${INPUT_CLASS} w-16 text-right font-mono`}
            aria-label="Шаг укладки, см"
          />
        </td>
        <td
          className={`px-2 py-1 text-right font-mono ${
            loop?.enabled
              ? 'text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-secondary)] italic'
          }`}
          title={loop?.enabled ? undefined : 'Предварительный расчёт. Включите петлю галкой слева чтобы применить мощность'}
        >
          {formatQPerM2(qPerM2)}
        </td>
        <td className="px-2 py-1 text-center">
          {hasWarning && (
            <AlertTriangle
              size={14}
              className={
                floorTempC > threshold
                  ? 'text-[var(--color-destructive)]'
                  : 'text-[var(--color-warning)]'
              }
              aria-label="Предупреждение"
            />
          )}
        </td>
      </tr>

      {isExpanded && loop && (
        <tr>
          <td colSpan={8} className="p-0">
            <div className="px-3 pt-3">
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <span>Система:</span>
                <select
                  value={loop.systemId}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateUfhLoop(loop.id, { systemId: e.target.value })}
                  className={INPUT_CLASS}
                  aria-label="Выберите систему отопления для контура"
                >
                  {orderedSystems.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <UfhLoopDetails
              room={room}
              loop={loop}
              qPerM2={qPerM2}
              qTpW={qTpW}
              floorTempC={floorTempC}
              qRoomW={qRoomW}
              threshold={threshold}
              isBathroom={bathroom}
              tSupplyEff={tSupplyEff}
              tReturnEff={tReturnEff}
            />
          </td>
        </tr>
      )}
    </>
  )
}
