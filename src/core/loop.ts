/**
 * Fixed-timestep simulation with decoupled rendering.
 * Sim always advances in exact STEP increments so gameplay is frame-rate independent.
 */
export const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;

export class Loop {
  private accumulator = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      // Clamp so an alt-tab pause does not fast-forward the whole run.
      const frame = Math.min((now - this.last) / 1000, 0.25);
      this.last = now;
      this.accumulator += frame;

      let steps = 0;
      while (this.accumulator >= STEP && steps < MAX_STEPS_PER_FRAME) {
        this.update(STEP);
        this.accumulator -= STEP;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;

      this.render(this.accumulator / STEP);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
