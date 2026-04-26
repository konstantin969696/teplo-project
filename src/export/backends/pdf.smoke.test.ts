/**
 * Phase 07.1 — smoke test that writes real PDFs to disk for visual UAT.
 * Skipped by default; run with PDF_SMOKE=1 to produce /tmp/stamp_smoke_*.pdf.
 */

import { describe, it, vi } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fontsDir = resolve(__dirname, '../fonts')
const robotoRegular = readFileSync(resolve(fontsDir, 'Roboto-Regular.ttf')).toString('base64')
const robotoBold = readFileSync(resolve(fontsDir, 'Roboto-Bold.ttf')).toString('base64')

vi.mock('./fontLoader', () => ({
  FONT_SOURCES: {
    roboto: { regularUrl: '', boldUrl: '', jsName: 'Roboto', label: 'Roboto' },
    gost: { regularUrl: '', boldUrl: '', jsName: 'DejaVuSerif', label: 'DejaVu Serif' }
  },
  loadFontFamily: vi.fn(async () => ({
    jsName: 'Roboto',
    regularBase64: robotoRegular,
    boldBase64: robotoBold
  }))
}))

import { exportToPdf } from './pdf'
import { findFormat } from '../sheet/formats'
import type { DocumentModel } from '../types'

const A4 = findFormat('A4')!
const A3 = findFormat('A3')!

const baseStamp = {
  objectName: 'Очистные сооружения дождевой канализации мкр. 18Б',
  objectCode: '70-2025',
  subsectionCode: 'ИЛО',
  drawingTitle: 'Содержание тома',
  stageCode: 'П',
  markCode: 'ОВ-С',
  drawingMark: '',
  authorName: 'Бохавчук И.В.',
  checkerName: 'Соловьев Д.М.',
  gipName: 'Гвоздёв Г.А.',
  normControlName: 'Соколова С.Н.',
  approverName: '',
  companyName: 'ГРАЖДАНПРОЕКТ',
  companyDept: '',
  date: '2026-04-26',
  agreedBy: 'ООО «СТРОЙМОНТАЖ»',
  inventoryNumber: '00123',
  replacedInventoryNumber: '00099'
}

const sampleContent: DocumentModel['content'] = [
  { kind: 'heading', text: 'Содержание', level: 1 },
  {
    kind: 'table',
    columns: [
      { id: 'mark', title: 'Обозначение', align: 'left' },
      { id: 'name', title: 'Наименование', align: 'left' },
      { id: 'note', title: 'Примечание', align: 'left' }
    ],
    rows: [
      ['', 'Обложка', ''],
      ['', 'Титульный лист', '1'],
      ['70-2025-П-ИЛО-ОВ-С', 'Содержание тома', '2'],
      ['', 'Текстовая часть', ''],
      ['70-2025-П-ИЛО-ОВ-ПЗ', 'Пояснительная записка', '3-6'],
      ['', 'Графическая часть', ''],
      ['Лист 1', 'Характеристика отопительно-вентиляционных систем', '7'],
      ['Лист 2', 'Воздухообмен', '8'],
      ['Лист 3', 'Теплопотери', '9'],
      ['Лист 4', 'Принципиальная схема вентиляции', '10']
    ]
  }
]

const SMOKE = process.env.PDF_SMOKE === '1'

describe.skipIf(!SMOKE)('pdf smoke (writes to /tmp/stamp_smoke_*.pdf)', () => {
  const writeBlob = async (blob: Blob, name: string) => {
    // jsdom-Blob.arrayBuffer() и Response(blob) оба возвращают пустоту.
    // Используем FileReader из jsdom — он умеет читать jsdom-Blob.
    const ab = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(blob)
    })
    const path = `/tmp/stamp_smoke_${name}.pdf`
    writeFileSync(path, Buffer.from(ab))
    console.log(`wrote ${path} (${ab.byteLength} bytes)`)
  }

  it('A4 portrait — full stamp', async () => {
    const m: DocumentModel = {
      id: 'a4-full',
      fileName: 'a4-full',
      format: A4,
      orientation: 'portrait',
      stamp: baseStamp,
      stampMode: 'full',
      content: sampleContent
    }
    const blob = await exportToPdf(m, { fontFamily: 'roboto' })
    await writeBlob(blob, 'a4-full')
  })

  it('A4 portrait — minimal-footer "Приложение Б"', async () => {
    const m: DocumentModel = {
      id: 'a4-min',
      fileName: 'a4-min',
      format: A4,
      orientation: 'portrait',
      stamp: baseStamp,
      stampMode: 'minimal-footer',
      footerLine: 'Приложение Б',
      content: sampleContent
    }
    const blob = await exportToPdf(m, { fontFamily: 'roboto' })
    await writeBlob(blob, 'a4-minimal')
  })

  it('A4 portrait — none', async () => {
    const m: DocumentModel = {
      id: 'a4-none',
      fileName: 'a4-none',
      format: A4,
      orientation: 'portrait',
      stamp: baseStamp,
      stampMode: 'none',
      content: sampleContent
    }
    const blob = await exportToPdf(m, { fontFamily: 'roboto' })
    await writeBlob(blob, 'a4-none')
  })

  it('A3 landscape — full stamp', async () => {
    const m: DocumentModel = {
      id: 'a3-full',
      fileName: 'a3-full',
      format: A3,
      orientation: 'landscape',
      stamp: { ...baseStamp, drawingTitle: 'Воздухообмен' },
      stampMode: 'full',
      content: sampleContent
    }
    const blob = await exportToPdf(m, { fontFamily: 'roboto' })
    await writeBlob(blob, 'a3-landscape-full')
  })
})
