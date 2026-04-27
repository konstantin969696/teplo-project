# POOL-EVAPORATION-SPEC -- Испарение с зеркала бассейна

Цель: добавить расчёт теплопотерь от испарения воды с открытого зеркала бассейна
в баланс теплопотерь комнаты. Эти потери существенны (часто 30--60 % от Q_итого
в помещении бассейна). Методология -- VDI 2089 (таблица ε) и ГОСТ Р 72128-2025.

В текущем `RoomHeatLossResult` учитываются только Q_осн, Q_инф, Q_вент.
Нужен четвёртый член -- Q_исп -- который суммируется в Q_итого и отображается
в `EquipmentRow` рядом с остальными составляющими.

---

## Физика и нормативы

### Формула испарения

```
G_исп = β · (P_нас(t_воды) − P_парц(t_возд, φ)) · F_зерк    [кг/ч]
Q_исп = G_исп · r · 1000 / 3600                              [Вт]
```

где:

| Обозначение | Размерность | Описание |
|---|---|---|
| β | кг/(м²·ч·кПа) | Коэффициент массоотдачи (по режиму эксплуатации) |
| P_нас(t_воды) | кПа | Давление насыщенного пара при температуре воды |
| P_парц | кПа | Парциальное давление водяного пара в воздухе помещения |
| F_зерк | м² | Площадь зеркала воды |
| r | кДж/кг | Теплота парообразования воды |

**Теплота парообразования** -- для диапазона 20--35 °C принимаем постоянное
значение `r = 2450 кДж/кг` (среднее между 2501 при 0 °C и 2430 при 30 °C).
Перевод кг/ч → Вт: `Q_исп = G_исп · 2450 · 1000 / 3600 = G_исп · 680.56`.

### Коэффициенты β по режимам (VDI 2089, ГОСТ Р 72128-2025)

Источник значений -- VDI 2089 (таблица ε в г/(м²·ч·мбар)), пересчитан в кг/(м²·ч·кПа):
`β [кг/(м²·ч·кПа)] = ε [г/(м²·ч·мбар)] / 100`
(1 кПа = 10 мбар, 1 кг = 1000 г → коэффициент 100)

| Режим | ε, г/(м²·ч·мбар) | β, кг/(м²·ч·кПа) | Примечание |
|---|---|---|---|
| Активное купание (общественный) | 20 | 0.20 | Типовое расчётное значение (по умолчанию) |
| Покой (зеркало открыто, никого нет) | 5 | 0.05 | -- |
| Покрытие / плёнка | 0.5 | 0.005 | -- |

Для справки: ε=28 (высокая нагрузка, аквапарк) → β=0.28; ε=35 (горки) → β=0.35.
СП 31-113-2004 п.10.29 -- только водный баланс (подпитка), не HVAC-расчёт.

В UI режим выбирается перечислением. В engine β передаётся явным параметром --
нет хардкода режимов внутри формулы.

### Давление насыщенного пара -- формула Магнуса

```
P_нас(T) = 0.6108 · exp(17.27 · T / (T + 237.3))   [кПа]
```

T в °C. Действительна для 0--60 °C, погрешность < 0.5 %.

Таблица для справки и тестов:

| t, °C | P_нас, кПа |
|---|---|
| 20 | 2.338 |
| 22 | 2.644 |
| 24 | 2.985 |
| 26 | 3.363 |
| 28 | 3.782 |
| 30 | 4.246 |
| 32 | 4.759 |
| 35 | 5.627 |

### Парциальное давление пара в воздухе

```
P_парц(t_возд, φ) = P_нас(t_возд) · φ
```

где φ -- относительная влажность воздуха в долях (0.60 = 60 %).

### Нормативная влажность (СП 60.13330.2020)

- Допустимый диапазон в помещении бассейна: φ = 50--65 %
- Расчётное значение по умолчанию: φ = 60 %

### Температура воды (СП 31-113-2004)

| Назначение | t_воды, °C |
|---|---|
| Спортивный бассейн | 26--28 |
| Оздоровительный / SPA | 28--32 |
| Детский | 30--32 |

В UI дефолт `tWater = 28`.

---

## Архитектура

### Изменения в типах

**Решение:** `PoolParams` как отдельный необязательный объект внутри `Room`.

Обоснование:

- Большинство комнат (≈ 90 % в типовом проекте) -- не бассейны. Прямые поля
  `waterTemp`, `poolArea`, `humidity` в `Room` засоряли бы тип бесполезными
  `null`-ами и увеличили бы размер каждого room-объекта в persist.
