# Менеджер проектов -- ТЗ

Цель: добавить sidebar слева со списком проектов. Пользователь может создавать
новый проект, переименовывать, дублировать, удалять, переключаться между ними.
Все данные (комнаты/ограждения/системы/сегменты/оборудование/петли) -- на
проект; каталоги (pipe/kms/coolant) -- общие.

---

## Архитектура

### Стейт сейчас

6 независимых `persist`-сторов в localStorage:

| Store              | localStorage key       |
|--------------------|------------------------|
| `projectStore`     | `teplo-project`        |
| `enclosureStore`   | `teplo-enclosures`     |
| `systemStore`      | `teplo-systems`        |
| `segmentStore`     | `teplo-segments`       |
| `equipmentStore`   | `teplo-equipment`      |
| `ufhLoopStore`     | `teplo-ufh-loops`      |

Каталоги (`pipeCatalogStore`, `kmsCatalogStore`, `coolantCatalogStore`,
`catalogStore`) -- НЕ привязаны к проекту, не трогаем.

### Что добавляем

**`projectsRegistryStore`** (новый, `persist` key `teplo-projects-registry`):

```ts
interface ProjectsRegistryState {
  projects: Record<string, ProjectMeta>
  projectOrder: string[]
  activeId: string | null

  createProject(name: string): string  // returns new id, makes it active
  switchProject(id: string): void
  renameProject(id: string, name: string): void
  duplicateProject(id: string): string // returns new id, makes it active
  deleteProject(id: string): void
}

interface ProjectMeta {
  id: string
  name: string
  createdAt: number  // Date.now()
  updatedAt: number
}
```

**Snapshots store** (новый, `persist` key `teplo-projects-snapshots`):

```ts
interface ProjectsSnapshotsState {
  snapshots: Record<string, ProjectSnapshot>

  saveSnapshot(id: string, snap: ProjectSnapshot): void
  getSnapshot(id: string): ProjectSnapshot | undefined
  deleteSnapshot(id: string): void
}

interface ProjectSnapshot {
  version: 1
  project: ProjectData       // city, tInside, rooms, roomOrder, customCities, schemaVersion
  enclosures: { enclosures: Record<string, Enclosure>; enclosureOrder: string[] }
  systems: { systems: Record<string, System>; systemOrder: string[] }
  segments: { segments: Record<string, Segment>; segmentOrder: string[] }
  equipment: { equipment: Record<string, Equipment>; equipmentOrder: string[] }
  ufhLoops: { loops: Record<string, UfhLoop>; loopsByRoom: Record<string, string> }
}
```

**Принцип:** активный проект живёт в "рабочих" persist-ключах (как сейчас).
Snapshot активного НЕ дублируем -- избегаем рассинхрона. Snapshot пишем
только в момент switch'a (текущий → snapshot, новый ← snapshot).

### Switch-механика

`switchProject(newId)`:

```
1. if (activeId === newId) return
2. if (activeId !== null):
     snap = collectSnapshot()  // см. ниже
     snapshotsStore.saveSnapshot(activeId, snap)
3. resetAllStores()  // дефолты во всех 6 сторах
4. snap = snapshotsStore.getSnapshot(newId)
   if (snap):
     restoreSnapshot(snap)
     snapshotsStore.deleteSnapshot(newId)
5. registryStore.activeId = newId
```

`createProject(name)`:

```
1. if (activeId !== null):
     saveSnapshot(activeId, collectSnapshot())
2. resetAllStores()
3. id = uuid()
4. registryStore.projects[id] = { id, name, createdAt: now, updatedAt: now }
5. registryStore.projectOrder.push(id)
6. registryStore.activeId = id
```

`duplicateProject(sourceId)`:

```
1. if (sourceId === activeId):
     snap = collectSnapshot()
   else:
     snap = snapshotsStore.getSnapshot(sourceId)
2. newId = uuid()
3. registryStore.projects[newId] = { id: newId, name: `${source.name} (копия)`, createdAt: now, updatedAt: now }
4. registryStore.projectOrder.push(newId)
5. snapshotsStore.saveSnapshot(newId, deepClone(snap))  // НЕ активируем
```

`deleteProject(id)`:

