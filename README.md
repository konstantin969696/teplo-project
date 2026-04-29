# Теплопроект

Настольное приложение для гидравлических расчётов систем отопления.

**Стек:** React 19 + TypeScript + Vite 6 + Tauri 2 (WebView2) + Zustand

---

## Установка (Windows)

1. Скачайте `Теплопроект_x.x.x_x64_ru-RU.msi` из [последнего Release](https://github.com/konstantin969696/teplo-project/releases/latest).
2. Запустите установщик.
3. Если появится предупреждение **Windows SmartScreen** — нажмите «Подробнее» → «Выполнить в любом случае».

Приложение устанавливается в `%LOCALAPPDATA%\Programs\teplo-project\`. Обновления проверяются автоматически при запуске.

---

## Разработка

### Требования

- [Node.js 20+](https://nodejs.org/)
- [Rust stable](https://rustup.rs/) + target `x86_64-pc-windows-msvc` (для Windows-билда)

### Запуск в браузере

```bash
npm install
npm run dev
```

Откроется `http://localhost:5173`.

### Запуск в Tauri (Windows)

```bash
npm install
npm run tauri:dev
```

Откроется нативное окно с hot-reload.

### Сборка MSI (только на Windows)

```bash
npm run tauri:build
```

Артефакт: `src-tauri/target/release/bundle/msi/Теплопроект_*.msi`

---

## Релиз

Пушим тег — GitHub Actions собирает MSI и публикует Release автоматически:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## Структура проекта

```
src/                 — React-приложение (TypeScript)
  engine/            — Расчётные модули (теплопотери, гидравлика, тёплый пол)
  workers/           — Web Workers через Comlink
  store/             — Zustand-стейт
  components/        — UI-компоненты
src-tauri/           — Tauri-оболочка (Rust)
  src/lib.rs         — Entry point с плагинами (updater, process, log)
  tauri.conf.json    — Конфигурация приложения
.github/workflows/   — CI/CD (release.yml)
```