- Отдельный объект `poolParams?: PoolParams` даёт семантическую группировку --
  все параметры бассейна в одном месте, легко копировать/валидировать.
- Условный рендер в UI становится тривиальным: `if (room.poolParams)`.
- При клонировании комнаты (`cloneRoom`) объект копируется целиком --
  не нужно перечислять N отдельных полей.

```ts
// src/types/project.ts

export type PoolMode = 'active' | 'idle' | 'covered'

export interface PoolParams {
  readonly enabled: boolean      // true = комната содержит бассейн
  readonly fMirrorM2: number     // F_зерк, м²
  readonly tWaterC: number       // t_воды, °C
  readonly phi: number           // φ, доли (0.60 = 60 %)
  readonly mode: PoolMode        // режим эксплуатации → β
}

export interface Room {
  // ... существующие поля без изменений ...
  readonly poolParams?: PoolParams   // undefined = нет бассейна
}
```

`RoomHeatLossResult` расширяется одним полем:

```ts
export interface RoomHeatLossResult {
  // ... существующие поля без изменений ...
  readonly qEvaporation: number   // Q_исп, Вт
  readonly qTotal: number         // Q_осн + Q_инф + Q_вент + Q_исп
}
```

### Engine

Новый файл `src/engine/poolEvaporation.ts` -- чистые функции, zero React imports.

```ts
/**
 * POOL-01: Давление насыщенного пара по формуле Магнуса.
 *
 * P_нас(T) = 0.6108 · exp(17.27 · T / (T + 237.3))  [кПа]
 *
 * @param tWater -- температура воды, °C
 * @returns давление насыщенного пара, кПа
 */
export function calculateSaturatedVaporPressure(tWater: number): number

/**
 * POOL-02: Парциальное давление водяного пара в воздухе.
 *
 * P_парц = P_нас(tAir) · φ
 *
 * @param tAir -- температура воздуха в помещении, °C
 * @param phi -- относительная влажность, доли (0--1)
 * @returns парциальное давление, кПа
 */
export function calculatePartialVaporPressure(tAir: number, phi: number): number

/**
 * POOL-03: Масса испарившейся воды за час.
 *
 * G_исп = β · (P_нас(tWater) − P_парц(tAir, φ)) · F_зерк  [кг/ч]
 *
 * @param beta -- коэффициент массоотдачи, кг/(м²·ч·кПа)
 * @param pSat -- P_нас(tWater), кПа
 * @param pPartial -- P_парц(tAir, φ), кПа
 * @param fMirrorM2 -- площадь зеркала воды, м²
 * @returns масса испарения, кг/ч
 */
export function calculateEvaporationMass(
  beta: number,
  pSat: number,
  pPartial: number,
  fMirrorM2: number
): number

/**
 * POOL-04: Тепловые потери от испарения в ваттах.
 *
 * Q_исп = G_исп · r · 1000 / 3600
 * где r = 2450 кДж/кг (теплота парообразования)
 *
 * @param evaporationMassKgH -- G_исп, кг/ч
 * @returns Q_исп, Вт
 */
export function calculateEvaporationHeatW(evaporationMassKgH: number): number

/**
 * POOL-05: β по режиму эксплуатации (справочная константа).
 *
 * Единицы: кг/(м²·ч·кПа).
 * Источник: VDI 2089, ε [г/(м²·ч·мбар)] / 100 = β [кг/(м²·ч·кПа)].
 * ГОСТ Р 72128-2025 подтверждает диапазон.
 */
export const BETA_BY_MODE: Record<PoolMode, number> = {
  active: 0.20,   // ε=20 (общественный бассейн, нормальная нагрузка)
  idle:   0.05,   // ε=5  (покой, открытое зеркало)
  covered: 0.005, // ε=0.5 (покрытие / плёнка)
}

/**
 * POOL-06: Полный расчёт Q_исп для комнаты с бассейном.
 *
 * @param pool -- PoolParams
 * @param tAir -- t_возд в помещении, °C
 * @returns Q_исп, Вт; 0 если pool.enabled === false
 */
export function calculatePoolEvaporationHeat(
  pool: PoolParams | undefined,
  tAir: number
): number
```

### Интеграция в heatLoss.ts

`calculateRoomTotals` получает дополнительный параметр `poolParams` и
добавляет `qEvaporation` в итог:

