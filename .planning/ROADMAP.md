# ROADMAP — ТеплоПроект

## Текущий milestone: M1 «Завершение MVP»

Цель — довести проект до состояния, в котором инженер ОВиК может пройти полный путь «новый объект → теплопотери → приборы → гидравлика → тёплый пол → выгрузка PDF/Excel» без ручных обходных путей.

### Фазы

| # | Фаза | Статус | Зависимости | Краткое описание |
|---|------|--------|-------------|------------------|
| 04.1 | Bootstrap & Cleanup (tail) | 🟡 in-progress | — | Доделать UAT всех bootstrap-сценариев, закрыть фазу. Был оборван при переезде. |
| 04.2 | Root-cause `systemOrder undefined` | 🟢 closed (2026-04-26) | — | RCA подтверждена: persisted state мог содержать `systemOrder` неверного типа. Fix: `shapeMerge` в `safeStorage.ts` + `merge:` во всех 4 stores. `?? []` снят. См. `phases/04.2-system-order-rca/STATUS.md`. |
| 04.3 | UFH-loop migration to systemId | 🔴 not-started | — | `ufhLoopOrder` отсутствует в `useUfhLoopStore` → systemId не ставится при миграции v1.0→v1.1. См. STATUS.md фазы 04.2. |
| 05 | Tab «Сводка» | 🔴 not-started | 04.2 | Заменить `EmptyTabState` на полноценный отчёт по объекту. Подготовка под экспорт. |
| 06 | Экспорт PDF | 🔴 not-started | 05 | jsPDF, ГОСТ 2.104 рамка, штамп, выгрузка по разделам. |
| 07 | Экспорт Excel | 🔴 not-started | 05 | ExcelJS, шаблон спецификации оборудования + ведомость теплопотерь. |
| 08 | UAT M1 + деплой | 🔴 not-started | 06, 07 | Сквозной прогон через Chromium, релиз на Vercel. |

### Бэклог (после M1)

- `999.1-ik-heating-calculator` — калькулятор ИК-отопления (см. `.planning/backlog/`)

## Принципы

- Один **не-trivial** PR на фазу. Атомарные коммиты внутри.
- Каждая фаза начинается с PLAN.md, заканчивается STATUS.md = closed.
- Тесты не red. Перед закрытием — UAT через Chromium на winde.
- Все термины — по русским СП/ГОСТ; код-комменты на английском.

## История

- **2026-04-19** — фаза 04.1 заморожена, фикс `runV11Migration` в коммите `62228e7`. См. jarvis-recap.
- **2026-04-20** — переезд VPS devuser → kot-claude, потерян `.planning/`.
- **2026-04-26** — восстановление: код из архива, `.planning/` reconstruct из jarvis-логов.
