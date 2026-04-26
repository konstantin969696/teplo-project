# Phase 06 — Экспорт-фундамент: листы, рамка, штамп, preview — PLAN

## Цель

Один раз заложить инфраструктуру, на которой потом сядут три экспортёра (PDF/Excel/Word, фазы 07/08/09):

1. **Модель листа** — формат, ориентация, поля, рамка по ГОСТ 2.104-2006.
2. **Штамп** (основная надпись формы 1) — рендер в общем формате + UI-форма для заполнения.
3. **Preview-модал** — рендер листов на canvas/SVG для просмотра до экспорта.

После 06 каждая фаза 07/08/09 сводится к маппингу абстрактной модели листа на конкретный backend (jsPDF / ExcelJS / docx).

## Архитектура

```
src/export/
├── sheet/
│   ├── formats.ts          // SheetFormat: A1, A2, A3, A3x2, A3x3, A4, ...
│   ├── frame.ts            // ГОСТ 2.104 рамка: координаты линий, отступы 20/5/5/5
│   ├── stamp.ts            // Основная надпись форма 1 (главный лист), форма 2а (последующие)
│   └── layout.ts           // Pagination: разбивка контента на листы по высоте
├── content/
│   ├── blocks.ts           // ContentBlock: header / table / kv-grid / paragraph
│   └── builders.ts         // buildSummaryDocument(stores) → DocumentModel
├── preview/
│   ├── PreviewModal.tsx    // модальное окно: листы с рамкой/штампом, prev/next, экспорт
│   └── SheetCanvas.tsx     // рендер одного листа в SVG (1:1 с экспортом)
├── store/
│   └── exportStore.ts      // персистный стор: stamp (имена, шифр, стадия, ...), default sheet/orientation
└── types.ts                // DocumentModel, Sheet, Stamp, SheetFormat, ContentBlock
```

## Данные

### `SheetFormat` (`formats.ts`)

```ts
type Orientation = 'portrait' | 'landscape'

interface SheetFormat {
  readonly id: string                // 'A4', 'A3', 'A3x2', ...
  readonly label: string             // 'А4', 'А3', 'А3×2', ...
  readonly widthMm: number           // итоговая ширина листа после склейки
  readonly heightMm: number
  readonly canRotate: boolean        // A4-A1: true; склейки: false (склейка фиксированной ориентации)
}

const SHEET_FORMATS: SheetFormat[] = [
  { id: 'A1', label: 'А1', widthMm: 594, heightMm: 841, canRotate: true },
  { id: 'A2', label: 'А2', widthMm: 420, heightMm: 594, canRotate: true },
  { id: 'A3', label: 'А3', widthMm: 297, heightMm: 420, canRotate: true },
  { id: 'A4', label: 'А4', widthMm: 210, heightMm: 297, canRotate: true },
  { id: 'A3x2', label: 'А3×2', widthMm: 594, heightMm: 420, canRotate: false },
  { id: 'A3x3', label: 'А3×3', widthMm: 891, heightMm: 420, canRotate: false },
  { id: 'A3x4', label: 'А3×4', widthMm: 1188, heightMm: 420, canRotate: false }
]
```

### `Stamp` (`store/exportStore.ts`)

```ts
interface Stamp {
  readonly objectName: string         // «Жилой дом по адресу...» (большая клетка наверху штампа)
  readonly drawingTitle: string       // «Поэтажный план. Спецификация»
  readonly stageCode: string          // «П» / «Р» / «РД»
  readonly markCode: string           // «ОВ-1» (марка комплекта)
  readonly drawingMark: string        // «ВК.001» (марка чертежа)
  readonly authorName: string         // «Разработал: Иванов И.И.»
  readonly checkerName: string
  readonly approverName: string
  readonly normControlName: string
  readonly companyName: string
  readonly companyDept: string
  readonly date: string               // дата по умолчанию = сегодня
  // Лист N из M проставляется автоматически.
}
```

Persisted в localStorage `teplo-export` (новый стор), чтобы при каждом экспорте поля были предзаполнены.

### `Frame` (`frame.ts`)

ГОСТ 2.104-2006:
- Внешняя линия — обрез листа (тонкая, или вообще не рисуется при печати).
- Поля рамки: слева 20 мм (под подшивку), сверху/справа/снизу 5 мм.
- Внутренняя линия — толстая (0.7 мм или эквивалент в PDF/Excel).

