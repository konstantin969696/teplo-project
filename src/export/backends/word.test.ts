/**
 * Word backend smoke test.
 * Проверяет что exportToWord возвращает Blob с правильным MIME.
 */

import { describe, it, expect } from 'vitest'
import { exportToWord } from './word'
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
    { kind: 'heading', text: 'Расчёт теплопотерь', level: 1 },
    { kind: 'paragraph', text: 'Кириллический параграф для проверки.' },
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
    },
  ],
}

describe('word backend', () => {
  it('возвращает Blob с MIME application/vnd.openxmlformats-officedocument.wordprocessingml.document', async () => {
    const blob = await exportToWord(model)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })

  it('размер больше 5 KB (валидный docx)', async () => {
    const blob = await exportToWord(model)
    expect(blob.size).toBeGreaterThan(5000)
  })

  it('работает с gostStamp', async () => {
    const gostModel: DocumentModel = {
      ...model,
      gostStamp: {
        ...baseStamp,
        drawingTitle: 'Расчёт (форма 5/6)',
      },
    }
    const blob = await exportToWord(gostModel)
    expect(blob.size).toBeGreaterThan(5000)
  })

  it('работает со всеми типами блоков', async () => {
    const allBlocks: DocumentModel = {
      ...model,
      content: [
        { kind: 'heading', text: 'H1', level: 1 },
        { kind: 'heading', text: 'H2', level: 2 },
        { kind: 'heading', text: 'H3', level: 3 },
        { kind: 'paragraph', text: 'Параграф' },
        { kind: 'kv-grid', columns: 2, items: [{ label: 'A', value: '1' }, { label: 'B', value: '2' }] },
      ],
    }
    const blob = await exportToWord(allBlocks)
    expect(blob.size).toBeGreaterThan(5000)
  })
})
