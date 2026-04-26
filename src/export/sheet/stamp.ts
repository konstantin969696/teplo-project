/**
 * ГОСТ 2.104-2006 — основная надпись «Форма 1».
 *
 * Геометрия: 185 × 55 мм, прижата к правому нижнему углу рамки.
 * Состоит из 22+ граф; здесь моделируем минимально необходимое подмножество для
 * первой версии экспорта. Полная геометрия будет уточнена в фазе 07 при отрисовке.
 *
 * Координаты ниже — относительно левого верхнего угла штампа.
 */

import type { Stamp } from '../types'
import type { FrameRect } from './frame'

export const STAMP_WIDTH_MM = 185
export const STAMP_HEIGHT_MM = 55

/**
 * Position of the title block inside the frame: правый нижний угол.
 */
export interface StampPosition {
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

export function computeStampPosition(frame: FrameRect): StampPosition {
  return {
    xMm: frame.xMm + frame.widthMm - STAMP_WIDTH_MM,
    yMm: frame.yMm + frame.heightMm - STAMP_HEIGHT_MM,
    widthMm: STAMP_WIDTH_MM,
    heightMm: STAMP_HEIGHT_MM
  }
}

export const EMPTY_STAMP: Stamp = {
  objectName: '',
  drawingTitle: '',
  stageCode: 'Р',
  markCode: 'ОВ',
  drawingMark: 'ОВ.001',
  authorName: '',
  checkerName: '',
  approverName: '',
  normControlName: '',
  companyName: '',
  companyDept: '',
  date: new Date().toISOString().slice(0, 10)
}

/**
 * Format ISO date YYYY-MM-DD as DD.MM.YYYY for stamp display.
 */
export function formatStampDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

/**
 * "Лист N из M" string.
 */
export function formatSheetCounter(index: number, total: number): string {
  return `Лист ${index + 1} из ${total}`
}
