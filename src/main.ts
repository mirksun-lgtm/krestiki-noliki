import './style.css';
import { createGame, makeMove, timeoutGame, type GameState, type Player } from './game/gameCore';
import { createSeries, recordGameResult, targetWins, type SeriesState } from './game/series';
import {
  advanceTimer,
  createTurnTimer,
  restartTimer,
  stopTimer,
  type TurnTimer,
} from './game/turnTimer';
import { cellAtPoint, drawBoard } from './rendering/boardRenderer';
import { chooseMove } from './ai/ai';
import { initSfx, outcomeSfx, playSfx, setSfxEnabled } from './audio/sfx';
import { createMusic, playMusic, stopMusic, setMusicEnabled } from './audio/music';
import {
  ACHIEVEMENTS,
  achievementScore,
  COSMETIC_UNLOCKS,
  newlyUnlocked,
  unlockedCosmetics,
  type AchievementDef,
} from './game/achievements';
import { recordGame, type Stats } from './game/stats';
import {
  loadAchievements,
  loadAudioSettings,
  loadSettings,
  loadStats,
  saveAchievements,
  saveAudioSettings,
  saveSettings,
  saveStats,
  type UserSettings,
} from './persistence/storage';

function must<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message);
  return value;
}

function element<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el == null) throw new Error(`Элемент #${id} не найден`);
  return el as T;
}

const screens = Array.from(document.querySelectorAll<HTMLElement>('.screen'));
const menuPvpBtn = element<HTMLButtonElement>('menu-pvp');
const menuPveBtn = element<HTMLButtonElement>('menu-pve');
const menuAchvBtn = element<HTMLButtonElement>('menu-achievements');
const menuStatsBtn = element<HTMLButtonElement>('menu-stats');
const menuSettingsBtn = element<HTMLButtonElement>('menu-settings');
const settingsBackBtn = element<HTMLButtonElement>('settings-back');
const sfxToggle = element<HTMLInputElement>('sfx-toggle');
const musicToggle = element<HTMLInputElement>('music-toggle');
const achvBackBtn = element<HTMLButtonElement>('achievements-back');
const achvBodyEl = element<HTMLElement>('achievements-body');
const statsBackBtn = element<HTMLButtonElement>('stats-back');
const statsBodyEl = element<HTMLElement>('stats-body');
const aiDifficultyFieldset = element<HTMLFieldSetElement>('ai-difficulty');
const pveSideFieldset = element<HTMLFieldSetElement>('pve-side');
const setupBackBtn = element<HTMLButtonElement>('setup-back');
const setupStartBtn = element<HTMLButtonElement>('setup-start');
const seriesInfoEl = element<HTMLElement>('series-info');
const statusEl = element<HTMLElement>('status');
const timerEl = element<HTMLElement>('turn-timer');
const hintEl = element<HTMLElement>('hint');
const restartBtn = element<HTMLButtonElement>('restart');
const toMenuBtn = element<HTMLButtonElement>('to-menu');
const resultTitleEl = element<HTMLElement>('result-title');
const resultSubEl = element<HTMLElement>('result-sub');
const resultMenuBtn = element<HTMLButtonElement>('result-menu');
const resultNextBtn = element<HTMLButtonElement>('result-next');
const resultOverlay = element<HTMLElement>('result-overlay');
const achievementOverlay = element<HTMLElement>('achievement-overlay');
const achievementIconEl = element<HTMLElement>('achievement-icon');
const achievementTitleEl = element<HTMLElement>('achievement-title');
const achievementDescEl = element<HTMLElement>('achievement-desc');
const achievementGainEl = element<HTMLElement>('achievement-gain');
const achievementCloseBtn = element<HTMLButtonElement>('achievement-close');

const canvas = element<HTMLCanvasElement>('game-canvas');
const ctx = must(canvas.getContext('2d'), '2D-контекст недоступен');
const gameScreenEl = element<HTMLElement>('screen-game');

/** Фокусируемая клетка для клавиатурной навигации (0-8 или null) */
let keyboardCell: number | null = null;

