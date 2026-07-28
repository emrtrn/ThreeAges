/**
 * The "look here" marker — Hikâye / Öğretici Tur Modu, Sürüm 2 (§12.4).
 *
 * A pulsing ground ring with a bobbing arrow over it, at the one place the
 * active step is asking the player to act: the spot a building should go
 * ({@link solveMissionSite}), or the building whose panel holds the step's
 * button. One marker, not two kinds — both are the same sentence ("here"), and
 * two visual languages for it would only ask the player to learn a second one.
 *
 * View only, like `strategicPointView.ts`. It renders a position it is handed
 * and decides nothing; a mission that stops feeding it simply stops pointing.
 *
 * Built once and moved, rather than rebuilt per target: the geometry never
 * changes, and a marker that disposed and re-created itself on every step change
 * would churn GPU buffers to say the same thing somewhere else.
 */
import { ConeGeometry, Group, Mesh, MeshBasicMaterial, RingGeometry } from "three";

/** The palette's gold, so the ring and the pulsing button read as one instruction. */
const HINT_COLOR = "#e2b95c";
const RING_INNER = 3.2;
const RING_OUTER = 4.0;
const ARROW_RADIUS = 1.1;
const ARROW_HEIGHT = 2.6;
/** Height the arrow floats at, before the bob. Clears a Settlement building's roof. */
const ARROW_BASE_HEIGHT = 7;
const ARROW_BOB = 0.7;
const PULSE_SECONDS = 1.4;

export class MissionHintView {
  readonly root = new Group();
  private readonly ring: Mesh;
  private readonly ringMaterial: MeshBasicMaterial;
  private readonly arrow: Mesh;
  private readonly arrowMaterial: MeshBasicMaterial;
  private elapsed = 0;

  constructor() {
    this.root.name = "rts-mission-hint";
    this.root.visible = false;
    this.ringMaterial = new MeshBasicMaterial({
      color: HINT_COLOR,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const ringGeometry = new RingGeometry(RING_INNER, RING_OUTER, 48);
    ringGeometry.rotateX(-Math.PI / 2);
    this.ring = new Mesh(ringGeometry, this.ringMaterial);
    // Above the territory overlay (y 0.022) and the strategic point rings (0.03),
    // for the reason those give: a marker inside friendly territory must not be
    // z-fought into invisibility by the control area that owns the ground.
    this.ring.position.y = 0.04;
    this.ring.renderOrder = 3;

    this.arrowMaterial = new MeshBasicMaterial({ color: HINT_COLOR, transparent: true, opacity: 0.9 });
    // Point-down cone: the arrow says "this ground", not "this direction".
    const arrowGeometry = new ConeGeometry(ARROW_RADIUS, ARROW_HEIGHT, 4);
    arrowGeometry.rotateZ(Math.PI);
    this.arrow = new Mesh(arrowGeometry, this.arrowMaterial);
    this.arrow.renderOrder = 3;

    this.root.add(this.ring, this.arrow);
  }

  /**
   * Point at a ground position, or stop pointing.
   *
   * @param groundHeight the terrain height there, so the marker sits on an
   *   authored Landscape rather than floating at sea level over a hillside.
   */
  setTarget(target: { readonly x: number; readonly z: number } | null, groundHeight = 0): void {
    this.root.visible = target !== null;
    if (!target) return;
    this.root.position.set(target.x, groundHeight, target.z);
  }

  /**
   * Animate on the *rendered-frame* delta, not simulation time — the same call
   * the rest of the presentation layer makes. At §38's 8x test speed a pulse
   * driven by the simulation would strobe.
   */
  update(dt: number): void {
    if (!this.root.visible) return;
    this.elapsed += dt;
    const phase = (Math.sin((this.elapsed / PULSE_SECONDS) * Math.PI * 2) + 1) / 2;
    this.ringMaterial.opacity = 0.4 + phase * 0.45;
    const scale = 0.94 + phase * 0.12;
    this.ring.scale.set(scale, 1, scale);
    this.arrow.position.y = ARROW_BASE_HEIGHT + phase * ARROW_BOB;
  }

  dispose(): void {
    this.ring.geometry.dispose();
    this.ringMaterial.dispose();
    this.arrow.geometry.dispose();
    this.arrowMaterial.dispose();
    this.root.clear();
  }
}
