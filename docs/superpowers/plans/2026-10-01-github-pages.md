# GitHub Pages Publishing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Опубликовать «Крестики-нолики» на GitHub Pages (решение Олега от 01.10.2026: основная площадка — GitHub Pages, itch.io — опция потом).

**Architecture:** Vite-приложение публикуется статикой: сборка `dist/` выкладывается на GitHub Pages через официальный GitHub Actions workflow (`actions/deploy-pages`). Относительный `base: './'` в конфиге Vite делает сборку переносимой — она работает и на project-page (`username.github.io/krestiki-noliki/`), и на user-page, и на itch.io без переделок.

**Tech Stack:** Vite 8, TypeScript 7, Vitest 5, Node 24, GitHub Actions (official Pages actions), Git Credential Manager для авторизации push.

**Spec:** Решение зафиксировано в сообщении Олега 01.10.2026 + PROGRESS.md (аудит §26/§38 готов, «готово к публикации») и BACKLOG.md (вопрос «Хостинг для публикации»).

## Global Constraints

- Общение с Олегом — только по-русски, технические решения агент принимает сам.
- Новых зависимостей не добавлять (Vite/TS/Vitest — и есть весь стек, Pipeline §2).
- Команды npm — через `npm.cmd` (PowerShell блокирует npm.ps1).
- Ветка репозитория — `master` (не `main`).
- `dist/` и `node_modules/` остаются в `.gitignore`.
- Публикация itch.io — НЕ делать сейчас (опция после v1).

## Review Focus

- **Относительные пути в сборке** — если `base` оставить по умолчанию (`/`), на project-page все `/_assets/...` дадут 404. Проверка: в `dist/index.html` пути к ассетам начинаются с `./`.
- **Workflow падает на первом запуске, если Pages не включён** — источник Pages должен быть «GitHub Actions». Это действие Олега в веб-интерфейсе; до включения workflow будет красным — это ожидаемо, не баг сборки.
- **Тесты в CI** — `npm ci` + `npm test` должны проходить на ubuntu-раннере так же, как локально (250/250). Если упадут — фиксить до пуша.
- **Авторизация push** — git настроен на Credential Manager: первый push откроет браузер для входа в GitHub. Токены в файлы не сохранять и не светить.
- **Живой URL после деплоя** — проверить в браузере: игра грузится, консоль без ошибок, ресурсы 200 (не SPA-404).

---

### Task 1: Закрыть вопрос хостинга в BACKLOG

**Files:**
- Modify: `BACKLOG.md`

**Interfaces:**
- Consumes: решение Олега 01.10.2026 (GitHub Pages основная, itch.io потом).
- Produces: BACKLOG без открытых вопросов по хостингу (читается следующими чатами).

- [ ] **Step 1: Перенести вопрос хостинга в «Закрыто»**

В секции «Открытые вопросы» удалить пункт про хостинг, в секцию «Закрыто» добавить:

```markdown
- ~~**Хостинг для публикации**~~ — **решение Олега (01.10.2026): основная площадка — GitHub Pages**, с опцией itch.io потом. Публикация через GitHub Actions (workflow `.github/workflows/deploy.yml`), относительный `base: './'` в Vite — сборка переносима на любую поддиректорию (проект GitHub Pages, itch.io). Проверка на телефоне в локальной сети работала: `http://192.168.0.104:4173/`.
```

- [ ] **Step 2: Проверить, что открытых вопросов не осталось**

Run: `Select-String -Path BACKLOG.md -Pattern '^- \*\*'`
Expected: в секции «Открытые вопросы» пунктов нет (секция может остаться пустой или быть удалённой).

---

### Task 2: vite.config.ts — относительный base

**Files:**
- Create: `vite.config.ts`

**Interfaces:**
- Consumes: дефолтный Vite-билд (`npm.cmd run build` → `dist/`).
- Produces: все ссылки в `dist/index.html` относительные (`./assets/...`) — это же условие Task 4 (workflow заливает `dist/` как есть).

- [ ] **Step 1: Создать vite.config.ts**

```ts
import { defineConfig } from 'vite';

// Относительный base: сборка работает на любой поддиректории
// (GitHub Pages project-site, itch.io) без правок.
export default defineConfig({
  base: './',
});
```

- [ ] **Step 2: Пересобрать и проверить пути**

Run: `npm.cmd run build`
Expected: сборка без ошибок; затем проверить `dist/index.html`:

```powershell
Select-String -Path dist/index.html -Pattern '(src|href)='
```

Expected: ссылки на ассеты начинаются с `./` (не `/assets/`).

---

### Task 3: README.md для репозитория

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: команды из `package.json` (`dev`, `build`, `test`, `preview`).
- Produces: витрина репозитория на GitHub (портфолио) + ссылка на живую игру (URL подставится после публикации).

- [ ] **Step 1: Создать README.md**

```markdown
# Крестики-нолики

Уютная (cozy-fantasy) игра «Крестики-нолики» на TypeScript + Canvas: PvP на одном устройстве, PvE против AI (4 сложности), серии Best of 3/5, таймер хода, статистика и достижения. Без внешних ассетов и runtime-зависимостей — вся графика, звуки и музыка синтезируются кодом.

**Играть:** https://REPLACE-WITH-LIVE-URL

## Возможности

- PvP «Против игрока» и PvE «Против AI» (Easy / Medium / Hard / Impossible)
- Форматы: Single, Best of 3, Best of 5; выбор первого хода и стороны игрока
- Таймер хода (5/10/30 с) с победой по истечении времени
- Статистика и 8 достижений с очками (локально, localStorage)
- Управление: мышь, тач, клавиатура (Tab, стрелки, Enter/Space, ESC)
- Адаптивная вёрстка, `prefers-reduced-motion`, высокий контраст

