/** Пресеты таймера на ход: секунды, 0 — таймер выключен. */
export type TimerPreset = 0 | 5 | 10 | 30;

/** Состояние таймера на ход. Чистые данные, без таймеров и DOM. */
export interface TurnTimer {
  limitMs: number;
  remainingMs: number;
  running: boolean;
}

export function createTurnTimer(limitSec: TimerPreset): TurnTimer {
  const limitMs = limitSec * 1000;
  return { limitMs, remainingMs: limitMs, running: false };
}

/** Начало хода: полный лимит заново. Выключенный таймер (0) не запускается. */
export function restartTimer(timer: TurnTimer): TurnTimer {
  return { limitMs: timer.limitMs, remainingMs: timer.limitMs, running: timer.limitMs > 0 };
}

/** Пауза без сброса остатка (ход AI, конец партии). */
export function stopTimer(timer: TurnTimer): TurnTimer {
  return { ...timer, running: false };
}

/**
 * Продвижение времени. timedOut — единственный сигнал о истечении:
 * после срабатывания таймер остановлен, повторно сигнал не приходит.
 */
export function advanceTimer(
  timer: TurnTimer,
  deltaMs: number,
): { timer: TurnTimer; timedOut: boolean } {
  if (!timer.running || deltaMs <= 0) return { timer, timedOut: false };

  const remainingMs = timer.remainingMs - deltaMs;
  if (remainingMs <= 0) {
    return { timer: { ...timer, remainingMs: 0, running: false }, timedOut: true };
  }
  return { timer: { ...timer, remainingMs }, timedOut: false };
}
