/**
 * Unit tests for room-actions (addRoomsToFloor, cloneRoom).
 * Drives the three Zustand stores directly — no React rendering.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addRoomsToFloor, cloneRoom } from './room-actions'
import { useProjectStore } from '../store/projectStore'
import { useEnclosureStore } from '../store/enclosureStore'
import { useEquipmentStore } from '../store/equipmentStore'
import type { Room } from '../types/project'

// Silence sonner toasts (deleteEnclosure inside store can call toast.warning).
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

function baseRoom(overrides: Partial<Omit<Room, 'id'>> = {}): Omit<Room, 'id'> {
  return {
    number: 101,
    name: 'Гостиная',
    floor: 1,
    area: 20,
    height: 2.7,
    isCorner: false,
    infiltrationMethod: 'rate',
    nInfiltration: 0.5,
    gapArea: null,
    windSpeed: null,
    lVentilation: 0,
    tInside: 20,
    ...overrides,
  }
}

beforeEach(() => {
  useProjectStore.setState({
    city: { name: 'Москва', tOutside: -25, gsop: 4943, humidityZone: 'Б' },
    tInside: 20,
    rooms: {},
    roomOrder: [],
    customCities: [],
    tSupply: 80,
    tReturn: 60,
  })
  useEnclosureStore.setState({ enclosures: {}, enclosureOrder: [] })
  useEquipmentStore.setState({ equipment: {}, equipmentOrder: [] })
})

describe('addRoomsToFloor', () => {
  it('создаёт N пустых комнат на указанном этаже с авто-нумерацией floor·100+N', () => {
    addRoomsToFloor(2, 3)

    const { rooms, roomOrder } = useProjectStore.getState()
    expect(roomOrder).toHaveLength(3)

    const numbers = roomOrder.map(id => rooms[id].number).sort((a, b) => a - b)
    expect(numbers).toEqual([201, 202, 203])

    for (const id of roomOrder) {
      expect(rooms[id].floor).toBe(2)
    }
  })

  it('продолжает нумерацию от текущего максимума на этаже', () => {
    // уже есть 105 на первом этаже
    useProjectStore.getState().addRoom(baseRoom({ number: 105, floor: 1 }))

    addRoomsToFloor(1, 2)

    const { rooms, roomOrder } = useProjectStore.getState()
    const numbers = roomOrder.map(id => rooms[id].number).sort((a, b) => a - b)
    expect(numbers).toEqual([105, 106, 107])
  })

  it('клампит count в диапазон 1..50 (0 → 1, 9999 → 50)', () => {
    addRoomsToFloor(1, 0)
    expect(useProjectStore.getState().roomOrder).toHaveLength(1)

    useProjectStore.setState({ rooms: {}, roomOrder: [] })
    addRoomsToFloor(1, 9999)
    expect(useProjectStore.getState().roomOrder).toHaveLength(50)
  })

  it('использует tInside из projectStore для новых комнат', () => {
    useProjectStore.setState({ tInside: 22 })
    addRoomsToFloor(1, 1)

    const { rooms, roomOrder } = useProjectStore.getState()
    expect(rooms[roomOrder[0]].tInside).toBe(22)
  })

  it('клампит этаж в диапазон 1..200 и округляет', () => {
    addRoomsToFloor(0, 1)
    addRoomsToFloor(9999, 1)

    const floors = Object.values(useProjectStore.getState().rooms).map(r => r.floor)
    expect(floors).toContain(1)
    expect(floors).toContain(200)
  })
})

describe('cloneRoom', () => {
  function seedRoomWithAttachments() {
    const roomId = 'room-src'
    useProjectStore.setState({
      rooms: {
        [roomId]: {
          ...baseRoom({ number: 101, floor: 1, name: 'Спальня' }),
          id: roomId,
        },
      },
      roomOrder: [roomId],
    })

    // parent wall + окно, привязанное к ней через parentEnclosureId
    const parentId = 'enc-wall'
    const childId = 'enc-window'
    useEnclosureStore.setState({
      enclosures: {
        [parentId]: {
          id: parentId,
          roomId,
          type: 'wall-ext',
          orientation: 'С',
          area: 12,
          kValue: 0.35,
          nCoeff: 1.0,
          nOverridden: false,
          adjacentRoomName: null,
          tAdjacent: null,
          perimeterOverride: null,
          zoneR: [2.1, 4.3, 8.6, 14.2],
          parentEnclosureId: null,
          constructionId: null,
        },
        [childId]: {
          id: childId,
          roomId,
          type: 'window',
          orientation: 'С',
          area: 2,
          kValue: 1.8,
          nCoeff: 1.0,
          nOverridden: false,
          adjacentRoomName: null,
          tAdjacent: null,
          perimeterOverride: null,
          zoneR: [2.1, 4.3, 8.6, 14.2],
          parentEnclosureId: parentId,
          constructionId: null,
        },
      },
      enclosureOrder: [parentId, childId],
    })

    useEquipmentStore.getState().addEquipment({
      roomId,
      kind: 'bimetal',
      catalogModelId: 'rifar-base-500',
      connection: 'side',
      installation: 'open',
      panelType: null,
      panelHeightMm: null,
      panelLengthMm: null,
      sectionsOverride: 5,
      convectorLengthMm: null,
      manualQNominal: null,
      manualNExponent: null,
    })

    return { roomId, parentId, childId }
  }

  it('возвращает null для несуществующего id', () => {
    const result = cloneRoom('does-not-exist')
    expect(result).toBeNull()
    expect(useProjectStore.getState().roomOrder).toHaveLength(0)
  })

  it('клонирует комнату с суффиксом « (копия)» и следующим номером этажа', () => {
    const { roomId } = seedRoomWithAttachments()

    const newRoomId = cloneRoom(roomId)
    expect(newRoomId).not.toBeNull()
    expect(newRoomId).not.toBe(roomId)

    const { rooms } = useProjectStore.getState()
    const clone = rooms[newRoomId!]
    expect(clone.name).toBe('Спальня (копия)')
    expect(clone.floor).toBe(1)
    expect(clone.number).toBe(102)
  })

  it('копирует enclosures и перемапит parentEnclosureId на клонированный parent (не на оригинал)', () => {
    const { roomId, parentId } = seedRoomWithAttachments()

    const newRoomId = cloneRoom(roomId)!

    const { enclosures, enclosureOrder } = useEnclosureStore.getState()
    const cloned = enclosureOrder
      .filter(id => enclosures[id].roomId === newRoomId)
      .map(id => enclosures[id])

    expect(cloned).toHaveLength(2)

    const clonedParent = cloned.find(e => e.type === 'wall-ext')!
    const clonedChild = cloned.find(e => e.type === 'window')!

    expect(clonedParent.parentEnclosureId).toBeNull()
    // critical: remap must point at cloned parent, not the original parent id
    expect(clonedChild.parentEnclosureId).toBe(clonedParent.id)
    expect(clonedChild.parentEnclosureId).not.toBe(parentId)

    // ids должны быть свежими
    expect(clonedParent.id).not.toBe(parentId)
  })

  it('копирует equipment с новыми id и той же конфигурацией', () => {
    const { roomId } = seedRoomWithAttachments()
    const originalIds = useEquipmentStore.getState().equipmentOrder

    const newRoomId = cloneRoom(roomId)!

    const { equipment, equipmentOrder } = useEquipmentStore.getState()
    const clonedEq = equipmentOrder
      .filter(id => equipment[id].roomId === newRoomId)
      .map(id => equipment[id])

    expect(clonedEq).toHaveLength(1)
    expect(clonedEq[0].id).not.toBe(originalIds[0])
    expect(clonedEq[0].kind).toBe('bimetal')
    expect(clonedEq[0].catalogModelId).toBe('rifar-base-500')
    expect(clonedEq[0].sectionsOverride).toBe(5)
  })

  it('не трогает оригинальную комнату, её enclosures и equipment', () => {
    const { roomId, parentId, childId } = seedRoomWithAttachments()
    const originalEqId = useEquipmentStore.getState().equipmentOrder[0]

    cloneRoom(roomId)

    const srcEncs = useEnclosureStore.getState().enclosureOrder
      .filter(id => useEnclosureStore.getState().enclosures[id].roomId === roomId)
    expect(srcEncs).toEqual([parentId, childId])

    const srcEq = useEquipmentStore.getState().equipment[originalEqId]
    expect(srcEq.roomId).toBe(roomId)
  })

  it('клонирует пустую комнату (0 enclosures, 0 equipment)', () => {
    useProjectStore.setState({
      rooms: { r1: { ...baseRoom({ name: 'Пустая' }), id: 'r1' } },
      roomOrder: ['r1'],
    })

    const newId = cloneRoom('r1')
    expect(newId).not.toBeNull()

    const { rooms, roomOrder } = useProjectStore.getState()
    expect(roomOrder).toHaveLength(2)
    expect(rooms[newId!].name).toBe('Пустая (копия)')

    // no enclosure/equipment side-effects
    expect(useEnclosureStore.getState().enclosureOrder).toHaveLength(0)
    expect(useEquipmentStore.getState().equipmentOrder).toHaveLength(0)
  })

  it('оставляет имя пустым если у источника имени нет', () => {
    useProjectStore.setState({
      rooms: { r1: { ...baseRoom({ name: '' }), id: 'r1' } },
      roomOrder: ['r1'],
    })

    const newId = cloneRoom('r1')!
    expect(useProjectStore.getState().rooms[newId].name).toBe('')
  })
})
