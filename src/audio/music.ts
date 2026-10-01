/** Музыкальный контроллер — одна спокойная петля на Web Audio API (без ассетов). */
export interface MusicController {
  enabled: boolean;
  playing: boolean;
  /** Внутренний: текущий "таймер" осциллятор для отслеживания конца петли. */
  _oscillator?: OscillatorNode;
  /** Внутренний: AudioContext. */
  _ctx?: AudioContext | null;
}

/** Создаёт контроллер музыки (по умолчанию выключена). */
export function createMusic(): MusicController {
  return {
    enabled: false,
    playing: false,
  };
}

/** Включает/выключает музыку. При выключении — останавливает воспроизведение. */
export function setMusicEnabled(music: MusicController, value: boolean): void {
  music.enabled = value;
  if (!value && music.playing) {
    stopMusic(music);
  }
}

/** Останавливает музыку, если играет. */
export function stopMusic(music: MusicController): void {
  if (music._oscillator) {
    try {
      music._oscillator.stop();
    } catch {
      // игнорируем ошибки остановки
    }
    music._oscillator = undefined;
  }
  music.playing = false;
}

/** Ленивое создание AudioContext. */
function ensureContext(music: MusicController): AudioContext | null {
  if (music._ctx !== undefined) return music._ctx;
  const Ctor = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
  if (Ctor == null) {
    music._ctx = null;
    return null;
  }
  try {
    music._ctx = new Ctor();
  } catch {
    music._ctx = null;
  }
  return music._ctx as AudioContext | null;
}

/** Проигрывает музыкальную петлю. */
export function playMusic(music: MusicController): void {
  if (!music.enabled || music.playing) return;

  const ctx = ensureContext(music);
  if (ctx == null) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  music.playing = true;
  scheduleLoop(music, ctx);
}

/** Планирует одну итерацию петли и ставит следующую через onended. */
function scheduleLoop(music: MusicController, ctx: AudioContext): void {
  if (!music.enabled || !music.playing) return;

  const notes = [
    { freq: 261.63, dur: 1.2 },  // C4
    { freq: 329.63, dur: 1.2 },  // E4
    { freq: 392.00, dur: 1.2 },  // G4
    { freq: 523.25, dur: 1.2 },  // C5
    { freq: 659.25, dur: 1.2 },  // E5
    { freq: 783.99, dur: 1.2 },  // G5
    { freq: 1046.50, dur: 1.2 }, // C6
  ];

  const now = ctx.currentTime;
  let t = now;

  for (const note of notes) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(note.freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + note.dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + note.dur + 0.05);
    t += note.dur;
  }

  const loopDuration = notes.reduce((sum, n) => sum + n.dur, 0);
  const timerOsc = ctx.createOscillator();
  timerOsc.frequency.setValueAtTime(0, now);
  timerOsc.start(now);
  timerOsc.stop(now + loopDuration);

  music._oscillator = timerOsc;

  timerOsc.onended = () => {
    if (music.enabled && music.playing) {
      scheduleLoop(music, ctx);
    }
  };
}