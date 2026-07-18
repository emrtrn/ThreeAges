/**
 * The ground marker for each §58 capture objective — Vertical Slice Plan v0.2
 * (Faz 11), "UI geri sayım ve harita göstergesi".
 *
 * The HUD tracker names the points and counts the seconds; this answers the
 * other half of the question — *where*. §60 dropped the minimap, so a player
 * reading "Batı Geçidi: düşmanda" has no second screen to look it up on: the
 * world itself has to show the ring, which is why the marker is drawn at the
 * point's real capture radius rather than as a decorative disc. What you see is
 * the area an enemy has to step into to contest.
 *
 * View only. It renders what {@link StrategicPointSystem} resolved and never
 * decides a holder.
 */
import { Color, Group, Mesh, MeshBasicMaterial, RingGeometry } from "three";

import type { StrategicPointStatus } from "./strategicPointSystem";
import type { TerritoryOwner } from "../territory/territoryControlSystem";

/** Matches the territory overlay's palette; a pass held by you is your blue. */
const HOLDER_COLOR: Readonly<Record<TerritoryOwner, string>> = {
  player: "#2d7fd6",
  enemy: "#c0392b",
  neutral: "#d7ad52",
};

/** Contest reads as its own state, not as a shade of whoever still holds it. */
const CONTESTED_COLOR = "#e5d675";

const RING_THICKNESS = 1.6;

export class StrategicPointView {
  readonly root = new Group();
  private readonly rings = new Map<string, { mesh: Mesh; material: MeshBasicMaterial }>();

  constructor() {
    this.root.name = "rts-strategic-points";
  }

  /**
   * Sync the rings to the current statuses. Rings are created once per point and
   * then only recoloured: the objectives are authored map data, so their count
   * and radius never change mid-match and rebuilding the geometry every frame
   * would be pure waste.
   */
  setStatuses(statuses: readonly StrategicPointStatus[]): void {
    for (const status of statuses) {
      const existing = this.rings.get(status.point.id) ?? this.createRing(status);
      existing.material.color.set(
        status.contested ? CONTESTED_COLOR : HOLDER_COLOR[status.holder],
      );
      // A held pass is solid, a neutral one faint: at the camera's usual height
      // the ring's *presence* is read before its colour is.
      existing.material.opacity = status.holder === "neutral" && !status.contested ? 0.35 : 0.7;
    }
  }

  private createRing(status: StrategicPointStatus): { mesh: Mesh; material: MeshBasicMaterial } {
    const { captureRadius } = status.point;
    const geometry = new RingGeometry(Math.max(0.1, captureRadius - RING_THICKNESS), captureRadius, 48);
    geometry.rotateX(-Math.PI / 2);
    const material = new MeshBasicMaterial({
      color: new Color(HOLDER_COLOR.neutral),
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = `rts-strategic-point-${status.point.id}`;
    // Above the territory overlay's cells (y 0.022), so a ring inside friendly
    // territory is not z-fought into invisibility by the very control that won it.
    mesh.position.set(status.point.x, 0.03, status.point.z);
    mesh.renderOrder = 2;
    this.root.add(mesh);
    const entry = { mesh, material };
    this.rings.set(status.point.id, entry);
    return entry;
  }

  dispose(): void {
    for (const { mesh, material } of this.rings.values()) {
      mesh.geometry.dispose();
      material.dispose();
    }
    this.rings.clear();
    this.root.clear();
  }
}
