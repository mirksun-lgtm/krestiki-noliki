import './style.css';
import { createGame, makeMove, type GameState, type Player } from './game/gameCore';
import { createSeries, recordGameResult, targetWins, type SeriesFormat, type SeriesState } from './game/series';
import { cellAtPoint, drawBoard } from './rendering/boardRenderer';

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
const setupBackBtn = element<HTMLButtonElement>('setup-back');
const setupStartBtn = element<HTMLButtonElement>('setup-start');
const seriesInfoEl = element<HTMLElement>('series-info');
const statusEl = element<HTMLElement>('status');
const hintEl = element<HTMLElement>('hint');
const restartBtn = element<HTMLButtonElement>('restart');
const toMenuBtn = element<HTMLButtonElement>('to-menu');
const resultTitleEl = element<HTMLElement>('result-title');
const resultSubEl = element<HTMLElement>('result-sub');
const resultMenuBtn = element<HTMLButtonElement>('result-menu');
const resultNextBtn = element<HTMLButtonElement>('result-next');

const canvas = element<HTMLCanvasElement>('game-canvas');
const ctx = must(canvas.getContext('2d'), '2D-контекст недоступен');

type ScreenId = 'screen-menu' | 'screen-setup' | 'screen-game' | 'screen-result';

const HINTS: Record<'finished' | 'outOfRange' | 'occupied', string> = {
  finished: 'Партия уже окончена — начните новую',
  outOfRange: 'Ход вне поля',
  occupied: 'Клетка занята',
};

let params: { format: SeriesFormat; starter: Player } = { format: 'single', starter: 'X' };
let series: SeriesState = createSeries('single', 'X');
let state: GameState = createGame('X');
let hoverCell: number | null = null;
/** Сторона поля в CSS-пикселях, обновляется при resize. */
let boardSize = 360;

function showScreen(id: ScreenId): void {
  for (const screen of screens) screen.hidden = screen.id !== id;
  if (id === 'screen-game') syncCanvasSize();
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
    statusEl.textContent = `Ход: ${state.currentPlayer}`;
    statusEl.dataset.player = state.currentPlayer;
  } else if (state.status === 'win') {
    statusEl.textContent = `Победа: ${state.winner}!`;
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

function updateSeriesInfo(): void {
  if (series.format === 'single') {
    seriesInfoEl.hidden = true;
    return;
  }
  seriesInfoEl.hidden = false;
  seriesInfoEl.textContent = `${gameNumberLabel()} · X ${series.score.X} — ${series.score.O} O`;
}

function startGame(): void {
  state = createGame(series.firstPlayer);
  hoverCell = null;
  hintEl.textContent = '';
  updateStatus();
  updateSeriesInfo();
  showScreen('screen-game');
}

function showResult(): void {
  resultTitleEl.textContent = state.status === 'win' ? `Победа ${state.winner}!` : 'Ничья';

  if (series.format === 'single') {
    resultSubEl.hidden = true;
  } else {
    resultSubEl.hidden = false;
    const score = `X ${series.score.X} — ${series.score.O} O`;
    resultSubEl.textContent = series.finished
      ? `Серия за ${series.winner}! Счёт: ${score}`
      : `${gameNumberLabel()} · Счёт: ${score}`;
  }

  resultNextBtn.textContent = !series.finished
    ? 'Следующая партия'
    : series.format === 'single'
      ? 'Новая партия'
      : 'Новая серия';

  showScreen('screen-result');
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

menuPvpBtn.addEventListener('click', () => showScreen('screen-setup'));
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

  params = {
    format: format === 'bestOf3' || format === 'bestOf5' ? format : 'single',
    starter: starter === 'O' ? 'O' : 'X',
  };
  series = createSeries(params.format, params.starter);
  startGame();
});

restartBtn.addEventListener('click', () => {
  state = createGame(series.firstPlayer);
  hoverCell = null;
  hintEl.textContent = '';
  updateStatus();
  draw();
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
