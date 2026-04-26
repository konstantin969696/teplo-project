# Phase 07 — Экспорт PDF (jsPDF)

**Зависимости:** 06 (closed). Использует `DocumentModel` + `paginate()` + `Sheet[]`.

## Цель

Реальный экспорт в PDF поверх фундамента 06: ГОСТ-рамка, штамп, контент натиано через jsPDF API. Поддержка кириллицы, выбор шрифта, лого в штампе.

## Скоуп

### Backend `src/export/backends/pdf.ts`

- `exportToPdf(model: DocumentModel): Promise<Blob>`
- Использует `paginate(model)` → массив листов
- Для каждого Sheet:
  - `doc.addPage(format, orientation)` (или setupPage перед первым)
  - Отрисовать ГОСТ-рамку (`doc.rect`, толщина 0.7 мм)
  - Отрисовать штамп (`doc.rect`, `doc.line`, `doc.text` для подписей)
  - Если в штампе есть logoDataUrl — `doc.addImage` в правый блок штампа
  - Контент: heading / paragraph / kv-grid / table — нативные jsPDF примитивы
- Имя файла: `${model.fileName}.pdf`

### Шрифты с кириллицей

- Roboto Regular + Bold (как «обычный») — встраиваем через `addFileToVFS` + `addFont`
- GOST type A (italic) Regular — как «чертёжный»
- TTF-файлы кладём в `src/export/fonts/`, импортируем как ассеты Vite (`?url`) и грузим один раз lazy при первом экспорте
- В `ExportState` добавляется `fontFamily: 'roboto' | 'gost'` (persist), select в форме штампа

### Лого

- В `Stamp` добавляется `logoDataUrl?: string` (base64 PNG/JPEG/SVG)
- В StampForm: `<input type="file" accept="image/*">` → FileReader → dataURL → `setStampField('logoDataUrl', ...)`
- Хранится в `exportStore` (общий для всех документов)
- Рендерится в правом блоке штампа над/под названием организации
- Кнопка «Удалить лого» рядом
- Размер ограничиваем 200 KB (предупреждение если больше)

### Подключение к UI

- В PreviewModal заменить toast-stub PDF на реальный экспорт:
  ```ts
  const blob = await exportToPdf(effectiveModel)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${effectiveModel.fileName}.pdf`
  a.click()
  URL.revokeObjectURL(url)
  ```
- Кнопка показывает спиннер во время экспорта
- При ошибке — toast.error

### Превью (SheetCanvas)

- Рендерить лого в SVG как `<image href={logoDataUrl}>` если задан
- Использовать выбранный fontFamily в стилях preview (как close-as-possible match — для Roboto подключаем @fontsource/roboto в Vite, для GOST — fallback на serif italic в превью; точная отрисовка в самом PDF)

## Калибровка пагинации

В фазе 06 `layout.ts` использует heuristic mm-числа. В фазе 07 надо убедиться, что фактически отрисованный jsPDF контент влезает. Если строки таблиц переполняют — корректируем `HEIGHT_TABLE_ROW` и т.п. до согласия preview ↔ pdf.

## Тесты

- Smoke: `exportToPdf(buildSummaryDocument(...))` returns non-empty Blob, mime `application/pdf`
- Кириллический текст в штампе не ломает blob (проверяется по `blob.size > headerSize`)
- Длинный документ → multi-page: количество страниц равно `paginate(model).length`

## Definition of Done

- [ ] `npm run test` зелёный (без regression)
- [ ] `tsc -b --noEmit` exit 0
- [ ] Кнопка PDF в PreviewModal скачивает файл
- [ ] Файл открывается в Acrobat / Chrome PDF Viewer без warning
- [ ] Кириллица читается, не пустые квадратики
- [ ] Штамп ГОСТ-узнаваем, лого если есть — на месте
- [ ] UAT: Костя экспортит summary.pdf и подтверждает «открывается, читается, штамп есть»
