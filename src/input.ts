/** Keyboard + touch-drag movement input, normalised by the caller. */
export class Input {
  private readonly keys = new Set<string>();
  private touchId: number | null = null;
  private touchOrigin = { x: 0, y: 0 };
  private touchVec = { x: 0, z: 0 };

  constructor(target: HTMLElement) {
    addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());

    target.addEventListener('pointerdown', (e) => {
      if (this.touchId !== null) return;
      this.touchId = e.pointerId;
      this.touchOrigin = { x: e.clientX, y: e.clientY };
      target.setPointerCapture(e.pointerId);
    });
    target.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.touchId) return;
      const dx = e.clientX - this.touchOrigin.x;
      const dy = e.clientY - this.touchOrigin.y;
      // A short drag is enough for full speed; the deadzone stops jitter.
      const len = Math.hypot(dx, dy);
      if (len < 12) {
        this.touchVec = { x: 0, z: 0 };
        return;
      }
      const k = Math.min(len, 60) / len;
      this.touchVec = { x: dx * k, z: dy * k };
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.touchId) return;
      this.touchId = null;
      this.touchVec = { x: 0, z: 0 };
    };
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }

  /** World-space direction. +z is "down the screen" under the tilted camera. */
  direction(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) z += 1;
    if (x === 0 && z === 0) return this.touchVec;
    return { x, z };
  }
}
