import type { ActionMap } from "@engine/input/actionMap";

/**
 * Mouse-button -> {@link ActionMap} bridge (runtime DOM layer).
 *
 * Maps mouse button down/up to synthetic `Mouse<button>` codes (`Mouse0` left,
 * `Mouse2` right) so the action map can bind them like keys — e.g. TPS aim
 * (right) and fire (left). Observer only: it never calls `preventDefault`
 * (PointerLookSource already suppresses the context menu) and works whether or
 * not pointer lock is engaged.
 *
 * Down is captured on the canvas; up and blur are watched on `window` so a
 * release outside the canvas still clears the held state.
 */
export class PointerButtonSource {
  constructor(
    private readonly actions: ActionMap,
    private readonly canvas: HTMLElement,
    private readonly target: Window = window,
  ) {}

  attach(): void {
    this.canvas.addEventListener("mousedown", this.handleDown);
    this.target.addEventListener("mouseup", this.handleUp);
    this.target.addEventListener("blur", this.handleBlur);
  }

  detach(): void {
    this.canvas.removeEventListener("mousedown", this.handleDown);
    this.target.removeEventListener("mouseup", this.handleUp);
    this.target.removeEventListener("blur", this.handleBlur);
  }

  private handleDown = (event: MouseEvent): void => {
    this.actions.handleDown(`Mouse${event.button}`);
  };

  private handleUp = (event: MouseEvent): void => {
    this.actions.handleUp(`Mouse${event.button}`);
  };

  private handleBlur = (): void => {
    // Drop button state on focus loss so a held button does not stick.
    this.actions.handleUp("Mouse0");
    this.actions.handleUp("Mouse2");
  };
}
