/**
 * Рендер основной надписи формы 6 (ГОСТ Р 21.101-2020) для PDF (jsPDF).
 * Форма 6 — последующие листы текстового документа, 185 × 15 мм.
 */

import type { jsPDF } from 'jspdf'
import { FRAME_LINE_THICK_MM, FRAME_LINE_THIN_MM } from '../sheet/frame'
import { buildDesignationCode, signerDate } from '../sheet/stamp'
import { STAMP_FORM6_GEOMETRY } from './stampGeometry'
import type { GostStampParams } from '../types'
import type { StampPosition } from './drawStamp5'

function ct(doc: jsPDF, text: string, x: number, y: number, w: number, h: number): void {
  if (!text) return
  doc.text(text, x + w / 2, y + h * 0.65, { align: 'center' })
}

function lt(doc: jsPDF, text: string, x: number, y: number, h: number, maxW: number): void {
  if (!text) return
  const pad = 0.5
  let s = text
  if (doc.getTextWidth(s) > maxW - pad * 2) {
    let lo = 0, hi = s.length
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2)
      if (doc.getTextWidth(s.slice(0, mid) + '…') <= maxW - pad * 2) lo = mid
      else hi = mid - 1
    }
    s = s.slice(0, lo) + '…'
  }
  doc.text(s, x + pad, y + h * 0.65)
}

export function drawStampForm6(
  doc: jsPDF,
  stamp: GostStampParams,
  pos: StampPosition,
  sheetIndex: number,
  sheetTotal: number,
  fontName: string,
): void {
  const { xMm: ox, yMm: oy } = pos
  const G = STAMP_FORM6_GEOMETRY

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(FRAME_LINE_THICK_MM)
  doc.rect(ox, oy, G.width, G.height)

  doc.setLineWidth(FRAME_LINE_THIN_MM)

  // Вертикальные разделители: граница подписантов | граница обозначения | граница организации
  const vLines = [G.signers.width, G.designation.x + G.designation.width]
  for (const vx of vLines) {
    doc.line(ox + vx, oy, ox + vx, oy + G.height)
  }

  // Горизонтальный разделитель в центральной части (Обозначение / Лист+Листов)
  const midY = oy + G.designation.height
  doc.line(ox + G.designation.x, midY, ox + G.designation.x + G.designation.width, midY)

  // Вертикальные разделители в строке Лист/Листов
  let cx = ox + G.sheetRow.x
  for (let i = 0; i < G.sheetRow.cols.length - 1; i++) {
    cx += G.sheetRow.cols[i]!.width
    doc.line(cx, oy + G.sheetRow.y, cx, oy + G.sheetRow.y + G.sheetRow.height)
  }

  // Вертикальные разделители подписантов
  cx = ox
  for (let i = 0; i < G.signers.cols.length - 1; i++) {
    cx += G.signers.cols[i]!.width
    doc.line(cx, oy, cx, oy + G.height)
  }

  // ─── Тексты ───
  doc.setTextColor(0, 0, 0)

  // Подписанты (1 строка, только Разраб.)
  doc.setFont(fontName, 'normal')
  doc.setFontSize(5)
  const sigX = ox + G.signers.x
  lt(doc, 'Разраб.', sigX, oy, G.signers.height, G.signers.cols[0]!.width)
  lt(doc, stamp.authorName, sigX + G.signers.cols[0]!.width, oy, G.signers.height, G.signers.cols[1]!.width)
  lt(doc, signerDate(stamp, 'author'), sigX + G.signers.cols[0]!.width + G.signers.cols[1]!.width + G.signers.cols[2]!.width, oy, G.signers.height, G.signers.cols[3]!.width)

  // Граф. 2 — Обозначение
  doc.setFont(fontName, 'normal')
  doc.setFontSize(6)
  ct(doc, buildDesignationCode(stamp), ox + G.designation.x, oy + G.designation.y, G.designation.width, G.designation.height)

  // Граф. Лист/Листов
  doc.setFontSize(5)
  cx = ox + G.sheetRow.x
  const sheetValues: readonly string[] = [String(sheetIndex + 1), String(sheetTotal)]
  G.sheetRow.cols.forEach((col, i) => {
    ct(doc, sheetValues[i] ?? '', cx, oy + G.sheetRow.y, col.width, G.sheetRow.height)
    cx += col.width
  })

  // Граф. 9 — Организация (усечённая)
  doc.setFont(fontName, 'bold')
  doc.setFontSize(5)
  const coX = ox + G.company.x
  ct(doc, stamp.companyName, coX, oy + G.company.y, G.company.width, G.company.height)
}
