/**
 * ГОСТ 2.104-2006 — рамка чертежа.
 *
 * Поля рамки относительно обреза листа:
 *   слева — 20 мм (под подшивку)
 *   сверху — 5 мм
 *   справа — 5 мм
 *   снизу — 5 мм
 *
 * Линии:
 *   обрез — тонкая (опц., обычно не печатается)
 *   рамка — толстая (0.7 мм)
 */

export const FRAME_MARGIN_LEFT_MM = 20
export const FRAME_MARGIN_TOP_MM = 5
export const FRAME_MARGIN_RIGHT_MM = 5
export const FRAME_MARGIN_BOTTOM_MM = 5

export const FRAME_LINE_THICK_MM = 0.7
export const FRAME_LINE_THIN_MM = 0.3

export interface FrameRect {
  readonly xMm: number                 // левый верх рамки
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

/**
 * Frame rectangle inside a sheet of given outer dimensions.
 */
export function computeFrame(sheetWidthMm: number, sheetHeightMm: number): FrameRect {
  return {
    xMm: FRAME_MARGIN_LEFT_MM,
    yMm: FRAME_MARGIN_TOP_MM,
    widthMm: sheetWidthMm - FRAME_MARGIN_LEFT_MM - FRAME_MARGIN_RIGHT_MM,
    heightMm: sheetHeightMm - FRAME_MARGIN_TOP_MM - FRAME_MARGIN_BOTTOM_MM
  }
}
