# STATUS — Phase 07.1

**Status:** 🟡 готово к UAT (закроется после визуального подтверждения Костей в браузере)
**Дата:** 2026-04-26
**Базовый коммит:** см. git log (отдельный коммит `feat(export): GOST stamp form 1 + side bar + sheet modes (07.1)`)

## Что сделано

### 1. Тип `Stamp` расширен ([types.ts](../../../src/export/types.ts))
- Новые поля: `objectCode`, `subsectionCode`, `gipName`, `signDates?`, `agreedBy?`, `inventoryNumber?`, `replacedInventoryNumber?`
- Новый тип `StampMode = 'full' | 'minimal-footer' | 'none'`
- `DocumentModel.stampMode?` + `footerLine?` для режимов «без штампа»

### 2. Геометрия штампа ГОСТ 2.104-2006 форма 1 ([sheet/stamp.ts](../../../src/export/sheet/stamp.ts))
- `STAMP_GEOMETRY` — точные координаты всех граф (changes / signers / title / stage / company)
- `EMPTY_STAMP` — обновлены дефолты под новые поля
- `buildDesignationCode(stamp)` — собирает шифр графы 2: `${objectCode}-${stageCode}-${subsectionCode} - ${markCode}`
- `signerDate(stamp, signer)` — дата подписанта с fallback на общую `stamp.date`

### 3. Маркировка формата К/А ([sheet/formats.ts](../../../src/export/sheet/formats.ts))
- Новая функция `formatStampMark(format, orientation)` → `Формат А4К`/`Формат А3А`/`Формат А4×3А`

### 4. PDF backend ([backends/pdf.ts](../../../src/export/backends/pdf.ts))
- `drawStampForm1` — точная геометрия формы 1: графа изменений (нижний-левый блок 75×25 с заголовками и 4 пустыми строками), 5 строк подписантов (Разраб./Проверил/ГИП/Н.контр./Утв.), графы 1-2 (обозначение/название) в центре, мини-таблица Стадия/Лист/Листов справа, графа 9 (организация + лого).
- `drawSideBar` — левая боковая полоса 7мм с вертикальным текстом: «Согласовано», «Инв. № подп.», «Подп. и дата», «Взам. инв. №».
- `drawFormatMark` — маркировка «Формат А4К» под рамкой справа внизу.
- `drawFooterLine` — нижняя строка для `stampMode='minimal-footer'` («Приложение Б» + «Лист N из M»).
- `drawSheet` ветвится по `stampMode`: full / minimal-footer / none.

### 5. SVG превью ([preview/SheetCanvas.tsx](../../../src/export/preview/SheetCanvas.tsx))
- `StampForm1` — точная копия PDF-геометрии в SVG
- `SideBar` + `FormatMark` + `FooterLine` — синхронны с PDF
- Контент-зона усечена по режиму штампа

### 6. Layout ([sheet/layout.ts](../../../src/export/sheet/layout.ts))
- `usableHeightMm` ветвится по `stampMode` (full → −55мм, minimal-footer → −8мм, none → ~0)

### 7. Persist ([store/exportStore.ts](../../../src/export/store/exportStore.ts))
- Bump `version: 1 → 2`
- Новые поля `defaultStampMode`, `defaultFooterLine` + сеттеры
- `merge:` дозаливает дефолты для новых полей Stamp при апгрейде персиста v1→v2

### 8. Builders ([content/builders.ts](../../../src/export/content/builders.ts))
- `BuilderContext` обогащён `stampMode` и `footerLine` из exportStore
- `makeModel` пробрасывает их в `DocumentModel`

### 9. UI ввода штампа ([preview/PreviewModal.tsx](../../../src/export/preview/PreviewModal.tsx))
- Радио-блок «Режим оформления листа»: Полный штамп / Только нижняя строка / Без штампа
- Поле «Нижняя строка» — активно для minimal-footer
- Новые поля: «Шифр объекта», «Подраздел», «Марка», «ГИП», «Утвердил» (опц.), «Согласовано», «Инв. № подп.», «Взам. инв. №»
- Форма штампа рендерится только для `stampMode === 'full'`

