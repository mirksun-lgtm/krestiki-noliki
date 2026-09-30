import './style.css';
import { createGame, makeMove, type GameState, type Player } from './game/gameCore';

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

const CELL = canvas.width / 3;

const HINTS: Record<'finished' | 'outOfRange' | 'occupied', string> = {
  finished: 'Партия уже окончена — начните новую',
  outOfRange: 'Ход вне поля',
  occupied: 'Клетка занята',
};

let firstPlayer: Player = 'X';
let state: GameState;

function draw(): void {
  ctx.fillStyle = '#f2ebe0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#8a7f6d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 1; i < 3; i++) {
    ctx.moveTo(i * CELL, 0);
    ctx.lineTo(i * CELL, canvas.height);
    ctx.moveTo(0, i * CELL);
    ctx.lineTo(canvas.width, i * CELL);
  }
  ctx.stroke();

  ctx.strokeStyle = '#4a4235';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let index = 0; index < 9; index++) {
    const mark = state.board[index];
    if (!mark) continue;
    const cx = (index % 3) * CELL + CELL / 2;
    const cy = Math.floor(index / 3) * CELL + CELL / 2;
    const half = CELL * 0.22;
    ctx.beginPath();
    if (mark === 'X') {
      ctx.moveTo(cx - half, cy - half);
      ctx.lineTo(cx + half, cy + half);
      ctx.moveTo(cx + half, cy - half);
      ctx.lineTo(cx - half, cy + half);
    } else {
      ctx.arc(cx, cy, half, 0, Math.PI * 2);
    }
    ctx.stroke();
  }
}

function updateStatus(): void {
  if (state.status === 'playing') {
    statusEl.textContent = `Ход: ${state.currentPlayer}`;
  } else if (state.status === 'win') {
    statusEl.textContent = `Победа: ${state.winner}!`;
  } else {
    statusEl.textContent = 'Ничья';
  }
}

function newGame(player: Player): void {
  firstPlayer = player;
  state = createGame(player);
  hintEl.textContent = '';
  draw();
  updateStatus();
}

function cellFromPointer(e: PointerEvent): number | null {
  const rect = canvas.getBoundingClientRect();
  const col = Math.floor((e.clientX - rect.left) / (rect.width / 3));
  const row = Math.floor((e.clientY - rect.top) / (rect.height / 3));
  if (col < 0 || col > 2 || row < 0 || row > 2) return null;
  return row * 3 + col;
}

canvas.addEventListener('pointerdown', (e) => {
  const cell = cellFromPointer(e);
  if (cell === null) return;

  const result = makeMove(state, cell);
  if (!result.ok) {
    hintEl.textContent = HINTS[result.reason];
    return;
  }

  hintEl.textContent = '';
  state = result.state;
  draw();
  updateStatus();
});

startXBtn.addEventListener('click', () => newGame('X'));
startOBtn.addEventListener('click', () => newGame('O'));
restartBtn.addEventListener('click', () => newGame(firstPlayer));

newGame('X');
