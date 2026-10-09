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
  /** SVG-значок 24×24 (этап v1.0.1 заменил эмодзи); id и условия не зависят от иконки. */
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
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#c98a3f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M17 5h2.5a2 2 0 0 1 0 4H17"/><path d="M7 5H4.5a2 2 0 0 0 0 4H7"/><path d="M12 13v3"/><path d="M9 19h6"/></svg>', // first-win: кубок
    score: 10,
    check: (ctx) => ctx.stats.wins >= 1,
  },
  {
    id: 'streak-3',
    title: 'Хет-трик',
    description: '3 победы подряд против AI',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#b8622e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21a6 6 0 0 0 6-6c0-5-5-7-6-12-1 5-6 7-6 12a6 6 0 0 0 6 6Z"/><path d="M12 21a2.6 2.6 0 0 0 2.6-2.6c0-2.2-2.2-3-2.6-5.4-.4 2.4-2.6 3.2-2.6 5.4A2.6 2.6 0 0 0 12 21Z"/></svg>', // streak-3: пламя
    score: 20,
    check: (ctx) => ctx.stats.bestWinStreak >= 3,
  },
  {
    id: 'beat-hard',
    title: 'Тактическое превосходство',
    description: 'Победите AI уровня Hard',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#3f6590" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l9 10"/><path d="M18 3L9 13"/><path d="M4 5L8 1"/><path d="M16 1l4 4"/></svg>', // beat-hard: скрещённые мечи
    score: 15,
    check: (ctx) => ctx.stats.byDifficulty.hard.wins >= 1,
  },
  {
    id: 'draw-impossible',
    title: 'Непробиваемый',
    description: 'Сыграйте вничью с AI уровня Impossible',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 2.4v5.1c0 4.6-3 8.2-7 10.5-4-2.3-7-5.9-7-10.5V5.4L12 3Z" stroke="#3f6590"/><path d="M9 10.5h6" stroke="#b8622e"/><path d="M9 13.5h6" stroke="#b8622e"/></svg>', // draw-impossible: щит с «=»
    score: 30,
    check: (ctx) => ctx.stats.byDifficulty.impossible.draws >= 1,
  },
  {
    id: 'fast-win',
    title: 'Молниеносная победа',
    description: 'Выиграйте партию, когда на поле не больше 6 фигур',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#d98324" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L5 13.5h5.5L9 22l8-11.5h-5.5L13 2Z"/></svg>', // fast-win: молния
    score: 15,
    check: (ctx) => ctx.lastGame.playerWon && ctx.lastGame.moves <= 6,
  },
  {
    id: 'timer-win',
    title: 'На счётчике',
    description: 'Выиграйте партию с включённым таймером',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#b8622e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10"/><path d="M7 21h10"/><path d="M7 3l5 9 5-9"/><path d="M7 21l5-9 5 9"/></svg>', // timer-win: песочные часы
    score: 15,
    check: (ctx) => ctx.lastGame.playerWon && ctx.lastGame.timerEnabled,
  },
  {
    id: 'three-draws',
    title: 'Дипломат',
    description: 'Сыграйте 3 ничьи',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#a5885e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c4 0 8.5-3.5 11-10"/><ellipse cx="8.6" cy="15.6" rx="2.4" ry="1.3" transform="rotate(-42 8.6 15.6)"/><ellipse cx="12" cy="12" rx="2.4" ry="1.3" transform="rotate(-42 12 12)"/><ellipse cx="15" cy="8.4" rx="2.4" ry="1.3" transform="rotate(-42 15 8.4)"/></svg>', // three-draws: оливковая ветвь
    score: 10,
    check: (ctx) => ctx.stats.draws >= 3,
  },
  {
    id: 'ten-games',
    title: 'Разогрелись',
    description: 'Сыграйте 10 партий',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="8" stroke="#3f6590"/><circle cx="12" cy="12" r="4.2" stroke="#b8622e"/><circle cx="12" cy="12" r="1.4" fill="#c98a3f" stroke="none"/></svg>', // ten-games: мишень
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
