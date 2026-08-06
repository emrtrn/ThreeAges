/**
 * The visible `?debug` panel: a performance instrument, and the speed picker.
 *
 * It used to print the whole simulation state, which made it a wall of text
 * nobody read while the numbers that actually decide whether the match is
 * playable — frame time, draw calls, what the AI costs per tick — were nowhere
 * on screen. Those simulation lines still exist, hidden, in
 * {@link RtsSimulationWitness}; this panel now shows only the speed control
 * (first, because it is the one thing here you *use* rather than read) and the
 * performance readout under it.
 */
import { formatRtsPerfDebug, type RtsPerfDebugSnapshot } from "./formatRtsPerfDebug";

export interface RtsDebugOverlayOptions {
  /** Arms a one-frame cost capture; the app decides when it actually happens. */
  readonly onCaptureFrame?: () => void;
}

export class RtsDebugOverlay {
  private readonly root = document.createElement("section");
  /** Above the readout, so a control never moves as the numbers grow a line. */
  private readonly controls = document.createElement("div");
  /** Reserved for the speed picker, so a later action cannot get in front of it. */
  private readonly controlSlot = document.createElement("div");
  private readonly readout = document.createElement("pre");

  constructor(options: RtsDebugOverlayOptions = {}) {
    this.root.className = "rts-debug-overlay";
    this.controls.className = "rts-debug-overlay-controls";
    this.controlSlot.className = "rts-debug-overlay-control-slot";
    this.controls.appendChild(this.controlSlot);
    this.readout.className = "rts-debug-overlay-readout";
    this.root.append(this.controls, this.readout);
    if (options.onCaptureFrame) {
      const capture = document.createElement("button");
      capture.type = "button";
      capture.className = "rts-debug-capture-button";
      capture.dataset.rtsDebugAction = "capture-frame";
      capture.textContent = "Kare maliyeti";
      capture.title = "Bir sonraki kareyi ölç, maçı duraklat ve dökümü göster";
      capture.addEventListener("click", () => options.onCaptureFrame?.());
      this.controls.appendChild(capture);
    }
    const host = document.getElementById("ui-overlay") ?? document.body;
    host.appendChild(this.root);
  }

  /** Keeps temporary test controls inside the same explicitly debug-only surface. */
  mountControl(control: { mount(parent: HTMLElement): void }): void {
    control.mount(this.controlSlot);
  }

  /**
   * Repaint the readout. The caller decides the cadence — sampled, not every
   * frame, so watching the frame time cannot become part of it.
   */
  setPerformance(snapshot: RtsPerfDebugSnapshot): void {
    this.readout.textContent = formatRtsPerfDebug(snapshot).join("\n");
  }

  dispose(): void {
    this.root.remove();
  }
}
