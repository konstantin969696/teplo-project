/**
 * Shared UI helpers for Phase 4 UFH (underfloor heating) components.
 * Re-exports INPUT_CLASS from equipment-help (DRY).
 * Houses COVERING_LABELS, bathroom heuristic, and format helpers.
 */

export { INPUT_CLASS } from '../equipment/equipment-help'
import type { FloorCovering } from '../../types/hydraulics'

export const COVERING_LABELS: Record<FloorCovering, string> = {
  tile:     'Плитка',
  laminate: 'Ламинат',
  parquet:  'Паркет',
  linoleum: 'Линолеум',
}

/** Эвристика для определения ванной/влажного помещения по имени комнаты. */
const BATHROOM_KEYWORDS = ['ванн', 'wc', 'санузел', 'туалет', 'душев']

/**
 * Возвращает true если имя комнаты содержит ключевое слово ванной/влажного помещения.
 * Использует русские ключевые слова — нечувствительно к регистру.
 */
export function isBathroomRoom(roomName: string): boolean {
  const lower = roomName.toLowerCase()
  return BATHROOM_KEYWORDS.some(k => lower.includes(k))
}

/**
 * Порог температуры пола по СП 60:
 * 33°C для ванных/влажных помещений, 29°C для жилых.
 */
export function floorTempThresholdC(roomName: string): number {
  return isBathroomRoom(roomName) ? 33 : 29
}

/** Форматирует среднюю температуру пола. */
export function formatFloorTemp(t: number): string {
  if (!Number.isFinite(t) || t === 0) return '—'
  return t.toFixed(1)
}

/** Форматирует удельную теплоотдачу q (Вт/м²). */
export function formatQPerM2(q: number): string {
  if (!Number.isFinite(q) || q === 0) return '—'
  return q.toFixed(0)
}

/** Форматирует длину контура (м). */
export function formatLoopLength(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return '—'
  return m.toFixed(1)
}
