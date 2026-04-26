/**
 * Phase 07 + 07.1 — PDF backend over jsPDF.
 *
 * Reads a DocumentModel produced by the Phase 06 builders, runs paginate(),
 * and renders each Sheet to a real PDF page with ГОСТ frame/stamp + content.
 *
 * Phase 07.1: точная геометрия штампа по ГОСТ 2.104-2006 форма 1, боковая полоса
 * (Согласовано / Инв.№ подп. / Подп. и дата / Взам. инв. №), маркировка формата
 * под рамкой («Формат А4К»), три режима листа (full / minimal-footer / none).
 *
 * Coordinate unit: mm (matches sheet/frame/stamp geometry).
 * Font sizes: pt.
 *
 * Lazy-loads TTFs via fontLoader and registers them on the jsPDF instance.
 */

import { jsPDF } from 'jspdf'
import { paginate } from '../sheet/layout'
import { dimensions, effectiveOrientation, formatStampMark } from '../sheet/formats'
import { computeFrame, FRAME_LINE_THICK_MM, FRAME_LINE_THIN_MM, FRAME_MARGIN_LEFT_MM } from '../sheet/frame'
import {
  computeStampPosition,
  STAMP_GEOMETRY,
  STAMP_HEIGHT_MM,
  buildDesignationCode,
  signerDate
} from '../sheet/stamp'
import { loadFontFamily, type LoadedFontFamily } from './fontLoader'
import type {
  ContentBlock,
  DocumentModel,
  ExportFontFamily,
  Sheet,
  Stamp,
  StampMode,
  TableCell,
  TableColumn,
  TableRow
} from '../types'

export interface ExportToPdfOptions {
  readonly fontFamily: ExportFontFamily
}

const CONTENT_PAD_MM = 4
const STAMP_GAP_MM = 2
const SIDEBAR_WIDTH_MM = 7         // ширина боковой полосы между обрезом и левой границей рамки
const FORMAT_MARK_GAP_MM = 1.5     // отступ от рамки до строки «Формат А4К»
const FOOTER_MIN_HEIGHT_MM = 8     // высота мини-футера для stampMode='minimal-footer'

const HEADING_FONT_PT: Record<1 | 2 | 3, number> = { 1: 14, 2: 11, 3: 9 }
const HEADING_LINE_MM: Record<1 | 2 | 3, number> = { 1: 12, 2: 9, 3: 7 }
const PARAGRAPH_FONT_PT = 9
const PARAGRAPH_LINE_MM = 5
const TABLE_HEADER_FONT_PT = 8
const TABLE_BODY_FONT_PT = 8
const TABLE_HEADER_HEIGHT_MM = 7
const TABLE_ROW_HEIGHT_MM = 6
const KV_FONT_PT_LABEL = 6
const KV_FONT_PT_VALUE = 8
const KV_ROW_HEIGHT_MM = 6
const BLOCK_GAP_MM = 3

export async function exportToPdf(
  model: DocumentModel,
  options: ExportToPdfOptions
): Promise<Blob> {
  const sheets = paginate(model)
  const orient = effectiveOrientation(model.format, model.orientation)
  const dims = dimensions(model.format, orient)

  const doc = new jsPDF({
    unit: 'mm',
    orientation: dims.widthMm > dims.heightMm ? 'landscape' : 'portrait',
    format: [dims.widthMm, dims.heightMm],
    compress: true
  })

  const font = await loadFontFamily(options.fontFamily)
  registerFont(doc, font)

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i]
    if (sheet == null) continue
    if (i > 0) {
      doc.addPage(
        [dims.widthMm, dims.heightMm],
        dims.widthMm > dims.heightMm ? 'landscape' : 'portrait'
      )
    }
    drawSheet(doc, model, sheet, font.jsName)
  }

  return doc.output('blob')
}

function registerFont(doc: jsPDF, font: LoadedFontFamily): void {
  doc.addFileToVFS(`${font.jsName}-Regular.ttf`, font.regularBase64)
  doc.addFileToVFS(`${font.jsName}-Bold.ttf`, font.boldBase64)
  doc.addFont(`${font.jsName}-Regular.ttf`, font.jsName, 'normal')
  doc.addFont(`${font.jsName}-Bold.ttf`, font.jsName, 'bold')
  doc.setFont(font.jsName, 'normal')
}

