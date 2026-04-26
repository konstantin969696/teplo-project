/**
 * Phase 06 — pagination: split DocumentModel content into Sheets that fit
 * inside the usable area (frame minus stamp).
 *
 * Heights are in mm. Each block reports an "ideal" height; long tables get
 * split row-by-row. Rest of the rendering exactness is delegated to the
 * format-specific adapter (jsPDF / ExcelJS / docx).
 */

import type { ContentBlock, DocumentModel, Sheet } from '../types'
import { dimensions, effectiveOrientation } from './formats'
import { computeFrame } from './frame'
import { STAMP_HEIGHT_MM } from './stamp'

// Heuristic mm-heights — будут уточнены в фазах 07/08/09 под конкретный backend.
const HEIGHT_HEADING: Record<1 | 2 | 3, number> = { 1: 12, 2: 9, 3: 7 }
const HEIGHT_PARAGRAPH_LINE = 5
const HEIGHT_TABLE_HEADER = 7
const HEIGHT_TABLE_ROW = 6
const HEIGHT_KV_ROW = 6
const HEIGHT_BLOCK_GAP = 3

function estimateBlockHeight(block: ContentBlock): number {
  switch (block.kind) {
    case 'heading': return HEIGHT_HEADING[block.level] + HEIGHT_BLOCK_GAP
    case 'paragraph': {
      const lines = Math.max(1, Math.ceil(block.text.length / 80))
      return lines * HEIGHT_PARAGRAPH_LINE + HEIGHT_BLOCK_GAP
    }
    case 'kv-grid': {
      const rows = Math.ceil(block.items.length / block.columns)
      return rows * HEIGHT_KV_ROW + HEIGHT_BLOCK_GAP
    }
    case 'table': {
      const footerRows = block.footer ? 1 : 0
      return HEIGHT_TABLE_HEADER + (block.rows.length + footerRows) * HEIGHT_TABLE_ROW + HEIGHT_BLOCK_GAP
    }
  }
}

/**
 * Computes the usable content area on a sheet: frame minus stamp footer minus
 * a small gap above the stamp.
 */
export function usableHeightMm(model: DocumentModel): number {
  const orient = effectiveOrientation(model.format, model.orientation)
  const dims = dimensions(model.format, orient)
  const frame = computeFrame(dims.widthMm, dims.heightMm)
  const STAMP_GAP = 2
  return Math.max(0, frame.heightMm - STAMP_HEIGHT_MM - STAMP_GAP)
}

/**
 * Split a long table block into chunks, each ≤ maxHeight mm.
 * Returns blocks that share the same columns/footer; footer goes to the last chunk.
 */
function splitTableBlock(block: Extract<ContentBlock, { kind: 'table' }>, maxHeightMm: number): readonly ContentBlock[] {
  const headerH = HEIGHT_TABLE_HEADER
  const rowH = HEIGHT_TABLE_ROW
  const rowsPerSheet = Math.max(1, Math.floor((maxHeightMm - headerH - HEIGHT_BLOCK_GAP) / rowH))
  const chunks: ContentBlock[] = []
  for (let i = 0; i < block.rows.length; i += rowsPerSheet) {
    const isLast = i + rowsPerSheet >= block.rows.length
    chunks.push({
      kind: 'table',
      columns: block.columns,
      rows: block.rows.slice(i, i + rowsPerSheet),
      footer: isLast ? block.footer : undefined
    })
  }
  if (chunks.length === 0) {
    // Нет строк, но всё равно вывести шапку + footer
    chunks.push({ kind: 'table', columns: block.columns, rows: [], footer: block.footer })
  }
  return chunks
}

export function paginate(model: DocumentModel): readonly Sheet[] {
  const maxH = usableHeightMm(model)
  const sheets: { blocks: ContentBlock[]; remaining: number }[] = [{ blocks: [], remaining: maxH }]

  const pushBlock = (b: ContentBlock) => {
    const h = estimateBlockHeight(b)
    const cur = sheets[sheets.length - 1]
    if (cur == null) return
    if (h > cur.remaining && cur.blocks.length > 0) {
      sheets.push({ blocks: [b], remaining: maxH - h })
    } else {
      cur.blocks.push(b)
      cur.remaining -= h
    }
  }

  for (const block of model.content) {
    if (block.kind === 'table' && estimateBlockHeight(block) > maxH) {
      const chunks = splitTableBlock(block, maxH)
      for (const c of chunks) pushBlock(c)
    } else {
      pushBlock(block)
    }
  }

  const total = sheets.length
  return sheets.map((s, i) => ({ index: i, total, blocks: s.blocks }))
}
