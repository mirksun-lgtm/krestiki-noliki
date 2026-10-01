import type { Player } from './gameCore';

export type SeriesFormat = 'single' | 'bestOf3' | 'bestOf5';

export interface SeriesState {
  format: SeriesFormat;
  score: Record<Player, number>;
  /** Сколько партий уже сыграно в серии. */
  gamesPlayed: number;
  /** Кто начинает следующую (или текущую, если партия ещё не начата) партию. */
  firstPlayer: Player;
  finished: boolean;
  winner: Player | null;
}

export function targetWins(format: SeriesFormat): number {
  if (format === 'single') return 1;
  if (format === 'bestOf3') return 2;
  return 3;
}

export function createSeries(format: SeriesFormat, firstPlayer: Player): SeriesState {
  return {
    format,
    score: { X: 0, O: 0 },
    gamesPlayed: 0,
    firstPlayer,
    finished: false,
    winner: null,
  };
}

export function recordGameResult(series: SeriesState, winner: Player | null): SeriesState {
  if (series.finished) return series;

  const score = { ...series.score };
  if (winner !== null) score[winner] += 1;

  const gamesPlayed = series.gamesPlayed + 1;
  // single — всегда ровно одна партия; в сериях конец достигается при targetWins победах
  const reachedTarget = winner !== null && score[winner] >= targetWins(series.format);
  const finished = series.format === 'single' || reachedTarget;

  return {
    ...series,
    score,
    gamesPlayed,
    firstPlayer: series.firstPlayer === 'X' ? 'O' : 'X',
    finished,
    winner: finished ? winner : null,
  };
}
