/**
 * useGckPath(systemId) — мемоизированный hook для расчёта ГЦК per-system.
 * Phase 04.1 W5: принимает явный systemId, читает температуры из systemStore,
 * фильтрует сегменты по systemId через filterSegmentsBySystem.
 *
 * При systemId='' или system undefined — возвращает EMPTY_RESULT (не крашится).
 *
 * Pitfall 7 mitigation: useMemo предотвращает лишние пересчёты при ре-рендерах.
 */

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  findMainCircuit,
  calculateSegment,
  derivedQ,
  buildChildrenMap,
  recommendPump,
  filterSegmentsBySystem,
  type SegmentCalcResult,
} from '../../engine/hydraulics'
import { calculateLMTD } from '../../engine/equipment'
import { calculateRoomTotals } from '../../engine/heatLoss'
import { useSegmentStore } from '../../store/segmentStore'
import { useSystemStore } from '../../store/systemStore'
import { usePipeCatalogStore } from '../../store/pipeCatalogStore'
import { useKmsCatalogStore } from '../../store/kmsCatalogStore'
import { useCoolantCatalogStore } from '../../store/coolantCatalogStore'
import { useEquipmentStore } from '../../store/equipmentStore'
import { useEnclosureStore } from '../../store/enclosureStore'
import { useProjectStore } from '../../store/projectStore'
import { useCatalogStore } from '../../store/catalogStore'
import { deriveEquipmentQActual } from '../equipment/equipment-help'
import type { SegmentNode } from '../../types/hydraulics'
import type { Enclosure } from '../../types/project'

export interface GckComputationResult {
  readonly segmentResults: Readonly<Record<string, SegmentCalcResult>>
  readonly gckPath: readonly string[]
  readonly deltaPGckPa: number
  readonly totalFlowKgH: number
}

const EMPTY_RESULT: GckComputationResult = {
  segmentResults: {},
  gckPath: [],
  deltaPGckPa: 0,
  totalFlowKgH: 0,
}

