/**
 * Phase 06 — public types for the export pipeline.
 * Format-agnostic: PDF/Excel/Word adapters consume DocumentModel produced by builders.
 */

export type Orientation = 'portrait' | 'landscape'

export interface SheetFormat {
  readonly id: string                  // 'A4' | 'A3' | 'A3x2' | ...
  readonly label: string               // 'А4', 'А3', 'А3×2' (русские лейблы)
  readonly widthMm: number             // итоговая ширина листа после склейки
  readonly heightMm: number
  readonly canRotate: boolean          // false для асимметричных склеек
}

/**
 * ГОСТ 2.104-2006 form 1 «Основная надпись».
 * Заполняется в UI перед экспортом, persist в exportStore.
 * Поля «Лист N из M» проставляются автоматически после layout-пагинации.
 */
export interface Stamp {
  readonly objectName: string          // «Жилой дом по адресу...»
  readonly drawingTitle: string        // «Теплопотери», «Спецификация приборов» (per-document)
  readonly stageCode: string           // 'П' | 'Р' | 'РД' | 'Э'
  readonly markCode: string            // марка комплекта: 'ОВ', 'ВК', ...
  readonly drawingMark: string         // марка чертежа: 'ОВ.001'
  readonly authorName: string
  readonly checkerName: string
  readonly approverName: string
  readonly normControlName: string
  readonly companyName: string
  readonly companyDept: string
  readonly date: string                // ISO YYYY-MM-DD; в штампе — DD.MM.YYYY
}

// ─── Content blocks ───
// Format-agnostic primitives. Каждый блок имеет фиксированную "идеальную" высоту в мм
// для пагинации; реальный рендер форматирует под конкретный backend.

export interface BlockHeading {
  readonly kind: 'heading'
  readonly text: string
  readonly level: 1 | 2 | 3
}

export interface BlockParagraph {
  readonly kind: 'paragraph'
  readonly text: string
}

export interface BlockKeyValueGrid {
  readonly kind: 'kv-grid'
  readonly columns: 2 | 3 | 4
  readonly items: readonly { readonly label: string; readonly value: string }[]
}

export interface BlockTable {
  readonly kind: 'table'
  readonly columns: readonly TableColumn[]
  readonly rows: readonly TableRow[]
  readonly footer?: TableRow            // итоговая строка
}

export interface TableColumn {
  readonly id: string
  readonly title: string
  readonly align: 'left' | 'center' | 'right'
  readonly widthMm?: number             // если задано — фикс; иначе авто
}

export type TableCell = string | number | { readonly text: string; readonly bold?: boolean }
export type TableRow = readonly TableCell[]

export type ContentBlock = BlockHeading | BlockParagraph | BlockKeyValueGrid | BlockTable

// ─── Document model ───

export interface DocumentModel {
  readonly id: string                  // 'heat-loss' | 'equipment' | 'hydraulics' | 'ufh' | 'summary'
  readonly fileName: string            // имя файла без расширения, по-русски
  readonly format: SheetFormat
  readonly orientation: Orientation
  readonly stamp: Stamp
  readonly content: readonly ContentBlock[]
}

export interface Sheet {
  readonly index: number               // 0-based
  readonly total: number               // заполняется после layout
  readonly blocks: readonly ContentBlock[]
}