type ScreenId =
  | 'screen-menu'
  | 'screen-setup'
  | 'screen-achievements'
  | 'screen-stats'
  | 'screen-settings'
  | 'screen-game';

const HINTS: Record<'finished' | 'outOfRange' | 'occupied', string> = {
  finished: 'Партия уже окончена — начните новую',
  outOfRange: 'Ход вне поля',
  occupied: 'Клетка занята',
};

type Params = { mode: 'pvp' | 'pve' } & UserSettings;

/** Сохранённые настройки живут дольше перезагрузки; сама партия — нет (GDD §21). */
const savedSettings = loadSettings();
let params: Params = { mode: 'pvp', ...savedSettings };
const audioSettings = loadAudioSettings();
let stats: Stats = loadStats();
let unlocked: string[] = loadAchievements();
let series: SeriesState = createSeries('single', 'X');
let state: GameState = createGame('X');
let hoverCell: number | null = null;
/** Сторона поля в CSS-пикселях, обновляется при resize. */
let boardSize = 360;

let timer: TurnTimer = createTurnTimer(0);
let timerLoop: number | null = null;
let lastTickAt = 0;
/** Последняя показанная секунда отсчёта — для сигнала тиканья. */
let lastShownSecs = -1;
let endedByTimeout = false;

const music = createMusic();

/** Анимация появления знака и победной линии: время старта, крутится в rAF. */
let markAnim: { cell: number; start: number } | null = null;
let winAnim: { start: number } | null = null;
let animRaf: number | null = null;
const MARK_ANIM_MS = 220;
const WIN_ANIM_MS = 340;

function aiSide(): Player {
  return params.side === 'X' ? 'O' : 'X';
}

function isAiTurn(): boolean {
  return params.mode === 'pve' && state.status === 'playing' && state.currentPlayer === aiSide();
}

function scheduleAiMove(): void {
  window.setTimeout(aiMove, 400);
}

function aiMove(): void {
  if (!isAiTurn()) return;
  const cell = chooseMove(state, params.difficulty);
  if (cell === null) return;
  const result = makeMove(state, cell);
  if (!result.ok) return;

  hintEl.textContent = '';
  state = result.state;
  updateStatus();
  beginMarkAnim(cell);
  draw();
  const playingAfterMove = state.status === 'playing';
  finishGameIfNeeded();
  if (playingAfterMove) playSfx('move');
  syncTimerWithTurn();
}

function showScreen(id: ScreenId): void {
  stopTimerLoop();
  clearAnims();
  for (const screen of screens) screen.hidden = screen.id !== id;
  resultOverlay.hidden = true;
  if (id === 'screen-game') {
    syncCanvasSize();
    if (audioSettings.music) playMusic(music);
  } else {
    stopMusic(music);
  }
}

let achievementQueue: AchievementDef[] = [];

/**
 * Показывает следующую карточку из очереди полученных достижений.
 * Скрытие+показ перезапускает CSS-анимацию на каждой карточке (нужен reflow).
 */
function showNextAchievement(): void {
  const next = achievementQueue.shift();
  if (next == null) {
    achievementOverlay.hidden = true;
    // GDD §10.2: отсчёт возобновляется только после закрытия последней карточки наград
    // и только если игрок всё ещё в игре (иначе — фантомный отсчёт после ухода в меню)
    if (state.status === 'playing' && !gameScreenEl.hidden) ensureTimerLoop();
    return;
  }
  achievementOverlay.hidden = true;
  achievementIconEl.textContent = next.icon;
  achievementTitleEl.textContent = next.title;
  achievementDescEl.textContent = next.description;
  achievementGainEl.textContent = `+${next.score} очков · всего ${achievementScore(unlocked)}`;
  void achievementOverlay.offsetWidth;
  achievementOverlay.hidden = false;
  // GDD §10.2: пока показана карточка награда, отсчёт таймера не идёт
  stopTimerLoop();
  playSfx('achievement');
  // Фокус на кнопку закрытия для клавиатурной навигации
  achievementCloseBtn.focus();
}