## Технологии

TypeScript 7 · Vite 8 · Vitest 5 · HTML Canvas · Web Audio API. Ноль runtime-зависимостей.

## Разработка

```bash
npm install
npm run dev      # dev-сервер
npm test         # 250 unit-тестов
npm run build    # tsc + production-сборка в dist/
npm run preview  # предпросмотр сборки
```

## Публикация

Каждый push в `master` собирается workflow'ом `.github/workflows/deploy.yml` и выкладывается на GitHub Pages.
```

- [ ] **Step 2: Заменить плейсхолдер после публикации**

После получения живого URL (Task 7) заменить `REPLACE-WITH-LIVE-URL` фактическим адресом и добавить коммит (см. Task 7 Step 4).

---

### Task 4: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm.cmd run build` из package.json (включает `tsc --noEmit`), тесты `npm.cmd test`, каталог `dist/` из Task 2.
- Produces: автоматический деплой на GitHub Pages при каждом push в `master` (и ручной запуск через `workflow_dispatch`).

- [ ] **Step 1: Создать .github/workflows/deploy.yml**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Проверить синтаксис YAML локально**

```powershell
node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/deploy.yml','utf8');if(!/name: Deploy/.test(s))process.exit(1);console.log('yaml ok, lines:',s.split('\n').length)"
```

Expected: `yaml ok` (полная валидация произойдёт на GitHub после пуша).

---

### Task 5: Локальная верификация перед пушем

**Files:**
- Test: весь проект (команды запускаются из корня).

**Interfaces:**
- Consumes: Task 2 (vite.config.ts), существующие 250 тестов.
- Produces: зелёный свет на коммит и пуш.

- [ ] **Step 1: Прогнать тесты**

Run: `npm.cmd test`
Expected: 250/250 прошли.

- [ ] **Step 2: Production-сборка**

Run: `npm.cmd run build`
Expected: `tsc --noEmit` без ошибок, vite build чисто (как на аудите: css ~7.3 kB, js ~26 kB).

- [ ] **Step 3: Prod preview + проверка в браузере**

```powershell
npm.cmd run preview -- --port 4173 --strictPort
```

Затем браузерным инструментом открыть `http://localhost:4173/`:
- консоль: 0 ошибок, 0 предупреждений приложения;
- сеть: все ресурсы 200;
- сыграть короткую партию (ход, победа, плашка) — UI живой.

Expected: всё зелёное. Preview-сервер остановить после проверки.

- [ ] **Step 4: Проверить, что в git не попадает мусор**

Run: `git status --short`
Expected: только `BACKLOG.md`, `README.md`, `vite.config.ts`, `.github/` и новый план; `dist/` не упоминается.

---

### Task 6: Коммит подготовки

**Files:**
- Modify: `BACKLOG.md`, `PROGRESS.md`, `README.md`, `vite.config.ts`, `.github/workflows/deploy.yml`, `docs/superpowers/plans/2026-10-01-github-pages.md`

**Interfaces:**
- Consumes: Task 1–5 (всё зелёное).
- Produces: один коммит-подготовка перед публикацией.

- [ ] **Step 1: Обновить PROGRESS.md**

В таблицу Pipeline добавить строку:

```markdown
| 14 | Публикация: GitHub Pages | ✅ готово | <хеш коммита> |
```

И блок итогов (датировать 01.10.2026): относительный `base` в Vite, workflow деплоя на Pages, README, BACKLOG-вопрос закрыт; тесты/сборка зелёные; живая проверка — в Task 7 (заполнить URL после публикации).

- [ ] **Step 2: Закоммитить подготовку**

```powershell
git add BACKLOG.md PROGRESS.md README.md vite.config.ts .github docs/superpowers/plans
git commit -m "Публикация GitHub Pages: относительный base Vite, workflow деплоя, README, BACKLOG: хостинг закрыт"
```

Expected: коммит создан, `git status --short` чистый (кроме возможных незакоммиченных правок PROGRESS — добить хеш в Step 1 отдельным коммитом после известного хеша, как принято в проекте).

---

### Task 7: Публикация (с участием Олега)

**Files:**
- Modify: `README.md` (живая ссылка), `PROGRESS.md` (итог + URL).

**Interfaces:**
- Consumes: Task 6 (коммит в `master`), аккаунт GitHub Олега.
- Produces: живая игра на `https://<username>.github.io/krestiki-noliki/`.

- [ ] **Step 1: Действие Олега — аккаунт GitHub** (если ещё нет)

Создать аккаунт на github.com (бесплатно). Сообщить Мии имя пользователя.

- [ ] **Step 2: Push с авторизацией через браузер**

```powershell
git remote add origin https://github.com/<username>/krestiki-noliki.git
git push -u origin master
```

Git Credential Manager откроет браузер для входа в GitHub — Олег авторизуется сам (токены не сохраняются в переписке и не светятся).

- [ ] **Step 3: Действие Олега — включить Pages**

На странице репозитория: **Settings → Pages → Build and deployment → Source: GitHub Actions**. (До этого первый запуск workflow упадёт — это ожидаемо.)

- [ ] **Step 4: Проверить живой URL**

Дождаться зелёного workflow (Actions → Deploy to GitHub Pages), открыть `https://<username>.github.io/krestiki-noliki/`:
- игра грузится, консоль без ошибок, ресурсы 200;
- сыграть партию, проверить сохранения (localStorage живёт на новом origin).

Затем: подставить URL в `README.md` (`REPLACE-WITH-LIVE-URL`), дополнить PROGRESS (итог публикации + хеш), закоммитить, запушить.

- [ ] **Step 5: Итог Олегу**

Кратко: ссылка на игру, что проверить руками (portrait/landscape/touch/звук — ограничения окружения агента из PROGRESS), itch.io — отложено.
