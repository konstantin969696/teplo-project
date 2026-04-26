# Phase 04.3 — UFH-loop migration to systemId — STATUS

**Status:** 🟢 closed (2026-04-26)

## Что было сломано

`runV11Migration` мигрирует v1.0 → v1.1, ставя `systemId` на segments / equipment / UFH-loops. Для UFH-loops это работало неправильно:

1. В `migration.ts` интерфейс `UfhLoopStoreState` объявлял несуществующие поля:
   ```ts
   ufhLoops: Record<string, unknown>
   ufhLoopOrder: string[]
   bulkSetSystemId: (ids: string[], systemId: string) => void
   ```
   Реальный store использует `loops`, `loopsByRoom`, и `bulkSetSystemId(systemId: string)` — однопараметровый.

2. В миграции вызывалось `ufhState.bulkSetSystemId([...(ufhState.ufhLoopOrder ?? [])], systemId)`. Поскольку `ufhLoopOrder` не существует — спред пустого undefined давал `[]`, и звался `bulkSetSystemId([], systemId)`. JS не возмущается лишним аргументом → реальный `bulkSetSystemId(systemId)` получал `[]` как `systemId` и **расставлял `[]` каждому loop** в качестве systemId.

3. Тесты в `migration.test.ts` мокали `bulkSetSystemId(ids, sysId)` руками, поэтому случайно проходили — mock не отражал реальное API.

**Импакт:** все пользователи v1.0 с тёплым полом после автомиграции получали UFH-loops с `systemId === []` (массив) вместо валидной строки. Любая проверка `loop.systemId === systemId` падала.

## Что сделано

- `src/engine/migration.ts`:
  - Интерфейс `UfhLoopStoreState` приведён к реальной форме (`loops`, `loopsByRoom`, `bulkSetSystemId(systemId)`).
  - `hasMembers` вычисляется через `Object.keys(ufhState.loops).length > 0`.
  - Вызов миграции — `ufhState.bulkSetSystemId(systemId)` (один аргумент).
  - `?? []` для `ufhLoopOrder` снят (поле больше не используется).
- `src/engine/migration.test.ts`:
  - Mock `ufhLoopStore` приведён к реальному API: `loops`, `loopsByRoom`, `bulkSetSystemId(sysId)` через `Object.keys`.
  - `makeV10Stores` теперь кладёт V10_UFH_LOOPS в `loops` (без несуществующего push в order-array).
  - Добавлен **регрессионный тест** «Phase 04.3: sets correct systemId on every UFH loop» — два loops, миграция через legacy fields, проверяет что у обоих `systemId === result.systemId` и **НЕ массив** (anti-regression).

**Test suite:** 46 файлов / **602 теста** зелёные (601 + 1 новый регрессионный).

## Что НЕ покрыто (для следующей фазы при необходимости)

- Migration **JSON-ветки** (`migrateV10toV11Json`) для UFH-loops — там systemId зашивается через destructure, отдельных тестов на ufhLoops в JSON-выгрузке мало. Если будут жалобы на импорт v1.0 JSON с тёплым полом — отдельная фаза.
- Реальный e2e-тест через zustand-persist + миграция — пока только unit-mock. Потенциальная фаза 04.4 (если нужно будет).
