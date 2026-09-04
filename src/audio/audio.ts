import type { GameEvent } from '../game';

/**
 * Procedural audio — synthesised in WebAudio, no sample files, matching the
 * runtime-generated art. Music is a koto-ish loop on the yo pentatonic scale
 * with a taiko pulse; SFX are short synth hits.
 */

/** Yo scale (D E G A B) over two octaves, in Hz. */
const SCALE = [293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0, 987.77];

const BPM = 96;
const BEAT = 60 / BPM;
/** Scheduler lookahead: notes are queued this far in advance of playback. */
const LOOKAHEAD = 0.25;

/** Minimum seconds between repeats of the same cue, so a horde does not buzz. */
const THROTTLE: Partial<Record<GameEvent, number>> = {
  hit: 0.055,
  crit: 0.09,
  kill: 0.07,
  pickup: 0.05,
  hurt: 0.25,
};

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private lastPlayed = new Map<string, number>();
  private timer: number | null = null;
  private nextNote = 0;
  private step = 0;
  /** Raised while a boss is alive; the loop adds a drum layer. */
  private intensity = 0;

  muted: boolean;

  constructor(muted = false) {
    this.muted = muted;
  }

  /** Must be called from a user gesture — browsers start contexts suspended. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.55;
      this.sfxBus.connect(this.master);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.3;
      this.musicBus.connect(this.master);

      this.noiseBuffer = this.makeNoise();
    }
    void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.02);
    }
  }

  setIntensity(level: number): void {
    this.intensity = level;
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // ------------------------------------------------------------------ voices

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    bus: GainNode,
    bend = 1,
    at = 0,
  ): void {
    const ctx = this.ctx!;
    const t = (at || ctx.currentTime) + 0;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(freq * bend, t + duration);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(env).connect(bus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private noise(duration: number, gain: number, cutoff: number, bus: GainNode, at = 0): void {
    const ctx = this.ctx!;
    const t = (at || ctx.currentTime) + 0;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(cutoff * 0.25, 120), t + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(env).connect(bus);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  /** Koto-like pluck: two detuned triangles with a fast decay. */
  private pluck(freq: number, at: number, gain = 0.18): void {
    this.tone(freq, 0.42, 'triangle', gain, this.musicBus!, 1, at);
    this.tone(freq * 2.01, 0.16, 'sine', gain * 0.4, this.musicBus!, 1, at);
  }

  private taiko(at: number, gain = 0.5): void {
    this.tone(110, 0.24, 'sine', gain, this.musicBus!, 0.35, at);
    this.noise(0.09, gain * 0.35, 1800, this.musicBus!, at);
  }

  // --------------------------------------------------------------------- sfx

  play(kind: GameEvent): void {
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const now = this.ctx.currentTime;
    const gap = THROTTLE[kind];
    if (gap !== undefined) {
      const last = this.lastPlayed.get(kind) ?? -1;
      if (now - last < gap) return;
      this.lastPlayed.set(kind, now);
    }
    const bus = this.sfxBus;

    switch (kind) {
      case 'hit':
        this.noise(0.05, 0.18, 2600, bus);
        break;
      case 'crit':
        this.noise(0.07, 0.3, 4200, bus);
        this.tone(880, 0.09, 'square', 0.12, bus, 1.6);
        break;
      case 'kill':
        this.tone(520, 0.12, 'square', 0.1, bus, 0.55);
        break;
      case 'pickup':
        this.tone(1180, 0.08, 'sine', 0.12, bus, 1.25);
        break;
      case 'levelup':
        // Rising pentatonic flourish.
        [0, 2, 4, 7].forEach((n, i) => {
          this.tone(SCALE[n + 2], 0.3, 'triangle', 0.22, bus, 1, this.ctx!.currentTime + i * 0.07);
        });
        break;
      case 'hurt':
        this.tone(170, 0.22, 'sawtooth', 0.24, bus, 0.5);
        this.noise(0.12, 0.16, 900, bus);
        break;
      case 'revive':
        [0, 3, 5, 8].forEach((n, i) => {
          this.tone(SCALE[n], 0.5, 'sine', 0.26, bus, 1, this.ctx!.currentTime + i * 0.1);
        });
        break;
      case 'bossSpawn':
        this.taiko(this.ctx.currentTime, 0.9);
        this.taiko(this.ctx.currentTime + 0.28, 0.9);
        this.tone(82, 1.4, 'sawtooth', 0.2, bus, 0.6);
        break;
      case 'bossPhase':
        // Gong: detuned partials with a long tail.
        [1, 1.48, 2.31, 3.02].forEach((m) => this.tone(196 * m, 1.8, 'sine', 0.16, bus, 0.98));
        this.noise(0.5, 0.2, 3400, bus);
        break;
      case 'gameover':
        [8, 5, 3, 0].forEach((n, i) => {
          this.tone(SCALE[n], 0.7, 'triangle', 0.24, bus, 1, this.ctx!.currentTime + i * 0.16);
        });
        break;
    }
  }

  // ------------------------------------------------------------------- music

  startMusic(): void {
    if (!this.ctx || this.timer !== null) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = setInterval(() => this.schedule(), 40) as unknown as number;
  }

  stopMusic(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Queues every note that falls inside the lookahead window. */
  private schedule(): void {
    if (!this.ctx || !this.musicBus) return;
    const eighth = BEAT / 2;

    while (this.nextNote < this.ctx.currentTime + LOOKAHEAD) {
      const at = this.nextNote;
      const s = this.step % 16;

      // Melody: sparse plucks walking the pentatonic scale.
      if (s % 2 === 0) {
        const degree = [0, 2, 4, 2, 5, 4, 2, 1][(this.step / 2) % 8 | 0];
        this.pluck(SCALE[degree + (s >= 8 ? 2 : 0)], at, 0.16);
      }
      // Drone every bar keeps the key anchored.
      if (s === 0) this.tone(SCALE[0] / 2, 1.6, 'sine', 0.1, this.musicBus, 1, at);
      // Taiko on 1 and 3; the boss layer fills in the off-beats.
      if (s === 0 || s === 8) this.taiko(at, 0.4);
      if (this.intensity > 0 && (s === 4 || s === 12)) this.taiko(at, 0.3);
      if (this.intensity > 0 && s % 4 === 2) this.noise(0.05, 0.06, 5200, this.musicBus, at);

      this.nextNote += eighth;
      this.step++;
    }
  }
}
