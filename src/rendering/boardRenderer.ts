import type { GameState } from '../game/gameCore';

/** Визуальные параметры одного кадра поля. */
export interface BoardView {
  /** Сторона поля в CSS-пикселях. */
  size: number;
  /** Клетка под курсором мыши (null — нет). */
  hoverCell: number | null;
}

/**
 * Клетка под точкой поля. x/y — координаты относительно левого верхнего угла,
 * boardSize — сторона квадратного поля в CSS-пикселях. Вне поля — null.
 */
export function cellAtPoint(x: number, y: number, boardSize: number): number | null {
  const col = Math.floor(x / (boardSize / 3));
  const row = Math.floor(y / (boardSize / 3));
  if (col < 0 || col > 2 || row < 0 || row > 2) return null;
  return row * 3 + col;
}

/** Центр клетки в координатах поля. */
export function cellCenter(index: number, boardSize: number): { x: number; y: number } {
  const cell = boardSize / 3;
  return {
    x: (index % 3) * cell + cell / 2,
    y: Math.floor(index / 3) * cell + cell / 2,
  };
}

/** Концы отрезка через центры клеток победной линии (первая → последняя). */
export function winningLinePoints(
  line: number[],
  boardSize: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const first = cellCenter(line[0], boardSize);
  const last = cellCenter(line[line.length - 1], boardSize);
  return { x1: first.x, y1: first.y, x2: last.x, y2: last.y };
}

const COLORS = {
  background: '#f2ebe0',
  grid: '#8a7f6d',
  marks: '#4a4235',
  hover: 'rgba(74, 66, 53, 0.08)',
  winLine: '#b5561f',
} as const;

/**
 * Отрисовка поля. Контекст должен быть переведён в CSS-пиксели
 * (setTransform(dpr, 0, 0, dpr, 0, 0)) — функция работает в координатах поля.
 */
export function drawBoard(ctx: CanvasRenderingContext2D, state: GameState, view: BoardView): void {
  const { size } = view;
  const cell = size / 3;

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, size, size);

  if (
    view.hoverCell !== null &&
    state.status === 'playing' &&
    state.board[view.hoverCell] === null
  ) {
    const col = view.hoverCell % 3;
    const row = Math.floor(view.hoverCell / 3);
    ctx.fillStyle = COLORS.hover;
    ctx.fillRect(col * cell, row * cell, cell, cell);
  }

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = Math.max(2, size / 120);
  ctx.beginPath();
  for (let i = 1; i < 3; i++) {
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, size);
    ctx.moveTo(0, i * cell);
    ctx.lineTo(size, i * cell);
  }
  ctx.stroke();

  ctx.strokeStyle = COLORS.marks;
  ctx.lineWidth = Math.max(3, size / 60);
  ctx.lineCap = 'round';
  const half = cell * 0.22;
  for (let index = 0; index < 9; index++) {
    const mark = state.board[index];
    if (!mark) continue;
    const { x: cx, y: cy } = cellCenter(index, size);
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

  if (state.winningLine) {
    const { x1, y1, x2, y2 } = winningLinePoints(state.winningLine, size);
    ctx.strokeStyle = COLORS.winLine;
    ctx.lineWidth = Math.max(4, size / 40);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}
