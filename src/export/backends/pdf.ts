/**
 * Phase 07 — PDF backend over jsPDF.
 *
 * Reads a DocumentModel produced by the Phase 06 builders, runs paginate(),
 * and renders each Sheet to a real PDF page with ГОСТ frame/stamp + content.
 *
 * Coordinate unit: mm (matches sheet/frame/stamp geometry).
 * Font sizes: pt.
 *
 * Lazy-loads TTFs via fontLoader and registers them on the jsPDF instance.
 */

import { jsPDF } from 'jspdf'
import { paginate } from '../sheet/layout'
import { dimensions, effectiveOrientation } from '../sheet/formats'
import { computeFrame, FRAME_LINE_THICK_MM, FRAME_LINE_THIN_MM } from '../sheet/frame'
import { computeStampPosition, formatStampDate, formatSheetCounter } from '../sheet/stamp'
import { loadFontFamily, type LoadedFontFamily } from './fontLoader'
import type {
  ContentBlock,
  DocumentModel,
  ExportFontFamily,
  Sheet,
  Stamp,
  TableCell,
  TableColumn,
  TableRow
} from '../types'

export interface ExportToPdfOptions {
  readonly fontFamily: ExportFontFamily
}

const CONTENT_PAD_MM = 4
const STAMP_GAP_MM = 2

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
  const stampPos = computeStampPosition(frame)

  // Frame (тонкая линия обреза + толстая рамка ГОСТ)
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(FRAME_LINE_THICK_MM)
  doc.rect(frame.xMm, frame.yMm, frame.widthMm, frame.heightMm)

  // Контент в верхней части листа
  const contentX = frame.xMm + CONTENT_PAD_MM
  const contentY = frame.yMm + CONTENT_PAD_MM
  const contentW = frame.widthMm - CONTENT_PAD_MM * 2
  const contentMaxY = stampPos.yMm - STAMP_GAP_MM
  drawContent(doc, sheet.blocks, contentX, contentY, contentW, contentMaxY, fontName)

  // Штамп
  drawStamp(doc, model.stamp, stampPos, sheet.index, sheet.total, fontName)
}

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

  // Header
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

  // Body
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

  // Footer
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
  // Бинарный поиск длины с многоточием
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

function drawStamp(
  doc: jsPDF,
  stamp: Stamp,
  pos: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  sheetIndex: number,
  sheetTotal: number,
  fontName: string
): void {
  const { xMm: x, yMm: y, widthMm: W, heightMm: H } = pos
  const colA = 70
  const colB = 50
  const lineH = H / 8

  // Внешняя рамка
  doc.setLineWidth(FRAME_LINE_THICK_MM)
  doc.setDrawColor(0, 0, 0)
  doc.rect(x, y, W, H)

  doc.setLineWidth(FRAME_LINE_THIN_MM)
  // Вертикальные разделители
  doc.line(x + colA, y, x + colA, y + H)
  doc.line(x + colA + colB, y, x + colA + colB, y + H)
  // Левый блок: 4 строки подписей
  const labels: { label: string; name: string }[] = [
    { label: 'Разработал', name: stamp.authorName },
    { label: 'Проверил', name: stamp.checkerName },
    { label: 'Н. контроль', name: stamp.normControlName },
    { label: 'Утвердил', name: stamp.approverName }
  ]
  for (let i = 1; i <= labels.length; i++) {
    doc.line(x, y + lineH * i, x + colA, y + lineH * i)
  }

  doc.setFont(fontName, 'normal')
  doc.setFontSize(7)
  labels.forEach((l, i) => {
    const cy = y + lineH * i + lineH * 0.65
    doc.text(l.label, x + 1, cy)
    if (l.name) doc.text(l.name, x + 22, cy)
    doc.setTextColor(85, 85, 85)
    if (i === 0) doc.text(formatStampDate(stamp.date), x + colA - 9, cy)
    doc.setTextColor(0, 0, 0)
  })

  // Средний блок: drawing title
  doc.setFont(fontName, 'bold')
  doc.setFontSize(11)
  const title = stamp.drawingTitle || '—'
  const titleX = x + colA + colB / 2
  const titleY = y + H / 2 + 1.5
  const titleLines: string[] = doc.splitTextToSize(title, colB - 4) as string[]
  const startY = titleY - ((titleLines.length - 1) * 4) / 2
  titleLines.forEach((line, i) => {
    doc.text(line, titleX, startY + i * 4, { align: 'center' })
  })

  // Правый блок: марка / стадия / лист / организация
  doc.setLineWidth(FRAME_LINE_THIN_MM)
  doc.line(x + colA + colB, y + 6, x + W, y + 6)
  doc.line(x + colA + colB, y + 13, x + W, y + 13)
  doc.line(x + colA + colB, y + 20, x + W, y + 20)

  doc.setFont(fontName, 'bold')
  doc.setFontSize(10)
  doc.text(stamp.drawingMark, x + colA + colB + 1, y + 4.5)

  doc.setFont(fontName, 'normal')
  doc.setFontSize(7)
  doc.text(`Стадия: ${stamp.stageCode}`, x + colA + colB + 1, y + 10.5)
  doc.text(formatSheetCounter(sheetIndex, sheetTotal), x + colA + colB + 1, y + 17.5)

  // Организация / объект
  doc.setFont(fontName, 'bold')
  doc.setFontSize(7)
  doc.text(stamp.companyName || '', x + colA + colB + 1, y + 25)
  doc.setFont(fontName, 'normal')
  doc.setTextColor(85, 85, 85)
  doc.text(stamp.companyDept || '', x + colA + colB + 1, y + 28.5)
  if (stamp.objectName) {
    const objLines: string[] = doc.splitTextToSize(stamp.objectName, W - colA - colB - 2) as string[]
    objLines.slice(0, 3).forEach((line, i) => {
      doc.text(line, x + colA + colB + 1, y + 33 + i * 3.2)
    })
  }
  doc.setTextColor(0, 0, 0)

  // Лого: рисуем поверх правого нижнего угла штампа, если задан
  if (stamp.logoDataUrl) {
    drawLogo(doc, stamp.logoDataUrl, x + colA + colB + 1, y + 43, W - colA - colB - 2, 11)
  }
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
