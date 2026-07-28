/**
 * The "click this building" marker — Hikâye / Öğretici Tur Modu, Sürüm 2 (§12.4).
 *
 * A bobbing arrow above a building the player already owns and has to act on:
 * the Market whose panel holds the trade button, the Centre that carries the
 * level-up, the producer standing without a road. Never a *suggestion* — an
 * earlier pass also marked proposed build sites and play-testing retired it
 * (§12.9): where to build is the decision the tur is teaching, and a marker on
 * ground the player had not chosen was answering the question instead of asking
 * it.
 *
 * Arrow only, deliberately. It used to sit inside a pulsing ground ring, but
 * selecting a building already draws a gold selection ring of its own, so on the
 * one screen where both appear — the step *is* "click this building" — the two
 * rings stacked into noise. The arrow is the part that reads from above.
 *
 * View only, like `strategicPointView.ts`. It renders a position it is handed
 * and decides nothing; a mission that stops feeding it simply stops pointing.
 *
 * Built once and moved, rather than rebuilt per target: the geometry never
 * changes, and a marker that disposed and re-created itself on every step change
 * would churn GPU buffers to say the same thing somewhere else.
 */
import { ConeGeometry, Group, Mesh, MeshBasicMaterial } from "three";

/** The palette's gold, so the arrow and the pulsing button read as one instruction. */
const HINT_COLOR = "#e2b95c";
const ARROW_RADIUS = 0.6;
const ARROW_HEIGHT = 2.4;
/** Height the arrow floats at, before the bob. Clears a Settlement building's roof. */
const ARROW_BASE_HEIGHT = 9;
const ARROW_BOB = 0.7;
const PULSE_SECONDS = 1.4;

export class MissionHintView {
  readonly root = new Group();
  private readonly arrow: Mesh;
  private readonly arrowMaterial: MeshBasicMaterial;
  private elapsed = 0;

  constructor() {
    this.root.name = "rts-mission-hint";
    this.root.visible = false;

    this.arrowMaterial = new MeshBasicMaterial({ color: HINT_COLOR, transparent: true, opacity: 0.9 });
    // Point-down cone: the arrow says "this ground", not "this direction".
    const arrowGeometry = new ConeGeometry(ARROW_RADIUS, ARROW_HEIGHT, 4);
    arrowGeometry.rotateZ(Math.PI);
    this.arrow = new Mesh(arrowGeometry, this.arrowMaterial);
    this.arrow.renderOrder = 3;

    this.root.add(this.arrow);
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
   * the rest of the presentation layer makes. At §38's 8x test speed a bob
   * driven by the simulation would strobe.
   */
  update(dt: number): void {
    if (!this.root.visible) return;
    this.elapsed += dt;
    const phase = (Math.sin((this.elapsed / PULSE_SECONDS) * Math.PI * 2) + 1) / 2;
    this.arrow.position.y = ARROW_BASE_HEIGHT + phase * ARROW_BOB;
  }

  dispose(): void {
    this.arrow.geometry.dispose();
    this.arrowMaterial.dispose();
    this.root.clear();
  }
}
