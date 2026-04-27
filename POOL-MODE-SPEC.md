# Pool / Comfort UFH Mode -- ТЗ

Цель: добавить корректный расчёт UFH-контура в режиме "комфорт"
(плитка у бассейна, ванная, прихожая) -- когда задача пола не закрыть
теплопотери, а только держать температуру поверхности комфортной.

Текущий движок (`engine/ufh.ts`) умеет только прямую задачу:
`q = f(t_теплоносителя)`. И автоматически вычитает `qUfh` из теплопотерь
комнаты в `EquipmentRow.tsx`. Для бассейнов и прочих "комфортных" зон
это даёт занижение мощности оборудования.

---

## Архитектура

### Изменения в типах

`src/types/hydraulics.ts` -- расширить `UfhLoop`:

```ts
export type UfhMode = 'heating' | 'comfort'

export interface UfhLoop {
  // существующие поля...
  readonly mode: UfhMode                 // дефолт 'heating'
  readonly targetFloorTempC: number | null  // если задано, обратная задача
}
```

- `mode === 'heating'` -- текущее поведение, ничего не меняется.
- `mode === 'comfort'` -- q НЕ вычитается из qResidual (см. EquipmentRow).
- `targetFloorTempC` -- если задано, движок подбирает t_теплоносителя
  обратной задачей, чтобы получить ровно эту t_пола. Иначе работает
  прямая задача от tSupply/tReturn системы.

### Обратная задача

`engine/ufh.ts` -- добавить функцию:

```ts
/**
 * UFH-08: Обратная задача — подбор средней температуры теплоносителя
 * по заданной средней температуре пола.
 *
 * Из УФН-04: t_пол = t_возд + q / α_tot
 * Из УФН-03: q = 8.92 · (t_ср − t_возд)^1.1 · k_покр
 *
 * Решаем: t_ср = t_возд + (q / (8.92 · k_покр))^(1/1.1),
 * где q = α_tot · (t_пол − t_возд) = 10.8 · (t_пол − t_возд)
 *
 * @param targetFloorTempC — целевая t_пола, °C
 * @param tRoom — t_возд, °C
 * @param covering — покрытие пола
 * @returns среднюю t_ср теплоносителя для достижения цели, °C
 *          или null если цель ниже комнатной (физически невозможно).
 */
export function calculateRequiredCoolantMeanTemp(
  targetFloorTempC: number,
  tRoom: number,
  covering: FloorCovering
): number | null {
  const dtFloor = targetFloorTempC - tRoom
  if (dtFloor <= 0) return null
  const q = ALPHA_FLOOR_TOTAL * dtFloor
  const k = COVERING_COEFF[covering]
  if (k <= 0) return null
  const dtCoolant = Math.pow(q / (8.92 * k), 1 / 1.1)
  return tRoom + dtCoolant
}
```

### Интеграция в UfhLoopDetails / UfhLoopRow

Если `loop.mode === 'comfort'` и задан `loop.targetFloorTempC`:

1. Считаем `tCoolantMean = calculateRequiredCoolantMeanTemp(...)`.
2. Подбираем tSupply/tReturn такие чтобы `(tSupply + tReturn) / 2 = tCoolantMean`.
   Базовый подход: оставляем `dt = tSupplyUfh - tReturnUfh` (5-10°C, из системы),
   сдвигаем оба в сторону: `tSupply' = tCoolantMean + dt/2`, `tReturn' = tCoolantMean - dt/2`.
3. Вычисляем `q = calculateHeatFlux(tSupply', tReturn', tRoom, covering)`.
4. Гидравлика считается на эти подобранные tSupply'/tReturn'.

В UI показываем:
- Признак "комфорт-режим" на строке.
- Подобранную t_теплоносителя (например, "33/27°C" вместо системной 45/35).
- t_пола = targetFloorTempC (которая по факту получена).

### Исключение из баланса теплопотерь

`src/components/equipment/EquipmentRow.tsx:111`:

