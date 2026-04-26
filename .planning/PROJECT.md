# ТеплоПроект — PROJECT.md

> Восстановлено 2026-04-26 из jarvis-recap (`~/.claude-lab/jarvis/.claude/core/hot/recent.md`) и фактического кода. Оригинальная `.planning/` осталась на старом сервере `devuser` и не переехала. Рабочая копия кода — `/home/edgelab/project/Teploroject/teplo-project/` (зеркало `C:\Users\konst\Downloads\teplo-project (2)\teplo-project` на винде Кости).

## Что это

Веб-приложение для инженеров ОВиК — расчёт системы отопления здания: от теплопотерь до подбора насоса, с выгрузкой в PDF/Excel по ГОСТ. Целевая аудитория — Костя и коллеги-проектировщики ОВиК.

## Стек

- **Frontend:** React 19, TypeScript 5.8, Vite 6
- **State:** Zustand (5 stores: project / system / segment / equipment / ufhLoop + каталоги)
- **UI:** Tailwind 4 (`@tailwindcss/vite`), `lucide-react`, `sonner` для тостов
- **Тесты:** Vitest 3, `@testing-library/react`, `jsdom`
- **Параллелизм:** Web Workers через `comlink`
- **Хранилище:** клиентское — `localStorage` через `safeStorage` обёртку. Бэкенда нет.
- **Экспорт (план):** jsPDF, ExcelJS, Chart.js. **Пока не реализовано.**

## Нормативная база

- СП 50.13330.2012 — тепловая защита зданий
- СП 131.13330.2020 — климатология
- СП 60.13330.2020 — отопление, вентиляция и кондиционирование
- ГОСТ 2.104-2006 — основные надписи (для PDF-выгрузки)

## Структура расчёта (5 табов в `App.tsx`)

| # | Таб | Компонент | Engine-модули | Статус |
|---|-----|-----------|---------------|--------|
| 0 | Теплопотери | `ClimateCard`, `HeatLossTab` | `climate.ts`, `heatLoss.ts` | ✅ работает |
| 1 | Приборы отопления | `EquipmentTab` | `equipment.ts`, `equipmentSystemTemps.ts` (LMTD) | ✅ работает |
| 2 | Гидравлика | `HydraulicsTab` | `hydraulics.ts`, `darcyWeisbach.ts`, `reynolds.ts` | ✅ работает |
| 3 | Тёплый пол | `UfhTab` | `ufh.ts` | ✅ работает |
| 4 | Сводка | `EmptyTabState` (заглушка) | — | ⚠️ не реализован |

## Engine (`src/engine/`)

`climate`, `heatLoss`, `equipment`, `equipmentSystemTemps`, `hydraulics`, `darcyWeisbach`, `reynolds`, `ufh`, `tree`, `skeleton`, `validation`, `migration`, `normative`. Каждый модуль — с тестами (`*.test.ts`) и интеграционными (`__integration__/`).

## Каталоги (`src/data/`)

`cities.ts`, `construction-catalog.json`, `coolant-catalog.json`, `equipment-catalog.json`, `kms-catalog.json`, `pipe-catalog.json`. Каталоги пользователь может расширять — мерж через `catalogMerge.ts`.

## Миграции данных

В `src/engine/migration.ts` — `runV11Migration` (v1.0 → v1.1). Создаёт «Систему 1» с переносом данных из v1.0 localStorage. Был фикс defensive-нормализации `systemOrder` (коммит `62228e7`, до переезда). См. `.planning/phases/04.1-bootstrap-cleanup/`.

## Деплой

Vercel (`.vercel/` есть). Production-домен пока неизвестен. Код приватный, репозитория на GitHub нет (по крайней мере, не пушился из этой среды).

## Where the code lives

| Где | Назначение |
|-----|------------|
| `/home/edgelab/project/Teploroject/teplo-project/` | **Рабочая копия (источник истины для GSD)**, git-репо локальный |
| `C:\Users\konst\Downloads\teplo-project (2)\teplo-project\` | Запущенный dev-сервер (Vite на 5173) у Кости в браузере |
| `D:\Yandex.Disk\5_ИИ\Проекты\Теплопроект\teplo-project.tar.gz` | Архив 4.6 МБ, источник распаковки |

Sync винда↔сервер делается вручную через `scp`/`rsync` (см. `.planning/lessons.md`).
