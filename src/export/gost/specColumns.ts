/**
 * Ширины колонок спецификации оборудования по ГОСТ 21.110-2013.
 * Сумма: 8+70+50+15+32 = 175 мм (в рамке 185 мм, с отступами от краёв).
 */

export const SPEC_COLUMNS = [
  { id: 'pos',      title: 'Поз.',                       align: 'center' as const, widthMm: 8  },
  { id: 'name',     title: 'Наименование и техническая характеристика', align: 'left' as const, widthMm: 70 },
  { id: 'type',     title: 'Тип, марка, обозначение',   align: 'left'   as const, widthMm: 50 },
  { id: 'qty',      title: 'Кол.',                       align: 'center' as const, widthMm: 15 },
  { id: 'note',     title: 'Примечание',                 align: 'left'   as const, widthMm: 32 },
] as const

export type SpecColumnId = typeof SPEC_COLUMNS[number]['id']
