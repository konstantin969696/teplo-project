# Phase 04.1 — Bootstrap UAT чек-лист

Прогон делает Костя в браузере на `http://localhost:5173/`. Перед каждым сценарием — открыть DevTools → Console (Ctrl+Shift+I → Console). Скриншоты не нужны, нужна отметка ✅/❌ и копия консольных ошибок при ❌.

## Подготовка

В DevTools → Application → Local Storage → `http://localhost:5173`. Здесь будем менять состояние перед каждым сценарием.

## Сценарии

### S1. Свежий пользователь (пустой localStorage)
**Setup:** в DevTools → Application → Storage → **Clear site data** → перезагрузить страницу (Ctrl+R).
**Ожидание:**
- Приложение открывается на табе «Теплопотери»
- В консоли — 0 ошибок
- Тост `«Проект обновлён до версии 1.1...»` **не показывается** (мигрировать нечего)
- Можно создать первое помещение — данные сохраняются
- Перезагрузка → данные на месте

### S2. Пользователь с v1.0-state (миграция вверх)
**Setup:**
1. Clear site data
2. В DevTools Console:
```js
localStorage.setItem('project-store', JSON.stringify({
  state: { activeTab: 0, projectName: 'Тест-объект v1.0' },
  version: 0
}))
localStorage.setItem('system-store', '{"state":{"systems":[],"systemOrder":[]},"version":0}')
```
3. Перезагрузить.

**Ожидание:**
- Тост `«Проект обновлён до версии 1.1 — создана «Система 1»…»` показан
- В localStorage появилась `system-store` v1 с одной «Системой 1»
- В консоли 0 ошибок

### S3. Пользователь с уже мигрированным v1.1-state
**Setup:** после S2 просто перезагрузить страницу (не сбрасывая).
**Ожидание:**
- Тост миграции **не показан** (идемпотентность)
- Приложение работает как обычно
- 0 ошибок в консоли

### S4. Битый JSON в localStorage
**Setup:**
1. Clear site data
2. В Console: `localStorage.setItem('project-store', '{not valid json')`
3. Перезагрузить.

**Ожидание:**
- Приложение НЕ падает (`safeStorage` глотает ошибку парсинга)
- Состояние пустое, как в S1
- В консоли допустимо предупреждение про невалидный JSON, не Uncaught

### S5. Частично присутствующие stores (отсутствует system-store)
**Setup:**
1. Clear site data
2. В Console: `localStorage.setItem('project-store', JSON.stringify({state:{activeTab:0},version:1}))`
3. Перезагрузить.

**Ожидание:**
- Приложение открывается, defensive-код в `runV11Migration` не падает
- 0 ошибок «Cannot read properties of undefined (reading 'length')»
- Если требуется — создаётся «Система 1»

### S6. systemOrder = undefined в существующем v1.1-state (регрессия `62228e7`)
**Setup:**
1. Clear site data
2. В Console:
```js
localStorage.setItem('system-store', JSON.stringify({
  state: { systems: [{id:'s1', name:'Система 1'}] /* нет поля systemOrder */ },
  version: 1
}))
```
3. Перезагрузить.

**Ожидание (это конкретно тот баг, что чинил коммит `62228e7`):**
- Приложение открывается без `Cannot read properties of undefined`
- `systemOrder` восстанавливается как `['s1']` (или из дефолтов)
- 0 ошибок в консоли

## Закрытие

Когда все 6 сценариев ✅ — Костя пишет «04.1 закрыта», я апдейчу `STATUS.md` → `🟢 closed`, ставлю galочку в ROADMAP, и перехожу к 04.2 (root-cause systemOrder).
