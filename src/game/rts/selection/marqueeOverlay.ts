/**
 * Selection marquee overlay — Vertical Slice Plan v0.2 §21 ("Kutu seçimi").
 *
 * A thin DOM rectangle drawn over the canvas while the player box-drags. It is
 * pure presentation (no hit-testing); the SelectionSystem decides which units
 * fall inside. Mounted into `#ui-overlay` (the HUD layer per index.html) so it
 * sits above the WebGL canvas.
 */
import type { RtsPointerRect } from "../input/rtsPointer";

export class MarqueeOverlay {
  private readonly el: HTMLDivElement;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "rts-marquee";
    Object.assign(this.el.style, {
      position: "absolute",
      border: "1px solid #cfe8b0",
      background: "rgba(160, 210, 120, 0.18)",
      pointerEvents: "none",
      display: "none",
      left: "0",
      top: "0",
    } satisfies Partial<CSSStyleDeclaration>);
    const host = document.getElementById("ui-overlay") ?? document.body;
    host.appendChild(this.el);
  }

  show(rect: RtsPointerRect): void {
    const left = Math.min(rect.x0, rect.x1);
    const top = Math.min(rect.y0, rect.y1);
    const width = Math.abs(rect.x1 - rect.x0);
    const height = Math.abs(rect.y1 - rect.y0);
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    this.el.style.width = `${width}px`;
    this.el.style.height = `${height}px`;
    this.el.style.display = "block";
  }

  hide(): void {
    this.el.style.display = "none";
  }

  dispose(): void {
    this.el.remove();
  }
}