```ts
export function calculateRoomTotals(
  enclosures: readonly Enclosure[],
  room: Room,
  deltaT: number
): RoomHeatLossResult {
  // ... существующий расчёт qBasic, qInfiltration, qVentilation ...

  const qEvaporation = calculatePoolEvaporationHeat(room.poolParams, room.tInside)
  const qTotal = qBasic + qInfiltration + qVentilation + qEvaporation
  const qSpecific = room.area > 0 ? qTotal / room.area : 0

  return {
    // ... существующие поля ...
    qEvaporation,
    qTotal,
    qSpecific,
  }
}
```

`buildRoomAuditString` обновляется:

```ts
export function buildRoomAuditString(
  qBasic: number,
  qInf: number,
  qVent: number,
  qEvap: number,
  qTotal: number
): string {
  return [
    'Q_итого = Q_осн + Q_инф + Q_вент + Q_исп',
    `  = ${qBasic.toFixed(1)} + ${qInf.toFixed(1)} + ${qVent.toFixed(1)} + ${qEvap.toFixed(1)}`,
    `  = ${qTotal.toFixed(1)} Вт`,
  ].join('\n')
}
```

### Интеграция в EquipmentRow

`EquipmentRow.tsx` отображает Q_исп как дополнительную строку в ячейке
`Q_пом` при `qEvaporation > 0`:

```tsx
// Внутри ячейки qRequired (аналогично qUfhComfort):
{qEvaporation > 0 && (
  <span className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
    Испарение: {Math.round(qEvaporation)} Вт
  </span>
)}
```

`qRoom` уже включает Q_исп (через `calculateRoomTotals` / worker), поэтому
`qRequired = Math.max(0, qRoom - qUfhHeating)` корректен без изменений.

---

## Phases

### Phase 1 -- типы + engine (формула + tests)

- `src/types/project.ts` -- добавить `PoolMode`, `PoolParams`, поле `poolParams?`
  в `Room`, поле `qEvaporation` в `RoomHeatLossResult`.
- `src/engine/poolEvaporation.ts` -- реализовать все функции из секции Engine.
- `src/engine/poolEvaporation.test.ts` -- юнит-тесты:
  - Магнус: точные значения для 20, 26, 30, 35 °C (сверка с таблицей).
  - Парциальное давление при φ = 0.6, tAir = 28 °C.
  - Полный расчёт: типовой бассейн 5×10 м, tWater = 28 °C, tAir = 28 °C,
    φ = 0.6, mode = 'active' → ожидаемый Q_исп ≈ 10.3 кВт. Ручной просчёт
    в комментарии к тесту:
    ```
    // P_нас(28) = 0.6108 · exp(17.27·28/(28+237.3)) = 3.782 кПа
    // P_парц = 3.782 · 0.6 = 2.269 кПа
    // ΔP = 3.782 - 2.269 = 1.513 кПа
    // G = β_active · ΔP · F = 0.20 · 1.513 · 50 = 15.13 кг/ч
    // Q = 15.13 · 2450 · 1000 / 3600 = 10 298 Вт ≈ 10.3 кВт
    ```
  - Граничные случаи: F_зерк = 0, φ ≥ 1, tWater < tAir.
- `src/engine/heatLoss.ts` -- интегрировать `calculatePoolEvaporationHeat`
  в `calculateRoomTotals`, обновить `buildRoomAuditString`.
- `src/engine/heatLoss.test.ts` -- обновить существующие тесты
  `calculateRoomTotals` (добавить `qEvaporation: 0` в ожидаемый результат
  или создать отдельный тест с `poolParams`).

**Коммит:** `feat(pool): типы PoolParams + engine испарения с формулой Магнуса`

### Phase 2 -- store + миграция

- `src/store/projectStore.ts`:
  - В `importJSON` -- нормализация `poolParams` (undefined → сохраняем undefined).
  - В `onRehydrateStorage` -- backward-compat: старые saves не имеют `poolParams`,
    оставляем undefined.
  - В `addRoom` -- `poolParams` не передаётся (undefined по умолчанию).
- `src/components/room-actions.ts` -- `addRoomsToFloor` и `cloneRoom`:
  - `addRoomsToFloor` -- без изменений (undefined).
  - `cloneRoom` -- `poolParams` копируется через spread `...source`,
    поэтому дополнительных действий не требуется.
- `src/engine/migration.ts` -- если появится `migrateV11toV12Json` в будущем,
  `poolParams` мигрируется как есть. Сейчас ничего не делаем.

**Коммит:** `feat(pool): store поддержка poolParams + backward-compat`

### Phase 3 -- UI (секция бассейна в Room editor)