function drawSheet(doc: jsPDF, model: DocumentModel, sheet: Sheet, fontName: string): void {
  const orient = effectiveOrientation(model.format, model.orientation)
  const dims = dimensions(model.format, orient)
  const frame = computeFrame(dims.widthMm, dims.heightMm)
  const mode: StampMode = model.stampMode ?? 'full'

  // Frame — толстая рамка ГОСТ
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(FRAME_LINE_THICK_MM)
  doc.rect(frame.xMm, frame.yMm, frame.widthMm, frame.heightMm)

  // Контент: верхняя часть листа
  const contentX = frame.xMm + CONTENT_PAD_MM
  const contentY = frame.yMm + CONTENT_PAD_MM
  const contentW = frame.widthMm - CONTENT_PAD_MM * 2
  const contentMaxY = computeContentMaxY(model, frame.yMm + frame.heightMm)
  drawContent(doc, sheet.blocks, contentX, contentY, contentW, contentMaxY, fontName)

  // Маркировка формата (для full и minimal-footer; для none — нет)
  if (mode !== 'none') {
    drawFormatMark(doc, model, frame, fontName, dims.widthMm, dims.heightMm)
  }

  if (mode === 'full') {
    drawSideBar(doc, model.stamp, frame, fontName)
    const stampPos = computeStampPosition(frame)
    drawStampForm1(doc, model.stamp, stampPos, sheet.index, sheet.total, fontName)
  } else if (mode === 'minimal-footer') {
    drawFooterLine(doc, model.footerLine ?? '', sheet.index, sheet.total, frame, fontName)
  }
}

function computeContentMaxY(model: DocumentModel, frameBottomY: number): number {
  const mode: StampMode = model.stampMode ?? 'full'
  if (mode === 'full') return frameBottomY - STAMP_HEIGHT_MM - STAMP_GAP_MM
  if (mode === 'minimal-footer') return frameBottomY - FOOTER_MIN_HEIGHT_MM - STAMP_GAP_MM
  return frameBottomY - CONTENT_PAD_MM
}

// ─── Content ──────────────────────────────────────────────────────────────

function drawContent(
  doc: jsPDF,
  blocks: readonly ContentBlock[],
  x: number,
  startY: number,
  width: number,
  maxY: number,
  fontName: string
): void {
  let y = startY
  for (const block of blocks) {
    if (y >= maxY) break
    y = drawBlock(doc, block, x, y, width, fontName) + BLOCK_GAP_MM
  }
}

function drawBlock(
  doc: jsPDF,
  block: ContentBlock,
  x: number,
  y: number,
  width: number,
  fontName: string
): number {
  switch (block.kind) {
    case 'heading': {
      doc.setFont(fontName, 'bold')
      doc.setFontSize(HEADING_FONT_PT[block.level])
      doc.setTextColor(0, 0, 0)
      doc.text(block.text, x, y + HEADING_LINE_MM[block.level] * 0.7)
      return y + HEADING_LINE_MM[block.level]
    }
    case 'paragraph': {
      doc.setFont(fontName, 'normal')
      doc.setFontSize(PARAGRAPH_FONT_PT)
      doc.setTextColor(0, 0, 0)
      const lines: string[] = doc.splitTextToSize(block.text, width) as string[]
      lines.forEach((line, i) => {
        doc.text(line, x, y + (i + 1) * PARAGRAPH_LINE_MM * 0.85)
      })
      return y + lines.length * PARAGRAPH_LINE_MM
    }
    case 'kv-grid': {
      const cols = block.columns
      const colW = width / cols
      const rows = Math.ceil(block.items.length / cols)
      doc.setTextColor(0, 0, 0)
      block.items.forEach((it, idx) => {
        const r = Math.floor(idx / cols)
        const c = idx % cols
        const cx = x + c * colW
        const cy = y + r * KV_ROW_HEIGHT_MM
        doc.setFont(fontName, 'normal')
        doc.setFontSize(KV_FONT_PT_LABEL)
        doc.setTextColor(85, 85, 85)
        doc.text(it.label.toUpperCase(), cx, cy + 2)
        doc.setFont(fontName, 'normal')
        doc.setFontSize(KV_FONT_PT_VALUE)
        doc.setTextColor(0, 0, 0)
        doc.text(it.value || '—', cx, cy + 5)
      })
      return y + rows * KV_ROW_HEIGHT_MM
    }
    case 'table': {
      return drawTable(doc, block.columns, block.rows, block.footer, x, y, width, fontName)
    }
  }
}

