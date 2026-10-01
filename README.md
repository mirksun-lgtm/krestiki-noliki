# Крестики-нолики

Уютная (cozy-fantasy) игра «Крестики-нолики» на TypeScript + Canvas: PvP на одном устройстве, PvE против AI (4 сложности), серии Best of 3/5, таймер хода, статистика и достижения. Без внешних ассетов и runtime-зависимостей — вся графика, звуки и музыка синтезируются кодом.

**Играть:** https://mirksun-lgtm.github.io/krestiki-noliki/

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
