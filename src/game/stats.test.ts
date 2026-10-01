import { describe, expect, it } from 'vitest';
import { createStats, recordGame, type GameResult } from './stats';

/** Результат PvE-партии: игрок за X, обычная победа над AI. */
function pveWin(over: Partial<GameResult> = {}): GameResult {
  return { mode: 'pve', winner: 'X', side: 'X', difficulty: 'medium', ...over };
}

/** Результат PvP-партии: выиграл X. */
function pvpWin(over: Partial<GameResult> = {}): GameResult {
  return { mode: 'pvp', winner: 'X', side: 'X', difficulty: 'medium', ...over };
}

describe('createStats', () => {
  it('все счётчики по умолчанию нулевые', () => {
    expect(createStats()).toEqual({
      totalGames: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      pvp: { xWins: 0, oWins: 0, draws: 0 },
      pve: { wins: 0, losses: 0, draws: 0 },
      byDifficulty: {
        easy: { wins: 0, losses: 0, draws: 0 },
        medium: { wins: 0, losses: 0, draws: 0 },
        hard: { wins: 0, losses: 0, draws: 0 },
        impossible: { wins: 0, losses: 0, draws: 0 },
      },
      winStreak: 0,
      bestWinStreak: 0,
    });
  });
});

describe('recordGame: PvP', () => {
  it('победа X: победу записываем в wins и в счёт по сторонам, поражений нет', () => {
    const stats = recordGame(createStats(), pvpWin());

    expect(stats.totalGames).toBe(1);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(0);
    expect(stats.draws).toBe(0);
    expect(stats.pvp).toEqual({ xWins: 1, oWins: 0, draws: 0 });
  });

  it('победа O: учитывается сторона O', () => {
    const stats = recordGame(createStats(), pvpWin({ winner: 'O' }));

    expect(stats.wins).toBe(1);
    expect(stats.pvp).toEqual({ xWins: 0, oWins: 1, draws: 0 });
    expect(stats.pve).toEqual({ wins: 0, losses: 0, draws: 0 });
  });

  it('ничьей в PvP: растут draws и ничьи PvP, побед/поражений нет', () => {
    const stats = recordGame(createStats(), pvpWin({ winner: null }));

    expect(stats.totalGames).toBe(1);
    expect(stats.wins).toBe(0);
    expect(stats.losses).toBe(0);
    expect(stats.draws).toBe(1);
    expect(stats.pvp).toEqual({ xWins: 0, oWins: 0, draws: 1 });
  });

  it('сторона игрока и сложность не влияют на PvP-счёт', () => {
    const stats = recordGame(
      createStats(),
      pvpWin({ winner: 'O', side: 'O', difficulty: 'impossible' }),
    );

    expect(stats.pvp.oWins).toBe(1);
    expect(stats.byDifficulty.impossible).toEqual({ wins: 0, losses: 0, draws: 0 });
    expect(stats.pve).toEqual({ wins: 0, losses: 0, draws: 0 });
  });
});

describe('recordGame: PvE', () => {
  it('победа игрока: wins, счёт PvE и бакет его сложности', () => {
    const stats = recordGame(createStats(), pveWin({ difficulty: 'hard' }));

    expect(stats.totalGames).toBe(1);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(0);
    expect(stats.pve).toEqual({ wins: 1, losses: 0, draws: 0 });
    expect(stats.byDifficulty.hard).toEqual({ wins: 1, losses: 0, draws: 0 });
    expect(stats.byDifficulty.easy).toEqual({ wins: 0, losses: 0, draws: 0 });
  });

  it('поражение игрока (победа AI): losses, бакет сложности, побед нет', () => {
    const stats = recordGame(createStats(), pveWin({ winner: 'O' }));

    expect(stats.wins).toBe(0);
    expect(stats.losses).toBe(1);
    expect(stats.pve).toEqual({ wins: 0, losses: 1, draws: 0 });
    expect(stats.byDifficulty.medium).toEqual({ wins: 0, losses: 1, draws: 0 });
  });

  it('поражение по таймеру — то же самое поражение (победа AI)', () => {
    // timeout даёт state.winner = сопернику — для статистики это обычный loss
    const stats = recordGame(
      createStats(),
      pveWin({ side: 'O', winner: 'X' }),
    );

    expect(stats.losses).toBe(1);
    expect(stats.pve.losses).toBe(1);
  });

  it('ничьей в PvE: draws и бакет сложности', () => {
    const stats = recordGame(createStats(), pveWin({ winner: null, difficulty: 'easy' }));

    expect(stats.draws).toBe(1);
    expect(stats.pve).toEqual({ wins: 0, losses: 0, draws: 1 });
    expect(stats.byDifficulty.easy).toEqual({ wins: 0, losses: 0, draws: 1 });
    expect(stats.byDifficulty.medium).toEqual({ wins: 0, losses: 0, draws: 0 });
  });

  it('сложности учитываются раздельно', () => {
    let stats = recordGame(createStats(), pveWin({ difficulty: 'easy' }));
    stats = recordGame(stats, pveWin({ difficulty: 'hard', winner: 'O' }));
    stats = recordGame(stats, pveWin({ difficulty: 'hard' }));

    expect(stats.byDifficulty.easy).toEqual({ wins: 1, losses: 0, draws: 0 });
    expect(stats.byDifficulty.hard).toEqual({ wins: 1, losses: 1, draws: 0 });
    expect(stats.pve).toEqual({ wins: 2, losses: 1, draws: 0 });
    expect(stats.totalGames).toBe(3);
  });
});

