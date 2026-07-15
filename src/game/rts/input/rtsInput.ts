/**
 * RTS raw-input source — Vertical Slice Plan v0.2 §21.
 *
 * Owns the browser event plumbing for the RTS runtime: keyboard pan state, an
 * accumulated wheel delta, and the live pointer position. Camera / selection
 * systems read this snapshot each frame; the input source itself holds no
 * gameplay logic (plan §14: systems stay separate).
 *
 * Focus loss (blur / tab hidden) clears all held state so a key held while the
 * window loses focus does not "stick" (plan §21: "Pencere odağı kaybında input
 * sıfırla", §23 acceptance: "Düşük kare hızında input takılı kalmıyor").
 */

/** Screen-relative pan intent, each component in [-1, 1]. */
export interface RtsPanIntent {
  /** +1 = pan right (screen +X), -1 = pan left. */
  x: number;
  /** +1 = pan forward (away from camera), -1 = pan back toward camera. */
  z: number;
}

const PAN_KEYS = new Map<string, keyof RtsPanIntent | "up" | "down" | "left" | "right">([
  ["KeyW", "up"],
  ["ArrowUp", "up"],
  ["KeyS", "down"],
  ["ArrowDown", "down"],
  ["KeyA", "left"],
  ["ArrowLeft", "left"],
  ["KeyD", "right"],
  ["ArrowRight", "right"],
]);

export class RtsInput {
  private readonly held = new Set<string>();
  /** Accumulated, unconsumed wheel delta (positive = zoom out). */
  private wheelDelta = 0;
  /** Pointer position in CSS pixels relative to the canvas, or null when outside. */
  private pointerX: number | null = null;
  private pointerY: number | null = null;
  private attached = false;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onFocusLost);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onFocusLost);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.reset();
  }

  /** Current screen-relative pan intent from held keys (normalized diagonals). */
  panIntent(): RtsPanIntent {
    let x = 0;
    let z = 0;
    if (this.held.has("left")) x -= 1;
    if (this.held.has("right")) x += 1;
    if (this.held.has("up")) z += 1;
    if (this.held.has("down")) z -= 1;
    if (x !== 0 && z !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      z *= inv;
    }
    return { x, z };
  }

  /** Take and clear the accumulated wheel delta (positive = zoom out). */
  consumeWheelDelta(): number {
    const delta = this.wheelDelta;
    this.wheelDelta = 0;
    return delta;
  }

  /** Live pointer position in canvas CSS pixels, or null when off-canvas. */
  pointerPosition(): { x: number; y: number } | null {
    return this.pointerX === null || this.pointerY === null
      ? null
      : { x: this.pointerX, y: this.pointerY };
  }

  /** Drop all held/accumulated input (focus loss, detach). */
  reset(): void {
    this.held.clear();
    this.wheelDelta = 0;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const dir = PAN_KEYS.get(event.code);
    if (dir) this.held.add(dir);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const dir = PAN_KEYS.get(event.code);
    if (dir) this.held.delete(dir);
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    // Normalize to notches; deltaMode 0 (pixels) divides down, 1 (lines) is ~1.
    this.wheelDelta += event.deltaMode === 0 ? event.deltaY / 100 : event.deltaY;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerX = event.clientX - rect.left;
    this.pointerY = event.clientY - rect.top;
  };

  private readonly onPointerLeave = (): void => {
    this.pointerX = null;
    this.pointerY = null;
  };

  private readonly onFocusLost = (): void => {
    this.reset();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.reset();
  };
}
