/**
 * Single enclosure row with 4px type color strip, conditional fields.
 * Orientation dropdown hidden for internal enclosure types.
 * Floor-ground shows FloorZonesBlock; others show FormulaAudit.
 */

import { useCallback, useMemo } from 'react'
import { X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { Enclosure, EnclosureType, Orientation } from '../../types/project'
import { useEnclosureStore } from '../../store/enclosureStore'
import { useProjectStore } from '../../store/projectStore'
import {
  ENCLOSURE_TYPE_CONFIG, calculateQBasic, DEFAULT_N_COEFF,
  calculateFloorZones, estimatePerimeter,
  buildEnclosureAuditString, buildFloorZoneAuditString
} from '../../engine/heatLoss'
import { checkNormative } from '../../engine/normative'
import { ConstructionPicker } from './ConstructionPicker'
import { ComplianceBadge } from './ComplianceBadge'

const WALL_PARENT_TYPES = new Set<EnclosureType>(['wall-ext', 'wall-int'])
const OPENING_CHILD_TYPES = new Set<EnclosureType>(['window', 'door-ext'])
import { FloorZonesBlock } from './FloorZonesBlock'
import { FormulaAudit } from './FormulaAudit'

interface EnclosureRowProps {
  enclosure: Enclosure
  deltaT: number | null
  isCorner: boolean
  roomArea: number
}

const ENCLOSURE_TYPES = Object.keys(ENCLOSURE_TYPE_CONFIG) as EnclosureType[]
const ORIENTATIONS: Orientation[] = ['\u0421', '\u0421\u0412', '\u0421\u0417', '\u0412', '\u042E\u0412', '\u042E', '\u042E\u0417', '\u0417']

const inputClass = 'border border-[var(--color-border)] rounded px-2 py-1 text-sm bg-[var(--color-bg)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors'

export function EnclosureRow({ enclosure, deltaT, isCorner, roomArea }: EnclosureRowProps) {
  const config = ENCLOSURE_TYPE_CONFIG[enclosure.type]

  // Full room enclosures (incl. self), in enclosureOrder — used for parent
  // dropdown, net-area aggregation, and per-type ordinal (#N) display.
  const roomEnclosures = useEnclosureStore(
    useShallow(s =>
      s.enclosureOrder
        .filter(id => s.enclosures[id]?.roomId === enclosure.roomId)
        .map(id => s.enclosures[id])
        .filter((e): e is Enclosure => e != null)
    )
  )
  const siblings = useMemo(
    () => roomEnclosures.filter(e => e.id !== enclosure.id),
    [roomEnclosures, enclosure.id]
  )
  const availableWalls = useMemo(
    () => siblings.filter(e => WALL_PARENT_TYPES.has(e.type)),
    [siblings]
  )
  // 1-based ordinal among same-type enclosures in the room.
  const typeOrdinal = useMemo(() => {
    const sameType = roomEnclosures.filter(e => e.type === enclosure.type)
    return sameType.findIndex(e => e.id === enclosure.id) + 1
  }, [roomEnclosures, enclosure.id, enclosure.type])
  const childrenArea = useMemo(() => {
    if (!WALL_PARENT_TYPES.has(enclosure.type)) return 0
    return siblings
      .filter(e => e.parentEnclosureId === enclosure.id)
      .reduce((sum, e) => sum + (e.area || 0), 0)
  }, [siblings, enclosure.id, enclosure.type])
  const netArea = useMemo(() => {
    if (!WALL_PARENT_TYPES.has(enclosure.type)) return enclosure.area
    return Math.max(0, enclosure.area - childrenArea)
  }, [enclosure.type, enclosure.area, childrenArea])

  const handleUpdate = useCallback((changes: Partial<Omit<Enclosure, 'id'>>) => {
    useEnclosureStore.getState().updateEnclosure(enclosure.id, changes)
  }, [enclosure.id])

  const handleDelete = useCallback(() => {
    useEnclosureStore.getState().deleteEnclosure(enclosure.id)
  }, [enclosure.id])

  const handleConstructionPick = useCallback((constructionId: string | null, kValue: number | null) => {
    const updates: Partial<Omit<Enclosure, 'id'>> = kValue !== null
      ? { constructionId, kValue }
      : { constructionId }
    useEnclosureStore.getState().updateEnclosure(enclosure.id, updates)
  }, [enclosure.id])

  // Manual K edit breaks the construction link (pie no longer matches its K)
  const handleKEdit = useCallback((newK: number) => {
    useEnclosureStore.getState().updateEnclosure(enclosure.id, {
      kValue: Math.max(0, newK),
      constructionId: null,
    })
  }, [enclosure.id])

  // Compliance against СП 50.13330 for the current city's ГСОП
  const gsop = useProjectStore(s => s.city?.gsop ?? null)
  const normativeVerdict = useMemo(
    () => checkNormative(enclosure.type, enclosure.kValue, gsop),
    [enclosure.type, enclosure.kValue, gsop]
  )

  const handleTypeChange = useCallback((newType: EnclosureType) => {
    const newConfig = ENCLOSURE_TYPE_CONFIG[newType]

    const externalFields: Partial<Omit<Enclosure, 'id'>> = newConfig.isExternal
      ? { orientation: enclosure.orientation ?? '\u0421', adjacentRoomName: null, tAdjacent: null }
      : { orientation: null, adjacentRoomName: enclosure.adjacentRoomName ?? '', tAdjacent: enclosure.tAdjacent ?? 18 }

    const parentField: Partial<Omit<Enclosure, 'id'>> = OPENING_CHILD_TYPES.has(newType)
      ? { parentEnclosureId: enclosure.parentEnclosureId ?? (availableWalls[0]?.id ?? null) }
      : { parentEnclosureId: null }

    const constructionField: Partial<Omit<Enclosure, 'id'>> = newType !== enclosure.type
      ? { constructionId: null }
      : {}

    const updates: Partial<Omit<Enclosure, 'id'>> = {
      type: newType,
      nCoeff: DEFAULT_N_COEFF[newType],
      nOverridden: false,
      ...externalFields,
      ...parentField,
      ...constructionField,
    }

    handleUpdate(updates)
  }, [enclosure.orientation, enclosure.adjacentRoomName, enclosure.tAdjacent, enclosure.parentEnclosureId, availableWalls, handleUpdate])

  // Compute Q for this enclosure — walls use netArea (gross − children) so
  // windows/doors don't double-count with their parent wall.
  let qValue: number | null = null
  if (deltaT !== null && enclosure.type !== 'floor-ground') {
    qValue = calculateQBasic(
      enclosure.kValue,
      netArea,
      deltaT,
      enclosure.nCoeff,
      enclosure.orientation,
      isCorner
    )
  }

  // Floor zone Q for floor-ground type
  const floorZones = useMemo(() => {
    if (enclosure.type !== 'floor-ground' || deltaT === null) return null
    const perim = enclosure.perimeterOverride ?? estimatePerimeter(roomArea)
    return calculateFloorZones(roomArea, perim, enclosure.zoneR, deltaT)
  }, [enclosure.type, enclosure.perimeterOverride, enclosure.zoneR, roomArea, deltaT])

  const floorQ = floorZones ? floorZones.reduce((s, z) => s + z.qWatts, 0) : null

  // Build audit string
  const auditString = useMemo(() => {
    if (deltaT === null) return null
    if (enclosure.type === 'floor-ground' && floorZones) {
      return buildFloorZoneAuditString(floorZones, deltaT)
    }
    if (qValue !== null) {
      return buildEnclosureAuditString(enclosure, deltaT, isCorner, qValue, netArea)
    }
    return null
  }, [enclosure, deltaT, isCorner, qValue, floorZones, netArea])

  const isFloorGround = enclosure.type === 'floor-ground'

  return (
    <>
      <tr
        className="h-10"
        style={{ borderLeft: `4px solid var(${config.colorVar})` }}
      >
        {/* Type dropdown with per-type ordinal badge */}
        <td className="px-2 py-1 align-top">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded text-[11px] font-mono font-medium bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
              title={`${ENCLOSURE_TYPE_CONFIG[enclosure.type].label} №${typeOrdinal} в этой комнате`}
              aria-label={`Номер в группе «${ENCLOSURE_TYPE_CONFIG[enclosure.type].label}»`}
            >
              #{typeOrdinal}
            </span>
            <select
              value={enclosure.type}
              onChange={e => handleTypeChange(e.target.value as EnclosureType)}
              onClick={e => e.stopPropagation()}
              className={`${inputClass} min-w-[120px]`}
              aria-label="Тип ограждения"
            >
              {ENCLOSURE_TYPES.map(type => (
                <option key={type} value={type}>
                  {ENCLOSURE_TYPE_CONFIG[type].label}
                </option>
              ))}
            </select>
          </div>
        </td>

        {/* Orientation dropdown - hidden for internal types */}
        <td className="px-2 py-1 align-top">
          {config.isExternal ? (
            <select
              value={enclosure.orientation ?? '\u0421'}
              onChange={e => handleUpdate({ orientation: e.target.value as Orientation })}
              onClick={e => e.stopPropagation()}
              className={`${inputClass} w-[56px]`}
              aria-label="Ориентация"
            >
              {ORIENTATIONS.map(dir => (
                <option key={dir} value={dir}>{dir}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-[var(--color-text-secondary)]">{'\u2014'}</span>
          )}
        </td>

        {/* Area (with parent-wall selector for openings / net area hint for walls) */}
        <td className="px-2 py-1 align-top">
          <input
            type="number"
            value={enclosure.area || ''}
            onChange={e => handleUpdate({
              area: Math.max(0, parseFloat(e.target.value) || 0),
              // Manual area edit clears L/H so they don't silently override on next render.
              length: undefined,
              heightM: undefined
            })}
            onClick={e => e.stopPropagation()}
            min={0}
            step={0.1}
            placeholder="0.0"
            className={`${inputClass} w-[96px] font-mono`}
            aria-label="Площадь ограждения"
          />
          {/* Optional L × H auto-calc helper. Updates area when both > 0. */}
          <div className="mt-1 flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            <input
              type="number"
              value={enclosure.length ?? ''}
              onChange={e => {
                const L = parseFloat(e.target.value)
                const lengthNext = isFinite(L) && L > 0 ? L : undefined
                const H = enclosure.heightM
                const next: Partial<typeof enclosure> = { length: lengthNext }
                if (lengthNext !== undefined && H !== undefined && H > 0) {
                  next.area = +(lengthNext * H).toFixed(2)
                }
                handleUpdate(next)
              }}
              onClick={e => e.stopPropagation()}
              min={0}
              step={0.1}
              placeholder="Д"
              title="Длина, м"
              className={`${inputClass} w-[56px] font-mono`}
              aria-label="Длина ограждения, м"
            />
            <span className="opacity-60">×</span>
            <input
              type="number"
              value={enclosure.heightM ?? ''}
              onChange={e => {
                const H = parseFloat(e.target.value)
                const heightNext = isFinite(H) && H > 0 ? H : undefined
                const L = enclosure.length
                const next: Partial<typeof enclosure> = { heightM: heightNext }
                if (heightNext !== undefined && L !== undefined && L > 0) {
                  next.area = +(L * heightNext).toFixed(2)
                }
                handleUpdate(next)
              }}
              onClick={e => e.stopPropagation()}
              min={0}
              step={0.1}
              placeholder="В"
              title="Высота, м"
              className={`${inputClass} w-[56px] font-mono`}
              aria-label="Высота ограждения, м"
            />
            <span className="opacity-60">м</span>
          </div>
          {OPENING_CHILD_TYPES.has(enclosure.type) && (
            <div className="mt-0.5">
              <select
                value={enclosure.parentEnclosureId ?? ''}
                onChange={e => handleUpdate({ parentEnclosureId: e.target.value || null })}
                onClick={e => e.stopPropagation()}
                className={`${inputClass} text-[11px] py-0.5 px-1 max-w-[160px]`}
                aria-label="Родительская стена"
                title="Окно/дверь прорезано в этой стене — её площадь будет вычтена из стены"
              >
                <option value="">— без стены —</option>
                {availableWalls.map((w, idx) => (
                  <option key={w.id} value={w.id}>
                    {`#${idx + 1} · `}
                    {ENCLOSURE_TYPE_CONFIG[w.type].label}
                    {w.orientation ? ` (${w.orientation})` : ''}
                    {` · ${w.area} м²`}
                  </option>
                ))}
              </select>
            </div>
          )}
          {WALL_PARENT_TYPES.has(enclosure.type) && childrenArea > 0 && (
            <div className="mt-0.5 text-[11px] text-[var(--color-text-secondary)] whitespace-nowrap">
              нетто: <span className="font-mono text-[var(--color-text-primary)]">{netArea.toFixed(2)}</span> м²
              <span className="opacity-70"> (−{childrenArea.toFixed(2)})</span>
            </div>
          )}
        </td>

        {/* K value with construction picker + compliance badge */}
        <td className="px-2 py-1 align-top">
          <div className="flex flex-col gap-1">
            <input
              type="number"
              value={enclosure.kValue || ''}
              onChange={e => handleKEdit(parseFloat(e.target.value) || 0)}
              onClick={e => e.stopPropagation()}
              min={0}
              max={20}
              step={0.01}
              placeholder="0.00"
              className={`${inputClass} w-[72px] font-mono`}
              aria-label="K-значение"
            />
            <ConstructionPicker
              type={enclosure.type}
              value={enclosure.constructionId}
              onPick={handleConstructionPick}
              className="max-w-[200px]"
            />
            <ComplianceBadge verdict={normativeVerdict} />
          </div>
        </td>

        {/* n coefficient */}
        <td className="px-2 py-1 align-top">
          {enclosure.nOverridden ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={enclosure.nCoeff}
                onChange={e => handleUpdate({ nCoeff: parseFloat(e.target.value) || 0 })}
                onClick={e => e.stopPropagation()}
                min={0}
                max={1}
                step={0.1}
                className={`${inputClass} w-[56px] font-mono`}
                aria-label="Коэффициент n"
              />
              <span className="text-xs text-[var(--color-warning)]">(ред.)</span>
            </div>
          ) : (
            <button
              onClick={e => {
                e.stopPropagation()
                handleUpdate({ nOverridden: true })
              }}
              className="text-sm font-mono text-[var(--color-text-primary)] hover:text-[var(--color-accent)] cursor-pointer"
              title="Нажмите для ручного ввода"
            >
              {enclosure.nCoeff}
              <span className="ml-1 text-xs text-[var(--color-text-secondary)]">Авто</span>
            </button>
          )}
        </td>

        {/* Q value */}
        <td className="px-2 py-1 align-top text-right font-mono text-[var(--color-text-primary)]">
          <div className="flex items-center justify-end gap-2">
            <span>
              {isFloorGround
                ? (floorQ !== null ? Math.round(floorQ) : '\u2014')
                : (qValue !== null ? Math.round(qValue) : '\u2014')}
            </span>
            {auditString && (
              <FormulaAudit auditString={auditString} />
            )}
          </div>
        </td>

        {/* Delete */}
        <td className="px-2 py-1 align-top">
          <button
            onClick={e => {
              e.stopPropagation()
              handleDelete()
            }}
            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-destructive)] transition-colors"
            aria-label={`Удалить ограждение ${config.label}`}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </td>
      </tr>

      {/* Floor zones block for floor-ground type */}
      {isFloorGround && (
        <tr style={{ borderLeft: `4px solid var(${config.colorVar})` }}>
          <td colSpan={7} className="p-0">
            <FloorZonesBlock
              enclosure={enclosure}
              deltaT={deltaT}
              roomArea={roomArea}
            />
          </td>
        </tr>
      )}
    </>
  )
}
