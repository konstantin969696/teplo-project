/**
 * Phase 07 — pdf backend smoke test.
 *
 * Mocks fontLoader (jsdom не умеет fetch локальных Vite assets),
 * проверяет что exportToPdf возвращает непустой Blob и multi-page работает.
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fontsDir = resolve(__dirname, '../fonts')
const robotoRegular = readFileSync(resolve(fontsDir, 'Roboto-Regular.ttf')).toString('base64')
const robotoBold = readFileSync(resolve(fontsDir, 'Roboto-Bold.ttf')).toString('base64')

vi.mock('./fontLoader', () => {
  return {
    FONT_SOURCES: {
      roboto: { regularUrl: '', boldUrl: '', jsName: 'Roboto', label: 'Roboto' },
      gost: { regularUrl: '', boldUrl: '', jsName: 'DejaVuSerif', label: 'DejaVu Serif' }
    },
    loadFontFamily: vi.fn(async (family: 'roboto' | 'gost') => ({
      jsName: family === 'roboto' ? 'Roboto' : 'DejaVuSerif',
      regularBase64: robotoRegular,
      boldBase64: robotoBold
    }))
  }
})

import { exportToPdf } from './pdf'
import { findFormat } from '../sheet/formats'
import type { DocumentModel } from '../types'

const A4 = findFormat('A4')!

const baseModel: DocumentModel = {
  id: 'test',
  fileName: 'test',
  format: A4,
  orientation: 'portrait',
  stamp: {
    objectName: 'Тестовый объект',
    objectCode: '70-2025',
    subsectionCode: 'ИЛО',
    drawingTitle: 'Теплопотери',
    stageCode: 'П',
    markCode: 'ОВ',
    drawingMark: '',
    authorName: 'Иванов И.И.',
    checkerName: 'Петров П.П.',
    gipName: 'Гвоздёв Г.А.',
    normControlName: 'Соколова С.Н.',
    approverName: '',
    companyName: 'ООО «Теплопроект»',
    companyDept: 'Отдел ОВиК',
    date: '2026-04-26',
    agreedBy: 'Заказчик',
    inventoryNumber: '00123',
    replacedInventoryNumber: '00099'
  },
  content: [
    { kind: 'heading', text: 'Тестовая страница', level: 1 },
    { kind: 'paragraph', text: 'Кириллический параграф для проверки шрифта.' }
  ]
}

describe('pdf backend', () => {
  it('exports a Blob with application/pdf mime type', async () => {
    const blob = await exportToPdf(baseModel, { fontFamily: 'roboto' })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(500)
  })

  it('renders with stampMode=minimal-footer + footerLine', async () => {
    const model: DocumentModel = {
      ...baseModel,
      stampMode: 'minimal-footer',
      footerLine: 'Приложение Б'
    }
    const blob = await exportToPdf(model, { fontFamily: 'roboto' })
    expect(blob.size).toBeGreaterThan(500)
  })

  it('renders with stampMode=none', async () => {
    const model: DocumentModel = { ...baseModel, stampMode: 'none' }
    const blob = await exportToPdf(model, { fontFamily: 'roboto' })
    expect(blob.size).toBeGreaterThan(500)
  })

  it('generates multiple pages for a long table', async () => {
    const longRows = Array.from({ length: 80 }, (_, i) => [
      String(i + 1),
      `Помещение ${i + 1}`,
      `${(i + 1) * 100} Вт`
    ] as const)

    const model: DocumentModel = {
      ...baseModel,
      content: [
        { kind: 'heading', text: 'Длинная таблица', level: 1 },
        {
          kind: 'table',
          columns: [
            { id: 'n', title: '№', align: 'right' },
            { id: 'name', title: 'Помещение', align: 'left' },
            { id: 'q', title: 'Q', align: 'right' }
          ],
          rows: longRows
        }
      ]
    }

    const blobOne = await exportToPdf(baseModel, { fontFamily: 'roboto' })
    const blobMany = await exportToPdf(model, { fontFamily: 'roboto' })
    expect(blobMany.size).toBeGreaterThan(blobOne.size)
  })
})
