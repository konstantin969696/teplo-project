/**
 * Рендер основной надписи формы 5 (ГОСТ Р 21.101-2020) для PDF (jsPDF).
 * Форма 5 — первый (заглавный) лист текстового документа, 185 × 40 мм.
 */

import type { jsPDF } from 'jspdf'
import { FRAME_LINE_THICK_MM, FRAME_LINE_THIN_MM } from '../sheet/frame'
import { buildDesignationCode, signerDate, formatStampDate } from '../sheet/stamp'
import { STAMP_FORM5_GEOMETRY } from './stampGeometry'
import type { GostStampParams } from '../types'

export interface StampPosition {
  readonly xMm: number
  readonly yMm: number
}

function ct(doc: jsPDF, text: string, x: number, y: number, w: number, h: number): void {
  if (!text) return
  doc.text(text, x + w / 2, y + h * 0.65, { align: 'center' })
}

function lt(doc: jsPDF, text: string, x: number, y: number, h: number, maxW: number): void {
  if (!text) return
  const pad = 0.5
  doc.text(truncate(doc, text, maxW - pad * 2), x + pad, y + h * 0.65)
}

function truncate(doc: jsPDF, text: string, maxMm: number): string {
  if (maxMm <= 0) return ''
  if (doc.getTextWidth(text) <= maxMm) return text
  let lo = 0, hi = text.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (doc.getTextWidth(text.slice(0, mid) + '…') <= maxMm) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo) + '…'
}

export function drawStampForm5(
  doc: jsPDF,
  stamp: GostStampParams,
  pos: StampPosition,
  sheetIndex: number,
  sheetTotal: number,
  fontName: string,
): void {
  const { xMm: ox, yMm: oy } = pos
  const G = STAMP_FORM5_GEOMETRY

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(FRAME_LINE_THICK_MM)
  doc.rect(ox, oy, G.width, G.height)

  doc.setLineWidth(FRAME_LINE_THIN_MM)

  // Вертикальный разделитель: правая колонка (Граф. 9)
  const coX = ox + G.company.x
  doc.line(coX, oy, coX, oy + G.height)

  // Горизонтальные разделители левой области
  const hLines = [G.title.height, G.title.height + G.designation.height, G.stageRow.y + G.stageRow.height]
  for (const hy of hLines) {
    doc.line(ox, oy + hy, coX, oy + hy)
  }

  // Вертикальные разделители строки Лит./Лист/Листов
  let cx = ox
  for (const col of G.stageRow.cols) {
    cx += col.width
    if (cx < coX) doc.line(cx, oy + G.stageRow.y, cx, oy + G.stageRow.y + G.stageRow.height)
  }

  // Горизонтальные разделители подписантов (5 строк × 2 мм)
  for (let r = 1; r < G.signers.rows.length; r++) {
    const ly = oy + G.signers.y + r * G.signers.rowHeight
    doc.line(ox, ly, ox + G.signers.width, ly)
  }
  // Вертикальные разделители подписантов
  cx = ox
  for (let i = 0; i < G.signers.cols.length - 1; i++) {
    cx += G.signers.cols[i]!.width
    doc.line(cx, oy + G.signers.y, cx, oy + G.signers.y + G.signers.height)
  }

  // ─── Тексты ───
  doc.setTextColor(0, 0, 0)

  // Граф. 1 — Наименование
  doc.setFont(fontName, 'bold')
  doc.setFontSize(8)
  ct(doc, stamp.drawingTitle, ox + G.title.x, oy + G.title.y, G.title.width, G.title.height)

  // Граф. 2 — Обозначение
  doc.setFont(fontName, 'normal')
  doc.setFontSize(7)
  ct(doc, buildDesignationCode(stamp), ox + G.designation.x, oy + G.designation.y, G.designation.width, G.designation.height)

  // Граф. Лит./Лист/Листов
  doc.setFont(fontName, 'normal')
  doc.setFontSize(5)
  const stageValues: readonly string[] = [stamp.stageCode, String(sheetIndex + 1), String(sheetTotal)]
  cx = ox + G.stageRow.x
  G.stageRow.cols.forEach((col, i) => {
    ct(doc, stageValues[i] ?? '', cx, oy + G.stageRow.y, col.width, G.stageRow.height)
    cx += col.width
  })

  // Подписанты (5 строк × 2 мм — только имена, размер мелкий)
  const signerValues: readonly [string, string, string][] = [
    [stamp.authorName,      '', signerDate(stamp, 'author')],
    [stamp.checkerName,     '', signerDate(stamp, 'checker')],
    [stamp.gipName,         '', signerDate(stamp, 'gip')],
    [stamp.normControlName, '', signerDate(stamp, 'normControl')],
    [stamp.approverName,    '', stamp.approverName ? signerDate(stamp, 'approver') : ''],
  ]
  doc.setFont(fontName, 'normal')
  doc.setFontSize(4)
  G.signers.rows.forEach((row, ri) => {
    const ry = oy + G.signers.y + ri * G.signers.rowHeight
    const [name, , date] = signerValues[ri]!
    cx = ox + G.signers.x
    // Role label
    lt(doc, row.label, cx, ry, G.signers.rowHeight, G.signers.cols[0]!.width)
    cx += G.signers.cols[0]!.width
    // Name
    lt(doc, name, cx, ry, G.signers.rowHeight, G.signers.cols[1]!.width)
    cx += G.signers.cols[1]!.width + G.signers.cols[2]!.width  // skip sign column
    // Date
    lt(doc, date, cx, ry, G.signers.rowHeight, G.signers.cols[3]!.width)
  })

  // Граф. 9 — Организация
  doc.setFont(fontName, 'bold')
  doc.setFontSize(6)
  const coY = oy + G.company.y
  const coW = G.company.width
  const coH = G.company.height

  if (stamp.logoDataUrl) {
    const logoH = coH * 0.55
    drawLogo(doc, stamp.logoDataUrl, coX + 1, coY + 1, coW - 2, logoH - 2)
    doc.line(coX, coY + logoH, coX + coW, coY + logoH)
    const textY = coY + logoH
    ct(doc, stamp.companyName, coX, textY, coW, coH - logoH)
  } else {
    ct(doc, stamp.companyName, coX, coY, coW, coH)
  }

  if (stamp.companyDept) {
    doc.setFont(fontName, 'normal')
    doc.setFontSize(4)
    doc.setTextColor(80, 80, 80)
    doc.text(stamp.companyDept, coX + coW / 2, coY + coH - 1, { align: 'center' })
    doc.setTextColor(0, 0, 0)
  }

  void formatStampDate
}

function drawLogo(doc: jsPDF, dataUrl: string, x: number, y: number, maxW: number, maxH: number): void {
  try {
    const fmt = dataUrl.startsWith('data:image/png')
      ? 'PNG'
      : (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg') ? 'JPEG' : null)
    if (!fmt) return
    doc.addImage(dataUrl, fmt, x, y, maxW, maxH, undefined, 'FAST')
  } catch (_) {
    // silently skip broken logos
  }
}