function drawTable(
  doc: jsPDF,
  columns: readonly TableColumn[],
  rows: readonly TableRow[],
  footer: TableRow | undefined,
  x: number,
  y: number,
  width: number,
  fontName: string
): number {
  const widths = computeColumnWidths(columns, width)
  let cy = y

  doc.setFont(fontName, 'bold')
  doc.setFontSize(TABLE_HEADER_FONT_PT)
  doc.setTextColor(0, 0, 0)
  doc.setLineWidth(FRAME_LINE_THIN_MM)
  doc.line(x, cy, x + width, cy)
  let cx = x
  columns.forEach((col, i) => {
    drawCell(doc, col.title, cx, cy, widths[i] ?? 0, TABLE_HEADER_HEIGHT_MM, col.align, true)
    cx += widths[i] ?? 0
  })
  cy += TABLE_HEADER_HEIGHT_MM
  doc.line(x, cy, x + width, cy)

  doc.setFont(fontName, 'normal')
  doc.setFontSize(TABLE_BODY_FONT_PT)
  doc.setLineWidth(0.05)
  doc.setDrawColor(204, 204, 204)
  for (const row of rows) {
    cx = x
    row.forEach((cell, i) => {
      drawCell(
        doc,
        cellText(cell),
        cx,
        cy,
        widths[i] ?? 0,
        TABLE_ROW_HEIGHT_MM,
        columns[i]?.align ?? 'left',
        cellBold(cell)
      )
      cx += widths[i] ?? 0
    })
    cy += TABLE_ROW_HEIGHT_MM
    doc.line(x, cy, x + width, cy)
  }

  if (footer) {
    doc.setLineWidth(FRAME_LINE_THIN_MM)
    doc.setDrawColor(0, 0, 0)
    doc.line(x, cy, x + width, cy)
    doc.setFont(fontName, 'bold')
    cx = x
    footer.forEach((cell, i) => {
      drawCell(
        doc,
        cellText(cell),
        cx,
        cy,
        widths[i] ?? 0,
        TABLE_ROW_HEIGHT_MM,
        columns[i]?.align ?? 'left',
        true
      )
      cx += widths[i] ?? 0
    })
    cy += TABLE_ROW_HEIGHT_MM
    doc.line(x, cy, x + width, cy)
  }

  doc.setDrawColor(0, 0, 0)
  return cy
}

function computeColumnWidths(columns: readonly TableColumn[], totalWidth: number): readonly number[] {
  const fixed = columns.reduce((acc, c) => acc + (c.widthMm ?? 0), 0)
  const flex = columns.filter(c => c.widthMm == null).length
  const flexW = flex > 0 ? Math.max(0, (totalWidth - fixed) / flex) : 0
  return columns.map(c => c.widthMm ?? flexW)
}

function drawCell(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  align: 'left' | 'center' | 'right',
  bold: boolean
): void {
  if (w <= 0) return
  const padX = 0.8
  const baseY = y + h * 0.65
  const textX = align === 'right' ? x + w - padX : align === 'center' ? x + w / 2 : x + padX
  const opts = { align } as const
  doc.setFont(doc.getFont().fontName, bold ? 'bold' : 'normal')
  doc.text(truncateToWidth(doc, text, w - padX * 2), textX, baseY, opts)
}

function truncateToWidth(doc: jsPDF, text: string, maxMm: number): string {
  if (maxMm <= 0) return ''
  const w = doc.getTextWidth(text)
  if (w <= maxMm) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (doc.getTextWidth(text.slice(0, mid) + '…') <= maxMm) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo) + '…'
}

function cellText(c: TableCell): string {
  if (typeof c === 'string') return c
  if (typeof c === 'number') return String(c)
  return c.text
}

function cellBold(c: TableCell): boolean {
  return typeof c === 'object' && c !== null && c.bold === true
}

// ─── Stamp form 1 (ГОСТ 2.104-2006) ───────────────────────────────────────

