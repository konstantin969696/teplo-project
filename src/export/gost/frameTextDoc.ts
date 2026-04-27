/**
 * Рамка текстового документа (ГОСТ 2.105-2019, ГОСТ Р 21.101-2020 прил. И).
 * Поля: левое 20 мм, правое/верхнее/нижнее 5 мм — идентично чертёжной рамке.
 * Выделена в отдельный файл чтобы можно было добавить специфические проверки
 * (например, отступ текста ≥ 10 мм от внутреннего края рамки).
 */

import { computeFrame } from '../sheet/frame'
import type { FrameRect } from '../sheet/frame'

export function computeTextDocFrame(widthMm: number, heightMm: number): FrameRect {
  return computeFrame(widthMm, heightMm)
}

/** Минимальный отступ текста от рамки по ГОСТ 2.105-2019 (10 мм). */
export const TEXT_DOC_CONTENT_PAD_MM = 10
