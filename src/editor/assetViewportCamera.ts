/**
 * Shared viewport scaffolding for the asset editors (Static + Skeletal mesh).
 *
 * `OrbitViewportCamera` owns the minimal orbit / pan / dolly pointer+wheel wiring
 * and writes the camera from a shared `Spherical` + look-at `target`;
 * `createAssetViewportRig` adds the identical studio lighting + floor grid. Both
 * were duplicated verbatim in the two editors — extracted here without behaviour
 * change. Each editor keeps its own renderer / raf loop / dispose and passes
 * gizmo + selection hooks.
 */
import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  Spherical,
  Vector3,
  type PerspectiveCamera,
  type Scene,
} from "three";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Per-editor callbacks so the shared controller defers gizmo/selection logic. */
export interface OrbitViewportCameraHooks {
  /** Return true to let another handler (e.g. a transform gizmo) own this press. */
  readonly shouldSkipPointerDown?: (event: PointerEvent) => boolean;
  /** Return true to suppress orbit/pan this move (e.g. a gizmo drag is active). */
  readonly isDragSuppressed?: () => boolean;
  /** Runs on every pointerdown before a drag starts (close menus, record Alt…). */
  readonly onPointerDown?: (event: PointerEvent) => void;
  /** Runs on a left-button release; `dragDistance` is px moved since the press. */
  readonly onClick?: (event: PointerEvent, dragDistance: number) => void;
}

/**
 * Minimal orbit/pan/dolly camera. Holds references to the editor's `spherical`
 * and `target` (so existing call sites keep working) and reads the framed model
 * radius lazily to bound the dolly range.
 */
export class OrbitViewportCamera {
  constructor(
    private readonly camera: PerspectiveCamera,
    readonly spherical: Spherical,
    readonly target: Vector3,
    private readonly getModelRadius: () => number,
  ) {}

  /** Writes the camera position/orientation from the spherical offset + target. */
  update(): void {
    const offset = new Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  /** Wires orbit (drag) / pan (shift|middle|right-drag) / dolly (wheel) onto `el`. */
  bind(el: HTMLElement, hooks: OrbitViewportCameraHooks = {}): void {
    let mode: "orbit" | "pan" | null = null;
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;

    el.addEventListener("contextmenu", (event) => event.preventDefault());
    el.addEventListener("pointerdown", (event) => {
      hooks.onPointerDown?.(event);
      if (hooks.shouldSkipPointerDown?.(event)) return;
      lastX = downX = event.clientX;
      lastY = downY = event.clientY;
      mode = event.button === 1 || event.shiftKey || event.button === 2 ? "pan" : "orbit";
      el.setPointerCapture(event.pointerId);
    });
    el.addEventListener("pointermove", (event) => {
      if (!mode || hooks.isDragSuppressed?.()) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      if (mode === "orbit") {
        this.spherical.theta -= dx * 0.01;
        this.spherical.phi = clamp(this.spherical.phi - dy * 0.01, 0.05, Math.PI - 0.05);
      } else {
        const panScale = this.spherical.radius * 0.0015;
        const right = new Vector3().setFromMatrixColumn(this.camera.matrix, 0);
        const up = new Vector3().setFromMatrixColumn(this.camera.matrix, 1);
        this.target.addScaledVector(right, -dx * panScale);
        this.target.addScaledVector(up, dy * panScale);
      }
      this.update();
    });
    const end = (event: PointerEvent): void => {
      const wasDragging = mode !== null;
      mode = null;
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
      if (wasDragging && event.button === 0) {
        hooks.onClick?.(event, Math.hypot(event.clientX - downX, event.clientY - downY));
      }
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const factor = Math.exp(event.deltaY * 0.001);
        const radius = this.getModelRadius();
        this.spherical.radius = clamp(this.spherical.radius * factor, radius * 0.2, radius * 12);
        this.update();
      },
      { passive: false },
    );
  }
}

/**
 * Adds the shared studio rig (neutral background, key+fill directionals, floor
 * grid) used by the asset editor viewports — the identical setup previously
 * inlined in both editors' `buildScene`.
 */
export function createAssetViewportRig(scene: Scene): void {
  scene.background = new Color(0x23262b);
  scene.add(new AmbientLight(0xffffff, 1.1));
  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 5, 2.5);
  scene.add(key);
  const fill = new DirectionalLight(0xb9d4ff, 1.0);
  fill.position.set(-3, 2.5, -2);
  scene.add(fill);
  scene.add(new GridHelper(20, 40, 0x55585c, 0x33373d));
}