describe('серия побед', () => {
  it('победы подряд увеличивают текущую и лучшую серию', () => {
    let stats = recordGame(createStats(), pveWin());
    stats = recordGame(stats, pveWin());
    stats = recordGame(stats, pveWin());

    expect(stats.winStreak).toBe(3);
    expect(stats.bestWinStreak).toBe(3);
  });

  it('поражение сбрасывает текущую серию, лучшая сохраняется', () => {
    let stats = recordGame(createStats(), pveWin());
    stats = recordGame(stats, pveWin());
    stats = recordGame(stats, pveWin());
    stats = recordGame(stats, pveWin({ winner: 'O' }));

    expect(stats.winStreak).toBe(0);
    expect(stats.bestWinStreak).toBe(3);
  });

  it('ничьая прерывает текущую серию', () => {
    let stats = recordGame(createStats(), pveWin());
    stats = recordGame(stats, pveWin());
    stats = recordGame(stats, pveWin({ winner: null }));
    stats = recordGame(stats, pveWin());

    expect(stats.winStreak).toBe(1);
    expect(stats.bestWinStreak).toBe(2);
  });

  it('новая лучшая серия перекрывает старую', () => {
    let stats = recordGame(createStats(), pveWin());
    stats = recordGame(stats, pveWin());
    stats = recordGame(stats, pveWin({ winner: 'O' }));
    for (let i = 0; i < 4; i += 1) stats = recordGame(stats, pveWin());

    expect(stats.winStreak).toBe(4);
    expect(stats.bestWinStreak).toBe(4);
  });

  it('PvP-партии не влияют на серию побед игрока (нет перспективы игрока)', () => {
    let stats = recordGame(createStats(), pveWin());
    stats = recordGame(stats, pvpWin());
    stats = recordGame(stats, pvpWin({ winner: null }));
    stats = recordGame(stats, pveWin());

    expect(stats.winStreak).toBe(2);
    expect(stats.bestWinStreak).toBe(2);
  });
});

describe('инварианты', () => {
  it('после смешанной последовательности победы+поражения+ничьи = всего партий', () => {
    const results: GameResult[] = [
      pvpWin(),
      pveWin(),
      pveWin({ winner: 'O' }),
      pvpWin({ winner: null }),
      pveWin({ winner: null }),
      pvpWin({ winner: 'O' }),
      pveWin(),
    ];

    let stats = createStats();
    for (const result of results) stats = recordGame(stats, result);

    expect(stats.totalGames).toBe(results.length);
    expect(stats.wins + stats.losses + stats.draws).toBe(stats.totalGames);
    expect(stats.pvp.xWins + stats.pvp.oWins + stats.pvp.draws).toBe(3);
    expect(stats.pve.wins + stats.pve.losses + stats.pve.draws).toBe(4);
  });

  it('recordGame не мутирует прежнее состояние', () => {
    const before = createStats();
    const after = recordGame(before, pveWin());

    expect(before.totalGames).toBe(0);
    expect(before.byDifficulty.medium.wins).toBe(0);
    expect(after).not.toBe(before);
  });
});
