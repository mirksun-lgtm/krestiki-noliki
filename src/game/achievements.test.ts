import { describe, expect, it } from 'vitest';
import { createStats, recordGame, type GameResult, type Stats } from './stats';
import {
  ACHIEVEMENTS,
  achievementScore,
  newlyUnlocked,
  unlockedCosmetics,
  type EvaluationContext,
  type LastGameFacts,
} from './achievements';

/** Результат партии для накопления Stats. */
function result(over: Partial<GameResult> = {}): GameResult {
  return { mode: 'pvp', winner: 'X', side: 'X', difficulty: 'medium', ...over };
}

function statsPlaying(results: GameResult[]): Stats {
  return results.reduce((stats, item) => recordGame(stats, item), createStats());
}

function facts(over: Partial<LastGameFacts> = {}): LastGameFacts {
  // обычная длинная партия без таймера, победа игрока
  return { playerWon: true, timerEnabled: false, moves: 9, ...over };
}

function ctx(over: Partial<EvaluationContext> = {}): EvaluationContext {
  return { stats: createStats(), lastGame: facts(), ...over };
}

describe('ACHIEVEMENTS', () => {
  it('id уникальны, у каждого есть название, описание, иконка и положительный score', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.icon.length).toBeGreaterThan(0);
      expect(a.score).toBeGreaterThan(0);
    }
  });

  it('id — стабильные строки из конфига (не меняются между запусками)', () => {
    expect(ACHIEVEMENTS.map((a) => a.id)).toEqual([
      'first-win',
      'streak-3',
      'beat-hard',
      'beat-impossible',
      'fast-win',
      'timer-win',
      'three-draws',
      'ten-games',
    ]);
  });
});

describe('условия выдачи', () => {
  it('первая победа: победа в любой партии разблокирует first-win', () => {
    const stats = statsPlaying([result(), result({ winner: null })]);

    expect(newlyUnlocked([], ctx({ stats }))).toContain('first-win');
  });

  it('без ни одной победы first-win не выдаётся', () => {
    const stats = statsPlaying([result({ winner: null }), result({ mode: 'pve', winner: 'O' })]);

    expect(newlyUnlocked([], ctx({ stats }))).not.toContain('first-win');
  });

  it('хет-трик: серия из 3 побед подряд против AI', () => {
    const stats = statsPlaying([
      result({ mode: 'pve' }),
      result({ mode: 'pve' }),
      result({ mode: 'pve' }),
    ]);

    expect(newlyUnlocked([], ctx({ stats }))).toContain('streak-3');
  });

  it('серия из 2 побед — хет-трика ещё нет', () => {
    const stats = statsPlaying([result({ mode: 'pve' }), result({ mode: 'pve' })]);

    expect(newlyUnlocked([], ctx({ stats }))).not.toContain('streak-3');
  });

  it('победа над Hard разблокирует beat-hard', () => {
    const stats = statsPlaying([result({ mode: 'pve', difficulty: 'hard' })]);

    expect(newlyUnlocked([], ctx({ stats }))).toContain('beat-hard');
    expect(newlyUnlocked([], ctx({ stats }))).not.toContain('beat-impossible');
  });

  it('победа над Impossible разблокирует beat-impossible', () => {
    const stats = statsPlaying([
      result({ mode: 'pve', difficulty: 'impossible' }),
      result({ mode: 'pve', difficulty: 'hard' }),
    ]);

    expect(newlyUnlocked([], ctx({ stats }))).toContain('beat-impossible');
  });

  it('три ничьи разблокируют three-draws, две — ещё нет', () => {
    const two = statsPlaying([result({ winner: null }), result({ winner: null })]);
    const three = statsPlaying([
      result({ winner: null }),
      result({ winner: null }),
      result({ winner: null }),
    ]);

    expect(newlyUnlocked([], ctx({ stats: two }))).not.toContain('three-draws');
    expect(newlyUnlocked([], ctx({ stats: three }))).toContain('three-draws');
  });

  it('10 сыгранных партий разблокируют ten-games, 9 — ещё нет', () => {
    const nine = statsPlaying(Array.from({ length: 9 }, () => result({ winner: null })));
    const ten = statsPlaying(Array.from({ length: 10 }, () => result({ winner: null })));

    expect(newlyUnlocked([], ctx({ stats: nine }))).not.toContain('ten-games');
    expect(newlyUnlocked([], ctx({ stats: ten }))).toContain('ten-games');
  });

  it('победа при включённом таймере разблокирует timer-win', () => {
    const unlocked = newlyUnlocked([], ctx({ lastGame: facts({ timerEnabled: true }) }));

    expect(unlocked).toContain('timer-win');
  });

  it('без таймера timer-win не выдаётся даже при победе', () => {
    expect(newlyUnlocked([], ctx())).not.toContain('timer-win');
  });

  it('проигрыш при включённом таймере не даёт timer-win', () => {
    const unlocked = newlyUnlocked(
      [],
      ctx({ lastGame: facts({ timerEnabled: true, playerWon: false }) }),
    );

    expect(unlocked).not.toContain('timer-win');
  });

  it('быстрая победа: не более 6 фигур на поле', () => {
    const unlocked = newlyUnlocked([], ctx({ lastGame: facts({ moves: 6 }) }));

    expect(unlocked).toContain('fast-win');
  });

  it('обычная партия (7+ фигур) не даёт fast-win', () => {
    const unlocked = newlyUnlocked([], ctx({ lastGame: facts({ moves: 7 }) }));

    expect(unlocked).not.toContain('fast-win');
  });

  it('проигрыш за 6 ходов не даёт fast-win', () => {
    const unlocked = newlyUnlocked(
      [],
      ctx({ lastGame: facts({ moves: 6, playerWon: false }) }),
    );

    expect(unlocked).not.toContain('fast-win');
  });
});

describe('выдача ровно один раз', () => {
  it('уже разблокированное не возвращается повторно', () => {
    const stats = statsPlaying([result()]);

    expect(newlyUnlocked(['first-win'], ctx({ stats }))).not.toContain('first-win');
  });

  it('повторная проверка того же состояния не дублирует награду', () => {
    const context = ctx({ stats: statsPlaying([result()]) });

    const first = newlyUnlocked([], context);
    const second = newlyUnlocked(first, context);

    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual([]);
  });
});

describe('achievementScore', () => {
  it('без достижений — 0 очков', () => {
    expect(achievementScore([])).toBe(0);
  });

  it('стоимость конкретных достижений соответствует зафиксированной в GDD', () => {
    expect(achievementScore(['first-win'])).toBe(10);
    expect(achievementScore(['streak-3'])).toBe(20);
    expect(achievementScore(['beat-impossible'])).toBe(30);
  });

  it('сумма всех достижений — полный Score набора (125)', () => {
    const all = ACHIEVEMENTS.map((a) => a.id);

    expect(achievementScore(all)).toBe(125);
  });

  it('неизвестный id игнорируется и не ломает подсчёт', () => {
    expect(achievementScore(['first-win', 'no-such-id'])).toBe(10);
  });
});

describe('unlockedCosmetics: порог разблокировки', () => {
  it('ниже порога (49) — ничего не разблокировано', () => {
    expect(unlockedCosmetics(49)).toEqual([]);
  });

  it('ровно на пороге (50) — разблокирован первый предмет, Набор 2', () => {
    const unlocked = unlockedCosmetics(50);

    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].id).toBe('set-2');
  });

  it('при максимальном Score набора предмет остаётся разблокированным', () => {
    expect(unlockedCosmetics(125).map((c) => c.id)).toContain('set-2');
  });
});
