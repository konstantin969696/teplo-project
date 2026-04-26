/**
 * Builds human-readable labels for equipment items used in the hydraulics
 * segment selector.
 *
 * UX-контракт (утверждён Костяном):
 *   - Dropdown "Назначение" = «куда подходит подводка» = помещение и его номер
 *     ("пом. 101 · Ванна, 1 этаж"). Прибор выбирается неявно (конкретный
 *     equipmentId), но лейбл показывает комнату как ориентир.
 *   - Модель прибора автоматически подставляется в segment.name при выборе
 *     (см. SegmentRow handleEquipmentChange).
 */

import type { CatalogModel, Equipment, Room } from '../../types/project'

export interface EquipmentLabelOption {
  readonly id: string
  readonly label: string
}

/**
 * Короткое manufacturer — Varmann → Varm., Rifar → Rifar (≤5 знаков оставляем как есть).
 * Используется для name-автоподстановки, не для dropdown-лейбла.
 */
function shortManufacturer(name: string): string {
  if (!name) return ''
  if (name.length <= 5) return name
  return name.slice(0, 4) + '.'
}

/**
 * Label для dropdown "Назначение": "пом. 101 · Ванна · 1 этаж".
 * Если в комнате несколько приборов — добавляем "· Пр-N" чтобы их различать.
 */
export function buildEquipmentLabel(
  equipment: Equipment,
  equipmentOrder: readonly string[],
  equipmentMap: Readonly<Record<string, Equipment>>,
  rooms: Readonly<Record<string, Room>>
): string {
  const room = rooms[equipment.roomId]
  if (!room) return 'без комнаты'

  const roomPart = room.number ? `пом. ${room.number}` : ''
  const namePart = room.name || ''
  const floorPart = `${room.floor} этаж`

  const parts = [roomPart, namePart, floorPart].filter(Boolean)
  let label = parts.join(' · ')

  // Если в этой комнате более одного прибора — добавляем "· Пр-N" для различения
  const roomEquipment = equipmentOrder.filter(eid => equipmentMap[eid]?.roomId === equipment.roomId)
  if (roomEquipment.length > 1) {
    const idx = roomEquipment.indexOf(equipment.id)
    const num = idx >= 0 ? idx + 1 : 1
    label += ` · Пр-${num}`
  }

  return label
}

export function buildEquipmentOptions(
  equipmentOrder: readonly string[],
  equipmentMap: Readonly<Record<string, Equipment>>,
  rooms: Readonly<Record<string, Room>>
): readonly EquipmentLabelOption[] {
  return equipmentOrder
    .map(id => equipmentMap[id])
    .filter((eq): eq is Equipment => Boolean(eq))
    .map(eq => ({
      id: eq.id,
      label: buildEquipmentLabel(eq, equipmentOrder, equipmentMap, rooms),
    }))
}

/**
 * Модель прибора для автозаполнения segment.name: "Varm. Ntherm 300x90"
 * или "Rifar Monolit 500". Пустая строка если catalogModelId не задан.
 */
export function buildEquipmentModelName(
  equipment: Equipment,
  catalog: Readonly<Record<string, CatalogModel>>
): string {
  if (!equipment.catalogModelId) return ''
  const model = catalog[equipment.catalogModelId]
  if (!model) return ''
  return `${shortManufacturer(model.manufacturer)} ${model.series}`.trim()
}
