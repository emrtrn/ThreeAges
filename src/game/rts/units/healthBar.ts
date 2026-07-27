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

/* A compact world bar cannot carry the 9-slice PNG without blurring its caps.
   These simple unlit planes echo that skin instead: charcoal shadow, bronze
   frame, recessed channel, then the semantic fill. */
const BAR_HEIGHT = 0.15;
const SHADOW_INSET = 0.014;
const CHANNEL_INSET = 0.012;
const FILL_INSET = 0.018;
const FILL_HEIGHT = 0.086;
/** Health ratios at which the bar changes colour, high band first. */
const BAR_COLORS: readonly (readonly [number, string])[] = [
  [0.6, "#79ad57"],
  [0.3, "#d6a23e"],
  [0, "#c94f3b"],
];

export class HealthBar {
  readonly object = new Group();
  private readonly fill: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly fillWidth: number;
  private readonly color = new Color();
  private lastRatio = -1;

  constructor(width: number, height: number) {
    this.object.name = "rts-unit-health-bar";
    this.object.position.y = height;
    // Render after the world so a bar is never swallowed by the body it labels.
    this.object.renderOrder = 10;

    const shadow = new Mesh(
      new PlaneGeometry(width + SHADOW_INSET, BAR_HEIGHT + SHADOW_INSET),
      new MeshBasicMaterial({ color: "#0b0806", depthTest: false, depthWrite: false, transparent: true, opacity: 0.94 }),
    );
    shadow.renderOrder = 10;
    this.object.add(shadow);

    const frame = new Mesh(
      new PlaneGeometry(width, BAR_HEIGHT),
      new MeshBasicMaterial({ color: "#8c6236", depthTest: false, depthWrite: false, transparent: true, opacity: 0.98 }),
    );
    frame.renderOrder = 11;
    frame.position.z = 0.001;
    this.object.add(frame);

    const channel = new Mesh(
      new PlaneGeometry(width - CHANNEL_INSET, BAR_HEIGHT - CHANNEL_INSET * 2),
      new MeshBasicMaterial({ color: "#21150e", depthTest: false, depthWrite: false, transparent: true, opacity: 0.98 }),
    );
    channel.renderOrder = 12;
    channel.position.z = 0.002;
    this.object.add(channel);

    this.fillWidth = width - FILL_INSET;
    this.fill = new Mesh(
      new PlaneGeometry(this.fillWidth, FILL_HEIGHT),
      // `transparent` with full opacity is deliberate. Three renders the whole
      // opaque list before the transparent one, and renderOrder only sorts
      // *within* a list — an opaque fill would be drawn first and then painted
      // over by the semi-transparent backing behind it.
      new MeshBasicMaterial({ color: "#79ad57", depthTest: false, depthWrite: false, transparent: true }),
    );
    this.fill.renderOrder = 13;
    this.fill.position.z = 0.003;
    this.object.add(this.fill);
    this.set(1);
  }

  /** Scale and recolour the fill. Anchored left so it drains toward the empty side. */
  set(ratio: number): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    // A healthy army does not need a forest of bars over it. The moment damage
    // lands, the bar returns and remains billboarded exactly as before.
    this.object.visible = clamped < 1;
    if (clamped === this.lastRatio) return;
    this.lastRatio = clamped;
    // A zero x-scale collapses the quad's normals; keep a sliver instead.
    this.fill.scale.x = Math.max(0.0001, clamped);
    this.fill.position.x = -(this.fillWidth * (1 - clamped)) / 2;
    const band = BAR_COLORS.find(([floor]) => clamped >= floor) ?? BAR_COLORS[BAR_COLORS.length - 1]!;
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
