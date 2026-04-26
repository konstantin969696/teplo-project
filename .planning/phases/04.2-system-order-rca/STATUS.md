# Phase 04.2 — root-cause `systemOrder undefined` — STATUS

**Status:** 🟢 closed (2026-04-26)

## Что доказано

Гипотеза **H1** (partial / mistyped persisted state) подтверждена unit-тестом `systemStore.persist.test.ts`. Сценарии:

| # | Persisted shape | Результат БЕЗ merge | Результат С `shapeMerge` |
|---|-----------------|--------------------|-----|
| S0 | пусто | `systemOrder = []` | `[]` |
| S1 | `{state:{systems:{}}}` без `systemOrder` | `[]` (zustand merge сохраняет default) | `[]` |
| S2 | `{state:{systems:{}, systemOrder:"broken"}}` | **`systemOrder = "broken"`** ← баг | `[]` |
| S3 | `'{not valid json'` | `[]` (zustand ловит throw) | `[]` |
| S4 | `{state:{systems:null, systemOrder:null}}` | **`systems = null`, `systemOrder = null`** ← баг | `{}`, `[]` |

Корневой кейс прода (apr-19): в `localStorage.teplo-systems` лежал JSON с `systemOrder` неверного типа (наиболее вероятно `null` после некорректной записи). Без `merge:` zustand-persist копировал мусор в state как есть. `?? []` в `migration.ts` был симптоматическим лекарством.

## Что сделано

- `src/store/safeStorage.ts` — добавлен `shapeMerge()` helper, валидирует поля по shape (`'array-of-string' | 'record'`), битые/неверного типа поля заменяются дефолтами.
- `src/store/systemStore.ts`, `segmentStore.ts`, `equipmentStore.ts`, `ufhLoopStore.ts` — добавлен `merge:` через `shapeMerge`.
- `src/engine/migration.ts` — удалены `?? []` для `systemOrder`, `segmentOrder`, `equipmentOrder` (инвариант теперь даёт store).
- `src/store/systemStore.persist.test.ts` — 5 новых тестов на rehydration shape.
- `src/engine/migration.test.ts` — удалены 2 устаревших теста (тестировали удалённый `?? []`).

**Test suite:** 46 файлов / **601 тест** зелёные (601 = 598 baseline + 5 новых − 2 устаревших).

**Коммит:** см. git log.

## Известные техдолги, обнаруженные попутно (отдельные фазы)

1. **`ufhLoopOrder` не существует** в реальном `useUfhLoopStore` — оно объявлено только в типе `UfhLoopStoreState` внутри `migration.ts:54-58`. В результате `runV11Migration` зовёт `ufhState.bulkSetSystemId([], systemId)` для UFH-loops, и **`systemId` НЕ ставится** на UFH-loops при миграции v1.0 → v1.1 у пользователей с тёплым полом.
   - Импакт: для проектов v1.0 с тёплым полом после миграции UFH-loops не привязаны к системе → могут не учитываться в Tab «Гидравлика»/«Тёплый пол».
   - Защита временная: `?? []` оставлен только для `ufhLoopOrder` в `migration.ts:106` (комментарий с указателем на этот STATUS).
   - **Действие:** завести фазу 04.3 «UFH-loop migration to systemId» — либо добавить `ufhLoopOrder` в store, либо переделать миграцию через `Object.keys(loops)`.

2. **Другие stores с persist** (`enclosureStore`, `constructionStore`, каталоги) — не получили `shapeMerge`. Если у них тоже встречаются `Order: null` или подобное в persisted state, могут быть аналогичные крэши. Профилактически — раскатать `shapeMerge` на все persist-stores в отдельной фазе или сразу.
   - **Действие:** завести задачу `999.2-shape-merge-rollout-all-stores` в backlog.

## Открытые вопросы — нет