- `src/components/heatLoss/RoomRow.tsx` -- в expanded-режиме (под `InfiltrationSection`)
  добавить `PoolSection`:
  - Чекбокс "Бассейн в помещении" (`poolParams.enabled`).
  - Если enabled:
    - Поле "Площадь зеркала, м²" (`fMirrorM2`, min 0, step 0.1).
    - Поле "Температура воды, °C" (`tWaterC`, min 20, max 35, step 1, default 28).
    - Поле "Влажность, %" (`phi`, min 30, max 90, step 5, default 60) --
      в UI проценты, в store доли (0.6).
    - Радио-кнопки режима: "Купание" / "Покой" / "Покрытие".
  - Подсказка: "Q_исп добавляется в теплопотери комнаты".
- `src/components/heatLoss/PoolSection.tsx` -- новый компонент (чистый presentational).
- `src/components/heatLoss/RoomRow.test.tsx` -- тесты на рендер PoolSection
  (появляется/скрывается по чекбоксу, корректные значения полей).

**Коммит:** `feat(pool): UI секция бассейна в редакторе комнаты`

### Phase 4 -- интеграция в EquipmentRow

- `src/components/equipment/EquipmentRow.tsx`:
  - Получить `qEvaporation` из `qRoom` (уже включено в `res.qTotal` от worker).
  - Для развёрнутой ячейки `Q_пом` при `qEvaporation > 0` добавить строку
    "Испарение: X Вт" аналогично "Комф.ТП".
  - `data-testid="q-evaporation"` на строке испарения.
- `src/components/equipment/EquipmentRow.test.tsx` -- тест:
  - Комната с бассейном → в ячейке видно "Испарение: ...".
  - Комната без бассейна → строки испарения нет.
  - Q_итого в `qRequired` включает Q_исп (проверка через data-testid).

**Коммит:** `feat(equipment): отображение Q_исп в EquipmentRow`

---

## Граничные случаи

| Условие | Поведение |
|---|---|
| `φ > 1.0` (введено > 100 %) | `clamp(phi, 0, 1)` в UI; engine принимает доли, валидация на входе. Если `phi >= 1` и `tWater <= tAir` -- физически возможно, формула работает. |
| `t_воды < t_возд` | Формула даёт `P_нас(tWater) < P_нас(tAir)`. Если при этом `phi` высокая, разность может стать отрицательной. `calculateEvaporationMass` возвращает `max(0, ...)` -- отрицательное испарение невозможно. |
| `F_зерк = 0` | `calculateEvaporationMass` возвращает 0. `calculatePoolEvaporationHeat` возвращает 0. |
| `poolParams.enabled = false` или `poolParams = undefined` | `calculatePoolEvaporationHeat` возвращает 0. Комната ведёт себя как обычная. |
| `P_нас − P_парц ≈ 0` (воздух насыщен) | `calculateEvaporationMass` → 0 → Q_исп = 0. Корректно, испарение прекращается. |
| `beta <= 0` | `calculateEvaporationMass` возвращает 0 (защита от некорректного ввода). |

---

## Из scope ИСКЛЮЧЕНО (отдельная задача)

- **Догрев воды чаши** (Q_догрев = G_воды · c · Δt / τ). Отдельный сервис,
  не относится к теплопотерям помещения.
- **Увлажнение / осушение воздуха.** Расчёт влажностного режима по полной
  методике СП 60 -- отдельная фича.
- **Испарение из джакузи / гидромассажных ванн.** Другие β и формулы.
- **Автоматический подбор φ по наружному климату.** Сейчас φ ручной ввод.

---

## Контракт для исполнителя (Саске)

1. **Атомарные коммиты** -- одна фаза = один коммит. 4 коммита всего.
2. **Тесты обязательны** -- engine-тесты для Phase 1 (все формулы с точными
   числами), UI-тесты для Phase 3/4. `npm test -- --run` зелёное перед каждым
   коммитом.
3. **Persist migration** -- bump version в `projectStore` НЕ требуется:
   `poolParams?` -- опциональное поле, старые saves получают `undefined`.
   `onRehydrateStorage` и `importJSON` должны корректно обрабатывать отсутствие
   поля (уже работает через optional chaining).
4. **Не трогай** -- `engine/hydraulics.ts`, `engine/ufh.ts`, `engine/equipment.ts`,
   `store/ufhLoopStore.ts`, `store/systemStore.ts`. Только `engine/heatLoss.ts`,
   `engine/poolEvaporation.ts` и UI-компоненты из спеки.
5. **Перед коммитом** каждой фазы:
   - `npm test -- --run` зелёное.
   - `npx tsc --noEmit` чисто.
6. **Ветка:** `feature/pool-evaporation`. PR в `main` после Phase 4.
