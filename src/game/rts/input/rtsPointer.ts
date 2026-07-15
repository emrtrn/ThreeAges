/**
 * RTS pointer plumbing — Vertical Slice Plan v0.2 §21 ("Seçim ve komut").
 *
 * Translates raw canvas pointer events into high-level intents: a left click vs.
 * a left box-drag (selection), and a right click (a contextual move/attack
 * command). All coordinates are canvas-relative CSS pixels; the
 * gameplay meaning (raycast, rect test) lives in the systems that consume these
 * callbacks, keeping this module free of scene logic (plan §14).
 */

export interface RtsPointerRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface RtsPointerHandler {
  /** Left button released without dragging (single select / deselect). */
  onSelectClick(x: number, y: number, additive: boolean): void;
  /** Left drag crossed the threshold — live marquee update (may fire often). */
  onSelectDrag(rect: RtsPointerRect): void;
  /** Left drag released — commit the box selection. */
  onSelectCommit(rect: RtsPointerRect, additive: boolean): void;
  /** Left drag cancelled without commit (e.g. focus loss); hide the marquee. */
  onSelectCancel(): void;
  /** Right button released as a click (move/attack command). */
  onCommandClick?(x: number, y: number): void;
  /** Pointer moved over the field; used by the Phase 2 build ghost. */
  onPointerHover?(x: number, y: number): void;
}

/** Pixels the pointer must travel before a left press becomes a box drag. */
const DRAG_THRESHOLD_PX = 5;

export class RtsPointer {
  private attached = false;
  private leftDown = false;
  private dragging = false;
  private startX = 0;
  private startY = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly handler: RtsPointerHandler,
  ) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("blur", this.onCancel);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("blur", this.onCancel);
    this.onCancel();
  }

  private local(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button === 0) {
      const { x, y } = this.local(event);
      this.leftDown = true;
      this.dragging = false;
      this.startX = x;
      this.startY = y;
      this.canvas.setPointerCapture(event.pointerId);
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const { x, y } = this.local(event);
    this.handler.onPointerHover?.(x, y);
    if (!this.leftDown) return;
    if (!this.dragging) {
      const moved = Math.hypot(x - this.startX, y - this.startY);
      if (moved < DRAG_THRESHOLD_PX) return;
      this.dragging = true;
    }
    this.handler.onSelectDrag(this.rect(x, y));
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button === 0 && this.leftDown) {
      this.leftDown = false;
      const { x, y } = this.local(event);
      const additive = event.shiftKey;
      if (this.dragging) {
        this.dragging = false;
        this.handler.onSelectCommit(this.rect(x, y), additive);
      } else {
        this.handler.onSelectClick(x, y, additive);
      }
      return;
    }
    if (event.button === 2) {
      const { x, y } = this.local(event);
      this.handler.onCommandClick?.(x, y);
    }
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    // Right-click is a game command, never the browser menu.
    event.preventDefault();
  };

  private readonly onCancel = (): void => {
    if (this.leftDown || this.dragging) this.handler.onSelectCancel();
    this.leftDown = false;
    this.dragging = false;
  };

  private rect(x: number, y: number): RtsPointerRect {
    return { x0: this.startX, y0: this.startY, x1: x, y1: y };
  }
}
