import { describe, expect, it, vi } from 'vitest';
import { loadSettings, saveSettings, SAVE_KEY, type SettingsStorage } from './storage';

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
