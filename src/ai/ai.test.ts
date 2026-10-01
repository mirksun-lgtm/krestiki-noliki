import { describe, expect, it } from 'vitest';
import { createGame, makeMove, type GameState, type Player } from '../game/gameCore';
import { chooseMove, type Difficulty } from './ai';

/** Позиция из строки вида "OO.X...X." — точка = пустая клетка. */
function pos(cells: string, currentPlayer: Player): GameState {
  const board = [...cells].map((c) => (c === '.' ? null : (c as Player)));
  return { board, currentPlayer, status: 'playing', winner: null, winningLine: null };
}

const WIN_POSITION = 'OO.X...X.'; // ход O: выигрыш в клетке 2
const BLOCK_POSITION = 'XX.O....O'; // ход O: угроза X в клетке 2, нужно блокировать
const NEUTRAL_POSITION = 'X.O......'; // ход O: без немедленных побед и угроз
const MAX_LEVELS: Difficulty[] = ['medium', 'hard', 'impossible'];

/** Детерминированный генератор для воспроизводимых партий. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('chooseMove — базовое поведение', () => {
  it('возвращает null для завершённой партии', () => {
    const finished: GameState = {
      ...createGame('X'),
      status: 'win',
      winner: 'X',
    };

    expect(chooseMove(finished, 'impossible')).toBeNull();
  });

  it('возвращает null, когда ходить нечем', () => {
    const full: GameState = {
      ...createGame('X'),
      board: ('XOXXXOOXO'.split('') as Player[]),
    };

    expect(chooseMove(full, 'impossible')).toBeNull();
  });

  it('на пустом поле выбирает валидную пустую клетку', () => {
    const cell = chooseMove(createGame('O'), 'medium');

    expect(cell).not.toBeNull();
    expect(cell).toBeGreaterThanOrEqual(0);
    expect(cell).toBeLessThanOrEqual(8);
  });
});

describe('немедленная победа', () => {
  for (const difficulty of MAX_LEVELS) {
    it(`${difficulty} всегда берёт немедленную победу`, () => {
      const cell = chooseMove(pos(WIN_POSITION, 'O'), difficulty, () => 0);

      expect(cell).toBe(2);
    });
  }

  it('лёгкий при ошибочном rng пропускает немедленную победу', () => {
    const cell = chooseMove(pos(WIN_POSITION, 'O'), 'easy', () => 0);

    expect(cell).not.toBe(2);
  });

  it('лёгкий, когда не отклоняется, берёт немедленную победу', () => {
    const cell = chooseMove(pos(WIN_POSITION, 'O'), 'easy', () => 1);

    expect(cell).toBe(2);
  });
});

describe('блокировка угрозы', () => {
  for (const difficulty of MAX_LEVELS) {
    it(`${difficulty} всегда блокирует немедленную угрозу`, () => {
      const cell = chooseMove(pos(BLOCK_POSITION, 'O'), difficulty, () => 0);

      expect(cell).toBe(2);
    });
  }

  it('лёгкий при ошибочном rng пропускает блокировку', () => {
    const cell = chooseMove(pos(BLOCK_POSITION, 'O'), 'easy', () => 0);

    expect(cell).not.toBe(2);
  });
});

describe('ошибки вне немедленных ситуаций', () => {
  // «лучший ход при rng» — это chooseMove невозможного уровня: он никогда не отклоняется,
  // а оценки те же (один minimax), поэтому совпадает и лучший ход среднего/харда.
  it('средний отклоняется от лучшего хода, когда победы и угрозы нет', () => {
    const rng = () => 0.29;
    const optimal = chooseMove(pos(NEUTRAL_POSITION, 'O'), 'impossible', rng);
    const deviated = chooseMove(pos(NEUTRAL_POSITION, 'O'), 'medium', rng);

    expect(deviated).not.toBe(optimal);
  });

  it('средний при rng выше порога играет лучший ход', () => {
    const rng = () => 0.5;
    const optimal = chooseMove(pos(NEUTRAL_POSITION, 'O'), 'impossible', rng);
    const normal = chooseMove(pos(NEUTRAL_POSITION, 'O'), 'medium', rng);

    expect(normal).toBe(optimal);
  });

  it('хард иногда отклоняется от лучшего хода', () => {
    const rng = () => 0.99;
    const optimal = chooseMove(pos(NEUTRAL_POSITION, 'O'), 'impossible', rng);
    const deviated = chooseMove(pos(NEUTRAL_POSITION, 'O'), 'hard', () => 0);

    expect(deviated).not.toBe(optimal);
    expect(chooseMove(pos(NEUTRAL_POSITION, 'O'), 'hard', rng)).toBe(optimal);
  });
});

describe('невозможный', () => {
  it('не отклоняется от победы даже при rng, склонном к ошибке', () => {
    expect(chooseMove(pos(WIN_POSITION, 'O'), 'impossible', () => 0)).toBe(2);
  });

  it('не отклоняется от блокировки даже при rng, склонном к ошибке', () => {
    expect(chooseMove(pos(BLOCK_POSITION, 'O'), 'impossible', () => 0)).toBe(2);
  });

  it('равноценные ходы могут различаться по выбору', () => {
    const first = chooseMove(createGame('O'), 'impossible', () => 0.1);
    const second = chooseMove(createGame('O'), 'impossible', () => 0.6);

    expect(first).not.toBe(second);
  });

  it('не проигрывает при полном переборе ходов оппонента', () => {
    const random = lcg(42);

    // Все ходы оппонента (X) перебираются полностью; ходы AI детерминированы rng-потоком.
    const opponentWins = (state: GameState): boolean => {
      if (state.status === 'win') return state.winner === 'X';
      if (state.status === 'draw') return false;

      if (state.currentPlayer === 'X') {
        for (let i = 0; i < 9; i++) {
          if (state.board[i] !== null) continue;
          const result = makeMove(state, i);
          if (result.ok && opponentWins(result.state)) return true;
        }
        return false;
      }

      const cell = chooseMove(state, 'impossible', random);
      expect(cell).not.toBeNull();
      const result = makeMove(state, cell as number);
      expect(result.ok).toBe(true);
      return opponentWins((result as { state: GameState }).state);
    };

    expect(opponentWins(createGame('X'))).toBe(false);
  }, 60_000);
});

describe('уровни между собой', () => {
  it('хард в целом играет сильнее лёгкого', () => {
    let hardWins = 0;
    let easyWins = 0;

    for (let game = 0; game < 20; game++) {
      const random = lcg(game + 1);
      let state = createGame('X');

      while (state.status === 'playing') {
        const difficulty: Difficulty = state.currentPlayer === 'X' ? 'easy' : 'hard';
        const cell = chooseMove(state, difficulty, random);
        expect(cell).not.toBeNull();
        const result = makeMove(state, cell as number);
        expect(result.ok).toBe(true);
        state = (result as { state: GameState }).state;
      }

      if (state.winner === 'O') hardWins++;
      if (state.winner === 'X') easyWins++;
    }

    expect(hardWins).toBeGreaterThan(easyWins);
  }, 60_000);
});
