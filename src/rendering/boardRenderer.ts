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
  backgroundTop: '#ddbf96',
  backgroundBottom: '#c9a675',
  grain: 'rgba(122, 84, 46, 0.14)',
  grid: '#8a5a2f',
  marksX: '#3f6590',
  marksO: '#b8622e',
  hover: 'rgba(255, 247, 224, 0.38)',
  winGlow: 'rgba(217, 131, 36, 0.35)',
  winLine: '#d98324',
} as const;

/** Фиксированные «полосы» древесного рисунка (детерминированные — без случайности каждый кадр). */
const GRAIN_LINES = [0.1, 0.24, 0.37, 0.53, 0.68, 0.82, 0.93] as const;

/** Тип знака. */
type Mark = 'X' | 'O';

/** Один штрих знака: кривая Безье (X) или дуга кольца (O). */
export type MarkStroke =
  | { kind: 'quadratic'; x1: number; y1: number; cx: number; cy: number; x2: number; y2: number }
  | { kind: 'arc'; cx: number; cy: number; r: number; from: number; to: number };

/**
 * Геометрия стилизованного знака в точке (cx, cy) поля стороной size.
 * X — два мягко изогнутых штриха (рисунок «от руки»), O — кольцо полного круга.
 */
export function markStrokes(mark: Mark, cx: number, cy: number, size: number): MarkStroke[] {
  // half-cell * 0.52: знак занимает ~52% клетки и не касается линий сетки
  const h = (size / 3) * 0.26;
  if (mark === 'X') {
    // изгиб перпендикулярен направлению штриха; оба штриха — с одинаковым поворотом
    const q = (h * 0.16) / Math.SQRT2;
    return [
      { kind: 'quadratic', x1: cx - h, y1: cy - h, cx: cx - q, cy: cy + q, x2: cx + h, y2: cy + h },
      { kind: 'quadratic', x1: cx + h, y1: cy - h, cx: cx - q, cy: cy - q, x2: cx - h, y2: cy + h },
    ];
  }
  const from = -Math.PI / 2;
  return [{ kind: 'arc', cx, cy, r: h, from, to: from + Math.PI * 2 }];
}

/**
 * Отрисовка поля. Контекст должен быть переведён в CSS-пиксели
 * (setTransform(dpr, 0, 0, dpr, 0, 0)) — функция работает в координатах поля.
 */
export function drawBoard(ctx: CanvasRenderingContext2D, state: GameState, view: BoardView): void {
  const { size } = view;
  const cell = size / 3;

  // деревянная поверхность: тёплый вертикальный градиент
  const wood = ctx.createLinearGradient(0, 0, 0, size);
  wood.addColorStop(0, COLORS.backgroundTop);
  wood.addColorStop(1, COLORS.backgroundBottom);
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, size, size);

  // древесный рисунок: волнистые горизонтальные полосы с фиксированными параметрами
  ctx.strokeStyle = COLORS.grain;
  ctx.lineWidth = Math.max(1, size / 240);
  for (const gy of GRAIN_LINES) {
    const y0 = gy * size;
    const amp = size * 0.012;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(size * 0.25, y0 + amp, size * 0.5, y0);
    ctx.quadraticCurveTo(size * 0.75, y0 - amp, size, y0);
    ctx.stroke();
  }

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

  // «выжженные» разделители
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = Math.max(2, size / 140);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 1; i < 3; i++) {
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, size);
    ctx.moveTo(0, i * cell);
    ctx.lineTo(size, i * cell);
  }
  ctx.stroke();

  ctx.lineWidth = Math.max(3, size / 55);
  for (let index = 0; index < 9; index++) {
    const mark = state.board[index];
    if (!mark) continue;
    const { x: cx, y: cy } = cellCenter(index, size);
    ctx.strokeStyle = mark === 'X' ? COLORS.marksX : COLORS.marksO;
    ctx.beginPath();
    for (const stroke of markStrokes(mark, cx, cy, size)) {
      if (stroke.kind === 'quadratic') {
        ctx.moveTo(stroke.x1, stroke.y1);
        ctx.quadraticCurveTo(stroke.cx, stroke.cy, stroke.x2, stroke.y2);
      } else {
        ctx.arc(stroke.cx, stroke.cy, stroke.r, stroke.from, stroke.to);
      }
    }
    ctx.stroke();
  }

  if (state.winningLine) {
    const { x1, y1, x2, y2 } = winningLinePoints(state.winningLine, size);
    ctx.lineCap = 'round';
    // мягкое свечение + ядро линии
    ctx.strokeStyle = COLORS.winGlow;
    ctx.lineWidth = Math.max(8, size / 20);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = COLORS.winLine;
    ctx.lineWidth = Math.max(4, size / 40);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}
