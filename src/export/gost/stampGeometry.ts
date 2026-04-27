/**
 * Геометрия основной надписи для текстовых документов по ГОСТ Р 21.101-2020.
 *  - Форма 5: первый лист, 185 × 40 мм.
 *  - Форма 6: последующие листы, 185 × 15 мм.
 *
 * Все координаты относительно левого верхнего угла штампа, мм.
 */

export const STAMP_FORM5_WIDTH_MM = 185
export const STAMP_FORM5_HEIGHT_MM = 40
export const STAMP_FORM6_WIDTH_MM = 185
export const STAMP_FORM6_HEIGHT_MM = 15

/**
 * Форма 5 (185 × 40 мм). Компоновка:
 *   - Правая колонка (Граф. 9, Организация): x=145, w=40, h=40 — полная высота
 *   - Левая область (145 мм):
 *     y=0..15   Граф. 1 (Наименование, h=15)
 *     y=15..25  Граф. 2 (Обозначение, h=10)
 *     y=25..30  Граф. 4/7/8 (Лит./Лист/Листов, h=5)
 *     y=30..40  Граф. 10-13 (Подписанты, 5 строк × 2 мм = 10 мм)
 */
export const STAMP_FORM5_GEOMETRY = {
  width: STAMP_FORM5_WIDTH_MM,
  height: STAMP_FORM5_HEIGHT_MM,

  company: { x: 145, y: 0, width: 40, height: 40 },

  title: { x: 0, y: 0, width: 145, height: 15 },

  designation: { x: 0, y: 15, width: 145, height: 10 },

  stageRow: {
    x: 0,
    y: 25,
    height: 5,
    cols: [
      { id: 'litera', label: 'Лит.', width: 15 },
      { id: 'sheet',  label: 'Лист', width: 20 },
      { id: 'sheets', label: 'Листов', width: 20 },
    ] as const,
  },

  signers: {
    x: 0,
    y: 30,
    width: 65,    // 17+20+15+13
    height: 10,   // 5 строк × 2 мм
    rowHeight: 2,
    cols: [
      { id: 'role', width: 17 },
      { id: 'name', width: 20 },
      { id: 'sign', width: 15 },
      { id: 'date', width: 13 },
    ] as const,
    rows: [
      { id: 'author',      label: 'Разраб.' },
      { id: 'checker',     label: 'Проверил' },
      { id: 'gip',         label: 'ГИП' },
      { id: 'normControl', label: 'Н. контр.' },
      { id: 'approver',    label: 'Утв.' },
    ] as const,
  },
} as const

/**
 * Форма 6 (185 × 15 мм). Компоновка:
 *   x=0..65    Граф. 10-13 (Подписанты, 1 строка, вся высота 15 мм)
 *   x=65..145  Граф. 2 (Обозначение, h=10) + Граф. 7/8 (Лист/Листов, h=5)
 *   x=145..185 Граф. 9 (Организация, усечённая, 40 × 15 мм)
 */
export const STAMP_FORM6_GEOMETRY = {
  width: STAMP_FORM6_WIDTH_MM,
  height: STAMP_FORM6_HEIGHT_MM,

  signers: {
    x: 0,
    y: 0,
    width: 65,
    height: 15,
    cols: [
      { id: 'role', width: 17 },
      { id: 'name', width: 20 },
      { id: 'sign', width: 15 },
      { id: 'date', width: 13 },
    ] as const,
  },

  designation: { x: 65, y: 0, width: 80, height: 10 },

  sheetRow: {
    x: 65,
    y: 10,
    height: 5,
    cols: [
      { id: 'sheet',  label: 'Лист',   width: 20 },
      { id: 'sheets', label: 'Листов', width: 20 },
    ] as const,
  },

  company: { x: 145, y: 0, width: 40, height: 15 },
} as const
