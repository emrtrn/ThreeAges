/**
 * Right-button drag -> look-delta bridge (runtime DOM layer).
 *
 * Accumulates pointer movement while the right mouse button is held on the game
 * canvas, so a Game Mode session can turn it into camera look each tick. The
 * runtime equivalent of the editor's orbit drag, but standalone — the editor
 * camera controller is editor-only and never reaches the game runtime.
 *
 * Observer that owns only its own gesture: it suppresses the context menu and
 * captures the pointer while dragging, and exposes the accumulated delta through
 * {@link consume}. The math (look angles) lives in pure game code.
 */
export class PointerLookSource {
  private active = false;
  private pointerId: number | null = null;
  private dx = 0;
  private dy = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  attach(): void {
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerUp);
    this.canvas.addEventListener("contextmenu", this.handleContextMenu);
  }

  detach(): void {
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
    this.canvas.removeEventListener("contextmenu", this.handleContextMenu);
  }

  /** Returns the look delta (pixels) accumulated since the last call and resets it. */
  consume(): { dx: number; dy: number } {
    const delta = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return delta;
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 2) return;
    event.preventDefault();
    this.active = true;
    this.pointerId = event.pointerId;
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can be unavailable; the move handler still works.
    }
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.active || event.pointerId !== this.pointerId) return;
    this.dx += event.movementX;
    this.dy += event.movementY;
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.active = false;
    this.pointerId = null;
    try {
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Capture may already be gone.
    }
  };

  private handleContextMenu = (event: Event): void => {
    // Right-drag look would otherwise pop the browser context menu.
    event.preventDefault();
  };
}
