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

- [ ] `src/components/hydraulics/useGckPath.ts` -- импортирует `calculateRoomTotals` (line 23) + 4 функции из `engine/hydraulics`. Самый сложный: задействуется `hydraulicsCalc` worker. Возможно потребуется адаптировать API worker.
- [ ] `src/components/equipment/EquipmentResultsTable.tsx` -- импорт `calculateRoomTotals` (line 21).
- [ ] `src/components/equipment/EquipmentRow.tsx` -- импорт `calculateRoomTotals` (line 28).
- [ ] `src/components/ufh/UfhLoopRow.tsx` -- импорт `calculateRoomTotals` (line 34).

### Что уже сделано

- ✅ `src/components/summary/SummaryTab.tsx` -- мигрирован на `getEngineWorker().heatLossForRooms(...)` через useEffect+useState. Тесты обновлены (vi.mock + findByText). Коммит см. в git log.

## ANALYSIS.md задачи

См. полный отчёт `ANALYSIS.md` (в корне `Teploroject/`). Статус по 7 пунктам:

- [x] #1 -- Engine Worker: exposed (частично -- только SummaryTab caller мигрирован, остальное в этом TECH-DEBT.md)
- [x] #2 -- O(n²) в derivedQ: устранено, добавлен buildChildrenMap
- [x] #3 -- Cross-store coupling: importService.ts создан, copyFloor через callback
- [x] #4 -- shape-validation в importJSON
- [ ] #5 -- VITE_APP_URL fallback (teplo-landing): не сделано
- [ ] #6 -- SEO лендинга: не сделано
- [ ] #7 -- Синхронизация версий: не сделано (см. выше)
