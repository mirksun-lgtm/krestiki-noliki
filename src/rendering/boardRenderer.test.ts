import { describe, expect, it } from 'vitest';
import {
  appearScale,
  cellAtPoint,
  cellCenter,
  markStrokes,
  winningLinePoints,
  type MarkStroke,
} from './boardRenderer';

// Поле 360×360 → клетка 120×120
const SIZE = 360;
const CELL = SIZE / 3;

describe('cellAtPoint', () => {
  it('центр каждой клетки даёт её индекс', () => {
    for (let index = 0; index < 9; index++) {
      const col = index % 3;
      const row = Math.floor(index / 3);
      expect(cellAtPoint(col * CELL + CELL / 2, row * CELL + CELL / 2, SIZE)).toBe(index);
    }
  });

  it('верхний левый угол поля — клетка 0', () => {
    expect(cellAtPoint(0, 0, SIZE)).toBe(0);
  });

  it('правый нижний угол внутри последней клетки — клетка 8', () => {
    expect(cellAtPoint(SIZE - 1, SIZE - 1, SIZE)).toBe(8);
  });

  it('точка на границе клеток относится к правой/нижней клетке', () => {
    expect(cellAtPoint(CELL, 10, SIZE)).toBe(1);
    expect(cellAtPoint(10, CELL, SIZE)).toBe(3);
  });

  it('координаты вне поля дают null', () => {
    expect(cellAtPoint(-1, 50, SIZE)).toBeNull();
    expect(cellAtPoint(50, -1, SIZE)).toBeNull();
    expect(cellAtPoint(SIZE, 50, SIZE)).toBeNull();
    expect(cellAtPoint(50, SIZE, SIZE)).toBeNull();
    expect(cellAtPoint(SIZE + 10, -10, SIZE)).toBeNull();
  });

  it('работает при другом размере поля', () => {
    expect(cellAtPoint(149, 149, 150)).toBe(8);
    expect(cellAtPoint(75, 25, 150)).toBe(1);
  });
});

describe('cellCenter', () => {
  it('центр клетки 0 — (60, 60)', () => {
    expect(cellCenter(0, SIZE)).toEqual({ x: 60, y: 60 });
  });

  it('центр клетки 4 — (180, 180)', () => {
    expect(cellCenter(4, SIZE)).toEqual({ x: 180, y: 180 });
  });

  it('центр клетки 8 — (300, 300)', () => {
    expect(cellCenter(8, SIZE)).toEqual({ x: 300, y: 300 });
  });
});

describe('winningLinePoints', () => {
  it('горизонталь [0,1,2] — от центра 0 до центра 2', () => {
    expect(winningLinePoints([0, 1, 2], SIZE)).toEqual({ x1: 60, y1: 60, x2: 300, y2: 60 });
  });

  it('вертикаль [0,3,6] — от центра 0 до центра 6', () => {
    expect(winningLinePoints([0, 3, 6], SIZE)).toEqual({ x1: 60, y1: 60, x2: 60, y2: 300 });
  });

  it('диагональ [2,4,6] — от центра 2 до центра 6', () => {
    expect(winningLinePoints([2, 4, 6], SIZE)).toEqual({ x1: 300, y1: 60, x2: 60, y2: 300 });
  });
});

type Curve = Extract<MarkStroke, { kind: 'quadratic' }>;
type Arc = Extract<MarkStroke, { kind: 'arc' }>;

function curves(strokes: MarkStroke[]): Curve[] {
  return strokes.filter((s): s is Curve => s.kind === 'quadratic');
}

function arcs(strokes: MarkStroke[]): Arc[] {
  return strokes.filter((s): s is Arc => s.kind === 'arc');
}

