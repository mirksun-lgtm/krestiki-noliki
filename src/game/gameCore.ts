export type Player = 'X' | 'O';

export type Cell = Player | null;

export type GameStatus = 'playing' | 'win' | 'draw';

export interface GameState {
  board: Cell[];
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | null;
  winningLine: number[] | null;
}

export function createGame(firstPlayer: Player): GameState {
  return {
    board: Array(9).fill(null),
    currentPlayer: firstPlayer,
    status: 'playing',
    winner: null,
    winningLine: null,
  };
}

export type MoveResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: 'finished' | 'outOfRange' | 'occupied'; state: GameState };

const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function findWin(board: Cell[], player: Player): number[] | null {
  for (const line of WIN_LINES) {
    if (line.every((i) => board[i] === player)) return [...line];
  }
  return null;
}

export function makeMove(state: GameState, index: number): MoveResult {
  if (state.status !== 'playing') {
    return { ok: false, reason: 'finished', state };
  }
  if (!Number.isInteger(index) || index < 0 || index > 8) {
    return { ok: false, reason: 'outOfRange', state };
  }
  if (state.board[index] !== null) {
    return { ok: false, reason: 'occupied', state };
  }

  const mover = state.currentPlayer;
  const board = [...state.board];
  board[index] = mover;

  const winningLine = findWin(board, mover);
  if (winningLine) {
    return {
      ok: true,
      state: { ...state, board, status: 'win', winner: mover, winningLine },
    };
  }

  if (board.every((cell) => cell !== null)) {
    return { ok: true, state: { ...state, board, status: 'draw' } };
  }

  return {
    ok: true,
    state: {
      ...state,
      board,
      currentPlayer: mover === 'X' ? 'O' : 'X',
    },
  };
}

/** Истечение времени на ходе игрока: текущая партия проиграна им, победа — сопернику. */
export function timeoutGame(state: GameState): GameState {
  if (state.status !== 'playing') return state;
  return {
    ...state,
    status: 'win',
    winner: state.currentPlayer === 'X' ? 'O' : 'X',
    winningLine: null,
  };
}
