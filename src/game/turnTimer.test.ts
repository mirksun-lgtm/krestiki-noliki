import { describe, expect, it } from 'vitest';
import { advanceTimer, createTurnTimer, restartTimer, stopTimer } from './turnTimer';
import { createGame, timeoutGame } from '../game/gameCore';
import { createSeries, recordGameResult } from '../game/series';

describe('createTurnTimer', () => {
  it('пресет 5 даёт лимит 5000 мс, но отсчёт не идёт до старта хода', () => {
    const timer = createTurnTimer(5);

    expect(timer.limitMs).toBe(5000);
    expect(timer.remainingMs).toBe(5000);
    expect(timer.running).toBe(false);
  });

  it('пресет «без таймера» даёт нулевой лимит', () => {
    const timer = createTurnTimer(0);

    expect(timer.limitMs).toBe(0);
    expect(timer.remainingMs).toBe(0);
    expect(timer.running).toBe(false);
  });
});

describe('restartTimer', () => {
  it('запускает отсчёт с полного лимита', () => {
    const timer = restartTimer(createTurnTimer(5));

    expect(timer.remainingMs).toBe(5000);
    expect(timer.running).toBe(true);
  });

  it('новый раунд сбрасывает таймер после срабатывания', () => {
    const fired = advanceTimer(restartTimer(createTurnTimer(5)), 6000);
    expect(fired.timedOut).toBe(true);

    const next = advanceTimer(restartTimer(fired.timer), 1000);

    expect(next.timedOut).toBe(false);
    expect(next.timer.remainingMs).toBe(4000);
    expect(next.timer.running).toBe(true);
  });

  it('для выключенного таймера сброс не запускает отсчёт', () => {
    const timer = restartTimer(createTurnTimer(0));

    expect(timer.running).toBe(false);
    expect(timer.remainingMs).toBe(0);
  });

  it('изменение режима применяется: новый пресет задаёт новый лимит', () => {
    const before = restartTimer(createTurnTimer(5));
    expect(before.limitMs).toBe(5000);

    const after = restartTimer(createTurnTimer(10));
    expect(after.limitMs).toBe(10000);
    expect(after.remainingMs).toBe(10000);
  });
});

describe('stopTimer', () => {
  it('останавливает отсчёт, сохраняя остаток', () => {
    const advanced = advanceTimer(restartTimer(createTurnTimer(10)), 3000);
    const stopped = stopTimer(advanced.timer);

    expect(stopped.running).toBe(false);
    expect(stopped.remainingMs).toBe(7000);
  });

  it('на ходу AI отсчёт не идёт и timeout не срабатывает', () => {
    const stopped = stopTimer(restartTimer(createTurnTimer(5)));
    const result = advanceTimer(stopped, 60_000);

    expect(result.timedOut).toBe(false);
    expect(result.timer.remainingMs).toBe(5000);
  });
});

describe('advanceTimer', () => {
  it('уменьшает остаток на прошедшее время', () => {
    const result = advanceTimer(restartTimer(createTurnTimer(10)), 2500);

    expect(result.timer.remainingMs).toBe(7500);
    expect(result.timedOut).toBe(false);
  });

  it('срабатывает по достижении нуля и останавливается', () => {
    const result = advanceTimer(restartTimer(createTurnTimer(5)), 5000);

    expect(result.timedOut).toBe(true);
    expect(result.timer.remainingMs).toBe(0);
    expect(result.timer.running).toBe(false);
  });

  it('повторный tick после срабатывания не даёт второй timeout', () => {
    const fired = advanceTimer(restartTimer(createTurnTimer(5)), 5000);
    const again = advanceTimer(fired.timer, 1000);

    expect(again.timedOut).toBe(false);
    expect(again.timer.remainingMs).toBe(0);
  });

  it('выключенный таймер никогда не срабатывает', () => {
    const result = advanceTimer(restartTimer(createTurnTimer(0)), 60_000);

    expect(result.timedOut).toBe(false);
  });

  it('завершённая партия не вызывает timeout: остановленный таймер не срабатывает', () => {
    const stopped = stopTimer(restartTimer(createTurnTimer(5)));

    expect(advanceTimer(stopped, 60_000).timedOut).toBe(false);
  });

  it('неположительный delta не меняет состояние', () => {
    const running = restartTimer(createTurnTimer(5));
    const result = advanceTimer(running, -100);

    expect(result.timedOut).toBe(false);
    expect(result.timer.remainingMs).toBe(5000);
    expect(result.timer.running).toBe(true);
  });
});

describe('истечение времени завершает партию', () => {
  it('timeout на ходу X — партию выигрывает O', () => {
    const timer = advanceTimer(restartTimer(createTurnTimer(5)), 5000);
    expect(timer.timedOut).toBe(true);

    const state = createGame('X');
    const result = timeoutGame(state);

    expect(result.status).toBe('win');
    expect(result.winner).toBe('O');
    expect(result.winningLine).toBeNull();
    expect(result.board).toEqual(state.board);
    expect(result.currentPlayer).toBe('X');
  });

  it('timeout на ходу O — партию выигрывает X', () => {
    const result = timeoutGame(createGame('O'));

    expect(result.status).toBe('win');
    expect(result.winner).toBe('X');
    expect(result.winningLine).toBeNull();
  });

  it('поражение по таймеру засчитывается в счёт серии', () => {
    const afterTimeout = timeoutGame(createGame('X'));
    const series = recordGameResult(createSeries('bestOf3', 'X'), afterTimeout.winner);

    expect(series.score).toEqual({ X: 0, O: 1 });
    expect(series.gamesPlayed).toBe(1);
  });
});
