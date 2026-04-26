# Phase 04.2 — root-cause `systemOrder undefined` — RCA

**Дата:** 2026-04-26
**Симптом (apr-19):** `runV11Migration` падал на свежем localStorage с `Cannot read properties of undefined (reading 'length')` в районе [src/engine/migration.ts:84](../../../src/engine/migration.ts).
**Hot fix (коммит 62228e7):** defensive `?? []` для `systemOrder`, `segmentOrder`, `equipmentOrder`, `ufhLoopOrder`.
**Цель этой фазы:** доказать настоящий root-cause, а не оставлять `?? []` как магический оберег.

## Что мы знаем точно

- `useSystemStore` ([src/store/systemStore.ts:21-24](../../../src/store/systemStore.ts)) объявляет `defaultSystemData = { systems: {}, systemOrder: [] }` и спредит его внутри `create((set) => ({ ...defaultSystemData, addSystem... }))`. Стартовое состояние ВСЕГДА содержит `systemOrder: []`.
- `safeStorage` ([src/store/safeStorage.ts](../../../src/store/safeStorage.ts)) — синхронный wrapper над localStorage. Гидрация тоже синхронная.
- `App.tsx` зовёт `runV11Migration` из `useEffect`, после первого render → персист точно завершил гидрацию.
- В `migration.test.ts` все 13 тестов — на mock-stores (без zustand-persist). Тесты не воспроизводят persist-flow, поэтому первичную поломку они и не ловили.

## Гипотезы (от вероятной к маловероятной)

### H1. Partial persisted state через стороннюю запись (наиболее вероятная)
**Сценарий:** `localStorage.teplo-systems` существует, но содержит JSON формы `{"state":{"systems":{}}}` (без `systemOrder`). Откуда мог взяться:
- Ручное редактирование DevTools → Application → Local Storage.
- Старая версия билда, где `systemOrder` ещё не был полем.
- Сбой записи (квота / DOMException), упавший между `JSON.stringify` и `setItem`.

**Что делает persist по умолчанию:** `merge: (persisted, current) => ({ ...current, ...persisted })`. Если `persisted = {systems:{}}`, результат: `{systems:{}, systemOrder: [], ...handlers}`. **`systemOrder` остаётся как `[]` из current.** Не падает.

**НО** если persisted = `{systems:{}, systemOrder: undefined}` (что, например, могло произойти если кто-то делал `setState({systemOrder: undefined})` — а потом `partialize` записал в JSON.stringify, который дропает undefined — **из строки undefined уходит**, при чтении этого поля нет → возвращаемся к предыдущему параграфу. Не падает.

**Где H1 всё-таки ломает:** если `merge` вызывается на shape, где persisted — это сразу `state` (без обёртки `{state:..., version:...}`). Старые версии zustand-persist (v3 и ранее) использовали другой формат; миграция v3→v4/v5 на одном пользователе могла дать кривой объект.

### H2. Hydration race из-за двух persist-store с одним workflow
**Сценарий:** `useProjectStore` имеет `version: 2` и **`migrate()`** ([projectStore.ts:229-242](../../../src/store/projectStore.ts)), который превращает `version<2` → `version 2` сохраняя legacy-поля. `useSystemStore` имеет `version: 1` БЕЗ `migrate()`. При первом запуске после деплоя v1.1:
1. `teplo-project` мигрирует с v1 → v2 (запускается `migrate`)
2. `teplo-systems` отсутствует → дефолт `{systems:{}, systemOrder:[]}`
3. `App.tsx` useEffect зовёт `runV11Migration`
4. Defaults на месте, `?? []` не нужен.

В этом сценарии гонки нет.

**НО** если у пользователя БЫЛ старый `teplo-systems` v0 (например, из beta-сборки), без `migrate()` он вернулся бы as-is. Тогда `systemOrder` мог отсутствовать → опять H1.

### H3. Сериализация: `JSON.parse` на битом значении
**Сценарий:** `localStorage.teplo-systems` содержит мусор (`'{not json'`). `safeStorage.getItem` отдаёт строку, `createJSONStorage` пытается её `JSON.parse`, получает throw — но zustand-persist его ловит и возвращает дефолт. **Не должно ломать.**

Однако в текущем коде **нет защитного `try` вокруг JSON.parse в createJSONStorage** — если zustand-persist v5 не глотает ошибку парсинга на каком-то edge-кейсе, падение могло уйти выше до initial state и оставить store без `systemOrder`. Маловероятно но возможно — нужен прогон сценария S4 из UAT (битый JSON).

### H4. Mounted-too-early из external code path
Кто-то вызывает `useSystemStore.getState()` **внутри module-scope** (top-level), до того как persist завершит гидрацию. Поиск показал — нет таких мест. Отбрасываем.

## План доказательства

| Шаг | Что | Артефакт |
|-----|-----|----------|
| 1 | Написать unit-тест в `systemStore.test.ts` который зашивает в `localStorage` partial persisted state (`{state:{systems:{}}}` без `systemOrder`) и проверяет что `useSystemStore.getState().systemOrder` после rehydrate = `[]`. | `systemStore.test.ts` ветка `persist-rehydration` |
| 2 | Если шаг 1 проходит без `?? []` — гипотеза H1 не даёт падения, проблема глубже. Если падает — RCA подтверждена и можно идти к шагу 3. | — |
| 3 | Заменить defensive `?? []` на явный `merge:` в persist-конфиге, нормализующий `systemOrder` к `Array.isArray(persisted.systemOrder) ? persisted.systemOrder : []`. То же для `segmentStore`, `equipmentStore`, `ufhLoopStore`. | PR `04.2-fix-persist-merge` |
| 4 | Удалить `?? []` из `migration.ts` (5 мест). | — |
| 5 | Прогнать все тесты + UAT-сценарии S1-S6 из 04.1 ещё раз. | STATUS.md = closed |

## Ожидаемая длительность

Если H1 — 1-2 часа. Если шаг 1 не падает — гипотезы переоценить, потенциально +день.

## Критерии готовности фазы

- [ ] Unit-тест на rehydration с partial state (минимум 4 кейса: пусто / только systems / битый JSON / валидный partial).
- [ ] `merge:` явно задан во всех 5 stores, `systemOrder/segmentOrder/equipmentOrder/ufhLoopOrder/loops` нормализуются.
- [ ] `?? []` удалены из `migration.ts`, тесты по-прежнему зелёные.
- [ ] UAT-сценарий S6 (systemOrder undefined) из 04.1 проходит без regression.
