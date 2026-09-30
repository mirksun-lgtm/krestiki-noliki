import { describe, expect, it } from 'vitest';
import { cellAtPoint, cellCenter, winningLinePoints } from './boardRenderer';

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
