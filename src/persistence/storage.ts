import type { Player } from '../game/gameCore';
import type { SeriesFormat } from '../game/series';
import type { TimerPreset } from '../game/turnTimer';
import type { Difficulty } from '../ai/ai';
import { ACHIEVEMENTS } from '../game/achievements';
import { createStats, type Stats } from '../game/stats';

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
  const source = asObject(raw);
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

export const STATS_KEY = 'krestiki-noliki:stats';

/** Счётчик — неотрицательное целое; всё остальное при чтении и записи → 0. */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function normalizeSide(value: unknown): { wins: number; losses: number; draws: number } {
  const source = asObject(value);
  return { wins: count(source.wins), losses: count(source.losses), draws: count(source.draws) };
}

/** Своевольная нормализация: каждый счётчик отдельно, невалидное → 0. */
function normalizeStats(raw: unknown): Stats {
  const source = asObject(raw);
  const pvp = asObject(source.pvp);
  const byDifficulty = asObject(source.byDifficulty);
  return {
    totalGames: count(source.totalGames),
    wins: count(source.wins),
    losses: count(source.losses),
    draws: count(source.draws),
    pvp: { xWins: count(pvp.xWins), oWins: count(pvp.oWins), draws: count(pvp.draws) },
    pve: normalizeSide(source.pve),
    byDifficulty: {
      easy: normalizeSide(byDifficulty.easy),
      medium: normalizeSide(byDifficulty.medium),
      hard: normalizeSide(byDifficulty.hard),
      impossible: normalizeSide(byDifficulty.impossible),
    },
    winStreak: count(source.winStreak),
    bestWinStreak: count(source.bestWinStreak),
  };
}

/**
 * Чтение статистики. Любая недоступность или повреждение данных
 * (нет хранилища, битый JSON, чужая версия, невалидные поля) → пустая статистика.
 */
export function loadStats(storage: SettingsStorage | null = browserStorage()): Stats {
  if (storage == null) return createStats();

  let raw: string | null;
  try {
    raw = storage.getItem(STATS_KEY);
  } catch {
    return createStats();
  }
  if (raw == null) return createStats();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return createStats();
  }
  if (typeof parsed !== 'object' || parsed === null) return createStats();

  const save = parsed as { version?: unknown; stats?: unknown };
  if (save.version !== SAVE_VERSION) return createStats();
  return normalizeStats(save.stats);
}

/**
 * Запись статистики. Отсутствующее или неработающее хранилище —
 * игра продолжает идти без сохранения, исключение наружу не выходит.
 */
export function saveStats(
  stats: Stats,
  storage: SettingsStorage | null = browserStorage(),
): void {
  if (storage == null) return;
  try {
    const payload = { version: SAVE_VERSION, stats: normalizeStats(stats) };
    storage.setItem(STATS_KEY, JSON.stringify(payload));
  } catch {
    // переполнилась квота или хранилище недоступно — сохранение просто не происходит
  }
}

export const ACHIEVEMENTS_KEY = 'krestiki-noliki:achievements';

const KNOWN_ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));

/** Только известные строковые id, без дублей; чужие элементы отбрасываются. */
function normalizeUnlocked(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && KNOWN_ACHIEVEMENT_IDS.has(item) && !seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

/**
 * Чтение разблокированных достижений. Любая недоступность или повреждение
 * данных (нет хранилища, битый JSON, чужая версия, мусор в массиве) → [].
 */
export function loadAchievements(storage: SettingsStorage | null = browserStorage()): string[] {
  if (storage == null) return [];

  let raw: string | null;
  try {
    raw = storage.getItem(ACHIEVEMENTS_KEY);
  } catch {
    return [];
  }
  if (raw == null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null) return [];

  const save = parsed as { version?: unknown; unlocked?: unknown };
  if (save.version !== SAVE_VERSION) return [];
  return normalizeUnlocked(save.unlocked);
}

/**
 * Запись разблокированных достижений. Отсутствующее или неработающее хранилище —
 * игра продолжает идти без сохранения, исключение наружу не выходит.
 */
export function saveAchievements(
  unlocked: readonly string[],
  storage: SettingsStorage | null = browserStorage(),
): void {
  if (storage == null) return;
  try {
    const payload = { version: SAVE_VERSION, unlocked: normalizeUnlocked(unlocked) };
    storage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(payload));
  } catch {
    // переполнилась квота или хранилище недоступно — сохранение просто не происходит
  }
}

export const AUDIO_KEY = 'krestiki-noliki:audio';

/** Настройки звука приложения. */
export interface AudioSettings {
  sfx: boolean;
  music: boolean;
}

const DEFAULT_AUDIO: AudioSettings = { sfx: true, music: true };

/**
 * Чтение настроек звука. Любая недоступность или повреждение данных
 * (нет хранилища, битый JSON, чужая версия, невалидные поля) → звук включён.
 */
export function loadAudioSettings(
  storage: SettingsStorage | null = browserStorage(),
): AudioSettings {
  if (storage == null) return { ...DEFAULT_AUDIO };

  let raw: string | null;
  try {
    raw = storage.getItem(AUDIO_KEY);
  } catch {
    return { ...DEFAULT_AUDIO };
  }
  if (raw == null) return { ...DEFAULT_AUDIO };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_AUDIO };
  }
  if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_AUDIO };

  const save = parsed as { version?: unknown; audio?: unknown };
  if (save.version !== SAVE_VERSION) return { ...DEFAULT_AUDIO };
  const source = asObject(save.audio);
  return {
    sfx: typeof source.sfx === 'boolean' ? source.sfx : DEFAULT_AUDIO.sfx,
    music: typeof source.music === 'boolean' ? source.music : DEFAULT_AUDIO.music,
  };
}

/**
 * Запись настроек звука. Отсутствующее или неработающее хранилище —
 * игра продолжает идти без сохранения, исключение наружу не выходит.
 */
export function saveAudioSettings(
  settings: AudioSettings,
  storage: SettingsStorage | null = browserStorage(),
): void {
  if (storage == null) return;
  try {
    storage.setItem(
      AUDIO_KEY,
      JSON.stringify({ version: SAVE_VERSION, audio: { sfx: settings.sfx, music: settings.music } }),
    );
  } catch {
    // переполнилась квота или хранилище недоступно — сохранение просто не происходит
  }
}
