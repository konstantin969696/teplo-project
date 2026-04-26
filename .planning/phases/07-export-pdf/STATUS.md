# Phase 07 — Экспорт PDF — STATUS

**Status:** 🟢 closed (2026-04-26) — реальный PDF-экспорт через jsPDF поверх фундамента 06.

## Что сделано

### Backend `src/export/backends/`

```
backends/
├── fontLoader.ts    // lazy fetch + base64 кэш TTF из src/export/fonts/?url
├── pdf.ts           // exportToPdf(model, { fontFamily }) → Promise<Blob>
└── pdf.test.ts      // smoke: blob.size > 500, multi-page работает
```

`exportToPdf` пересоздаёт DocumentModel → paginate → jsPDF doc. Для каждого Sheet
рисует:
- ГОСТ-рамку (0.7 мм) натиано через `doc.rect`
- Контент (heading / paragraph / kv-grid / table) через `doc.text` + `doc.line`
- Штамп ГОСТ форму 1 нативно: левый блок (4 строки подписей с датой), средний (наименование чертежа), правый (марка, стадия, лист N из M, организация, объект, лого)

Координаты в мм (jsPDF unit `mm`), размеры шрифта в pt.

### Шрифты

В `src/export/fonts/` положены 4 TTF (~1.7 MB суммарно):
- `Roboto-Regular.ttf` + `Roboto-Bold.ttf` (Apache 2.0, Google) — sans-serif с кириллицей
- `DejaVuSerif.ttf` + `DejaVuSerif-Bold.ttf` (Bitstream Vera derivative, public-domain-like) — serif как заместитель чертёжного ГОСТ 2.304

Загружаются один раз при первом экспорте через `fetch(?url)` + `arrayBufferToBase64`, кэшируются в `Map<url, base64>`. После регистрации в jsPDF VFS/font используются для всех страниц.

В `ExportState` добавлен `fontFamily: 'roboto' | 'gost'` (persist), select в боковой панели PreviewModal.

### Лого

В `Stamp` добавлено опциональное `logoDataUrl` (PNG/JPEG, ≤ 200 KB). UI:
- `<input type="file" accept="image/png,image/jpeg">` → FileReader → dataURL → `setStampField('logoDataUrl', ...)`
- Превью миниатюры + кнопка «удалить»
- Валидация размера и MIME, ошибки через toast.error

Лого хранится в `exportStore` (общий для всех документов), рендерится в правом блоке штампа над/под названием организации. В PDF — через `doc.addImage(...)`. В превью — через SVG `<image href={dataUrl}>`.

### PreviewModal

- Кнопка PDF теперь делает реальный экспорт: blob → object URL → `<a download>` → click → revoke
- Спиннер (`Loader2`) во время генерации
- Все три кнопки disable во время экспорта чтобы не было параллельных
- Excel/Word — пока показывают toast-stub (фазы 08/09)

### Тесты

`pdf.test.ts` (новый, 2 теста):
- `exports a Blob with application/pdf mime type` — проверка типа и размера blob
- `generates multiple pages for a long table` — таблица из 80 строк генерирует больший blob чем плоский документ

В тестах `loadFontFamily` мокается через `vi.mock`, реальные TTF читаются через Node `fs.readFileSync` (не fetch — чтобы работало в jsdom).

**Полный suite: 48 файлов / 607 тестов зелёные.** TypeScript build чистый. `npm run build` собирает Vite-bundle 939 KB (включая jspdf + 4 TTF как ассеты).

## UAT (Костя на Windows)

- [ ] Открыть http://localhost:5173/, перейти в любой таб → «Экспорт…»
- [ ] Выбрать формат / ориентацию / шрифт, заполнить штамп, загрузить лого
- [ ] Жмём «PDF» → проверить: файл скачан, открывается в Acrobat/Chrome, кириллица читается, штамп ГОСТ виден, лого на месте
- [ ] Multi-page: таб «Гидравлика» с длинной таблицей сегментов → проверить разбивку на листы

## Известные ограничения

- Heuristic высоты блоков из фазы 06 могут давать lemure overlap при экстремально длинных таблицах. Калибровка по факту в UAT.
- DejaVu Serif — заместитель ГОСТ 2.304, а не сам ГОСТ. Настоящий чертёжный шрифт (GOST type A italic) добавим в фазе 07.1 после поиска проверенного источника лицензии.
- Лого только PNG/JPEG. SVG не поддерживается через `addImage` — для SVG нужно расширение до растеризации (фаза 07.1).
- Bundle warning >500 KB: jspdf + html2canvas тяжёлые. Lazy-split экспорта в отдельный чанк — backlog.
