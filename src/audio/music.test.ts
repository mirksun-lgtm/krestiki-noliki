import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Music Module', () => {
  let audioContextMock: any;
  let oscillatorMock: any;
  let gainMock: any;

  beforeEach(() => {
    vi.resetModules();

    // Mock AudioContext and related APIs
    oscillatorMock = {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    };

    gainMock = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    audioContextMock = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createOscillator: vi.fn(() => oscillatorMock),
      createGain: vi.fn(() => gainMock),
      resume: vi.fn().mockResolvedValue(undefined),
    };

    // Create a proper constructor mock
    const AudioContextMock = vi.fn(function(this: any) {
      return audioContextMock;
    }) as any;
    
    vi.stubGlobal('AudioContext', AudioContextMock);
    vi.stubGlobal('webkitAudioContext', AudioContextMock);
  });

  async function getModule() {
    return await import('./music');
  }

  describe('createMusic', () => {
    it('creates a music controller with disabled state by default', async () => {
      const { createMusic } = await getModule();
      const music = createMusic();
      expect(music.enabled).toBe(false);
      expect(music.playing).toBe(false);
    });
  });

  describe('setMusicEnabled', () => {
    it('enables music', async () => {
      const { createMusic, setMusicEnabled } = await getModule();
      const music = createMusic();
      setMusicEnabled(music, true);
      expect(music.enabled).toBe(true);
    });

    it('disables music', async () => {
      const { createMusic, setMusicEnabled } = await getModule();
      const music = createMusic();
      setMusicEnabled(music, true);
      setMusicEnabled(music, false);
      expect(music.enabled).toBe(false);
    });

    it('stops music when disabled while playing', async () => {
      const { createMusic, setMusicEnabled, playMusic } = await getModule();
      const music = createMusic();
      setMusicEnabled(music, true);
      playMusic(music);
      expect(music.playing).toBe(true);

      setMusicEnabled(music, false);
      expect(music.enabled).toBe(false);
      expect(music.playing).toBe(false);
      expect(oscillatorMock.stop).toHaveBeenCalled();
    });
  });

  describe('playMusic', () => {
    it('does nothing when music is disabled', async () => {
      const { createMusic, playMusic } = await getModule();
      const music = createMusic();
      playMusic(music);
      expect(music.playing).toBe(false);
      expect(audioContextMock.createOscillator).not.toHaveBeenCalled();
    });

    it('starts music when enabled', async () => {
      const { createMusic, setMusicEnabled, playMusic } = await getModule();
      const music = createMusic();
      setMusicEnabled(music, true);
      playMusic(music);

      expect(music.playing).toBe(true);
      expect(audioContextMock.createOscillator).toHaveBeenCalled();
      expect(audioContextMock.createGain).toHaveBeenCalled();
      expect(oscillatorMock.connect).toHaveBeenCalledWith(gainMock);
      expect(gainMock.connect).toHaveBeenCalledWith(audioContextMock.destination);
      expect(oscillatorMock.start).toHaveBeenCalled();
    });

    it('does not start twice if already playing', async () => {
      const { createMusic, setMusicEnabled, playMusic } = await getModule();
      const music = createMusic();
      setMusicEnabled(music, true);
      playMusic(music);
      const firstCallCount = audioContextMock.createOscillator.mock.calls.length;
      playMusic(music);

      // Second call should not schedule additional oscillators
      expect(audioContextMock.createOscillator).toHaveBeenCalledTimes(firstCallCount);
    });

    it('resumes audio context if suspended', async () => {
      audioContextMock.state = 'suspended';
      const { createMusic, setMusicEnabled, playMusic } = await getModule();
      const music = createMusic();
      setMusicEnabled(music, true);
      playMusic(music);

      await vi.waitFor(() => expect(audioContextMock.resume).toHaveBeenCalled());
    });
  });

  describe('stopMusic', () => {
    it('stops playing music', async () => {
      const { createMusic, setMusicEnabled, playMusic, stopMusic } = await getModule();
      const music = createMusic();
      setMusicEnabled(music, true);
      playMusic(music);
      expect(music.playing).toBe(true);

      stopMusic(music);
      expect(music.playing).toBe(false);
      expect(oscillatorMock.stop).toHaveBeenCalled();
    });

    it('does nothing if not playing', async () => {
      const { createMusic, setMusicEnabled, stopMusic } = await getModule();
      const music = createMusic();
      setMusicEnabled(music, true);
      stopMusic(music);

      expect(oscillatorMock.stop).not.toHaveBeenCalled();
    });
  });

  describe('looping', () => {
    it('schedules next loop when current ends', async () => {
      const { createMusic, setMusicEnabled, playMusic } = await getModule();
      const music = createMusic();
      setMusicEnabled(music, true);
      playMusic(music);

      const firstLoopCalls = audioContextMock.createOscillator.mock.calls.length;

      // Simulate loop end by calling the onended handler
      const onEnded = oscillatorMock.onended;
      if (onEnded) onEnded();

      // Should schedule a second loop (8 more oscillators: 7 notes + 1 timer)
      expect(audioContextMock.createOscillator).toHaveBeenCalledTimes(firstLoopCalls + 8);
    });

    it('stops looping when disabled', async () => {
      const { createMusic, setMusicEnabled, playMusic } = await getModule();
      const music = createMusic();
      setMusicEnabled(music, true);
      playMusic(music);

      setMusicEnabled(music, false);

      const onEnded = oscillatorMock.onended;
      if (onEnded) onEnded();

      // Should not schedule new oscillator
      expect(audioContextMock.createOscillator).toHaveBeenCalledTimes(8); // Only first loop
    });
  });
});