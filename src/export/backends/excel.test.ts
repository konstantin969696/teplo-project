/**
 * Excel backend smoke test.
 * Проверяет что exportToExcel возвращает Blob с правильным MIME.
 */

import { describe, it, expect } from 'vitest'
import { exportToExcel } from './excel'
import { findFormat } from '../sheet/formats'
import type { DocumentModel } from '../types'

const A4 = findFormat('A4')!

const baseStamp = {
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
  companyName: 'ООО Теплопроект',
  companyDept: '',
  date: '2026-04-27',
}

const model: DocumentModel = {
  id: 'test',
  fileName: 'test',
  format: A4,
  orientation: 'portrait',
  stamp: baseStamp,
  content: [
    { kind: 'heading', text: 'Заголовок', level: 1 },
    { kind: 'paragraph', text: 'Параграф с кириллицей.' },
    {
      kind: 'table',
      columns: [
        { id: 'n', title: '№', align: 'right' },
        { id: 'name', title: 'Помещение', align: 'left' },
        { id: 'q', title: 'Q, Вт', align: 'right' },
      ],
      rows: [
        ['1', 'Гостиная', 1500],
        ['2', 'Кухня', 800],
      ],
      footer: ['', 'Итого', { text: '2300', bold: true }],
    },
  ],
}

describe('excel backend', () => {
  it('возвращает Blob с MIME application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', async () => {
    const blob = await exportToExcel(model)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  })

  it('размер больше 1 KB (валидный xlsx)', async () => {
    const blob = await exportToExcel(model)
    expect(blob.size).toBeGreaterThan(1000)
  })

  it('работает с gostStamp вместо stamp', async () => {
    const gostModel: DocumentModel = {
      ...model,
      gostStamp: {
        ...baseStamp,
        drawingTitle: 'Расчёт теплопотерь (форма 5)',
      },
    }
    const blob = await exportToExcel(gostModel)
    expect(blob.size).toBeGreaterThan(1000)
  })

  it('работает с пустым контентом', async () => {
    const empty: DocumentModel = { ...model, content: [] }
    const blob = await exportToExcel(empty)
    expect(blob).toBeInstanceOf(Blob)
  })

  it('kv-grid блок корректно обрабатывается', async () => {
    const kvModel: DocumentModel = {
      ...model,
      content: [{
        kind: 'kv-grid',
        columns: 2,
        items: [
          { label: 'Город', value: 'Москва' },
          { label: 'tнар', value: '-28°C' },
        ],
      }],
    }
    const blob = await exportToExcel(kvModel)
    expect(blob.size).toBeGreaterThan(1000)
  })
})
