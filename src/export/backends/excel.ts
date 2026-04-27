/**
 * Excel backend (SheetJS/xlsx) для экспорта документов.
 *
 * Штамп в Excel не рендерится pixel-perfect — вместо него строка метаданных
 * в заголовке листа (шифр, стадия, дата).
 *
 * Использует SheetJS (xlsx): utils.book_new / utils.aoa_to_sheet / write.
 * Поддерживает ContentBlock: heading, paragraph, kv-grid, table.
 */

import * as XLSX from 'xlsx'
import { buildDesignationCode } from '../sheet/stamp'
import type { DocumentModel, ContentBlock, TableRow, TableCell } from '../types'

export async function exportToExcel(model: DocumentModel): Promise<Blob> {
  const wb = XLSX.utils.book_new()
  const rows: (string | number)[][] = []

  const stamp = model.gostStamp ?? model.stamp

  // Метаданные заголовка
  rows.push([buildDesignationCode(stamp)])
  rows.push([stamp.drawingTitle ?? ''])
  rows.push([`Стадия: ${stamp.stageCode}  |  Дата: ${stamp.date}  |  Разработал: ${stamp.authorName}`])
  rows.push([])

  for (const block of model.content) {
    appendBlock(rows, block)
    rows.push([])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Ширина первой колонки — автоматически под контент
  ws['!cols'] = [{ wch: 60 }]

  XLSX.utils.book_append_sheet(wb, ws, 'Лист1')

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
}

function appendBlock(rows: (string | number)[][], block: ContentBlock): void {
  switch (block.kind) {
    case 'heading':
      rows.push([block.text.toUpperCase()])
      break
    case 'paragraph':
      rows.push([block.text])
      break
    case 'kv-grid':
      for (let i = 0; i < block.items.length; i += block.columns) {
        const row: string[] = []
        for (let j = 0; j < block.columns; j++) {
          const item = block.items[i + j]
          if (item) row.push(`${item.label}: ${item.value}`)
        }
        rows.push(row)
      }
      break
    case 'table': {
      rows.push(block.columns.map(c => c.title))
      for (const row of block.rows) {
        rows.push(row.map(cellToValue))
      }
      if (block.footer) {
        rows.push(block.footer.map(cellToValue))
      }
      break
    }
  }
}

function cellToValue(c: TableCell): string | number {
  if (typeof c === 'string') return c
  if (typeof c === 'number') return c
  return c.text
}