function drawStampForm1(
  doc: jsPDF,
  stamp: Stamp,
  pos: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  sheetIndex: number,
  sheetTotal: number,
  fontName: string
): void {
  const { xMm: x, yMm: y, widthMm: W, heightMm: H } = pos
  const G = STAMP_GEOMETRY

  doc.setLineWidth(FRAME_LINE_THICK_MM)
  doc.setDrawColor(0, 0, 0)
  doc.rect(x, y, W, H)

  doc.setLineWidth(FRAME_LINE_THIN_MM)

  // ───── Графа изменений (нижний-левый блок 75×25) ─────
  // Заголовок (5мм) + 4 пустые строки по 5мм
  const ch = G.changes
  const chX = x + ch.x
  const chY = y + ch.y
  // Внешние границы — рисуем линии разделителей колонок
  let cx = chX
  for (const col of ch.cols) {
    cx += col.width
    if (cx < chX + ch.width) {
      doc.line(cx, chY, cx, chY + ch.height)
    }
  }
  // Горизонтальные линии (заголовок + 4 строки)
  for (let r = 1; r <= 5; r++) {
    const ly = chY + r * 5
    if (ly <= chY + ch.height) doc.line(chX, ly, chX + ch.width, ly)
  }
  // Заголовки колонок
  doc.setFont(fontName, 'normal')
  doc.setFontSize(5)
  cx = chX
  for (const col of ch.cols) {
    drawCenteredText(doc, col.label, cx, chY, col.width, ch.headerHeight)
    cx += col.width
  }

  // ───── Графы 10-13 (Должность/Фамилия/Подпись/Дата) — 75×30 над графой изменений ─────
  const sg = G.signers
  const sgX = x + sg.x
  const sgY = y + sg.y
  // Вертикальные разделители
  cx = sgX
  for (const col of sg.cols) {
    cx += col.width
    if (cx < sgX + sg.width) {
      doc.line(cx, sgY, cx, sgY + sg.height)
    }
  }
  // Горизонтальные разделители (5 строк по 6мм)
  for (let r = 1; r <= sg.rows.length; r++) {
    const ly = sgY + r * sg.rowHeight
    if (ly <= sgY + sg.height) doc.line(sgX, ly, sgX + sg.width, ly)
  }
  // Содержимое строк
  doc.setFont(fontName, 'normal')
  doc.setFontSize(7)
  doc.setTextColor(0, 0, 0)
  // Дату отрисуем меньшим шрифтом, иначе DD.MM.YYYY обрезается в 13мм колонке
  const drawSignRow = (rowIdx: number, role: string, name: string, date: string) => {
    const ry = sgY + rowIdx * sg.rowHeight
    doc.setFontSize(7)
    drawLeftText(doc, role, sgX, ry, sg.cols[0]!.width, sg.rowHeight)
    drawLeftText(doc, name, sgX + sg.cols[0]!.width, ry, sg.cols[1]!.width, sg.rowHeight)
    doc.setFontSize(6)
    drawLeftText(doc, date, sgX + sg.cols[0]!.width + sg.cols[1]!.width + sg.cols[2]!.width, ry, sg.cols[3]!.width, sg.rowHeight)
    doc.setFontSize(7)
  }
  drawSignRow(0, 'Разраб.', stamp.authorName, signerDate(stamp, 'author'))
  drawSignRow(1, 'Проверил', stamp.checkerName, signerDate(stamp, 'checker'))
  drawSignRow(2, 'ГИП', stamp.gipName, signerDate(stamp, 'gip'))
  drawSignRow(3, 'Н. контр.', stamp.normControlName, signerDate(stamp, 'normControl'))
  drawSignRow(4, 'Утв.', stamp.approverName, stamp.approverName ? signerDate(stamp, 'approver') : '')

  // ───── Графы 1-2 (Обозначение/Название) — центральная колонка 70×50 ─────
  const ti = G.title
  const tiX = x + ti.x
  const tiY = y + ti.y
  // Линия между обозначением (графа 2 сверху 15мм) и названием (графа 1)
  doc.line(tiX, tiY + ti.designationHeight, tiX + ti.width, tiY + ti.designationHeight)

  // Графа 2 — обозначение/шифр (большой текст)
  doc.setFont(fontName, 'bold')
  doc.setFontSize(11)
  doc.setTextColor(0, 0, 0)
  const designation = buildDesignationCode(stamp)
  drawCenteredText(doc, designation, tiX, tiY, ti.width, ti.designationHeight)

  // Графа 1 — название чертежа (крупный текст по центру нижней части)
  doc.setFont(fontName, 'bold')
  doc.setFontSize(10)
  const title = stamp.drawingTitle || ''
  const titleArea = { x: tiX, y: tiY + ti.designationHeight, w: ti.width, h: ti.height - ti.designationHeight }
  drawWrappedCenteredText(doc, title, titleArea.x, titleArea.y, titleArea.w, titleArea.h, 4)

  // ───── Графы 4/7/8 (Стадия/Лист/Листов) — 70×10 под title ─────
  // 2 строки по 5мм: верх — заголовки, низ — значения. Колонки 30/20/20.
  const st = G.stage
  const stX = x + st.x
  const stY = y + st.y
  const stCols = [
    { id: 'stage', label: 'Стадия', value: stamp.stageCode, w: 30 },
    { id: 'sheet', label: 'Лист', value: String(sheetIndex + 1), w: 20 },
    { id: 'sheets', label: 'Листов', value: String(sheetTotal), w: 20 }
  ]
  // Верхняя горизонтальная линия (между title и stage)
  doc.line(stX, stY, stX + st.width, stY)
  // Средняя горизонтальная линия (между заголовками и значениями)
  doc.line(stX, stY + st.height / 2, stX + st.width, stY + st.height / 2)
  // Вертикальные разделители колонок
  let stCx = stX
  for (let i = 0; i < stCols.length - 1; i++) {
    stCx += stCols[i]!.w
    doc.line(stCx, stY, stCx, stY + st.height)
  }
  // Заголовки (верхняя строка)
  doc.setFontSize(5)
  doc.setFont(fontName, 'normal')
  doc.setTextColor(85, 85, 85)
  stCx = stX
  for (const col of stCols) {
    drawCenteredText(doc, col.label, stCx, stY, col.w, st.height / 2)
    stCx += col.w
  }
  // Значения (нижняя строка)
  doc.setFontSize(8)
  doc.setFont(fontName, 'bold')
  doc.setTextColor(0, 0, 0)
  stCx = stX
  for (const col of stCols) {
    drawCenteredText(doc, col.value, stCx, stY + st.height / 2, col.w, st.height / 2)
    stCx += col.w
  }

  // ───── Графа 9 — правый блок (Организация + лого) ─────
  const co = G.company
  const coX = x + co.x
  const coY = y + co.y
  // Внутри: 60% сверху — лого, 40% снизу — название организации (или наоборот, по образцу — логотип крупный сверху)
  const logoH = co.height * 0.55
  const textY = coY + logoH

  // Линия между лого и текстом
  doc.line(coX, textY, coX + co.width, textY)

  // Лого
  if (stamp.logoDataUrl) {
    drawLogo(doc, stamp.logoDataUrl, coX + 1, coY + 1, co.width - 2, logoH - 2)
  }

  // Название организации
  doc.setFont(fontName, 'bold')
  doc.setFontSize(7)
  doc.setTextColor(0, 0, 0)
  const orgArea = { x: coX, y: textY, w: co.width, h: co.height - logoH }
  drawWrappedCenteredText(doc, stamp.companyName || '', orgArea.x, orgArea.y, orgArea.w, orgArea.h, 3)

  // Подразделение мелко (если есть)
  if (stamp.companyDept) {
    doc.setFont(fontName, 'normal')
    doc.setFontSize(5)
    doc.setTextColor(85, 85, 85)
    doc.text(stamp.companyDept, coX + co.width / 2, coY + co.height - 1, { align: 'center' })
  }
  doc.setTextColor(0, 0, 0)
}

