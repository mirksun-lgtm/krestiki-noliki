import './style.css';
import { createGame, makeMove, timeoutGame, type GameState, type Player } from './game/gameCore';
import { createSeries, recordGameResult, targetWins, type SeriesFormat, type SeriesState } from './game/series';
import {
  advanceTimer,
  createTurnTimer,
  restartTimer,
  stopTimer,
  type TimerPreset,
  type TurnTimer,
} from './game/turnTimer';
import { cellAtPoint, drawBoard } from './rendering/boardRenderer';
import { chooseMove, type Difficulty } from './ai/ai';

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

const canvas = element<HTMLCanvasElement>('game-canvas');
const ctx = must(canvas.getContext('2d'), '2D-контекст недоступен');

type ScreenId = 'screen-menu' | 'screen-setup' | 'screen-game';

const HINTS: Record<'finished' | 'outOfRange' | 'occupied', string> = {
  finished: 'Партия уже окончена — начните новую',
  outOfRange: 'Ход вне поля',
  occupied: 'Клетка занята',
};

let params: {
  mode: 'pvp' | 'pve';
  /** Сторона игрока в PvE; в PvP поле не используется. */
  side: Player;
  difficulty: Difficulty;
  format: SeriesFormat;
  starter: Player;
  timer: TimerPreset;
} = {
  mode: 'pvp',
  side: 'X',
  difficulty: 'medium',
  format: 'single',
  starter: 'X',
  timer: 0,
};
let series: SeriesState = createSeries('single', 'X');
let state: GameState = createGame('X');
let hoverCell: number | null = null;
/** Сторона поля в CSS-пикселях, обновляется при resize. */
let boardSize = 360;

let timer: TurnTimer = createTurnTimer(0);
let timerLoop: number | null = null;
let lastTickAt = 0;
let endedByTimeout = false;

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
  draw();
  finishGameIfNeeded();
  syncTimerWithTurn();
}

function showScreen(id: ScreenId): void {
  stopTimerLoop();
  for (const screen of screens) screen.hidden = screen.id !== id;
  resultOverlay.hidden = true;
  if (id === 'screen-game') syncCanvasSize();
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

function draw(): void {
  drawBoard(ctx, state, { size: boardSize, hoverCell });
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
}

function finishGameIfNeeded(): void {
  if (state.status === 'playing') return;
  series = recordGameResult(series, state.winner);
  showResult();
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
    return;
  }
  const cell = cellFromEvent(e);
  if (cell === null) return;

  const result = makeMove(state, cell);
  if (!result.ok) {
    hintEl.textContent = HINTS[result.reason];
    return;
  }

  hintEl.textContent = '';
  state = result.state;
  updateStatus();
  draw();
  finishGameIfNeeded();
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

window.addEventListener('resize', syncCanvasSize);

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
  startGame();
});

restartBtn.addEventListener('click', () => {
  state = createGame(series.firstPlayer);
  hoverCell = null;
  hintEl.textContent = '';
  endedByTimeout = false;
  resultOverlay.hidden = true;
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

showScreen('screen-menu');