achievementCloseBtn.addEventListener('click', showNextAchievement);

let achievementDelay: number | null = null;

/**
 * Карточки полученных достижений показываются с короткой паузой:
 * не перекрывают плашку результата и не накладываются на её звук.
 */
function scheduleAchievementCards(): void {
  if (achievementQueue.length === 0) return;
  if (achievementDelay !== null) window.clearTimeout(achievementDelay);
  achievementDelay = window.setTimeout(() => {
    achievementDelay = null;
    showNextAchievement();
  }, 650);
}

function turnTimerTick(): void {
  const now = Date.now();
  const result = advanceTimer(timer, now - lastTickAt);
  lastTickAt = now;
  timer = result.timer;
  renderTurnTimer();
  if (result.timedOut) onTimerTimeout();
}

/** Запускает интервал отсчёта (идемпотентно); при «без таймера» — не запускает. */
function ensureTimerLoop(): void {
  if (params.timer === 0 || timerLoop !== null) return;
  lastTickAt = Date.now();
  timerLoop = window.setInterval(turnTimerTick, 100);
}

function stopTimerLoop(): void {
  if (timerLoop === null) return;
  window.clearInterval(timerLoop);
  timerLoop = null;
}

function renderTurnTimer(): void {
  // страховка: после конца партии отсчёт не показывается даже если состояние не успели остановить
  const counting = params.timer > 0 && timer.running && state.status === 'playing';
  if (!counting) {
    timerEl.hidden = true;
    timerEl.classList.remove('urgent');
    return;
  }
  const secs = Math.ceil(timer.remainingMs / 1000);
  timerEl.hidden = false;
  timerEl.textContent = String(secs);
  timerEl.classList.toggle('urgent', secs <= 2);
  if (secs !== lastShownSecs) {
    // сигнал таймера — на последних трёх секундах отсчёта, при каждом новом отсчёте
    if (secs <= 3 && secs >= 1 && secs < lastShownSecs) playSfx('tick');
    lastShownSecs = secs;
  }
}

/** Отсчёт идёт только на ходе человека в живой партие; каждый новый ход — полный лимит. */
function syncTimerWithTurn(): void {
  timer = state.status === 'playing' && !isAiTurn() ? restartTimer(timer) : stopTimer(timer);
  renderTurnTimer();
}

function onTimerTimeout(): void {
  if (state.status !== 'playing' || isAiTurn()) return;
  endedByTimeout = true;
  state = timeoutGame(state);
  updateStatus();
  draw();
  finishGameIfNeeded();
  syncTimerWithTurn();
}

function beginMarkAnim(cell: number): void {
  markAnim = { cell, start: performance.now() };
  runAnim();
}

function beginWinAnim(): void {
  winAnim = { start: performance.now() };
  runAnim();
}

function clearAnims(): void {
  markAnim = null;
  winAnim = null;
  if (animRaf !== null) {
    cancelAnimationFrame(animRaf);
    animRaf = null;
  }
}

function runAnim(): void {
  if (animRaf === null) animRaf = requestAnimationFrame(stepAnim);
}

function stepAnim(now: number): void {
  animRaf = null;
  if (markAnim !== null && now - markAnim.start >= MARK_ANIM_MS) markAnim = null;
  if (winAnim !== null && now - winAnim.start >= WIN_ANIM_MS) winAnim = null;
  draw();
  if (markAnim !== null || winAnim !== null) animRaf = requestAnimationFrame(stepAnim);
}

function draw(): void {
  const now = performance.now();
  drawBoard(ctx, state, {
    size: boardSize,
    hoverCell,
    markAnim:
      markAnim === null
        ? null
        : { cell: markAnim.cell, progress: (now - markAnim.start) / MARK_ANIM_MS },
    winProgress: winAnim === null ? undefined : (now - winAnim.start) / WIN_ANIM_MS,
  });
}

