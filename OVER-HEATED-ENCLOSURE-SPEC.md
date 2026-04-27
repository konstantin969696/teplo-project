# OVER-HEATED-ENCLOSURE-SPEC -- Ограждение над отапливаемым

Текущий workaround: инженер просто не добавляет «потолок над отапливаемым подвалом»
в комнату, чтобы не получить завышенные теплопотери. Это ненадёжно -- комнату можно
скопировать, и ограждение появится снова.

Правильное решение: если смежное помещение отапливается, температура расчётного
перепада для ограждения -- не `t_outside`, а `t_neighbor`. При `t_neighbor = t_inside`
теплопотери обнуляются автоматически.

В существующем коде `tAdjacent: number | null` уже есть в `Enclosure`, но
**engine его игнорирует** -- `calculateRoomTotals` передаёт единый `deltaT` во все
ограждения. Настоящая спека исправляет это.

---

## Физика и нормативы

### Формула (СП 50.13330.2024, п. 9.1)

```
Q_огр = K · A · (t_in − t_adj) · n_поправ
```

где `t_adj` -- расчётная температура с другой стороны ограждения:
- Внешнее ограждение (wall-ext, window, roof): `t_adj = t_outside`
- Ограждение к отапливаемому помещению: `t_adj = t_neighbor`

Коэффициент n из СП 50 Приложение Г применяется когда `t_adj` **не задан**
явно -- он приближённо заменяет неизвестную t_neighbor:

| Тип ограждения | n (дефолт) | Значение |
|---|---|---|
| Наружная стена, окно, кровля | 1.0 | t_adj = t_outside |
| Перекрытие над неотапливаемым подвалом | 0.6 | -- |
| Перекрытие над техническим подпольем | 0.4 | текущий ceiling-int defaultN |
| Внутренняя стена | 0.5 | текущий wall-int defaultN |

Когда t_neighbor **известна** -- n не нужен, вместо этого подставляем реальный ΔT:

```
ΔT_огр = max(0, t_in − t_neighbor)
```

При `t_neighbor = t_inside` → `ΔT_огр = 0` → `Q = 0`. Это физически правильно.

### Граница применимости «q=0»

q=0 только если t_neighbor ≥ t_inside. Если подвал поддерживается на 16°C,
а наше помещение на 20°C -- q ≠ 0:

```
Q = K · A · max(0, 20 − 16) = K · A · 4
```

Инженер обязан указывать реальную t_neighbor. Флаг «полностью обнулить» без указания
температуры -- антипаттерн, не реализуем.

---

## Архитектура

### Анализ существующего кода

**Что уже есть:**
- `Enclosure.tAdjacent: number | null` -- существует в типах (src/types/project.ts:56)
- `Enclosure.nCoeff: number` -- участвует в `calculateQBasic` (heatLoss.ts:59)
- `Enclosure.nOverridden: boolean` -- true если пользователь менял n вручную
- `ENCLOSURE_TYPE_CONFIG` -- defaultN: wall-int=0.5, ceiling-int=0.4, внешние=1.0

**Что не работает:**
- `tAdjacent` в engine не используется. В `calculateRoomTotals` (heatLoss.ts:160)
  передаётся единый `deltaT` во все ограждения, `enc.tAdjacent` игнорируется.
- Следовательно, для wall-int с заданным tAdjacent расчёт сейчас неточный --
  берётся `K·A·(t_in − t_out)·0.5` вместо `K·A·(t_in − t_adj)·1`.

### Выбранное решение -- расширить tAdjacent на engine

**Не добавляем** отдельный boolean `overHeated` или поле `tNeighborC` -- такое поле
**уже есть** (`tAdjacent`). Проблема только в engine.

**Что меняем:**

1. В `calculateRoomTotals` вычислять `encDeltaT` per-ограждение:

```ts
const encDeltaT = enc.tAdjacent !== null
  ? Math.max(0, room.tInside - enc.tAdjacent)
  : deltaT  // глобальный t_in - t_out

// Если t_adj задан явно -- nCoeff не нужен (у нас точный ΔT),
// если пользователь не переопределял вручную -- сбрасываем до 1.
const encNCoeff = (enc.tAdjacent !== null && !enc.nOverridden)
  ? 1.0
  : enc.nCoeff

qBasic += calculateQBasic(
  enc.kValue, area, encDeltaT, encNCoeff,
  enc.orientation, room.isCorner
)
```

2. **Типы не меняются** -- `tAdjacent: number | null` уже в `Enclosure`.
   Единственное расширение -- разрешить задавать tAdjacent для **всех** типов,
   а не только wall-int/ceiling-int (сейчас UI ограничивает -- только внутренние).

3. В UI добавить поле «t соседнего помещения, °C» для ограждений
   ceiling, wall-ext, floor-ground, roof -- т.е. тех, которые могут граничить
   с отапливаемым пространством.

### Изменение сигнатуры calculateQBasic

**Не меняется.** Логика инкапсулируется в `calculateRoomTotals` -- вычисляем
`encDeltaT` и `encNCoeff` перед вызовом.

### Изменения в store

Нет. `tAdjacent` уже сохраняется в `enclosureStore`. Persist не трогаем.

### Изменения в types/project.ts

Нет новых полей. Только расширяем семантику существующего `tAdjacent`:
документируем что оно применяется ко всем типам ограждений.

Обновить комментарий к полю:

```ts
// src/types/project.ts
export interface Enclosure {
  // ...
  // Температура смежного помещения, °C.
  // Если задано -- engine использует deltaT = max(0, tInside - tAdjacent) вместо
  // глобального t_in - t_out. Применяется к любому типу ограждения.
  // null = нет смежного отапливаемого помещения (default).
  readonly tAdjacent: number | null
  // ...
}
```

