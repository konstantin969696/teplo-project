# Технический долг

## Версии зависимостей (расхождение между teplo-project и teplo-landing)

- TypeScript: 5.8 vs 6.0 (мажорное)
- Vite: 6 vs 8
- Цель: синхронизировать на teplo-landing-версии (новее), отдельная фаза с миграцией breaking changes.

## Engine Worker -- миграция callers (из ANALYSIS.md #1)

Worker exposed (`src/workers/engine.worker.ts`), proxy готов (`useEngineWorker.ts`), один caller мигрирован (`SummaryTab.tsx`) как POC. Осталось перевести 4 файла на async-вызов через worker, чтобы расчёты ушли из main thread.

### Шаблон миграции

```ts
// Было (sync, в main thread):
import { calculateRoomTotals } from '../../engine/heatLoss'
// ...
const result = useMemo(
  () => calculateRoomTotals(enclosures, room, dt),
  [enclosures, room, dt]
)

// Стало (async, через worker):
import { useEffect, useState } from 'react'
import { getEngineWorker } from '../../workers/useEngineWorker'
// ...
const [result, setResult] = useState<RoomHeatLossResult | null>(null)
useEffect(() => {
  let cancelled = false
  getEngineWorker()
    .heatLossForRooms(enclosures, enclosureOrder, rooms, roomOrder, tOutside)
    .then(res => { if (!cancelled) setResult(res[0]) })  // или индекс/маппинг
  return () => { cancelled = true }
}, [enclosures, enclosureOrder, rooms, roomOrder, tOutside])
```

### Что обязательно учесть

1. **Cancellation** -- в cleanup useEffect ставить `cancelled = true`, чтобы поздний промис не записал в state размонтированного компонента.
2. **Mock в тестах** -- `vi.mock('../../workers/useEngineWorker', () => ({ getEngineWorker: () => ({ heatLossForRooms: async (...) => calculateRoomTotals(...) }) }))`. Реальный `Worker` в jsdom не работает.
3. **Async-тесты** -- использовать `await screen.findByText(...)` вместо `getByText` для элементов, которые появляются после промиса.
4. **Loading state** -- опционально, для длинных расчётов добавить spinner. Для мелких пропустить.

### Файлы для миграции (атомарными коммитами)

- [ ] `src/components/hydraulics/useGckPath.ts` — **архитектурный конфликт, требует решения (см. ниже)**.
- [x] `src/components/equipment/EquipmentResultsTable.tsx` — коммит `e529ff6`.
- [x] `src/components/equipment/EquipmentRow.tsx` — коммит `5f96439`.
- [x] `src/components/ufh/UfhLoopRow.tsx` — коммит `17737d2`.

### useGckPath — архитектурный конфликт (остановка для решения)

`calculateRoomTotals` в `useGckPath` — не отображение, а **промежуточное вычисление**:

```
calculateRoomTotals(per room) → qRoom → target → deriveEquipmentQActual → equipmentQMap
equipmentQMap + segments → hydraulicsCalc (worker) → segmentResults
segmentResults → findMainCircuit → GCK path
```

Worker имеет:
- `heatLossForRooms` — Q_пом для комнат (без учёта equipment каталога / LMTD)
- `hydraulicsCalc(segments, equipmentQ, ...)` — принимает `equipmentQ` как готовый `Record<string, number>`

`findMainCircuit` и `recommendPump` в worker **не exposed** — остаются в main thread.

**Варианты:**

**A. Двухшаговый async (без изменений worker API):**
```
useEffect step 1: heatLossForRooms → qPerRoom[]
useEffect step 2 (deps: qPerRoom): compute equipmentQMap sync + hydraulicsCalc → results
```
Проблема: двойная async-цепочка, loading state усложняется, `findMainCircuit` всё равно в main thread.

**B. Добавить `fullHydraulicsCalc` в worker:**
Exposed функция принимает всё что нужно для equipmentQMap (enclosures, rooms, equipment, models) + гидравлику. Вычисляет обе части и возвращает полный результат. Требует расширения worker API. `findMainCircuit` и `recommendPump` тоже переехать в worker.

**C. Оставить useGckPath как есть (sync useMemo):**
Гидравлика — менее критична по нагрузке (считается на system-level, а не per-room). Приоритет worker: теплопотери (N комнат × per render). 3 файла уже мигрированы — основная нагрузка снята.

**Рекомендую C сейчас, B — в отдельной задаче (Phase 6 worker).**

### Что уже сделано

- ✅ `src/components/summary/SummaryTab.tsx` -- мигрирован на `getEngineWorker().heatLossForRooms(...)` через useEffect+useState. Тесты обновлены (vi.mock + findByText). Коммит см. в git log.

## ANALYSIS.md задачи

См. полный отчёт `ANALYSIS.md` (в корне `Teploroject/`). Статус по 7 пунктам:

- [x] #1 -- Engine Worker: 4 из 5 callers мигрированы (useGckPath — архитектурный конфликт, см. выше)
- [x] #2 -- O(n²) в derivedQ: устранено, добавлен buildChildrenMap (коммит `2cd089c`)
- [x] #3 -- Cross-store coupling: importService.ts создан, copyFloor через callback
- [x] #4 -- shape-validation в importJSON (коммит `39a33f7`)
- [x] #5 -- VITE_APP_URL fallback (teplo-landing): сделано (коммит `2298615`)
- [x] #6 -- SEO лендинга: сделано (коммит `c11614f`)
- [x] #7 -- Синхронизация версий: lucide-react ок; TS/Vite задокументированы в teplo-landing/TECH-DEBT.md (коммит `823772e`)
