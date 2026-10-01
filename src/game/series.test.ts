import { describe, expect, it } from 'vitest';
import { createSeries, recordGameResult, targetWins, type SeriesState } from './series';

describe('createSeries', () => {
  it('начинает серию с нулевого счёта и непройденных партий', () => {
    const series = createSeries('bestOf3', 'X');

    expect(series.format).toBe('bestOf3');
    expect(series.score).toEqual({ X: 0, O: 0 });
    expect(series.gamesPlayed).toBe(0);
    expect(series.firstPlayer).toBe('X');
    expect(series.finished).toBe(false);
    expect(series.winner).toBeNull();
  });

  it('позволяет задать начального первого игрока O', () => {
    expect(createSeries('bestOf5', 'O').firstPlayer).toBe('O');
  });

  it('формат single тоже создаётся', () => {
    const series = createSeries('single', 'X');

    expect(series.format).toBe('single');
    expect(series.finished).toBe(false);
  });
});

describe('targetWins', () => {
  it('single — до 1 победы', () => {
    expect(targetWins('single')).toBe(1);
  });

  it('bestOf3 — до 2 побед', () => {
    expect(targetWins('bestOf3')).toBe(2);
  });

  it('bestOf5 — до 3 побед', () => {
    expect(targetWins('bestOf5')).toBe(3);
  });
});

describe('recordGameResult', () => {
  it('записывает победу X в счёт', () => {
    const series = recordGameResult(createSeries('bestOf3', 'X'), 'X');

    expect(series.score).toEqual({ X: 1, O: 0 });
    expect(series.gamesPlayed).toBe(1);
    expect(series.finished).toBe(false);
    expect(series.winner).toBeNull();
  });

  it('записывает победу O в счёт', () => {
    const series = recordGameResult(createSeries('bestOf3', 'X'), 'O');

    expect(series.score).toEqual({ X: 0, O: 1 });
    expect(series.finished).toBe(false);
  });

  it('ничья не меняет счёт, но партия засчитывается', () => {
    const series = recordGameResult(createSeries('bestOf3', 'X'), null);

    expect(series.score).toEqual({ X: 0, O: 0 });
    expect(series.gamesPlayed).toBe(1);
    expect(series.finished).toBe(false);
  });

  it('single завершается победой', () => {
    const series = recordGameResult(createSeries('single', 'X'), 'X');

    expect(series.finished).toBe(true);
    expect(series.winner).toBe('X');
  });

  it('single завершается ничьей без победителя', () => {
    const series = recordGameResult(createSeries('single', 'X'), null);

    expect(series.finished).toBe(true);
    expect(series.winner).toBeNull();
  });

  it('bestOf3 не завершается при счёте 1:0', () => {
    const series = recordGameResult(createSeries('bestOf3', 'X'), 'X');

    expect(series.finished).toBe(false);
    expect(series.winner).toBeNull();
  });

  it('bestOf3 завершается при второй победе X', () => {
    let series = createSeries('bestOf3', 'X');
    series = recordGameResult(series, 'X');
    series = recordGameResult(series, 'X');

    expect(series.score).toEqual({ X: 2, O: 0 });
    expect(series.finished).toBe(true);
    expect(series.winner).toBe('X');
  });

  it('bestOf3 учитывает ничью между победами O', () => {
    let series = createSeries('bestOf3', 'O');
    series = recordGameResult(series, null);
    series = recordGameResult(series, 'O');
    series = recordGameResult(series, 'O');

    expect(series.score).toEqual({ X: 0, O: 2 });
    expect(series.finished).toBe(true);
    expect(series.winner).toBe('O');
  });

  it('bestOf5 требует три победы', () => {
    let series = createSeries('bestOf5', 'X');
    series = recordGameResult(series, 'X');
    series = recordGameResult(series, 'X');
    expect(series.finished).toBe(false);

    series = recordGameResult(series, 'X');

    expect(series.finished).toBe(true);
    expect(series.winner).toBe('X');
  });

  it('ничья никогда не завершает серию bestOf3', () => {
    let series = createSeries('bestOf3', 'X');
    for (let i = 0; i < 5; i++) series = recordGameResult(series, null);

    expect(series.finished).toBe(false);
    expect(series.gamesPlayed).toBe(5);
    expect(series.score).toEqual({ X: 0, O: 0 });
  });

  it('первый ход чередуется после победы', () => {
    let series = createSeries('bestOf3', 'X');
    series = recordGameResult(series, 'X');

    expect(series.firstPlayer).toBe('O');

    series = recordGameResult(series, 'O');
    expect(series.firstPlayer).toBe('X');
  });

  it('первый ход чередуется и после ничьей', () => {
    const series = recordGameResult(createSeries('bestOf3', 'X'), null);

    expect(series.firstPlayer).toBe('O');
  });

  it('результат в завершённой серии не меняет состояние', () => {
    const finished = recordGameResult(createSeries('single', 'X'), 'X');
    const after = recordGameResult(finished, 'O');

    expect(after).toEqual(finished);
  });

  it('не дублирует счёт при повторной записи после завершения', () => {
    let series = recordGameResult(createSeries('bestOf3', 'X'), 'X');
    series = recordGameResult(series, 'X');
    expect(series.finished).toBe(true);

    series = recordGameResult(series, 'X');

    expect(series.score).toEqual({ X: 2, O: 0 });
    expect(series.winner).toBe('X');
  });
});

describe('серия как последовательность партий', () => {
  it('bestOf3 доигрывается до победителя 2:1', () => {
    const results: Array<'X' | 'O' | null> = ['X', 'O', 'X'];
    let series: SeriesState = createSeries('bestOf3', 'X');

    for (const result of results) series = recordGameResult(series, result);

    expect(series.gamesPlayed).toBe(3);
    expect(series.score).toEqual({ X: 2, O: 1 });
    expect(series.finished).toBe(true);
    expect(series.winner).toBe('X');
  });

  it('после каждой партии начинает другой игрок', () => {
    let series = createSeries('bestOf3', 'X');
    const starters = [series.firstPlayer];

    for (const result of ['X', null, 'O'] as const) {
      series = recordGameResult(series, result);
      starters.push(series.firstPlayer);
    }

    expect(starters).toEqual(['X', 'O', 'X', 'O']);
  });
});