// ─── Side bar (графы 19-23 по ГОСТ Р 21.101) ──────────────────────────────

function drawSideBar(
  doc: jsPDF,
  stamp: Stamp,
  frame: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  fontName: string
): void {
  // Полоса лежит между обрезом листа (xMm=0) и левой границей рамки (xMm=FRAME_MARGIN_LEFT_MM=20)
  // Используем ширину SIDEBAR_WIDTH_MM=7, выровнено по правому краю (прижато к рамке)
  const x = frame.xMm - SIDEBAR_WIDTH_MM
  const y = frame.yMm
  const w = SIDEBAR_WIDTH_MM
  const h = frame.heightMm

  // Внешние линии полосы
  doc.setLineWidth(FRAME_LINE_THIN_MM)
  doc.setDrawColor(0, 0, 0)
  doc.rect(x, y, w, h)

  // Разбиваем по высоте: «Согласовано» (вверху, ~25мм) | Инв.№ подп. | Подп. и дата | Взам. инв. №
  // Доли по высоте — сверху вниз
  const sections = [
    { label: 'Согласовано', value: stamp.agreedBy ?? '', heightFrac: 0.30 },
    { label: 'Инв. № подл.', value: stamp.inventoryNumber ?? '', heightFrac: 0.22 },
    { label: 'Подп. и дата', value: '', heightFrac: 0.26 },
    { label: 'Взам. инв. №', value: stamp.replacedInventoryNumber ?? '', heightFrac: 0.22 }
  ]

  let cy = y
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]!
    const sh = h * sec.heightFrac
    if (i > 0) doc.line(x, cy, x + w, cy)

    // Текст вертикально снизу-вверх — anchor по центру секции, поворот -90° (CCW)
    // jsPDF: angle отрицательный = против часовой стрелки.
    doc.setFont(fontName, 'normal')
    doc.setFontSize(5)
    doc.setTextColor(0, 0, 0)

    const cx = x + w / 2 + 1.2          // чуть правее центра, чтобы текст центровался по секции
    const cyMid = cy + sh / 2
    const display = sec.value ? `${sec.label} ${sec.value}` : sec.label
    doc.text(display, cx, cyMid, { angle: 90, align: 'center' })

    cy += sh
  }
  doc.setTextColor(0, 0, 0)
}

