/**
 * World-space unit health bar — Vertical Slice Plan v0.2 §45 ("UI: Sağlık
 * çubukları").
 *
 * A two-quad billboard above a unit. Deliberately unlit and depth-test-free: a
 * bar that a friendly capsule can hide is worse than no bar, because the player
 * reads it to decide whether to retreat (GDD 06 §3.4).
 */
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
} from "three";

/** Shared scratch: every bar billboards on the same frame, one after another. */
const scratchQuaternion = new Quaternion();

const BAR_HEIGHT = 0.14;
/** Health ratios at which the bar changes colour, high band first. */
const BAR_COLORS: readonly (readonly [number, string])[] = [
  [0.5, "#57c15a"],
  [0.25, "#d8c14a"],
  [0, "#cf4b3f"],
];

export class HealthBar {
  readonly object = new Group();
  private readonly fill: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly color = new Color();
  private lastRatio = -1;

  constructor(private readonly width: number, height: number) {
    this.object.name = "rts-unit-health-bar";
    this.object.position.y = height;
    // Render after the world so a bar is never swallowed by the body it labels.
    this.object.renderOrder = 10;

    const background = new Mesh(
      new PlaneGeometry(width, BAR_HEIGHT),
      new MeshBasicMaterial({ color: "#15181c", depthTest: false, transparent: true, opacity: 0.85 }),
    );
    background.renderOrder = 10;
    this.object.add(background);

    this.fill = new Mesh(
      new PlaneGeometry(width, BAR_HEIGHT * 0.7),
      // `transparent` with full opacity is deliberate. Three renders the whole
      // opaque list before the transparent one, and renderOrder only sorts
      // *within* a list — an opaque fill would be drawn first and then painted
      // over by the semi-transparent backing behind it.
      new MeshBasicMaterial({ color: "#57c15a", depthTest: false, transparent: true }),
    );
    this.fill.renderOrder = 11;
    this.fill.position.z = 0.001;
    this.object.add(this.fill);
    this.set(1);
  }

  /** Scale and recolour the fill. Anchored left so it drains toward the empty side. */
  set(ratio: number): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    if (clamped === this.lastRatio) return;
    this.lastRatio = clamped;
    // A zero x-scale collapses the quad's normals; keep a sliver instead.
    this.fill.scale.x = Math.max(0.0001, clamped);
    this.fill.position.x = -(this.width * (1 - clamped)) / 2;
    const band = BAR_COLORS.find(([floor]) => clamped > floor) ?? BAR_COLORS[BAR_COLORS.length - 1]!;
    this.fill.material.color.set(this.color.set(band[1]));
  }

  /**
   * Billboard toward the camera. The bar hangs off the unit, which turns to face
   * its heading, so the camera's rotation has to be expressed *relative to* that
   * parent — copying it straight in would let a walking unit turn its own bar
   * edge-on to the viewer.
   */
  faceCamera(quaternion: Quaternion): void {
    const parent = this.object.parent;
    if (!parent) {
      this.object.quaternion.copy(quaternion);
      return;
    }
    parent.getWorldQuaternion(scratchQuaternion).invert();
    this.object.quaternion.copy(scratchQuaternion.multiply(quaternion));
  }

  dispose(): void {
    for (const child of this.object.children) {
      if (!(child instanceof Mesh)) continue;
      child.geometry.dispose();
      child.material.dispose();
    }
    this.object.clear();
  }
}
