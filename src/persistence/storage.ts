import type { Player } from '../game/gameCore';
import type { SeriesFormat } from '../game/series';
import type { TimerPreset } from '../game/turnTimer';
import type { Difficulty } from '../ai/ai';

/** Последние подтверждённые игроком настройки партии. */
export interface UserSettings {
  /** Сторона игрока в PvE; в PvP поле не используется. */
  side: Player;
  difficulty: Difficulty;
  format: SeriesFormat;
  starter: Player;
  timer: TimerPreset;
}

const DEFAULT_SETTINGS: UserSettings = {
  side: 'X',
  difficulty: 'medium',
  format: 'single',
  starter: 'X',
  timer: 0,
};

export const SAVE_KEY = 'krestiki-noliki:save';

/** Несовместимая версия сохранения читается как «нет данных» (fallback на дефолты). */
const SAVE_VERSION = 1;

/** Минимальный срез браузерного Storage — достаточно для чтения/записи. */
export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): SettingsStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // доступ запрещён (private mode, sandbox) — игра работает без сохранений
  }
}

const SIDES = ['X', 'O'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard', 'impossible'] as const;
const FORMATS = ['single', 'bestOf3', 'bestOf5'] as const;
const TIMERS = [0, 5, 10, 30] as const;

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.some((item) => item === value) ? (value as T) : fallback;
}

/** Своевольное значение каждого поля: невалидное или отсутствующее → дефолт поля. */
function normalizeSettings(raw: unknown): UserSettings {
  const source: Record<string, unknown> =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    side: pick(source.side, SIDES, DEFAULT_SETTINGS.side),
    difficulty: pick(source.difficulty, DIFFICULTIES, DEFAULT_SETTINGS.difficulty),
    format: pick(source.format, FORMATS, DEFAULT_SETTINGS.format),
    starter: pick(source.starter, SIDES, DEFAULT_SETTINGS.starter),
    timer: pick(source.timer, TIMERS, DEFAULT_SETTINGS.timer),
  };
}

/**
 * Чтение настроек. Любая недоступность или повреждение данных
 * (нет хранилища, битый JSON, чужая версия, невалидные поля) → дефолты.
 */
export function loadSettings(storage: SettingsStorage | null = browserStorage()): UserSettings {
  if (storage == null) return { ...DEFAULT_SETTINGS };

  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (raw == null) return { ...DEFAULT_SETTINGS };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_SETTINGS };

  const save = parsed as { version?: unknown; settings?: unknown };
  if (save.version !== SAVE_VERSION) return { ...DEFAULT_SETTINGS };
  return normalizeSettings(save.settings);
}

/**
 * Запись настроек. Отсутствующее или неработающее хранилище —
 * игра продолжает идти без сохранения, исключение наружу не выходит.
 */
export function saveSettings(
  settings: UserSettings,
  storage: SettingsStorage | null = browserStorage(),
): void {
  if (storage == null) return;
  const payload = {
    version: SAVE_VERSION,
    settings: {
      side: settings.side,
      difficulty: settings.difficulty,
      format: settings.format,
      starter: settings.starter,
      timer: settings.timer,
    },
  };
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    // переполнилась квота или хранилище недоступно — сохранение просто не происходит
  }
}
