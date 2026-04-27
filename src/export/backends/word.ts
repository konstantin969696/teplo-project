/**
 * Word backend (docx npm package) для экспорта документов.
 *
 * Генерирует .docx файл с рамкой как Table + текстовым контентом.
 * Штамп формы 5/6 — параграф в нижней части документа (упрощённо).
 *
 * 1 мм ≈ 56.7 twips (twips = 1/1440 дюйма, 1 дюйм = 25.4 мм).
 */

import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  HeadingLevel,
  TextRun,
  AlignmentType,
} from 'docx'
import { buildDesignationCode } from '../sheet/stamp'
import type { DocumentModel, ContentBlock, TableRow as TRow, TableCell as TCell } from '../types'

const MM_TO_TWIP = 56.7

function mmToTwip(mm: number): number {
  return Math.round(mm * MM_TO_TWIP)
}

export async function exportToWord(model: DocumentModel): Promise<Blob> {
  const stamp = model.gostStamp ?? model.stamp

  const metaParagraphs = [
    new Paragraph({
      children: [new TextRun({ text: buildDesignationCode(stamp), bold: true })],
    }),
    new Paragraph({ children: [new TextRun({ text: stamp.drawingTitle ?? '' })] }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Стадия: ${stamp.stageCode}  |  Дата: ${stamp.date}  |  Разработал: ${stamp.authorName}`
        })
      ]
    }),
    new Paragraph({ children: [] }),
  ]

  const contentSections = model.content.flatMap(block => buildBlock(block))

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            left: mmToTwip(20),
            right: mmToTwip(5),
            top: mmToTwip(5),
            bottom: mmToTwip(45),   // место под штамп
          }
        }
      },
      children: [...metaParagraphs, ...contentSections],
    }]
  })

  const buf = await Packer.toBuffer(doc)
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })
}

function buildBlock(block: ContentBlock): (Paragraph | Table)[] {
  switch (block.kind) {
    case 'heading':
      return [new Paragraph({
        heading: block.level === 1 ? HeadingLevel.HEADING_1
          : block.level === 2 ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3,
        children: [new TextRun({ text: block.text })],
      })]

    case 'paragraph':
      return [new Paragraph({
        children: [new TextRun({ text: block.text })],
      })]

    case 'kv-grid': {
      const result: Paragraph[] = []
      for (let i = 0; i < block.items.length; i += block.columns) {
        const texts: string[] = []
        for (let j = 0; j < block.columns; j++) {
          const it = block.items[i + j]
          if (it) texts.push(`${it.label}: ${it.value}`)
        }
        result.push(new Paragraph({ children: [new TextRun({ text: texts.join('   ') })] }))
      }
      return result
    }

    case 'table': {
      const totalWidthMm = 165  // ширина текстовой области (A4: 210-20-5-10=175, минус отступы)
      const colWidths = computeColumnWidths(block.columns, totalWidthMm)

      const noBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
      const headerBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' }

      const headerRow = new TableRow({
        children: block.columns.map((col, i) =>
          new TableCell({
            width: { size: mmToTwip(colWidths[i] ?? 20), type: WidthType.DXA },
            borders: { bottom: headerBorder, top: headerBorder, left: noBorder, right: noBorder },
            children: [new Paragraph({
              alignment: col.align === 'center' ? AlignmentType.CENTER
                : col.align === 'right' ? AlignmentType.RIGHT
                : AlignmentType.LEFT,
              children: [new TextRun({ text: col.title, bold: true })]
            })]
          })
        )
      })

      const dataRows = block.rows.map((row: TRow) =>
        new TableRow({
          children: row.map((cell: TCell, i: number) =>
            new TableCell({
              width: { size: mmToTwip(colWidths[i] ?? 20), type: WidthType.DXA },
              borders: { bottom: noBorder, top: noBorder, left: noBorder, right: noBorder },
              children: [new Paragraph({
                alignment: (block.columns[i]?.align === 'center' ? AlignmentType.CENTER
                  : block.columns[i]?.align === 'right' ? AlignmentType.RIGHT
                  : AlignmentType.LEFT),
                children: [new TextRun({ text: cellText(cell), bold: typeof cell === 'object' && cell !== null && 'bold' in cell ? cell.bold : false })]
              })]
            })
          )
        })
      )

      const table = new Table({
        rows: [headerRow, ...dataRows],
        width: { size: mmToTwip(totalWidthMm), type: WidthType.DXA },
      })

      return [table, new Paragraph({ children: [] })]
    }
  }
}

function computeColumnWidths(columns: readonly { widthMm?: number }[], totalMm: number): readonly number[] {
  const fixed = columns.reduce((acc, c) => acc + (c.widthMm ?? 0), 0)
  const flexCount = columns.filter(c => c.widthMm == null).length
  const flexW = flexCount > 0 ? Math.max(0, (totalMm - fixed) / flexCount) : 0
  return columns.map(c => c.widthMm ?? flexW)
}

function cellText(c: TCell): string {
  if (typeof c === 'string') return c
  if (typeof c === 'number') return String(c)
  return c.text
}
