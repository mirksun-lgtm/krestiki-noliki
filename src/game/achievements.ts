import type { Stats } from './stats';

/** Факты только что завершённой партии — для достижений, не выводимых из Stats. */
export interface LastGameFacts {
  /** Победа игрока: в PvP — любая победа, в PvE — победа стороны игрока. */
  playerWon: boolean;
  /** Был ли включён таймер на ход в этой партии. */
  timerEnabled: boolean;
  /** Сколько фигур осталось на поле в конце партии. */
  moves: number;
}

/** Контекст оценки: накопительная статистика + факты последней партии. */
export interface EvaluationContext {
  stats: Stats;
  lastGame: LastGameFacts;
}

export interface AchievementDef {
  /** Стабильный id: хранится в сохранении, на не переводится. */
  id: string;
  title: string;
  description: string;
  /** Иконка-эмодзи: этап 9/10 может заменить на SVG-арт без изменения id. */
  icon: string;
  /** Сколько Achievement Score даёт достижение (GDD §19.3). */
  score: number;
  check(ctx: EvaluationContext): boolean;
}

/**
 * Базовые достижения v1 (Pipeline §20 / GDD §19.4).
 * Числа и score зафиксированы в GDD §19.4 после баланса этапа 8.
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first-win',
    title: 'Первая победа',
    description: 'Выиграйте любую партию',
    icon: '🏆',
    score: 10,
    check: (ctx) => ctx.stats.wins >= 1,
  },
  {
    id: 'streak-3',
    title: 'Хет-трик',
    description: '3 победы подряд против AI',
    icon: '🔥',
    score: 20,
    check: (ctx) => ctx.stats.bestWinStreak >= 3,
  },
  {
    id: 'beat-hard',
    title: 'Тактическое превосходство',
    description: 'Победите AI уровня Hard',
    icon: '⚔️',
    score: 15,
    check: (ctx) => ctx.stats.byDifficulty.hard.wins >= 1,
  },
  {
    id: 'beat-impossible',
    title: 'Невозможно? Возможно!',
    description: 'Победите AI уровня Impossible',
    icon: '👑',
    score: 30,
    check: (ctx) => ctx.stats.byDifficulty.impossible.wins >= 1,
  },
  {
    id: 'fast-win',
    title: 'Молниеносная победа',
    description: 'Выиграйте партию, когда на поле не больше 6 фигур',
    icon: '⚡',
    score: 15,
    check: (ctx) => ctx.lastGame.playerWon && ctx.lastGame.moves <= 6,
  },
  {
    id: 'timer-win',
    title: 'На счётчике',
    description: 'Выиграйте партию с включённым таймером',
    icon: '⏱️',
    score: 15,
    check: (ctx) => ctx.lastGame.playerWon && ctx.lastGame.timerEnabled,
  },
  {
    id: 'three-draws',
    title: 'Дипломат',
    description: 'Сыграйте 3 ничьи',
    icon: '🤝',
    score: 10,
    check: (ctx) => ctx.stats.draws >= 3,
  },
  {
    id: 'ten-games',
    title: 'Разогрелись',
    description: 'Сыграйте 10 партий',
    icon: '🎯',
    score: 10,
    check: (ctx) => ctx.stats.totalGames >= 10,
  },
];

/** Какие достижения уже получены: возвращает только новые id, в порядке ACHIEVEMENTS. */
export function newlyUnlocked(unlocked: readonly string[], ctx: EvaluationContext): string[] {
  const owned = new Set(unlocked);
  return ACHIEVEMENTS.filter((a) => !owned.has(a.id) && a.check(ctx)).map((a) => a.id);
}

/** Суммарный Achievement Score; неизвестные и повторные id не искажают подсчёт. */
export function achievementScore(unlocked: readonly string[]): number {
  const owned = new Set(unlocked);
  return ACHIEVEMENTS.reduce((sum, a) => sum + (owned.has(a.id) ? a.score : 0), 0);
}

/** Косметический предмет, открываемый за Achievement Score (GDD §19.5). */
export interface CosmeticUnlock {
  id: string;
  title: string;
  requiredScore: number;
}

/**
 * Первый реальный предмет — Набор 2 (P2, GDD §19.5): Score копится с P1,
 * порог зафиксирован в GDD §19.4.
 */
export const COSMETIC_UNLOCKS: readonly CosmeticUnlock[] = [
  { id: 'set-2', title: 'Набор 2', requiredScore: 50 },
];

/** Предметы, чей порог уже набран текущим Score. */
export function unlockedCosmetics(score: number): CosmeticUnlock[] {
  return COSMETIC_UNLOCKS.filter((item) => score >= item.requiredScore);
}