/** Синхронизация внутреннего размера canvas с CSS-размером и devicePixelRatio. */
function syncCanvasSize(): void {
  // bitmap canvas соответствует content-box, а не border-box
  const cssSize = canvas.clientWidth;
  if (cssSize <= 0) return;
  boardSize = cssSize;

  const dpr = window.devicePixelRatio || 1;
  const px = Math.max(1, Math.round(boardSize * dpr));
  if (canvas.width !== px || canvas.height !== px) {
    canvas.width = px;
    canvas.height = px;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function updateStatus(): void {
  if (state.status === 'playing') {
    if (isAiTurn()) {
      statusEl.textContent = 'Ход AI…';
      statusEl.dataset.player = aiSide();
    } else {
      statusEl.textContent = `Ход: ${state.currentPlayer}`;
      statusEl.dataset.player = state.currentPlayer;
    }
  } else if (state.status === 'win') {
    statusEl.textContent = params.mode === 'pve' && state.winner === aiSide()
      ? 'Победа AI!'
      : `Победа: ${state.winner}!`;
    statusEl.dataset.player = state.winner ?? '';
  } else {
    statusEl.textContent = 'Ничья';
    statusEl.dataset.player = '';
  }
  // мягкий импульс при каждой смене статуса
  statusEl.classList.remove('status-pulse');
  void statusEl.offsetWidth;
  statusEl.classList.add('status-pulse');
}

/** Номер партии: с ничьими серия может выйти за пределы классического «из N». */
function gameNumberLabel(): string {
  const next = series.gamesPlayed + 1;
  const maxGames = 2 * targetWins(series.format) - 1;
  return next <= maxGames ? `Партия ${next} из ${maxGames}` : `Партия ${next}`;
}

/** Счёт для подписей: в PvE стороны — это Вы и AI. */
function scoreLabel(): string {
  const { X, O } = series.score;
  if (params.mode !== 'pve') return `X ${X} — ${O} O`;
  const mine = params.side === 'X' ? X : O;
  const theirs = params.side === 'X' ? O : X;
  return `Вы ${mine} — ${theirs} AI`;
}

function updateSeriesInfo(): void {
  if (series.format === 'single') {
    seriesInfoEl.hidden = true;
    return;
  }
  seriesInfoEl.hidden = false;
  seriesInfoEl.textContent = `${gameNumberLabel()} · ${scoreLabel()}`;
}

function startGame(): void {
  state = createGame(series.firstPlayer);
  hoverCell = null;
  hintEl.textContent = '';
  endedByTimeout = false;
  timer = createTurnTimer(params.timer);
  updateStatus();
  updateSeriesInfo();
  showScreen('screen-game');
  ensureTimerLoop();
  syncTimerWithTurn();
  if (isAiTurn()) scheduleAiMove();
}

function showResult(): void {
  let title: string;
  if (state.status === 'win') {
    title =
      params.mode === 'pve'
        ? state.winner === params.side
          ? 'Победа!'
          : 'Победа AI!'
        : `Победа ${state.winner}!`;
  } else {
    title = 'Ничья';
  }
  resultTitleEl.textContent = endedByTimeout ? `Время вышло! ${title}` : title;

  if (series.format === 'single') {
    resultSubEl.hidden = true;
  } else {
    resultSubEl.hidden = false;
    const score = scoreLabel();
    resultSubEl.textContent = series.finished
      ? `Серия за ${series.winner}! Счёт: ${score}`
      : `${gameNumberLabel()} · Счёт: ${score}`;
  }

  resultNextBtn.textContent = !series.finished
    ? 'Следующая партия'
    : series.format === 'single'
      ? 'Новая партия'
      : 'Новая серия';

  // счёт над полем обновляем после записи результата: с плашкой поле остаётся видно
  updateSeriesInfo();
  resultOverlay.hidden = false;
  // Фокус на первый интерактивный элемент плашки для клавиатурной навигации
  resultNextBtn.focus();
}

function finishGameIfNeeded(): void {
  if (state.status === 'playing') return;
  series = recordGameResult(series, state.winner);
  stats = recordGame(stats, {
    mode: params.mode,
    winner: state.winner,
    side: params.side,
    difficulty: params.difficulty,
  });
  saveStats(stats);

  // оценка по статистике с уже записанной партией + фактам последней партии
  const fresh = newlyUnlocked(unlocked, {
    stats,
    lastGame: {
      playerWon:
        params.mode === 'pvp' ? state.winner !== null : state.winner === params.side,
      timerEnabled: params.timer > 0,
      moves: state.board.filter((cell) => cell !== null).length,
    },
  });
  if (fresh.length > 0) {
    unlocked = [...unlocked, ...fresh];
    saveAchievements(unlocked);
    for (const id of fresh) {
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (def != null) achievementQueue.push(def);
    }
  }

  showResult();
  if (state.winningLine !== null) {
    beginWinAnim();
    // перерисовать сразу с прогрессом 0: полная линия не должна мелькнуть до анимации
    draw();
  }
  playSfx(
    outcomeSfx({
      mode: params.mode,
      winner: state.winner,
      side: params.side,
      timedOut: endedByTimeout,
    }),
  );
  scheduleAchievementCards();
}

/** Заполнение экрана статистики: значения — только числа из проверенного Stats. */
function renderStats(): void {
  const rows = (['easy', 'medium', 'hard', 'impossible'] as const)
    .map((level) => {
      const s = stats.byDifficulty[level];
      const name = level[0].toUpperCase() + level.slice(1);
      return `<tr><th>${name}</th><td>${s.wins}</td><td>${s.losses}</td><td>${s.draws}</td></tr>`;
    })
    .join('');
  statsBodyEl.innerHTML = `
    <p class="stat-line">Всего партий: <b>${stats.totalGames}</b></p>
    <p class="stat-line">Победы: <b>${stats.wins}</b> · Поражения: <b>${stats.losses}</b> · Ничьи: <b>${stats.draws}</b></p>
    <p class="stat-line">Серия побед: текущая <b>${stats.winStreak}</b> · лучшая <b>${stats.bestWinStreak}</b></p>
    <h3>PvP</h3>
    <p class="stat-line">X: <b>${stats.pvp.xWins}</b> · O: <b>${stats.pvp.oWins}</b> · Ничьих: <b>${stats.pvp.draws}</b></p>
    <h3>PvE (против AI)</h3>
    <p class="stat-line">Победы: <b>${stats.pve.wins}</b> · Поражения: <b>${stats.pve.losses}</b> · Ничьи: <b>${stats.pve.draws}</b></p>
    <table class="stat-table">
      <thead><tr><th>Сложность</th><th>Победы</th><th>Поражения</th><th>Ничьи</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/** Заполнение экрана достижений: список из конфига + Score и прогресс разблокировки. */
function renderAchievements(): void {
  const score = achievementScore(unlocked);
  const owned = new Set(unlocked);
  const items = ACHIEVEMENTS.map((a) => {
    const got = owned.has(a.id);
    return `<li class="achv-item${got ? ' unlocked' : ''}">
      <span class="achv-icon" aria-hidden="true">${got ? a.icon : '🔒'}</span>
      <span class="achv-text"><b>${a.title}</b><br /><span>${a.description}</span></span>
      <span class="achv-score">+${a.score}</span>
    </li>`;
  }).join('');

  const next = COSMETIC_UNLOCKS.find((c) => score < c.requiredScore);
  const gained = unlockedCosmetics(score);
  const progress = next == null
    ? `Разблокировано: ${gained.map((c) => `«${c.title}»`).join(', ')}`
    : `До «${next.title}»: <b>${next.requiredScore - score}</b> очков`;

  achvBodyEl.innerHTML = `
    <p class="stat-line">Achievement Score: <b>${score}</b> · Достижений: <b>${owned.size}</b> из ${ACHIEVEMENTS.length}</p>
    <p class="stat-line achv-progress">${progress}</p>
    <ul class="achv-list">${items}</ul>
  `;
}

function cellFromEvent(e: PointerEvent): number | null {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - canvas.clientLeft;
  const y = e.clientY - rect.top - canvas.clientTop;
  return cellAtPoint(x, y, canvas.clientWidth);
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (isAiTurn()) {
    hintEl.textContent = 'Сейчас ходит AI';
    playSfx('error');
    return;
  }
  const cell = cellFromEvent(e);
  if (cell === null) return;

  const result = makeMove(state, cell);
  if (!result.ok) {
    hintEl.textContent = HINTS[result.reason];
    playSfx('error');
    return;
  }

  hintEl.textContent = '';
  state = result.state;
  updateStatus();
  beginMarkAnim(cell);
  draw();
  const playingAfterMove = state.status === 'playing';
  finishGameIfNeeded();
  // финальный ход без отдельного «щелчка» — его подменяет звук результата
  if (playingAfterMove) playSfx('move');
  syncTimerWithTurn();
  if (isAiTurn()) scheduleAiMove();
});

// Подсветка клетки — только для мыши: на тач-устройствах hover не имеет смысла.
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const next = cellFromEvent(e);
  if (next === hoverCell) return;
  hoverCell = next;
  draw();
});

canvas.addEventListener('pointerleave', () => {
  if (hoverCell === null) return;
  hoverCell = null;
  draw();
});

/** Клавиатурная навигация по клеткам (Tab фокусирует canvas, стрелки перемещают, Enter/Space ставит фигуру) */
canvas.addEventListener('keydown', (e) => {
  if (state.status !== 'playing' || isAiTurn()) return;

  let nextCell = keyboardCell;

  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault();
      if (nextCell === null) nextCell = 6; // начинаем с нижнего ряда
      else if (nextCell >= 3) nextCell -= 3;
      break;
    case 'ArrowDown':
      e.preventDefault();
      if (nextCell === null) nextCell = 2; // начинаем с верхнего ряда
      else if (nextCell <= 5) nextCell += 3;
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (nextCell === null) nextCell = 2; // начинаем с правого столбца
      else if (nextCell % 3 !== 0) nextCell -= 1;
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (nextCell === null) nextCell = 0; // начинаем с левого столбца
      else if (nextCell % 3 !== 2) nextCell += 1;
      break;
    case 'Home':
      e.preventDefault();
      nextCell = 0;
      break;
    case 'End':
      e.preventDefault();
      nextCell = 8;
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      if (nextCell !== null && !isAiTurn() && state.status === 'playing') {
        const result = makeMove(state, nextCell);
        if (result.ok) {
          hintEl.textContent = '';
          state = result.state;
          updateStatus();
          beginMarkAnim(nextCell);
          draw();
          const playingAfterMove = state.status === 'playing';
          finishGameIfNeeded();
          if (playingAfterMove) playSfx('move');
          syncTimerWithTurn();
          if (isAiTurn()) scheduleAiMove();
        } else {
          hintEl.textContent = HINTS[result.reason];
          playSfx('error');
        }
      }
      return;
  }

  if (nextCell !== keyboardCell) {
    keyboardCell = nextCell;
    hoverCell = nextCell; // переиспользуем hover для визуальной подсветки
    draw();
  }
});

canvas.addEventListener('blur', () => {
  keyboardCell = null;
  if (hoverCell !== null) {
    hoverCell = null;
    draw();
  }
});

/** Глобальный ESC — закрывает открытые оверлеи (результат, достижения) из любой точки */
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!resultOverlay.hidden) {
    resultMenuBtn.click();
  } else if (!achievementOverlay.hidden) {
    achievementCloseBtn.click();
  }
});

window.addEventListener('resize', syncCanvasSize);

function setRadio(name: string, value: string): void {
  const input = document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
  if (input != null) input.checked = true;
}

/** Восстановление сохранённых настроек в форме параметров при запуске. */
function applySettingsToForm(settings: UserSettings): void {
  setRadio('side', settings.side);
  setRadio('difficulty', settings.difficulty);
  setRadio('format', settings.format);
  setRadio('starter', settings.starter);
  setRadio('timer', String(settings.timer));
}

menuPvpBtn.addEventListener('click', () => {
  params.mode = 'pvp';
  aiDifficultyFieldset.hidden = true;
  pveSideFieldset.hidden = true;
  showScreen('screen-setup');
});

menuPveBtn.addEventListener('click', () => {
  params.mode = 'pve';
  aiDifficultyFieldset.hidden = false;
  pveSideFieldset.hidden = false;
  showScreen('screen-setup');
});

setupBackBtn.addEventListener('click', () => showScreen('screen-menu'));

menuAchvBtn.addEventListener('click', () => {
  renderAchievements();
  showScreen('screen-achievements');
});

achvBackBtn.addEventListener('click', () => showScreen('screen-menu'));

menuStatsBtn.addEventListener('click', () => {
  renderStats();
  showScreen('screen-stats');
});

statsBackBtn.addEventListener('click', () => showScreen('screen-menu'));

menuSettingsBtn.addEventListener('click', () => showScreen('screen-settings'));

settingsBackBtn.addEventListener('click', () => showScreen('screen-menu'));

sfxToggle.addEventListener('change', () => {
  audioSettings.sfx = sfxToggle.checked;
  setSfxEnabled(audioSettings.sfx);
  saveAudioSettings(audioSettings);
  if (audioSettings.sfx) playSfx('tick'); // слышимый отклик сразу при включении
});

musicToggle.addEventListener('change', () => {
  audioSettings.music = musicToggle.checked;
  setMusicEnabled(music, audioSettings.music);
  saveAudioSettings(audioSettings);
  if (audioSettings.music) playMusic(music); // сразу играем, если находимся на игровом экране
});

setupStartBtn.addEventListener('click', () => {
  const format = must(
    document.querySelector<HTMLInputElement>('input[name="format"]:checked'),
    'Формат не выбран',
  ).value;
  const starter = must(
    document.querySelector<HTMLInputElement>('input[name="starter"]:checked'),
    'Первый игрок не выбран',
  ).value;
  const difficulty = must(
    document.querySelector<HTMLInputElement>('input[name="difficulty"]:checked'),
    'Сложность не выбрана',
  ).value;
  const side = must(
    document.querySelector<HTMLInputElement>('input[name="side"]:checked'),
    'Сторона игрока не выбрана',
  ).value;
  const timerValue = must(
    document.querySelector<HTMLInputElement>('input[name="timer"]:checked'),
    'Режим таймера не выбран',
  ).value;

  params = {
    mode: params.mode,
    side: side === 'O' ? 'O' : 'X',
    difficulty: difficulty === 'easy' || difficulty === 'hard' || difficulty === 'impossible'
      ? difficulty
      : 'medium',
    format: format === 'bestOf3' || format === 'bestOf5' ? format : 'single',
    starter: starter === 'O' ? 'O' : 'X',
    timer: timerValue === '5' ? 5 : timerValue === '10' ? 10 : timerValue === '30' ? 30 : 0,
  };
  series = createSeries(params.format, params.starter);
  saveSettings(params);
  startGame();
});

restartBtn.addEventListener('click', () => {
  state = createGame(series.firstPlayer);
  hoverCell = null;
  hintEl.textContent = '';
  endedByTimeout = false;
  resultOverlay.hidden = true;
  clearAnims();
  updateStatus();
  draw();
  ensureTimerLoop();
  syncTimerWithTurn();
  if (isAiTurn()) scheduleAiMove();
});

toMenuBtn.addEventListener('click', () => showScreen('screen-menu'));
resultMenuBtn.addEventListener('click', () => showScreen('screen-menu'));

resultNextBtn.addEventListener('click', () => {
  if (!series.finished) {
    startGame();
    return;
  }
  series = createSeries(params.format, params.starter);
  startGame();
});

setSfxEnabled(audioSettings.sfx);
sfxToggle.checked = audioSettings.sfx;
setMusicEnabled(music, audioSettings.music);
musicToggle.checked = audioSettings.music;
initSfx();
applySettingsToForm(savedSettings);
showScreen('screen-menu');
