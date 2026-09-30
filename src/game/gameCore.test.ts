import { describe, expect, it } from 'vitest';
import { createGame, makeMove, type GameState, type Player } from './gameCore';

/** Последовательность ходов (индексы клеток), после которой первый игрок занимает линию. */
const WIN_SEQUENCES: Array<{ line: number[]; moves: number[] }> = [
  { line: [0, 1, 2], moves: [0, 3, 1, 4, 2] },
  { line: [3, 4, 5], moves: [3, 0, 4, 1, 5] },
  { line: [6, 7, 8], moves: [6, 0, 7, 1, 8] },
  { line: [0, 3, 6], moves: [0, 1, 3, 2, 6] },
  { line: [1, 4, 7], moves: [1, 0, 4, 2, 7] },
  { line: [2, 5, 8], moves: [2, 0, 5, 1, 8] },
  { line: [0, 4, 8], moves: [0, 1, 4, 2, 8] },
  { line: [2, 4, 6], moves: [2, 0, 4, 1, 6] },
];

function play(firstPlayer: Player, moves: number[]): GameState {
  let state = createGame(firstPlayer);
  for (const index of moves) {
    const result = makeMove(state, index);
    if (!result.ok) throw new Error(`неожиданно отклонён ход в клетку ${index}`);
    state = result.state;
  }
  return state;
}

describe('createGame', () => {
  it('начинает с пустого поля и статусом playing', () => {
    const state = createGame('X');

    expect(state.board).toEqual(Array(9).fill(null));
    expect(state.status).toBe('playing');
    expect(state.winner).toBeNull();
    expect(state.winningLine).toBeNull();
  });

  it('позволяет выбрать, кто ходит первым — X', () => {
    expect(createGame('X').currentPlayer).toBe('X');
  });

  it('позволяет выбрать, кто ходит первым — O', () => {
    const state = createGame('O');

    expect(state.currentPlayer).toBe('O');
    // первый ход за O: поле всё ещё пустое
    expect(state.board).toEqual(Array(9).fill(null));
  });
});

describe('makeMove', () => {
  it('ставит фигуру текущего игрока в свободную клетку', () => {
    const result = makeMove(createGame('X'), 4);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.board[4]).toBe('X');
  });

  it('переключает ход после каждого хода', () => {
    const first = makeMove(createGame('X'), 0);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.currentPlayer).toBe('O');

    const second = makeMove(first.state, 1);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.board[1]).toBe('O');
    expect(second.state.currentPlayer).toBe('X');
  });

  it('не изменяет исходное состояние (ходы иммутабельны)', () => {
    const start = createGame('X');
    makeMove(start, 0);

    expect(start.board).toEqual(Array(9).fill(null));
    expect(start.currentPlayer).toBe('X');
  });

  it('отклоняет ход в занятую клетку и не меняет состояние', () => {
    const afterX = makeMove(createGame('X'), 4);
    expect(afterX.ok).toBe(true);
    if (!afterX.ok) return;

    const result = makeMove(afterX.state, 4);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('occupied');
    expect(result.state).toBe(afterX.state);
  });

  it('отклоняет ход с индексом вне поля', () => {
    const state = createGame('X');

    for (const badIndex of [-1, 9, 2.5]) {
      const result = makeMove(state, badIndex);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('outOfRange');
      expect(result.state).toBe(state);
    }
  });
});

describe('победа', () => {
  for (const { line, moves } of WIN_SEQUENCES) {
    it(`победа X по линии [${line.join(', ')}]`, () => {
      const state = play('X', moves);

      expect(state.status).toBe('win');
      expect(state.winner).toBe('X');
      expect(state.winningLine).toEqual(line);
    });

    it(`победа O по линии [${line.join(', ')}]`, () => {
      const state = play('O', moves);

      expect(state.status).toBe('win');
      expect(state.winner).toBe('O');
      expect(state.winningLine).toEqual(line);
    });
  }
});

describe('ничья', () => {
  it('поле заполнено без победителя — ничья', () => {
    const state = play('X', [0, 1, 2, 4, 3, 5, 7, 6, 8]);

    expect(state.status).toBe('draw');
    expect(state.winner).toBeNull();
    expect(state.winningLine).toBeNull();
    expect(state.board.every((cell) => cell !== null)).toBe(true);
  });
});

describe('завершённая партия', () => {
  it('после победы дальнейшие ходы отклоняются', () => {
    const finished = play('X', [0, 3, 1, 4, 2]);

    const result = makeMove(finished, 5);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('finished');
    expect(result.state).toBe(finished);
  });

  it('после ничьей дальнейшие ходы отклоняются', () => {
    const finished = play('X', [0, 1, 2, 4, 3, 5, 7, 6, 8]);

    const result = makeMove(finished, 8);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('finished');
    expect(result.state).toBe(finished);
  });
});

describe('restart', () => {
  it('после завершённой партии новая партия начинается с чистого поля', () => {
    const firstGame = play('X', [0, 3, 1, 4, 2]);
    expect(firstGame.status).toBe('win');

    const secondGame = createGame('O');

    expect(secondGame.board).toEqual(Array(9).fill(null));
    expect(secondGame.status).toBe('playing');
    expect(secondGame.currentPlayer).toBe('O');
    expect(secondGame.winner).toBeNull();
    expect(secondGame.winningLine).toBeNull();
  });

  it('результаты партий не смешиваются после рестарта', () => {
    play('X', [0, 3, 1, 4, 2]);

    const secondGame = play('O', [0, 1, 3, 2, 6]);

    expect(secondGame.status).toBe('win');
    expect(secondGame.winner).toBe('O');
    expect(secondGame.winningLine).toEqual([0, 3, 6]);
  });
});
