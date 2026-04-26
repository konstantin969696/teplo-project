# Lessons — ТеплоПроект

Записи здесь собираются после корректировок Кости (правило из глобального `~/.claude/CLAUDE.md`). Перед каждой сессией перечитывать.

## 2026-04-26 — восстановление после переезда

### Sync винда ↔ сервер вручную, sync-loop пока не нужен
Костя работает в браузере на винде по `http://localhost:5173/`, dev-сервер крутится из `C:\Users\konst\Downloads\teplo-project (2)\teplo-project`. Я планирую и редактирую код в `/home/edgelab/project/Teploroject/teplo-project/`. Изменения переносить через `scp -r src/ kostay@kostya:'C:/Users/konst/Downloads/teplo-project (2)/teplo-project/'` — vite hot-reload подхватит. Автоматизацию делать только если попросит.

### Git локальный, без GitHub remote
Репо инициализирован 2026-04-26 после переезда, без `origin`. История коммитов до этого восстанавливается только из jarvis-логов и git-истории старого сервера. До закрытия M1 не пушить никуда без явного `да` Кости.

### Кириллица в путях ломает Node-инструменты
На winде путь с кириллицей (`D:\Yandex.Disk\5_ИИ\...`) приводил к `ERR_MODULE_NOT_FOUND` потому что Yandex.Disk хранит cloud-only placeholders, а SSH-сессия передаёт OEM cp866 в дочерние процессы. Решение для дев-серверов на винде: хранить проект в ASCII-пути (`C:\Users\konst\Downloads\...` сработал) и **запускать через ScheduledTask**, а не через `Start-Process` из SSH (таск стартует в нормальной windows-локали).

### Архив `teplo-project.tar.gz` приехал битым
В архиве distrib-файлы `vite/dist`, `vite/bin/vite.js`, `rollup/dist/es/parseAst.js` отсутствовали. Спасало только `rm -rf node_modules && npm ci`. Проверять целостность `node_modules` сразу при разворачивании в новой среде.
