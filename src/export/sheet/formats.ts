/**
 * Sheet formats by ГОСТ 2.301-68 (basic A0..A4) plus склейки A3×N для длинных таблиц / планов.
 * widthMm / heightMm — для portrait по умолчанию (height ≥ width).
 */

import type { SheetFormat, Orientation } from '../types'

export const SHEET_FORMATS: readonly SheetFormat[] = [
  { id: 'A1', label: 'А1', widthMm: 594, heightMm: 841, canRotate: true },
  { id: 'A2', label: 'А2', widthMm: 420, heightMm: 594, canRotate: true },
  { id: 'A3', label: 'А3', widthMm: 297, heightMm: 420, canRotate: true },
  { id: 'A4', label: 'А4', widthMm: 210, heightMm: 297, canRotate: true },
  // Склейки A3 (фиксированный landscape по высоте 420)
  { id: 'A3x2', label: 'А3×2', widthMm: 594, heightMm: 420, canRotate: false },
  { id: 'A3x3', label: 'А3×3', widthMm: 891, heightMm: 420, canRotate: false },
  { id: 'A3x4', label: 'А3×4', widthMm: 1188, heightMm: 420, canRotate: false },
  // Склейки A4 (фиксированный landscape по высоте 297)
  { id: 'A4x2', label: 'А4×2', widthMm: 420, heightMm: 297, canRotate: false },
  { id: 'A4x3', label: 'А4×3', widthMm: 630, heightMm: 297, canRotate: false }
]

const FORMAT_INDEX = new Map(SHEET_FORMATS.map(f => [f.id, f]))

export function findFormat(id: string): SheetFormat | undefined {
  return FORMAT_INDEX.get(id)
}

/**
 * Returns the actual rendered width × height after applying orientation.
 * For non-rotatable formats the orientation arg is ignored.
 */
export function dimensions(format: SheetFormat, orientation: Orientation): {
  readonly widthMm: number
  readonly heightMm: number
} {
  if (!format.canRotate || orientation === 'portrait') {
    return { widthMm: format.widthMm, heightMm: format.heightMm }
  }
  return { widthMm: format.heightMm, heightMm: format.widthMm }
}

/**
 * Effective orientation for a format — склейки имеют свою фиксированную (landscape).
 */
export function effectiveOrientation(format: SheetFormat, requested: Orientation): Orientation {
  if (format.canRotate) return requested
  return format.widthMm > format.heightMm ? 'landscape' : 'portrait'
}
