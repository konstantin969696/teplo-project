import { expose } from 'comlink'
import { calculateRoomTotals } from '../engine/heatLoss'
import { calculateSegment, filterSegmentsBySystem, buildChildrenMap, derivedQ } from '../engine/hydraulics'
import type { Enclosure, Room, RoomHeatLossResult } from '../types/project'
import type { Segment, SegmentCalcResult, PipeSpec, KmsItem, CoolantSpec } from '../types/hydraulics'

export interface SegmentCalcMap {
  readonly [segmentId: string]: SegmentCalcResult
}

const api = {
  ping: () => 'pong' as const,

  heatLossForRooms(
    enclosures: Record<string, Enclosure>,
    enclosureOrder: string[],
    rooms: Record<string, Room>,
    roomOrder: string[],
    tOutside: number
  ): RoomHeatLossResult[] {
    const enclosureList = enclosureOrder
      .map(id => enclosures[id])
      .filter((e): e is Enclosure => e != null)

    return roomOrder
      .map(id => rooms[id])
      .filter((r): r is Room => r != null)
      .map(room => {
        const roomEnclosures = enclosureList.filter(e => e.roomId === room.id)
        const dt = room.tInside - tOutside
        return calculateRoomTotals(roomEnclosures, room, dt)
      })
  },

  hydraulicsCalc(
    segments: Record<string, Segment>,
    equipmentQ: Record<string, number>,
    coolant: CoolantSpec,
    deltaTK: number,
    pipeCatalog: Record<string, PipeSpec>,
    kmsCatalog: Record<string, KmsItem>,
    systemId: string
  ): SegmentCalcMap {
    const pipeArr = Object.values(pipeCatalog)
    const kmsArr = Object.values(kmsCatalog)
    const filtered = filterSegmentsBySystem(segments, systemId)
    const childrenMap = buildChildrenMap(segments, systemId)
    const result: Record<string, SegmentCalcResult> = {}

    for (const [id, seg] of Object.entries(filtered)) {
      const q = derivedQ(id, segments, equipmentQ, childrenMap)
      result[id] = calculateSegment(seg, q, coolant, deltaTK, pipeArr, kmsArr)
    }

    return result
  },
}

expose(api)

export type EngineWorkerAPI = typeof api
