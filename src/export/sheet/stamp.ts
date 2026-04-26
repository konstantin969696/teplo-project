/**
 * ГОСТ 2.104-2006 — основная надпись «Форма 1» (185×55 мм).
 *
 * Геометрия граф (мм, единая для PDF и SVG превью):
 *
 *   Слева внизу — графы изменений (14-18), 25 мм по высоте, 5 строк, ширины:
 *     Изм 10 | Кол.уч 7 | Лист 10 | №док 23 | Подп 15 | Дата 10
 *   Слева вверху — пусто (там же ↑ те же 75мм, но используются под графы 1-9)
 *
 *   В верхней половине штампа (h=30мм над графой изменений):
 *     • Должность (графа 10) — 17 мм | Фамилия (11) — 23 мм | Подп (12) — 15 мм | Дата (13) — 10 мм — 4 строки по 5 мм + 1 для шапки
 *
 *   Центр (h=30мм x w=70мм): обозначение (графа 2, верх 15мм) + название (графа 1, низ 15мм)
 *   Правее центра (h=15мм x w=40мм мини-таблица): Стадия 15 | Лист 5 | Листов 20 (по нижней строке)
 *   Правый блок (50×24мм): организация + лого (графа 9)
 *
 * Координаты ниже — относительно левого верхнего угла штампа.
 */

import type { Stamp } from '../types'
import type { FrameRect } from './frame'

export const STAMP_WIDTH_MM = 185
export const STAMP_HEIGHT_MM = 55

// Геометрия формы 1 (точные ширины граф из ГОСТ 2.104-2006 приложение А)
export const STAMP_GEOMETRY = {
  width: STAMP_WIDTH_MM,
  height: STAMP_HEIGHT_MM,

  // Графы изменений (14-18) — нижний-левый блок
  changes: {
    x: 0,
    y: 30,
    width: 75,
    height: 25,
    cols: [
      { id: 'izm', label: 'Изм.', width: 10 },
      { id: 'kol', label: 'Кол.уч.', width: 7 },
      { id: 'list', label: 'Лист', width: 10 },
      { id: 'doc', label: '№ док.', width: 23 },
      { id: 'sign', label: 'Подп.', width: 15 },
      { id: 'date', label: 'Дата', width: 10 }
    ],
    headerHeight: 5,
    rowHeight: 5
  },

  // Графы 10-13 (Должность/Фамилия/Подпись/Дата) — над графой изменений? нет, в форме 1
  // эти графы занимают ВЕРХНЮЮ половину левых 75 мм. Высота 25 мм, 5 строк по 5 мм:
  //   строка 1 (заголовок): Разраб. | Фамилия | Подп. | Дата
  //   строка 2-5: Разраб./Проверил/ГИП/Н.контр./Утв.
  // По форме 1 — 5 строк подписантов, верхняя строка — заголовки колонок (но обычно её опускают).
  signers: {
    x: 0,
    y: 0,
    width: 75,
    height: 30,
    cols: [
      { id: 'role', label: '', width: 17 },     // должность
      { id: 'name', label: '', width: 20 },     // фамилия (уменьшено с 23 до 20, 3мм отдали в дату)
      { id: 'sign', label: '', width: 15 },     // подпись
      { id: 'date', label: '', width: 13 }      // дата (увеличено с 10 до 13 для DD.MM.YYYY)
    ],
    rows: [
      { id: 'author', label: 'Разраб.' },
      { id: 'checker', label: 'Проверил' },
      { id: 'gip', label: 'ГИП' },
      { id: 'normControl', label: 'Н. контр.' },
      { id: 'approver', label: 'Утв.' }
    ],
    rowHeight: 6
  },

  // Графы 1-2 — обозначение/название в центре (между подписантами и стадией)
  title: {
    x: 75,
    y: 0,
    width: 70,
    height: 50,
    // Внутри: верх 15 — графа 2 (обозначение шифр), низ 35 — графа 1 (название)
    designationHeight: 15
  },

  // Графы 4/7/8 — Стадия / Лист / Листов (мини-таблица справа от title)
  stage: {
    x: 75,
    y: 50,
    width: 70,
    height: 5,
    cols: [
      { id: 'stage', label: 'Стадия', width: 15 },
      { id: 'sheet', label: 'Лист', width: 5 },
      { id: 'sheets', label: 'Листов', width: 20 }
    ]
  },

  // Графа 9 — правый блок (организация + лого)
  company: {
    x: 145,
    y: 0,
    width: 40,
    height: 55
  }
} as const

/**
 * Position of the title block inside the frame: правый нижний угол.
 */
export interface StampPosition {
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

export function computeStampPosition(frame: FrameRect): StampPosition {
  return {
    xMm: frame.xMm + frame.widthMm - STAMP_WIDTH_MM,
    yMm: frame.yMm + frame.heightMm - STAMP_HEIGHT_MM,
    widthMm: STAMP_WIDTH_MM,
    heightMm: STAMP_HEIGHT_MM
  }
}

export const EMPTY_STAMP: Stamp = {
  objectName: '',
  objectCode: '',
  subsectionCode: '',
  drawingTitle: '',
  stageCode: 'Р',
  markCode: 'ОВ',
  drawingMark: '',
  authorName: '',
  checkerName: '',
  gipName: '',
  normControlName: '',
  approverName: '',
  companyName: '',
  companyDept: '',
  date: new Date().toISOString().slice(0, 10)
}

/**
 * Format ISO date YYYY-MM-DD as DD.MM.YYYY for stamp display.
 */
export function formatStampDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

/**
 * "Лист N из M" string (legacy, теперь используется отдельно для графы Лист/Листов).
 */
export function formatSheetCounter(index: number, total: number): string {
  return `Лист ${index + 1} из ${total}`
}

/**
 * Шифр документа графы 2 по ГОСТ Р 21.101-2020.
 * Если drawingMark задан — берём его как override.
 * Иначе собираем из частей: `${objectCode}-${stageCode}-${subsectionCode} - ${markCode}`.
 */
export function buildDesignationCode(stamp: Stamp): string {
  if (stamp.drawingMark && stamp.drawingMark.trim() !== '') return stamp.drawingMark
  const parts = [stamp.objectCode, stamp.stageCode, stamp.subsectionCode].filter(p => p && p.trim() !== '')
  const left = parts.join('-')
  const right = stamp.markCode || ''
  if (!left && !right) return ''
  if (!left) return right
  if (!right) return left
  return `${left} - ${right}`
}

/**
 * Дата подписанта (с fallback на общую stamp.date).
 */
export function signerDate(stamp: Stamp, signer: 'author' | 'checker' | 'gip' | 'normControl' | 'approver'): string {
  const specific = stamp.signDates?.[signer]
  if (specific && specific.trim() !== '') return formatStampDate(specific)
  if (stamp.date) return formatStampDate(stamp.date)
  return ''
}