describe('markStrokes', () => {
  it('X — два изогнутых штриха, концы которых симметричны вокруг центра', () => {
    const strokes = curves(markStrokes('X', 180, 180, SIZE));
    expect(strokes).toHaveLength(2);
    for (const c of strokes) {
      expect((c.x1 + c.x2) / 2).toBeCloseTo(180);
      expect((c.y1 + c.y2) / 2).toBeCloseTo(180);
      expect(c.x1).not.toBe(c.x2);
      expect(c.y1).not.toBe(c.y2);
    }
  });

  it('X — штрихи идут по диагоналям: ↘ и ↙', () => {
    const [a, b] = curves(markStrokes('X', 180, 180, SIZE));
    expect(a.x1).toBeLessThan(a.x2);
    expect(a.y1).toBeLessThan(a.y2);
    expect(b.x1).toBeGreaterThan(b.x2);
    expect(b.y1).toBeLessThan(b.y2);
  });

  it('X — штрих изогнут: точка управления не лежит на прямой концов', () => {
    for (const c of curves(markStrokes('X', 180, 180, SIZE))) {
      // расстояние точки управления от прямой через (x1,y1)-(x2,y2)
      const dx = c.x2 - c.x1;
      const dy = c.y2 - c.y1;
      const dist = Math.abs(dy * (c.cx - c.x1) - dx * (c.cy - c.y1)) / Math.hypot(dx, dy);
      expect(dist).toBeGreaterThan(0);
    }
  });

  it('O — одно полное кольцо в центре', () => {
    const [arc, ...rest] = arcs(markStrokes('O', 180, 180, SIZE));
    expect(rest).toHaveLength(0);
    expect(arc.cx).toBeCloseTo(180);
    expect(arc.cy).toBeCloseTo(180);
    expect(arc.r).toBeGreaterThan(0);
    expect(arc.to - arc.from).toBeCloseTo(Math.PI * 2);
  });

  it('знак не вылезает за пределы своей клетки (не касается линий сетки)', () => {
    // клетка = size/3, знак живёт в центре клетки (180,180)
    const halfCell = CELL / 2;
    for (const c of curves(markStrokes('X', 180, 180, SIZE))) {
      const reach = Math.max(
        Math.hypot(c.x1 - 180, c.y1 - 180),
        Math.hypot(c.x2 - 180, c.y2 - 180),
      );
      expect(reach).toBeLessThan(halfCell);
    }
    const [arc] = arcs(markStrokes('O', 180, 180, SIZE));
    expect(arc.r).toBeLessThan(halfCell);
  });

  it('удвоение поля удваивает размер знака', () => {
    const [small] = arcs(markStrokes('O', 100, 100, 150));
    const [big] = arcs(markStrokes('O', 100, 100, 300));
    expect(big.r).toBeCloseTo(small.r * 2);
    const smallX = curves(markStrokes('X', 100, 100, 150));
    const bigX = curves(markStrokes('X', 100, 100, 300));
    const reach = (c: Curve) => Math.hypot(c.x1 - 100, c.y1 - 100);
    expect(reach(bigX[0])).toBeCloseTo(reach(smallX[0]) * 2);
  });
});

describe('appearScale', () => {
  it('прогресс 0 → масштаб 0 (знак не виден)', () => {
    expect(appearScale(0)).toBe(0);
  });

  it('прогресс 1 → масштаб 1 (полный размер)', () => {
    expect(appearScale(1)).toBe(1);
  });

  it('значения вне [0;1] обрезаются', () => {
    expect(appearScale(-0.5)).toBe(0);
    expect(appearScale(1.7)).toBe(1);
  });

  it('ease-out: на середине прогресса масштаб больше половины', () => {
    expect(appearScale(0.5)).toBeGreaterThan(0.5);
  });

  it('монотонно растёт от 0 до 1', () => {
    let previous = -1;
    for (const t of [0, 0.1, 0.3, 0.5, 0.8, 1]) {
      const scale = appearScale(t);
      expect(scale).toBeGreaterThanOrEqual(previous);
      previous = scale;
    }
  });
});
