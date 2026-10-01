import type { Player } from './gameCore';
import type { Difficulty } from '../ai/ai';

/** Счёт с перспективой игрока (PvE) по одной категории. */
export interface SideRecord {
  wins: number;
  losses: number;
  draws: number;
}

/** Победы в PvP считаются по сторонам доски, «поражения» в PvP не существуют. */
export interface PvPRecord {
  xWins: number;
  oWins: number;
  draws: number;
}

/**
 * Статистика игрока (этап 7, Pipeline §19 / GDD §20).
 *
 * Семантика: wins — все партии с победителем (PvP по сторонам + PvE игрока),
 * losses — только PvE, где есть перспектива игрока против AI,
 * draws — все ничьи; invariant: wins + losses + draws === totalGames.
 * Серия побед ведётся только по PvE — в PvP перспективы игрока нет.
 */
export interface Stats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  pvp: PvPRecord;
  pve: SideRecord;
  byDifficulty: Record<Difficulty, SideRecord>;
  /** Текущая серия побед игрока в PvE. */
  winStreak: number;
  /** Лучшая серия побед игрока в PvE за всё время. */
  bestWinStreak: number;
}

/** Итог завершённой партии, нужный для записи статистики. */
export interface GameResult {
  mode: 'pvp' | 'pve';
  /** Победитель партии; null — ничья. */
  winner: Player | null;
  /** Сторона игрока; существенна только в PvE. */
  side: Player;
  /** Сложность AI; учитывается только в PvE. */
  difficulty: Difficulty;
}

function emptySide(): SideRecord {
  return { wins: 0, losses: 0, draws: 0 };
}

export function createStats(): Stats {
  return {
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    pvp: { xWins: 0, oWins: 0, draws: 0 },
    pve: emptySide(),
    byDifficulty: {
      easy: emptySide(),
      medium: emptySide(),
      hard: emptySide(),
      impossible: emptySide(),
    },
    winStreak: 0,
    bestWinStreak: 0,
  };
}

/** Независимая копия: recordGame не мутирует входное состояние. */
function cloneStats(stats: Stats): Stats {
  return {
    ...stats,
    pvp: { ...stats.pvp },
    pve: { ...stats.pve },
    byDifficulty: {
      easy: { ...stats.byDifficulty.easy },
      medium: { ...stats.byDifficulty.medium },
      hard: { ...stats.byDifficulty.hard },
      impossible: { ...stats.byDifficulty.impossible },
    },
  };
}

export function recordGame(stats: Stats, result: GameResult): Stats {
  const next = cloneStats(stats);
  next.totalGames += 1;

  if (result.mode === 'pvp') {
    if (result.winner === null) {
      next.draws += 1;
      next.pvp.draws += 1;
    } else {
      next.wins += 1;
      next.pvp[result.winner === 'X' ? 'xWins' : 'oWins'] += 1;
    }
    return next;
  }

  const bucket = next.byDifficulty[result.difficulty];
  if (result.winner === null) {
    next.draws += 1;
    next.pve.draws += 1;
    bucket.draws += 1;
    next.winStreak = 0;
  } else if (result.winner === result.side) {
    next.wins += 1;
    next.pve.wins += 1;
    bucket.wins += 1;
    next.winStreak += 1;
    if (next.winStreak > next.bestWinStreak) next.bestWinStreak = next.winStreak;
  } else {
    next.losses += 1;
    next.pve.losses += 1;
    bucket.losses += 1;
    next.winStreak = 0;
  }
  return next;
}
