import { describe, expect, it } from 'vitest';
import { outcomeSfx } from './sfx';

describe('outcomeSfx', () => {
  it('PvP: победа → win', () => {
    expect(outcomeSfx({ mode: 'pvp', winner: 'X', side: 'X', timedOut: false })).toBe('win');
  });

  it('PvP: ничья → draw', () => {
    expect(outcomeSfx({ mode: 'pvp', winner: null, side: 'O', timedOut: false })).toBe('draw');
  });

  it('PvP: timeout → timeout, даже когда у соперника есть победа', () => {
    expect(outcomeSfx({ mode: 'pvp', winner: 'O', side: 'X', timedOut: true })).toBe('timeout');
  });

  it('PvE: победа стороны игрока → win', () => {
    expect(outcomeSfx({ mode: 'pve', winner: 'X', side: 'X', timedOut: false })).toBe('win');
  });

  it('PvE: игрок начал за O и победил → win', () => {
    expect(outcomeSfx({ mode: 'pve', winner: 'O', side: 'O', timedOut: false })).toBe('win');
  });

  it('PvE: победа AI → loss', () => {
    expect(outcomeSfx({ mode: 'pve', winner: 'O', side: 'X', timedOut: false })).toBe('loss');
  });

  it('PvE: ничья → draw', () => {
    expect(outcomeSfx({ mode: 'pve', winner: null, side: 'X', timedOut: false })).toBe('draw');
  });

  it('PvE: timeout → timeout (не loss)', () => {
    expect(outcomeSfx({ mode: 'pve', winner: 'X', side: 'X', timedOut: true })).toBe('timeout');
  });
});