export function useGckPath(systemId: string): GckComputationResult {
  const system = useSystemStore(s => s.systems[systemId])
  const allSegments = useSegmentStore(s => s.segments)
  const coolants = useCoolantCatalogStore(s => s.coolants)
  const pipes = usePipeCatalogStore(s => s.pipes)
  const kmsCatalog = useKmsCatalogStore(useShallow(s => Object.values(s.elements)))
  const equipment = useEquipmentStore(s => s.equipment)
  const equipmentOrder = useEquipmentStore(s => s.equipmentOrder)
  const rooms = useProjectStore(s => s.rooms)
  const tOutside = useProjectStore(s => s.city?.tOutside ?? null)
  const enclosures = useEnclosureStore(s => s.enclosures)
  const enclosureOrder = useEnclosureStore(s => s.enclosureOrder)
  const systemsMap = useSystemStore(s => s.systems)
  const catalogModels = useCatalogStore(s => s.models)

  return useMemo(() => {
    if (!system || !systemId) return EMPTY_RESULT

    const coolant = coolants[system.coolantId]
    if (!coolant) return EMPTY_RESULT

    const deltaT = Math.max(1, system.tSupply - system.tReturn)

    // equipmentQMap: id → Q_факт, рассчитанный per-equipment через ту же формулу
    // что и EquipmentRow (deriveEquipmentQActual). До этого использовалось
    // eq.calculated?.Q — несуществующее поле, всегда возвращавшее 0 → подводки
    // с привязанным прибором имели Q=0 и не считались гидравлически.
    const equipmentQMap: Record<string, number> = {}

    // Сгруппировать оборудование по roomId для расчёта qRequired per room.
    const equipmentByRoom = new Map<string, string[]>()
    for (const eqId of equipmentOrder) {
      const eq = equipment[eqId]
      if (!eq) continue
      if (!equipmentByRoom.has(eq.roomId)) equipmentByRoom.set(eq.roomId, [])
      equipmentByRoom.get(eq.roomId)!.push(eqId)
    }

    // Для каждой комнаты: посчитать qTotal (теплопотери), поделить на N приборов,
    // для каждого прибора применить deriveEquipmentQActual с его системными температурами.
    for (const [roomId, eqIds] of equipmentByRoom) {
      const room = rooms[roomId]
      if (!room) continue

      // Q_пом — теплопотери комнаты. Если нет tOutside — Q_пом = null → приборы = 0 не можем.
      const roomDeltaT = tOutside !== null ? room.tInside - tOutside : null
      let qRoom: number | null = null
      if (roomDeltaT !== null) {
        const roomEnclosures = enclosureOrder
          .map(eid => enclosures[eid])
          .filter((enc): enc is Enclosure => enc != null && enc.roomId === roomId)
        qRoom = calculateRoomTotals(roomEnclosures, room, roomDeltaT).qTotal
      }

      const target = qRoom !== null ? qRoom / eqIds.length : null

      for (const eqId of eqIds) {
        const eq = equipment[eqId]
        if (!eq) continue
        const eqSystem = eq.systemId ? systemsMap[eq.systemId] : undefined
        const tSup = eqSystem?.tSupply ?? system.tSupply
        const tRet = eqSystem?.tReturn ?? system.tReturn
        const lmtd = calculateLMTD(tSup, tRet, room.tInside)
        if (lmtd <= 0) { equipmentQMap[eqId] = 0; continue }
        const model = eq.catalogModelId ? catalogModels[eq.catalogModelId] ?? null : null
        const { qActual } = deriveEquipmentQActual(eq, model, target, lmtd)
        equipmentQMap[eqId] = qActual ?? 0
      }
    }

    const pipeArr = Object.values(pipes)
    const segments = filterSegmentsBySystem(allSegments, systemId)
    const segmentResults: Record<string, SegmentCalcResult> = {}

    // Build once: O(n) parent→children map for Q derivation
    const qChildrenMap = buildChildrenMap(segments, systemId)
    for (const [id, seg] of Object.entries(segments)) {
      const q = derivedQ(id, segments, equipmentQMap, qChildrenMap)
      segmentResults[id] = calculateSegment(seg, q, coolant, deltaT, pipeArr, kmsCatalog)
    }

    // Построить граф узлов для findMainCircuit
    const childrenMap: Record<string, string[]> = {}
    for (const [id, seg] of Object.entries(segments)) {
      if (seg.parentSegmentId !== null) {
        const pid = seg.parentSegmentId
        if (!childrenMap[pid]) childrenMap[pid] = []
        childrenMap[pid]!.push(id)
      }
    }

    const nodes: SegmentNode[] = Object.entries(segments).map(([id, seg]) => ({
      id,
      parentId: seg.parentSegmentId,
      children: childrenMap[id] ?? [],
      deltaP: segmentResults[id]?.deltaPTotalPa ?? 0,
    }))

    const gckPath = findMainCircuit(nodes)
    const deltaPGckPa = gckPath.reduce(
      (sum, id) => sum + (segmentResults[id]?.deltaPTotalPa ?? 0),
      0
    )

    // Суммарный расход через насос — сумма расходов корневых сегментов
    const rootSegments = Object.values(segments).filter(s => s.parentSegmentId === null)
    const totalFlowKgH = rootSegments.reduce(
      (sum, s) => sum + (segmentResults[s.id]?.flowKgH ?? 0),
      0
    )

    return { segmentResults, gckPath, deltaPGckPa, totalFlowKgH }
  }, [
    system, systemId, allSegments, coolants, pipes, kmsCatalog,
    equipment, equipmentOrder, rooms, tOutside,
    enclosures, enclosureOrder, systemsMap, catalogModels
  ])
}

// Re-export for convenience
export { recommendPump }
