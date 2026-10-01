/** Имена звуковых эффектов игры (GDD §17.1). */
export type SfxName =
  | 'move'
  | 'error'
  | 'tick'
  | 'win'
  | 'loss'
  | 'draw'
  | 'timeout'
  | 'achievement';

/** Факты последней партии, нужные для выбора звука результата. */
export interface OutcomeContext {
  mode: 'pvp' | 'pve';
  winner: 'X' | 'O' | null;
  /** Сторона игрока (в PvE — за кого играет человек). */
  side: 'X' | 'O';
  timedOut: boolean;
}

/**
 * Звук по итогу партии: timeout и ничья — отдельные сигналы;
 * в PvE победа/поражение зависит от перспективы игрока, в PvP победа одна.
 */
export function outcomeSfx(ctx: OutcomeContext): SfxName {
  if (ctx.timedOut) return 'timeout';
  if (ctx.winner === null) return 'draw';
  if (ctx.mode === 'pvp') return 'win';
  return ctx.winner === ctx.side ? 'win' : 'loss';
}

/** Один тон эффекта; время и частоты задаются относительно начала эффекта. */
interface Tone {
  freq: number;
  dur: number;
  at?: number;
  type?: OscillatorType;
  gain?: number;
  /** Конечная частота — плавное «скольжение» тона вниз. */
  glideTo?: number;
}

/**
 * Рецепты синтезированных звуков (без ассетов — решение по графике 01.10.2026):
 * мягкие короткие тоны, общий gain держится низким, чтобы не раздражать.
 */
const RECIPES: Record<SfxName, Tone[]> = {
  move: [{ freq: 340, glideTo: 190, dur: 0.09, type: 'triangle', gain: 0.2 }],
  error: [{ freq: 170, dur: 0.16, type: 'square', gain: 0.08 }],
  tick: [{ freq: 880, dur: 0.05, gain: 0.1 }],
  win: [
    { freq: 523, dur: 0.12, at: 0 },
    { freq: 659, dur: 0.12, at: 0.1 },
    { freq: 784, dur: 0.24, at: 0.2, gain: 0.22 },
  ],
  loss: [
    { freq: 392, dur: 0.16, at: 0, type: 'triangle' },
    { freq: 330, dur: 0.16, at: 0.13, type: 'triangle' },
    { freq: 262, dur: 0.3, at: 0.26, type: 'triangle' },
  ],
  draw: [
    { freq: 494, dur: 0.14, at: 0 },
    { freq: 440, dur: 0.22, at: 0.12 },
  ],
  timeout: [{ freq: 620, glideTo: 180, dur: 0.5, type: 'triangle', gain: 0.16 }],
  achievement: [
    { freq: 659, dur: 0.1, at: 0, gain: 0.18 },
    { freq: 784, dur: 0.1, at: 0.08, gain: 0.18 },
    { freq: 988, dur: 0.1, at: 0.16, gain: 0.18 },
    { freq: 1319, dur: 0.3, at: 0.24, gain: 0.22 },
  ],
};

let enabled = true;
let audioCtx: AudioContext | null = null;

export function setSfxEnabled(value: boolean): void {
  enabled = value;
}

/** Ленивое создание AudioContext; недоступность означает работу без звука. */
function ensureContext(): AudioContext | null {
  if (audioCtx !== null) return audioCtx;
  const Ctor = globalThis.AudioContext;
  if (Ctor == null) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

function playTone(c: AudioContext, t: Tone): void {
  const start = c.currentTime + (t.at ?? 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = t.type ?? 'sine';
  osc.frequency.setValueAtTime(t.freq, start);
  if (t.glideTo != null) osc.frequency.exponentialRampToValueAtTime(t.glideTo, start + t.dur);
  const peak = t.gain ?? 0.2;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(start);
  osc.stop(start + t.dur + 0.03);
}

/** Проигрывает эффект. Любые сбои аудио на игру не влияют. */
export function playSfx(name: SfxName): void {
  if (!enabled) return;
  try {
    const c = ensureContext();
    if (c == null) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    for (const tone of RECIPES[name]) playTone(c, tone);
  } catch {
    // звук не критичен — игра продолжается без него
  }
}

/**
 * Разворачивает AudioContext после первого жеста пользователя:
 * autoplay policy браузера запрещает звук до жеста.
 */
export function initSfx(): void {
  const unlock = (): void => {
    try {
      const c = ensureContext();
      if (c != null && c.state === 'suspended') c.resume().catch(() => {});
    } catch {
      // без звука
    }
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
}