```
1. delete registryStore.projects[id]
2. registryStore.projectOrder = projectOrder.filter(x => x !== id)
3. snapshotsStore.deleteSnapshot(id)
4. if (id === activeId):
     if (projectOrder.length > 0):
       switchProject(projectOrder[0])
     else:
       // Авто-создаём пустой "Проект 1", чтобы не было empty state
       createProject('Проект 1')
```

### Snapshot helpers (`src/services/projectSnapshot.ts`)

```ts
export function collectSnapshot(): ProjectSnapshot {
  const p = useProjectStore.getState()
  return {
    version: 1,
    project: { city: p.city, tInside: p.tInside, rooms: p.rooms, roomOrder: p.roomOrder, customCities: p.customCities, schemaVersion: p.schemaVersion },
    enclosures: { enclosures: useEnclosureStore.getState().enclosures, enclosureOrder: useEnclosureStore.getState().enclosureOrder },
    // ... systems, segments, equipment, ufhLoops аналогично
  }
}

export function restoreSnapshot(snap: ProjectSnapshot): void {
  useProjectStore.setState({ ...snap.project, activeTab: 0 })
  useEnclosureStore.setState(snap.enclosures)
  useSystemStore.setState(snap.systems)
  useSegmentStore.setState(snap.segments)
  useEquipmentStore.setState(snap.equipment)
  useUfhLoopStore.setState(snap.ufhLoops)
}

export function resetAllStores(): void {
  // Каждый стор должен экспортировать свой default. Если сейчас не экспортирует --
  // экспортировать через `export const defaultXxxData`.
}
```

### Миграция legacy → registry

В `App.tsx` на старте:

```
1. Дождаться rehydrate всех 6 сторов:
   await Promise.all([
     useProjectStore.persist.rehydrate(),
     ...
   ])
2. Дождаться rehydrate registry.
3. if (registry.projectOrder.length === 0):
     // Это либо первый запуск, либо апгрейд с legacy.
     hasLegacyData = checkLegacyData()  // есть ли rooms/enclosures/etc в текущих сторах?
     if (hasLegacyData):
       id = uuid()
       registry.projects[id] = { id, name: 'Проект 1', createdAt: now, updatedAt: now }
       registry.projectOrder = [id]
       registry.activeId = id
     // если данных нет -- registry останется пустым, UI покажет prompt "Создайте проект".
```

`checkLegacyData()`: `Object.keys(rooms).length > 0 || Object.keys(enclosures).length > 0 || ...`

---

## Phases (атомарные коммиты)

### Phase 1 -- Registry + snapshots stores + auto-migration

**Файлы:**
- `src/store/projectsRegistryStore.ts` (CRUD без switch-логики -- только данные)
- `src/store/projectsSnapshotsStore.ts` (тонкий wrapper над persist Record)
- `src/services/projectSnapshot.ts` (`collectSnapshot`, `restoreSnapshot`, `resetAllStores`)
- `src/types/project.ts` -- добавить `ProjectMeta`, `ProjectSnapshot`
- `src/App.tsx` -- legacy-migration на старте (после rehydrate)
- Каждый из 6 сторов (project/enclosure/system/segment/equipment/ufhLoop) --
  экспортировать `defaultXxxData` если ещё не экспортирует.

**Тесты:**
- `projectsRegistryStore.test.ts` -- create / rename / delete / order / duplicate
- `projectsSnapshotsStore.test.ts` -- save / get / delete
- `projectSnapshot.test.ts` -- collect → restore round-trip (полный equality)
- `App.legacyMigration.test.ts` -- legacy data + пустой registry → "Проект 1" создан и активен

**Коммит:** `feat(projects): registry + snapshots stores + legacy-migration`

---

### Phase 2 -- Switch logic

**Файлы:**
- `src/store/projectsRegistryStore.ts` -- добавить методы `switchProject`,
  `createProject`, `duplicateProject`, `deleteProject` (используют snapshots store + snapshot helpers).

**Тесты:**
- Round-trip: createProject('A') → заполнить → createProject('B') → switchProject(A) → данные A; switchProject(B) → данные B.
- Duplicate: создать → duplicate → переименовать копию → удалить оригинал → данные копии живы.
- Delete активного → автоматически переключается на следующий или создаётся "Проект 1".

**Коммит:** `feat(projects): switch / duplicate / delete с snapshot round-trip`

---

### Phase 3 -- Sidebar UI