// ─── Format mark («Формат А4К») ───────────────────────────────────────────

function drawFormatMark(
  doc: jsPDF,
  model: DocumentModel,
  frame: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  fontName: string,
  sheetWidthMm: number,
  sheetHeightMm: number
): void {
  const mark = formatStampMark(model.format, model.orientation)
  doc.setFont(fontName, 'normal')
  doc.setFontSize(6)
  doc.setTextColor(85, 85, 85)
  // Под рамкой справа внизу
  const markX = frame.xMm + frame.widthMm
  const markY = Math.min(sheetHeightMm - 1, frame.yMm + frame.heightMm + FORMAT_MARK_GAP_MM + 2)
  doc.text(mark, markX, markY, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  void sheetWidthMm
}

// ─── Footer line for stampMode='minimal-footer' ────────────────────────────

function drawFooterLine(
  doc: jsPDF,
  text: string,
  sheetIndex: number,
  sheetTotal: number,
  frame: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  fontName: string
): void {
  // Тонкая горизонтальная линия + строка типа «Приложение Б» слева, «Лист N из M» справа
  const lineY = frame.yMm + frame.heightMm - FOOTER_MIN_HEIGHT_MM
  doc.setLineWidth(FRAME_LINE_THIN_MM)
  doc.setDrawColor(0, 0, 0)
  doc.line(frame.xMm, lineY, frame.xMm + frame.widthMm, lineY)

  doc.setFont(fontName, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  if (text) {
    doc.text(text, frame.xMm + 2, lineY + 5)
  }
  if (sheetTotal > 1) {
    doc.text(`Лист ${sheetIndex + 1} из ${sheetTotal}`, frame.xMm + frame.widthMm - 2, lineY + 5, { align: 'right' })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function drawCenteredText(doc: jsPDF, text: string, x: number, y: number, w: number, h: number): void {
  if (!text) return
  doc.text(text, x + w / 2, y + h * 0.65, { align: 'center' })
}

function drawLeftText(doc: jsPDF, text: string, x: number, y: number, w: number, h: number): void {
  if (!text) return
  const padX = 0.6
  doc.text(truncateToWidth(doc, text, w - padX * 2), x + padX, y + h * 0.65)
}

function drawWrappedCenteredText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  lineMm: number
): void {
  if (!text) return
  const lines = doc.splitTextToSize(text, w - 2) as string[]
  const totalH = lines.length * lineMm
  const startY = y + (h - totalH) / 2 + lineMm * 0.7
  lines.forEach((line, i) => {
    doc.text(line, x + w / 2, startY + i * lineMm, { align: 'center' })
  })
}

function drawLogo(doc: jsPDF, dataUrl: string, x: number, y: number, maxW: number, maxH: number): void {
  try {
    const fmt = detectImageFormat(dataUrl)
    if (!fmt) return
    doc.addImage(dataUrl, fmt, x, y, maxW, maxH, undefined, 'FAST')
  } catch (err) {
    console.warn('[pdf] drawLogo failed', err)
  }
}

function detectImageFormat(dataUrl: string): 'PNG' | 'JPEG' | null {
  if (dataUrl.startsWith('data:image/png')) return 'PNG'
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG'
  return null
}

void FRAME_MARGIN_LEFT_MM
