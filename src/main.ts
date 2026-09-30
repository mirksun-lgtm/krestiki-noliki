import './style.css';
import { createGame, makeMove, type GameState, type Player } from './game/gameCore';
import { cellAtPoint, drawBoard } from './rendering/boardRenderer';

function must<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message);
  return value;
}

const canvas = must(
  document.querySelector<HTMLCanvasElement>('#game-canvas'),
  'Canvas #game-canvas не найден',
);
const ctx = must(canvas.getContext('2d'), '2D-контекст недоступен');

const statusEl = must(document.querySelector<HTMLElement>('#status'), 'Элемент #status не найден');
const hintEl = must(document.querySelector<HTMLElement>('#hint'), 'Элемент #hint не найден');
const startXBtn = must(
  document.querySelector<HTMLButtonElement>('#start-x'),
  'Кнопка #start-x не найдена',
);
const startOBtn = must(
  document.querySelector<HTMLButtonElement>('#start-o'),
  'Кнопка #start-o не найдена',
);
const restartBtn = must(
  document.querySelector<HTMLButtonElement>('#restart'),
  'Кнопка #restart не найдена',
);

const HINTS: Record<'finished' | 'outOfRange' | 'occupied', string> = {
  finished: 'Партия уже окончена — начните новую',
  outOfRange: 'Ход вне поля',
  occupied: 'Клетка занята',
};

let firstPlayer: Player = 'X';
let state: GameState;
let hoverCell: number | null = null;
/** Сторона поля в CSS-пикселях, обновляется при resize. */
let boardSize = 360;

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

function newGame(player: Player): void {
  firstPlayer = player;
  state = createGame(player);
  hoverCell = null;
  hintEl.textContent = '';
  updateStatus();
  draw();
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

startXBtn.addEventListener('click', () => newGame('X'));
startOBtn.addEventListener('click', () => newGame('O'));
restartBtn.addEventListener('click', () => newGame(firstPlayer));

state = createGame('X');
updateStatus();
syncCanvasSize();