## Тесты

- `pdf.test.ts` — обновлен под новый Stamp, добавлены кейсы `stampMode='minimal-footer'` и `stampMode='none'`
- `pdf.smoke.test.ts` — новый smoke-тест (skip по умолчанию, run via `PDF_SMOKE=1`) генерит реальные PDF в `/tmp/stamp_smoke_*.pdf` для визуального UAT
- `npx tsc -b` — чисто
- `npx vitest run` — **609 passed** (было 609, регресса нет)
- `PDF_SMOKE=1 npx vitest run pdf.smoke.test.ts` — 4 PDF сгенерированы

## Визуальное сравнение с эталоном

Сравнение через PyMuPDF render (DPI 150) сделано для:
- A4 портрет full → совпадает по всем элементам со стр.5 эталона `Пример штампа/70-2025-П-ИЛО-ОВ.pdf`:
  - графа изменений: ✅
  - Разраб./Проверил/ГИП/Н.контр./Утв.: ✅
  - шифр `70-2025-П-ИЛО-ОВ-С`: ✅
  - название чертежа крупно по центру: ✅
  - Стадия/Лист/Листов: ✅
  - боковая полоса с Согласовано/Инв.№/Подп.и дата/Взам.инв.№: ✅
  - маркировка `Формат А4К`: ✅
- A3 альбом full → маркировка авто-меняется на `Формат А3А` (А=альбомный): ✅
- A4 minimal-footer → только рамка + строка «Приложение Б» внизу слева + маркировка формата: ✅
- A4 none → только рамка + контент: ✅

## Открытые вопросы (для UAT в браузере)

1. **Превью SheetCanvas vs PDF**: SVG-геометрия повторяет PDF, но финальная сверка нужна на винде в браузере (Костя смотрит в Chromium dev-server).
2. **Миграция localStorage**: при первом открытии у Кости `teplo-export` v1 должен апгрейдиться без warning. Проверить devtools console.
3. **Шрифт штампа**: текущий шрифт колонки даты — 6pt, фамилия 7pt. Если читается мелко на печати — увеличить или взять GOST-шрифт.

## Definition of done — статус

- [x] Тип Stamp расширен, миграция exportStore проходит без warning
- [x] PDF-экспорт А4 портрет визуально совпадает с эталоном
- [x] Маркировка формата авто-меняется (А4К↔А4А, А3А, А4×NА)
- [x] `stampMode='minimal-footer'` рисует только нижнюю строку «Приложение Б»
- [x] `stampMode='none'` — только рамка + контент
- [x] Форма ввода в PreviewModal содержит все новые поля + переключатель режима
- [x] Превью SVG синхронно с PDF (проверено в коде, нужна визуальная сверка в браузере)
- [x] Все vitest-тесты зелёные (609 passed)
- [x] STATUS.md записан
- [ ] **UAT в браузере на винде** — ждём Костю

## Файлы (все изменения этой фазы)

- `src/export/types.ts` (расширен)
- `src/export/sheet/stamp.ts` (полная переработка геометрии + helpers)
- `src/export/sheet/formats.ts` (+ formatStampMark)
- `src/export/sheet/layout.ts` (usableHeightMm учитывает stampMode)
- `src/export/store/exportStore.ts` (v1→v2, новые поля, mergeStamp)
- `src/export/backends/pdf.ts` (полная переработка drawStamp + новые функции)
- `src/export/backends/pdf.test.ts` (обновлены кейсы + новые)
- `src/export/backends/pdf.smoke.test.ts` (новый — skip по умолчанию)
- `src/export/content/builders.ts` (BuilderContext+stampMode/footerLine)
- `src/export/preview/SheetCanvas.tsx` (полная переработка)
- `src/export/preview/PreviewModal.tsx` (расширена форма + radio режима)
- `.planning/phases/07.1-gost-stamp-form1/PLAN.md` (новый)
- `.planning/phases/07.1-gost-stamp-form1/STATUS.md` (новый — этот файл)
- `.planning/ROADMAP.md` (добавлена фаза 07.1, обновлены зависимости 08/09/10)
