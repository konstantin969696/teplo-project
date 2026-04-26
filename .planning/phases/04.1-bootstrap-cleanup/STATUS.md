# Phase 04.1 — Bootstrap & Cleanup — STATUS

**Status:** 🟡 in-progress (заморожена 2026-04-19, перезапуск 2026-04-26)

## Что сделано до переезда

- Шаг **04.1-07** Bootstrap & Cleanup открыт. Полный текст PLAN-файла `04.1-07-bootstrap-and-cleanup-PLAN.md` **не сохранился** — оригинал на старом сервере devuser, в jsonl-логах jarvis его не было (только упоминание).
- Найдена и пофикшена критическая ошибка `runV11Migration`: падал на свежем localStorage с `Cannot read properties of undefined (reading 'length')` на месте `migration.ts:13`.
- Применена defensive-нормализация `systemOrder` в `src/engine/migration.ts`. Коммит `62228e7` (история этого репо начинается с 2026-04-26 — первый коммит уже включает фикс).
- 13/13 регрессионных тестов на миграции зелёные (`migration.test.ts`).
- UAT через Chromium по Tailscale на винде Кости: UI-ошибка ушла, 0 console errors.

## Что осталось

- [ ] **UAT всех bootstrap-сценариев.** Перебрать: пустой localStorage, v1.0 persisted, v1.1 persisted, испорченный JSON в localStorage, отсутствие отдельных stores. Минимум 5 сценариев.
- [ ] Восстановить (или формализовать заново) текст `04.1-07-bootstrap-and-cleanup-PLAN.md` — что осталось в плане кроме UAT.
- [ ] Зафиксировать root-cause `systemOrder undefined` — в фазе 04.1 был отложен на 04.2 (см. ROADMAP).
- [ ] Решить: остаются ли в 04.1 ещё шаги после 07, или закрываем и переходим к 04.2.

## Артефакты

- `src/engine/migration.ts` — место фикса
- `src/engine/migration.test.ts` — регрессия 13/13
- `src/store/safeStorage.ts` — обёртка над localStorage (потенциальный source of `undefined`)
- `src/store/projectStore.ts` — здесь живёт `systemOrder`

## Открытые вопросы

1. **Нужен ли GitHub-репо?** Сейчас локальный git без remote. Push в GitHub упростил бы передачу изменений между виндой и сервером.
2. **Sync code винда ↔ сервер.** Сейчас вручную через scp. Можно поднять fswatch+rsync.
