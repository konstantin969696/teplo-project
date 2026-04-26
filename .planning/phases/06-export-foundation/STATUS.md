# Phase 06 — Экспорт-фундамент — STATUS

**Status:** 🟢 closed (2026-04-26) — фундамент готов; реальные backend-адаптеры идут в фазах 07/08/09.

## Что сделано

### Архитектура `src/export/`

```
src/export/
├── types.ts                  // SheetFormat, Stamp, ContentBlock, DocumentModel, Sheet
├── sheet/
│   ├── formats.ts            // SHEET_FORMATS (A1/A2/A3/A4 + A3×2/3/4 + A4×2/3), dimensions, effectiveOrientation
│   ├── frame.ts              // ГОСТ 2.104-2006 рамка: поля 20/5/5/5
│   ├── stamp.ts              // STAMP_WIDTH/HEIGHT, computeStampPosition, formatStampDate, formatSheetCounter
│   └── layout.ts             // paginate(model) → Sheet[] с разбивкой длинных таблиц
├── content/
│   └── builders.ts           // 5 билдеров: heatLoss / equipment / hydraulics / ufh / summary
├── preview/
│   ├── SheetCanvas.tsx       // SVG-рендер одного листа: рамка + контент через foreignObject + штамп
│   └── PreviewModal.tsx      // модал с боковой панелью настроек, навигацией листов и кнопками экспорта
├── store/
│   └── exportStore.ts        // Zustand persist + shapeMerge: stamp + defaultFormat + defaultOrientation
└── useExportPreview.tsx      // хук: returns { button, modal } для использования в табах
```

### Кнопки в табах (вариант B по решению Кости)

В каждом из 5 табов добавлена своя кнопка «Экспорт…» с per-document preview:

| Tab | Builder | Default mark |
|-----|---------|--------------|
| Теплопотери | `buildHeatLossDocument` | ОВ.001 |
| Приборы отопления | `buildEquipmentDocument` | ОВ.002 |
| Гидравлика | `buildHydraulicsDocument` | ОВ.003 |
| Тёплый пол | `buildUfhDocument` | ОВ.004 |
| Сводка | `buildSummaryDocument` | ОВ.000 |

### Что умеет PreviewModal

- Боковая панель: формат листа (A1/A2/A3/A4 + A3×N + A4×N), ориентация (книжная/альбомная — disabled на склейках), форма штампа со всеми полями ГОСТ 2.104.
- Поля штампа разделены на:
  - **per-document** (наименование чертежа, марка) — не уходят в общий стор
  - **общие** (организация, ФИО, объект, стадия, дата) — сохраняются в `exportStore` и переиспользуются между документами
- Основная область: SVG-лист 1:1 с реальными мм, навигация листов prev/next, счётчик «Лист N из M».
- Кнопки PDF / Excel / Word — пока показывают toast-stub с указанием, в какой фазе они появятся.

### ГОСТ-рамка и штамп в SVG

- Рамка: 20/5/5/5 мм поля, толщина 0.7 мм.
- Штамп форма 1: 185×55 мм в правом нижнем углу, упрощённая внутренняя разбивка (4 строки подписей слева, наименование по центру, марка/стадия/лист/организация справа).
- Контент рендерится в `<foreignObject>` (HTML внутри SVG) — это даёт честный скейлинг и работающие таблицы; в будущем PDF-адаптер сможет отрисовать то же самое нативно через jsPDF API.

### exportStore с shapeMerge

Persist под ключом `teplo-export`, version 1. Поля `stamp` валидируются как `record` через `shapeMerge` (Phase 04.2 pattern). Битый persisted state не ломает приложение — откат на дефолты.

## Что НЕ сделано (отдельные фазы)

- **Фаза 07 — PDF**: jsPDF backend-адаптер. Будет читать DocumentModel + Sheet[] и отрисовывать ГОСТ-рамку, штамп, контент натиано. Сейчас кнопка PDF — заглушка.
- **Фаза 08 — Excel**: ExcelJS адаптер. Лист на каждый Sheet, рамка через границы ячеек, штамп — merged-cells.
- **Фаза 09 — Word**: docx адаптер.
- **Точная геометрия штампа** по ГОСТ 2.104 (все 22+ графы) — сейчас упрощённая; в фазе 07 при отрисовке pdf уточним.
- **Чертёжный шрифт ГОСТ 2.304** — пока используется Arial. В фазе 07 встроим freeware GOST-шрифт.

## Тесты

Test suite: **47 файлов / 605 тестов** зелёные (без новых тестов на 06 — фаза в основном UI-каркас, smoke-тесты перенесены в фазу 07 при первом реальном экспорте). TypeScript build чистый (`tsc -b --noEmit` exit 0).

## Известные ограничения

- Estimated heights в `layout.ts` — heuristic мм-числа; реальная пагинация зависит от backend-шрифтов и должна быть откалибрована в фазе 07.
- Per-document overrides штампа сбрасываются при закрытии модала (живут только в локальном state PreviewModal). Если Костя хочет чтобы они сохранялись per-tab — отдельный пункт в backlog.