```ts
// Было:
return Math.max(0, qRoom - qUfhActive)

// Стало:
const qUfhInBalance = ufhLoops
  .filter(l => l.enabled && l.mode === 'heating')
  .reduce((sum, l) => sum + l.qActiveW, 0)
return Math.max(0, qRoom - qUfhInBalance)
```

Где `qUfhActive` сейчас — просто сумма всех включённых, заменим на сумму
только heating-контуров.

---

## Phases

### Phase 1 — types + engine

- `types/hydraulics.ts` -- `UfhMode`, поле `mode`, поле `targetFloorTempC`.
- `engine/ufh.ts` -- функция `calculateRequiredCoolantMeanTemp`.
- `engine/ufh.test.ts` -- юнит-тесты обратной задачи.
- `store/ufhLoopStore.ts` -- shapeMerge migration: дефолт `mode = 'heating'`,
  `targetFloorTempC = null` для существующих контуров.
- Миграция persist version + 1.

**Коммит:** `feat(ufh): тип UfhMode + обратная задача t_пола → t_теплоносителя`

### Phase 2 — расчёт в UI с обратной задачей

- `components/ufh/UfhLoopDetails.tsx` -- если `mode='comfort'` и `targetFloorTempC`,
  пересчитать tSupply/tReturn перед `calculateHeatFlux` и `calculateLoopHydraulics`.
  Показать в таблице подобранные температуры.
- `components/ufh/UfhLoopRow.tsx` -- добавить визуальный признак "комфорт-режим"
  (бейджик/иконка), отображать целевую t_пола вместо расчётной.
- Тесты на оба компонента.

**Коммит:** `feat(ufh): расчёт comfort-контура с обратной задачей`

### Phase 3 — UI редактирования режима

- `components/ufh/UfhLoopDetails.tsx` -- секция настроек контура:
  - Радио-кнопки: "Отопительный" / "Комфортный".
  - Если "Комфортный" -- поле ввода `targetFloorTempC` (default 30, диапазон 25-35).
  - Подсказка: "Контур не будет учитываться в балансе отопления комнаты".

**Коммит:** `feat(ufh): UI выбора режима контура (отопительный/комфортный)`

### Phase 4 — исключение comfort-контуров из баланса

- `components/equipment/EquipmentRow.tsx` -- в расчёте `qResidual` фильтр
  по `l.mode === 'heating'`. Comfort-контуры визуально показываются отдельной
  строкой "комфорт: q Вт (вне баланса)".
- Тесты.

**Коммит:** `feat(equipment): comfort-контуры UFH не вычитаются из qResidual`

---

## Из scope ИСКЛЮЧЕНО (отдельная задача)

- **Испарение с зеркала бассейна** (Q_исп = β·(P_нас − P_возд)·F_зерк).
  Это блок теплопотерь самой комнаты бассейна, не UFH. Заведём отдельную
  спеку `POOL-EVAPORATION-SPEC.md` если возьмёшь в работу.
- **Догрев воды чаши.** Отдельный сервис, к UFH не относится.
- **Per-room t_пола threshold** (29°C для жилых, 31°C для бассейна).
  Сейчас порог хардкоднут 29°C; per-room threshold — отдельная фича.
- **Признак ограждения "над отапливаемым" с автоматическим q=0.**
  Сейчас инженер просто не добавляет такое ограждение в комнату — workaround
  работает. Автоматизировать можно отдельной задачей.

---

## Контракт для исполнителя (Саске)

1. **Атомарные коммиты** — одна фаза = один коммит. 4 коммита всего.
2. **Тесты обязательны** — engine/ufh для Phase 1, UI-тесты для Phase 2/3,
   integration-тесты EquipmentRow для Phase 4.
3. **Persist migration** — bump version в ufhLoopStore, добавить migrate
   для дефолтных значений `mode='heating'`, `targetFloorTempC=null`.
   Существующие проекты не должны сломаться.
4. **Не трогай** — engine/heatLoss, engine/hydraulics (только UFH-движок).
5. **Перед коммитом** каждой фазы:
   - `npm test -- --run` зелёное.
   - `npx tsc --noEmit` чисто.
6. **Ветка:** `feature/pool-comfort-ufh`. PR в main после Phase 4.
