import { describe, expect, it, vi } from 'vitest';
import {
  loadAchievements,
  loadSettings,
  loadStats,
  saveAchievements,
  saveSettings,
  saveStats,
  ACHIEVEMENTS_KEY,
  SAVE_KEY,
  STATS_KEY,
  type SettingsStorage,
} from './storage';

/** Значения по умолчанию — выписаны вручную, не берутся из кода под тестом. */
const FALLBACK = {
  side: 'X',
  difficulty: 'medium',
  format: 'single',
  starter: 'X',
  timer: 0,
} as const;

/** Корректные сохранённые настройки — тоже ручной литерал (JSON-совместимый). */
const VALID = {
  side: 'O',
  difficulty: 'hard',
  format: 'bestOf5',
  starter: 'O',
  timer: 30,
} as const;

function memoryStorage(seed: Record<string, string> = {}): SettingsStorage & {
  data: Record<string, string>;
} {
  const data = { ...seed };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

function rawSeed(payload: unknown): Record<string, string> {
  return { [SAVE_KEY]: JSON.stringify(payload) };
}

describe('loadSettings', () => {
  it('без хранилища возвращает настройки по умолчанию', () => {
    expect(loadSettings(null)).toEqual(FALLBACK);
  });

  it('пустое хранилище возвращает настройки по умолчанию', () => {
    expect(loadSettings(memoryStorage())).toEqual(FALLBACK);
  });

  it('повреждённый JSON возвращает настройки по умолчанию', () => {
    const store = memoryStorage({ [SAVE_KEY]: '{тут не JSON' });

    expect(loadSettings(store)).toEqual(FALLBACK);
  });

  it.each([42, null, 'привет'])(
    'не-объект вместо сохранения (%j) возвращает настройки по умолчанию',
    (payload) => {
      expect(loadSettings(memoryStorage(rawSeed(payload)))).toEqual(FALLBACK);
    },
  );

  it('сохранение другой версии игнорируется', () => {
    const store = memoryStorage(rawSeed({ version: 99, settings: VALID }));

    expect(loadSettings(store)).toEqual(FALLBACK);
  });

  it('валидные сохранённые настройки загружаются (версия 1)', () => {
    const store = memoryStorage(
      rawSeed({
        version: 1,
        settings: {
          side: 'O',
          difficulty: 'hard',
          format: 'bestOf5',
          starter: 'O',
          timer: 30,
        },
      }),
    );

    expect(loadSettings(store)).toEqual(VALID);
  });

  it('неполное сохранение дополняется дефолтами по недостающим полям', () => {
    const store = memoryStorage(rawSeed({ version: 1, settings: { difficulty: 'hard' } }));

    expect(loadSettings(store)).toEqual({
      side: 'X',
      difficulty: 'hard',
      format: 'single',
      starter: 'X',
      timer: 0,
    });
  });

  it('невалидные значения полей заменяются дефолтами', () => {
    const store = memoryStorage(
      rawSeed({
        version: 1,
        settings: { side: 'Y', difficulty: 'ultra', format: 'bestOf7', starter: 5, timer: 7 },
      }),
    );

    expect(loadSettings(store)).toEqual(FALLBACK);
  });

  it('исключение при чтении хранилища не роняет загрузку', () => {
    const broken: SettingsStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
    };

    expect(loadSettings(broken)).toEqual(FALLBACK);
  });

  it('по умолчанию читает из localStorage браузера', () => {
    vi.stubGlobal('localStorage', memoryStorage(rawSeed({ version: 1, settings: VALID })));
    try {
      expect(loadSettings()).toEqual(VALID);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('saveSettings', () => {
  it('записанные настройки читаются обратно без потерь', () => {
    const store = memoryStorage();

    saveSettings(VALID, store);

    expect(loadSettings(store)).toEqual(VALID);
  });

  it('по умолчанию пишет в localStorage браузера', () => {
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);
    try {
      saveSettings(VALID);
      expect(loadSettings()).toEqual(VALID);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('отсутствие хранилища не приводит к исключению', () => {
    expect(() => saveSettings(VALID, null)).not.toThrow();
  });

  it('ошибка записи (переполнение квоты) не пробрасывается наружу', () => {
    const full: SettingsStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    expect(() => saveSettings(VALID, full)).not.toThrow();
  });
});

/** Пустая статистика — литерал, не из кода под тестом. */
const EMPTY_STATS = {
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
} as const;

/** Заполненная статистика — тоже ручной литерал (JSON-совместимый). */
const SAVED_STATS = {
  totalGames: 7,
  wins: 4,
  losses: 2,
  draws: 1,
  pvp: { xWins: 2, oWins: 1, draws: 1 },
  pve: { wins: 2, losses: 2, draws: 0 },
  byDifficulty: {
    easy: { wins: 1, losses: 0, draws: 0 },
    medium: { wins: 1, losses: 2, draws: 0 },
    hard: { wins: 0, losses: 0, draws: 0 },
    impossible: { wins: 0, losses: 0, draws: 0 },
  },
  winStreak: 2,
  bestWinStreak: 3,
} as const;

function rawStatsSeed(payload: unknown): Record<string, string> {
  return { [STATS_KEY]: JSON.stringify(payload) };
}

describe('loadStats', () => {
  it('без хранилища возвращает пустую статистику', () => {
    expect(loadStats(null)).toEqual(EMPTY_STATS);
  });

  it('пустое хранилище возвращает пустую статистику', () => {
    expect(loadStats(memoryStorage())).toEqual(EMPTY_STATS);
  });

  it('повреждённый JSON возвращает пустую статистику', () => {
    const store = memoryStorage({ [STATS_KEY]: '{тут не JSON' });

    expect(loadStats(store)).toEqual(EMPTY_STATS);
  });

  it.each([42, null, 'привет'])(
    'не-объект вместо сохранения (%j) возвращает пустую статистику',
    (payload) => {
      expect(loadStats(memoryStorage(rawStatsSeed(payload)))).toEqual(EMPTY_STATS);
    },
  );

  it('сохранение другой версии игнорируется', () => {
    const store = memoryStorage(rawStatsSeed({ version: 99, stats: SAVED_STATS }));

    expect(loadStats(store)).toEqual(EMPTY_STATS);
  });

  it('валидная сохранённая статистика загружается без потерь', () => {
    const store = memoryStorage(rawStatsSeed({ version: 1, stats: SAVED_STATS }));

    expect(loadStats(store)).toEqual(SAVED_STATS);
  });

  it('неполное сохранение дополняется нулями по недостающим полям', () => {
    const store = memoryStorage(rawStatsSeed({ version: 1, stats: { totalGames: 5 } }));

    expect(loadStats(store)).toEqual({ ...EMPTY_STATS, totalGames: 5 });
  });

  it('невалидные значения полей заменяются нулями', () => {
    const store = memoryStorage(
      rawStatsSeed({
        version: 1,
        stats: {
          ...SAVED_STATS,
          wins: -3,
          draws: 2.5,
          winStreak: 'много',
          pvp: { ...SAVED_STATS.pvp, xWins: null },
        },
      }),
    );

    const loaded = loadStats(store);
    expect(loaded.wins).toBe(0);
    expect(loaded.draws).toBe(0);
    expect(loaded.winStreak).toBe(0);
    expect(loaded.pvp.xWins).toBe(0);
    // валидные поля не пострадали
    expect(loaded.totalGames).toBe(7);
    expect(loaded.pvp.oWins).toBe(1);
  });

  it('исключение при чтении хранилища не роняет загрузку', () => {
    const broken: SettingsStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
    };

    expect(loadStats(broken)).toEqual(EMPTY_STATS);
  });

  it('по умолчанию читает из localStorage браузера', () => {
    vi.stubGlobal('localStorage', memoryStorage(rawStatsSeed({ version: 1, stats: SAVED_STATS })));
    try {
      expect(loadStats()).toEqual(SAVED_STATS);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('saveStats', () => {
  it('записанная статистика читается обратно без потерь', () => {
    const store = memoryStorage();

    saveStats(SAVED_STATS, store);

    expect(loadStats(store)).toEqual(SAVED_STATS);
  });

  it('по умолчанию пишет в localStorage браузера', () => {
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);
    try {
      saveStats(SAVED_STATS);
      expect(loadStats()).toEqual(SAVED_STATS);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('отсутствие хранилища не приводит к исключению', () => {
    expect(() => saveStats(SAVED_STATS, null)).not.toThrow();
  });

  it('ошибка записи (переполнение квоты) не пробрасывается наружу', () => {
    const full: SettingsStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    expect(() => saveStats(SAVED_STATS, full)).not.toThrow();
  });

  it('запись настроек не затирает статистику (разные ключи)', () => {
    const store = memoryStorage();

    saveStats(SAVED_STATS, store);
    saveSettings(VALID, store);

    expect(loadStats(store)).toEqual(SAVED_STATS);
    expect(loadSettings(store)).toEqual(VALID);
  });
});

function rawAchievementsSeed(payload: unknown): Record<string, string> {
  return { [ACHIEVEMENTS_KEY]: JSON.stringify(payload) };
}

describe('loadAchievements', () => {
  it('без хранилища — пустой список', () => {
    expect(loadAchievements(null)).toEqual([]);
  });

  it('пустое хранилище — пустой список', () => {
    expect(loadAchievements(memoryStorage())).toEqual([]);
  });

  it('повреждённый JSON — пустой список', () => {
    const store = memoryStorage({ [ACHIEVEMENTS_KEY]: '{тут не JSON' });

    expect(loadAchievements(store)).toEqual([]);
  });

  it.each([42, null, 'привет'])(
    'не-массив вместо сохранения (%j) — пустой список',
    (payload) => {
      expect(loadAchievements(memoryStorage(rawAchievementsSeed(payload)))).toEqual([]);
    },
  );

  it('сохранение другой версии игнорируется', () => {
    const store = memoryStorage(rawAchievementsSeed({ version: 99, unlocked: ['first-win'] }));

    expect(loadAchievements(store)).toEqual([]);
  });

  it('валидный список загружается без потерь', () => {
    const store = memoryStorage(
      rawAchievementsSeed({ version: 1, unlocked: ['first-win', 'streak-3'] }),
    );

    expect(loadAchievements(store)).toEqual(['first-win', 'streak-3']);
  });

  it('неизвестные и нестроковые id отбрасываются, известные сохраняют порядок', () => {
    const store = memoryStorage(
      rawAchievementsSeed({ version: 1, unlocked: ['streak-3', 42, 'no-such', 'first-win'] }),
    );

    expect(loadAchievements(store)).toEqual(['streak-3', 'first-win']);
  });

  it('исключение при чтении хранилища не роняет загрузку', () => {
    const broken: SettingsStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
    };

    expect(loadAchievements(broken)).toEqual([]);
  });

  it('по умолчанию читает из localStorage браузера', () => {
    vi.stubGlobal(
      'localStorage',
      memoryStorage(rawAchievementsSeed({ version: 1, unlocked: ['first-win'] })),
    );
    try {
      expect(loadAchievements()).toEqual(['first-win']);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('saveAchievements', () => {
  it('список читается обратно без потерь', () => {
    const store = memoryStorage();

    saveAchievements(['first-win', 'beat-hard'], store);

    expect(loadAchievements(store)).toEqual(['first-win', 'beat-hard']);
  });

  it('по умолчанию пишет в localStorage браузера', () => {
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);
    try {
      saveAchievements(['first-win']);
      expect(loadAchievements()).toEqual(['first-win']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('отсутствие хранилища не приводит к исключению', () => {
    expect(() => saveAchievements(['first-win'], null)).not.toThrow();
  });

  it('ошибка записи (переполнение квоты) не пробрасывается наружу', () => {
    const full: SettingsStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    expect(() => saveAchievements(['first-win'], full)).not.toThrow();
  });

  it('запись достижений не затирает статистику и настройки (разные ключи)', () => {
    const store = memoryStorage();

    saveStats(SAVED_STATS, store);
    saveSettings(VALID, store);
    saveAchievements(['first-win'], store);

    expect(loadStats(store)).toEqual(SAVED_STATS);
    expect(loadSettings(store)).toEqual(VALID);
    expect(loadAchievements(store)).toEqual(['first-win']);
  });
});