---

## UI

### EnclosureRow

Текущее состояние: поле «Температура смежного, °C» показывается только для
`wall-int` и `ceiling-int` (isExternal: false).

**Изменение:** показывать поле для всех типов в секции «Смежное помещение»:
- Чекбокс «Примыкает к отапливаемому помещению» -- при включении активирует поле.
- Числовое поле «t соседа, °C» (min -10, max 40, step 1, дефолт = tInside).
- Подсказка: «Если t соседа = t помещения -- q=0 автоматически. Если t ниже --
  потери рассчитываются по реальному перепаду».
- При задании tAdjacent и `!nOverridden` -- n автоматически = 1 (движок сам).
  В UI скрываем или greyed поле n и показываем «(авто, задана t соседа)».

Это изменение в `EnclosureRow.tsx` и/или `EnclosureRowDetails.tsx`.

---

## Phases

### Phase 1 -- engine + тесты (core fix)

**Файлы:**
- `src/engine/heatLoss.ts` -- в `calculateRoomTotals` добавить вычисление
  `encDeltaT` / `encNCoeff` перед вызовом `calculateQBasic`.
- `src/engine/heatLoss.test.ts` -- добавить тесты:
  - wall-int с `tAdjacent = tInside` → `Q = 0`.
  - ceiling с `tAdjacent = 16°C` при `tInside = 20°C`, `tOutside = -28°C` →
    `Q = K · A · 4` (а не `K · A · 48 · 0.4`).
  - `tAdjacent = null` → поведение не изменилось (регрессионный тест).
  - `tAdjacent > tInside` → `Q = 0` (отрицательный ΔT → max(0,...)).

**Коммит:** `feat(enclosure): tAdjacent теперь участвует в расчёте deltaT для всех ограждений`

### Phase 2 -- типы + комментарии (документирование)

**Файлы:**
- `src/types/project.ts` -- обновить комментарий к `tAdjacent` и `nCoeff`
  (снять ограничение "for internal types").
- `src/engine/heatLoss.ts` -- `buildEnclosureAuditString` -- показывать
  `encDeltaT` и источник ("t_adj = X°C" или "t_out") в audit-строке.

**Коммит:** `docs(enclosure): tAdjacent расширен на все типы ограждений, audit-string обновлён`

### Phase 3 -- UI в EnclosureRow

**Файлы:**
- `src/components/heatLoss/EnclosureRow.tsx` -- снять условие `!isExternal`
  на показ поля tAdjacent. Добавить чекбокс «Смежное с отапливаемым» (ставит tAdjacent = tInside),
  числовое поле при чекбоксе, подсказку.
- `src/components/heatLoss/EnclosureRow.test.tsx` -- тесты: поле tAdjacent
  появляется для ceiling, ввод tAdjacent = tInside → computed q = 0 в preview.

**Коммит:** `feat(ui): поле tAdjacent для всех типов ограждений в EnclosureRow`

### Phase 4 -- audit-string (опционально)

**Файлы:**
- `src/engine/heatLoss.ts` -- `buildEnclosureAuditString` -- расширить: добавить
  строку «deltaT = t_adj (X°C)» если использован tAdjacent, иначе «deltaT = t_out».

**Коммит:** `feat(enclosure): audit-string показывает источник deltaT`

---

## Граничные случаи

| Условие | Поведение |
|---|---|
| `tAdjacent = tInside` | `encDeltaT = 0` → `Q = 0`. Корректно. |
| `tAdjacent > tInside` | `max(0, tInside - tAdjacent) = 0` → `Q = 0`. Обратный поток тепла не моделируем. |
| `tAdjacent = null` | Поведение прежнее: `encDeltaT = deltaT` (t_in - t_out), `nCoeff` из store. |
| `nOverridden = true` и `tAdjacent != null` | nCoeff пользователя сохраняется (пользователь осознанно выставил). encDeltaT = max(0, tInside - tAdjacent). |
| `tAdjacent < tOutside` | Физически невозможно для отапливаемого помещения, но движок просто посчитает `Q = K·A·(tInside - tAdjacent)` без ограничений сверху. UI подсказка: «t соседа ниже наружной — проверьте ввод». |
| `floor-ground` с tAdjacent | Тип floor-ground считается по зонам (не через calculateQBasic). tAdjacent для него не применяется. В UI не показывать поле для floor-ground. |

---

## Из scope ИСКЛЮЧЕНО

- **Автоматическое определение t_neighbor** из списка комнат проекта -- отдельная фича.
- **Тепловой мост** между смежными помещениями -- за рамками линейного расчёта.
- **Изменение стандартных n** в `DEFAULT_N_COEFF` -- не трогаем, они применяются
  только когда tAdjacent = null.

---

## Контракт для исполнителя (Саске)

1. **Атомарные коммиты** -- одна фаза = один коммит. 3-4 коммита, ветка `feature/over-heated-enclosure`.
2. **Тесты обязательны** -- Phase 1: 4 юнит-теста для новой логики + регрессионный.
   `npm test -- --run` зелёное перед каждым коммитом.
3. **Не трогай** -- `engine/hydraulics.ts`, `engine/ufh.ts`, `store/systemStore.ts`,
   `store/projectStore.ts`. Только `engine/heatLoss.ts`, `types/project.ts` (комментарий),
   `components/heatLoss/EnclosureRow.tsx`.
4. **Backward-compat** -- существующие проекты с `tAdjacent = null` должны
   вести себя идентично текущему расчёту. Регрессионный тест обязателен.
5. **Перед коммитом каждой фазы:**
   - `npm test -- --run` зелёное.
   - `npx tsc --noEmit` чисто.
6. **Ветка:** `feature/over-heated-enclosure`. PR в `main` после Phase 3 (Phase 4 опционально).
