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
 * ГОСТ 2.104-2006 form 1 «Основная надпись» + дополнительные графы по ГОСТ Р 21.101-2020.
 * Заполняется в UI перед экспортом, persist в exportStore.
 * Поля «Лист N из M» проставляются автоматически после layout-пагинации.
 *
 * Шифр документа собирается из частей:
 *   `${objectCode}-${stageCode}-${subsectionCode} - ${markCode}`
 * например: `70-2025-П-ИЛО - ОВ` (объект=70-2025, стадия=П, подраздел=ИЛО, марка=ОВ).
 */
export interface Stamp {
  // Объект и шифр
  readonly objectName: string          // «Жилой дом по адресу...»
  readonly objectCode: string          // шифр объекта: «70-2025»
  readonly subsectionCode: string      // подраздел: «ИЛО», «ПЗ», «С»
  readonly stageCode: string           // 'П' | 'Р' | 'РД' | 'Э'
  readonly markCode: string            // марка комплекта: 'ОВ', 'ВК', ...

  // Per-document
  readonly drawingTitle: string        // «Теплопотери», «Спецификация приборов»
  readonly drawingMark: string         // марка чертежа: 'ОВ.001' (для шифра графы 2 если задано)

  // Подписанты (графа 11/12/13)
  readonly authorName: string
  readonly checkerName: string
  readonly gipName: string             // ГИП — главный инженер проекта
  readonly normControlName: string
  readonly approverName: string        // утвердил (опц., в форме 1 не используется, но оставляем для совместимости)

  // Организация (графа 9)
  readonly companyName: string
  readonly companyDept: string
  readonly logoDataUrl?: string        // base64 data URL, рендерится в правом блоке штампа

  // Дата (общая) и опц. отдельные даты подписантов
  readonly date: string                // ISO YYYY-MM-DD; в штампе — DD.MM.YYYY
  readonly signDates?: {
    readonly author?: string
    readonly checker?: string
    readonly gip?: string
    readonly normControl?: string
    readonly approver?: string
  }

  // Дополнительные графы по ГОСТ Р 21.101-2020 (боковая полоса слева)
  readonly agreedBy?: string                  // «Согласовано» (имя/должность)
  readonly inventoryNumber?: string           // «Инв. № подп.»
  readonly replacedInventoryNumber?: string   // «Взам. инв. №»
}

/**
 * Режим оформления листа.
 *  - 'full'           — полный штамп ГОСТ форма 1 + боковая полоса + маркировка формата
 *  - 'minimal-footer' — без штампа; внизу справа за рамкой строка `footerLine` («Приложение Б»)
 *  - 'none'           — только рамка + контент
 */
export type StampMode = 'full' | 'minimal-footer' | 'none'

/**
 * Параметры основной надписи для текстовых документов (ГОСТ Р 21.101-2020 форма 5/6).
 * Используется вместо `Stamp` когда `DocumentModel.gostStamp` задан.
 * Идентичен `Stamp` по полям — выделен отдельным типом для clarity и будущих расхождений.
 */
export interface GostStampParams {
  readonly objectName: string
  readonly objectCode: string
  readonly subsectionCode: string
  readonly stageCode: string
  readonly markCode: string
  readonly drawingTitle: string
  readonly drawingMark: string

  readonly authorName: string
  readonly checkerName: string
  readonly gipName: string
  readonly normControlName: string
  readonly approverName: string

  readonly companyName: string
  readonly companyDept: string
  readonly logoDataUrl?: string

  readonly date: string
  readonly signDates?: {
    readonly author?: string
    readonly checker?: string
    readonly gip?: string
    readonly normControl?: string
    readonly approver?: string
  }

  readonly agreedBy?: string
  readonly inventoryNumber?: string
  readonly replacedInventoryNumber?: string
}

/**
 * Шрифт для PDF-экспорта.
 *  - 'roboto' — обычный sans-serif с кириллицей (Roboto Regular/Bold)
 *  - 'gost'   — чертёжный ГОСТ 2.304 (GOST type A italic)
 */
export type ExportFontFamily = 'roboto' | 'gost'

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
  readonly stampMode?: StampMode       // default 'full'
  readonly footerLine?: string         // используется при stampMode='minimal-footer' («Приложение Б»)
  readonly content: readonly ContentBlock[]
  /** Если задан — используется штамп формы 5/6 (текстовый документ) вместо формы 1 (чертёж). */
  readonly gostStamp?: GostStampParams
}

export interface Sheet {
  readonly index: number               // 0-based
  readonly total: number               // заполняется после layout
  readonly blocks: readonly ContentBlock[]
}