Основная надпись (штамп) — **в правом нижнем углу** ВСЕГДА, размер 185 × 55 мм для главного листа (форма 1), 185 × 15 мм для последующих листов чертежа того же комплекта (форма 2а). Сейчас делаем только форму 1.

Доп. графа 26 (ГОСТ 2.104) — слева сбоку, 70×14 мм, перевёрнута 90°, повторяет обозначение чертежа. Включить опционально.

### `DocumentModel` (`types.ts`)

```ts
interface DocumentModel {
  readonly title: string             // имя файла (без расширения)
  readonly format: SheetFormat
  readonly orientation: Orientation
  readonly stamp: Stamp
  readonly content: readonly ContentBlock[]
}

interface Sheet {
  readonly index: number             // 0-based
  readonly total: number             // total пересчитывается после layout
  readonly blocks: readonly ContentBlock[]
}
```

`layout.paginate(model)` → `Sheet[]`. На вход — высота полезной области (формат − поля − штамп), на выход — массив листов.

### Preview

`PreviewModal` показывает `Sheet[]` через `SheetCanvas` (SVG в `<foreignObject>` для текста и таблиц). Кнопки: ← / →, выбор формата / ориентации, поля штампа, экспорт в PDF / Excel / Word.

## Шаги выполнения

| # | Шаг | Файлы | Тесты |
|---|-----|-------|-------|
| 1 | `types.ts`, `formats.ts` (constants + helpers) | `src/export/types.ts`, `src/export/sheet/formats.ts` | `formats.test.ts` (sanity) |
| 2 | `frame.ts` — функции расчёта геометрии рамки | `src/export/sheet/frame.ts` | `frame.test.ts` (правильные мм) |
| 3 | `stamp.ts` — данные + helper-формирование строк | `src/export/sheet/stamp.ts` | `stamp.test.ts` |
| 4 | `exportStore.ts` — Zustand persist + shapeMerge | `src/export/store/exportStore.ts` | `exportStore.test.ts` (S0..S4 как у systemStore) |
| 5 | `content/blocks.ts` + `builders.ts` — DocumentModel из stores | `src/export/content/*` | `builders.test.ts` (snapshot DocumentModel из заполненного projectStore) |
| 6 | `layout.ts` — пагинация | `src/export/sheet/layout.ts` | `layout.test.ts` (длинная таблица режется на N листов) |
| 7 | `SheetCanvas.tsx` — SVG-рендер одного листа | `src/export/preview/SheetCanvas.tsx` | smoke-render |
| 8 | `PreviewModal.tsx` — модал с навигацией + UI штампа + кнопки экспорта (заглушки на 07/08/09) | `src/export/preview/PreviewModal.tsx` | smoke-render, change format, fill stamp |
| 9 | Кнопка «Экспорт…» в `SummaryTab` (открывает PreviewModal) | `src/components/summary/SummaryTab.tsx` | + smoke-тест |
| 10 | STATUS.md + commit |  |  |

## Открытые вопросы

1. **Форма штампа точная.** ГОСТ 2.104-2006 определяет 22+ графы. Нужно решить какие из них показывать в UI как заполняемые, какие — фиксированные/автоматические. Начну с минимального набора (см. `Stamp` выше), Костя дополнит по фактической потребности.
2. **Шрифт.** ГОСТ требует чертёжный шрифт (ISO 3098 / ГОСТ 2.304). В PDF можно встроить freeware (`gostmono`) — для Excel/Word достаточно «Arial» как fallback. В preview — системный.
3. **Где живёт кнопка «Экспорт…»?** В `SummaryTab` снизу — единая для всего отчёта. Или в каждом табе своя? Я выбираю единую в Сводке (теплопотери / приборы / гидравлика / тёплый пол попадают в один документ как разделы). Косте подтвердить.

## Что НЕ входит в 06

- Сам PDF/Excel/Word output — это фазы 07/08/09.
- Шаблоны спецификаций оборудования (отдельная форма по ГОСТ 21.110) — потенциально отдельная фаза или backlog.
- Многоязычность UI экспорта — только русский (требование Кости).
