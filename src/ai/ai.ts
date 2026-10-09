import { makeMove, type GameState, type Player } from '../game/gameCore';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible';

interface LevelConfig {
  /** Вероятность отклониться от лучшего хода. */
  mistakeChance: number;
  /** Не отклоняться, когда лучший ход — немедленная победа или блокировка угрозы. */
  protectImmediate: boolean;
}

const LEVELS: Record<Difficulty, LevelConfig> = {
  easy: { mistakeChance: 0.6, protectImmediate: false },
  medium: { mistakeChance: 0.3, protectImmediate: true },
  hard: { mistakeChance: 0.15, protectImmediate: true },
  impossible: { mistakeChance: 0, protectImmediate: true },
};

/** Оценка позиции с точки зрения игрока `ai`: быстрые победы ценнее, быстрые поражения ближе к нулю. */
function minimax(state: GameState, ai: Player, depth: number, alpha: number, beta: number): number {
  if (state.status === 'win') return state.winner === ai ? 10 - depth : depth - 10;
  if (state.status === 'draw') return 0;

  const maximizing = state.currentPlayer === ai;
  let best = maximizing ? -Infinity : Infinity;

  for (let i = 0; i < 9; i++) {
    if (state.board[i] !== null) continue;
    const result = makeMove(state, i);
    if (!result.ok) continue;
    const score = minimax(result.state, ai, depth + 1, alpha, beta);
    if (maximizing) {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
  }
  return best;
}

function hasImmediateWin(state: GameState, player: Player): boolean {
  for (let i = 0; i < 9; i++) {
    if (state.board[i] !== null) continue;
    const result = makeMove({ ...state, currentPlayer: player }, i);
    if (result.ok && result.state.status === 'win') return true;
  }
  return false;
}

function pickCell(random: () => number, items: { cell: number }[]): number {
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index].cell;
}

/**
 * Пул ходов для «ошибки» уровня: hard берёт только сильнейший из неточных ходов
 * (случайный среди равных), остальные уровни — случайный среди всех неточных.
 */
export function mistakePool(
  scored: readonly { cell: number; score: number }[],
  bestScore: number,
  difficulty: Difficulty,
): { cell: number; score: number }[] {
  const others = scored.filter((s) => s.score !== bestScore);
  if (difficulty !== 'hard') return others;
  let max = -Infinity;
  for (const s of others) if (s.score > max) max = s.score;
  return others.filter((s) => s.score === max);
}

/**
 * Лучший ход для `state.currentPlayer` с учётом уровня сложности.
 * `random` позволяет подделать генератор в тестах.
 */
export function chooseMove(
  state: GameState,
  difficulty: Difficulty,
  random: () => number = Math.random,
): number | null {
  if (state.status !== 'playing') return null;

  const ai = state.currentPlayer;
  const opponent: Player = ai === 'X' ? 'O' : 'X';
  const level = LEVELS[difficulty];

  const scored: { cell: number; score: number }[] = [];
  for (let i = 0; i < 9; i++) {
    if (state.board[i] !== null) continue;
    const result = makeMove(state, i);
    if (!result.ok) continue;
    // каждый ход считается независимо, чтобы получить точные оценки для отбора равных
    scored.push({ cell: i, score: minimax(result.state, ai, 1, -Infinity, Infinity) });
  }
  if (scored.length === 0) return null;

  let bestScore = -Infinity;
  for (const s of scored) {
    if (s.score > bestScore) bestScore = s.score;
  }
  const best = scored.filter((s) => s.score === bestScore);

  const protectNow =
    level.protectImmediate &&
    (hasImmediateWin(state, ai) || hasImmediateWin(state, opponent));

  if (!protectNow && random() < level.mistakeChance) {
    const pool = mistakePool(scored, bestScore, difficulty);
    if (pool.length > 0) return pickCell(random, pool);
  }
  return pickCell(random, best);
}