**Файлы:**
- `src/components/layout/ProjectSidebar.tsx`
  - 240px ширина на desktop, collapsible (иконка только) до 56px
  - На mobile (<768px) -- drawer с overlay, открывается кнопкой-гамбургером в `AppHeader`
  - Список проектов: каждая строка -- имя, дата обновления (relative: "сегодня"/"вчера"/"3 дня назад"), активный подсвечен
  - Inline rename: двойной клик по имени → input → blur/Enter сохраняет, Esc отменяет
  - Иконка "..." на hover → меню: переименовать, дублировать, удалить (с confirm), экспорт JSON
  - Кнопка "+ Новый проект" сверху → диалог с input'ом имени (default "Проект N")
- `src/components/layout/AppHeader.tsx`
  - В центре: имя активного проекта (вместо города; город сдвигается ниже или в sidebar) -- ИЛИ оставляем город, имя проекта показываем компактно слева под лого. Финальный выбор за дизайнером, по дефолту -- имя проекта в центре, город справа от имени маленьким шрифтом.
- `src/App.tsx` -- layout: `<div className="flex"><ProjectSidebar /><div className="flex-1"><AppHeader />...</div></div>`

**Тесты:**
- `ProjectSidebar.test.tsx` -- render списка, активный подсвечен, "+" создаёт, "..." показывает меню, rename работает, delete с confirm.

**Коммит:** `feat(ui): ProjectSidebar -- список, переключение, переименование`

---

### Phase 4 -- Import-as-new-project

**Файлы:**
- `src/store/projectStore.ts` -- `importJSON(data, mode: 'new' | 'replace')` (default `'new'`)
  - `mode === 'new'`: createProject(filename без расширения), потом обычный импорт в активный (он же новый)
  - `mode === 'replace'`: текущее поведение (заменить активный)
- UI диалога импорта (там где сейчас file input): добавить checkbox "Заменить текущий проект" (по умолчанию выкл).

**Тесты:**
- Import as new → активный проект новый, имя = filename, старый проект остался в registry.
- Import replace → активный заполнен новыми данными, новый проект НЕ создан.

**Коммит:** `feat(import): импорт JSON по умолчанию создаёт новый проект`

---

## Решения / ответы на риски

1. **Async rehydrate.** В `App.tsx` использовать `useEffect` + `Promise.all([...persist.rehydrate()])` ПЕРЕД миграцией. Показывать loader до завершения.
2. **Existing tests.** Тесты, которые `useProjectStore.setState` / `localStorage.clear()` -- НЕ сломаются: они сбрасывают рабочие сторы, registry в beforeEach не трогаем (он не активен в их сценариях). НО если App.tsx-level тесты есть -- нужно ребейзить под новый layout.
3. **schemaVersion миграция v1.0→v1.1.** Импорт продолжает мигрировать как раньше. Snapshot формат `version: 1`, миграции пока нет, при изменении -- добавить как обычно.
4. **Удаление активного.** Если registry становится пустым -- автоматом `createProject('Проект 1')`, чтобы не было пустого экрана.
5. **Каталоги.** НЕ трогаем. Они остаются глобальными.
6. **Размер snapshot'ов в localStorage.** Лимит ~5-10 МБ. Один проект ~50-200 КБ. Десяток проектов -- норма. Если у пользователя 50+ -- предупредить (toast "близко к лимиту"), вынести в IndexedDB -- задача на будущее.
7. **Атомарность snapshot save.** Если процесс прервётся между сохранением активного и переключением -- активный snapshot уже в storage, но рабочие ключи ещё текущие. На следующем старте -- registry показывает старый activeId, рабочие ключи совпадают, snapshot нового лежит в snapshots. Безопасно: switch выполнится повторно при клике пользователя.

---

## Контракт для исполнителя (Саске)

1. **Атомарные коммиты по фазам.** 4 коммита, каждая фаза = 1 коммит. Не сваливать в кучу.
2. **Тесты обязательны** для каждой фазы. Перед коммитом: `npm test -- --run` зелёное.
3. **Tsc чисто:** `npx tsc --noEmit` без ошибок.
4. **Вне scope:** не рефакторить чужой код, не менять каталоги, не трогать engine/.
5. **Не выдумывать API.** Если непонятно -- спросить у Костяна. Не молча "упрощать".
6. **Перед стартом каждой фазы** -- прочитать соответствующие существующие файлы, не писать вслепую.
7. **Branch:** `feature/projects-manager`. По завершении всех 4 фаз -- PR в main (через Костяна).
