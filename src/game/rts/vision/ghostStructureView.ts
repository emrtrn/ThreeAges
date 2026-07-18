/**
 * "Last known" enemy buildings on the map — Vertical Slice Plan v0.2 §59,
 * GDD 08 §40.
 *
 * §40 offers two presentations: the last seen model, or a ghost sign. This draws
 * the sign — a flat translucent footprint marker at the remembered position —
 * for a specific reason beyond cost. Reusing the real building model would mean
 * the ghost stays perfectly accurate as the true building levels up or takes
 * damage, because a cloned model is tempting to keep in sync. A deliberately
 * abstract marker cannot lie in that direction: it shows *that* something was
 * seen there and how long ago, and nothing it does not know.
 *
 * §40's "bilgi eskidikçe doğruluk kaybedebilir" is the fade: a marker loses
 * opacity with the age of the sighting, so a fresh scout report reads as solid
 * and a five-minute-old one as a hint.
 *
 * View only. It renders {@link EnemyMemorySystem} and never decides what is
 * remembered.
 */
import { Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";

import type { EnemyMemorySystem, RememberedStructure } from "./enemyMemorySystem";
import type { UnitOwner } from "../units/unit";

/** Matches the territory palette so an enemy ghost reads as enemy at a glance. */
const GHOST_COLOR: Readonly<Record<UnitOwner, string>> = {
  player: "#2d7fd6",
  enemy: "#c0392b",
};

const FRESH_OPACITY = 0.55;
const STALE_OPACITY = 0.15;
/** Seconds after which a sighting has decayed to {@link STALE_OPACITY}. */
const FULL_DECAY_SECONDS = 180;

/** Footprint sizes are not remembered, so every ghost is one neutral size. */
const MARKER_SIZE = 4;

export class GhostStructureView {
  readonly root = new Group();
  private readonly markers = new Map<number, { mesh: Mesh; material: MeshBasicMaterial }>();
  private readonly geometry: PlaneGeometry;

  constructor(
    private readonly memory: EnemyMemorySystem,
    private readonly observer: UnitOwner,
  ) {
    this.root.name = "rts-structure-ghosts";
    this.geometry = new PlaneGeometry(MARKER_SIZE, MARKER_SIZE);
    this.geometry.rotateX(-Math.PI / 2);
  }

  /**
   * Sync markers to the observer's current ghost set.
   *
   * Markers are keyed by structure id and reused, so a building repeatedly
   * scouted and lost does not churn geometry.
   */
  refresh(now: number): void {
    const ghosts = this.memory.ghosts(this.observer);
    const live = new Set<number>();

    for (const ghost of ghosts) {
      live.add(ghost.structureId);
      const entry = this.markers.get(ghost.structureId) ?? this.createMarker(ghost);
      entry.material.opacity = this.opacityFor(ghost, now);
    }

    for (const [id, entry] of this.markers) {
      if (live.has(id)) continue;
      // The memory was either re-sighted (the real building renders again) or
      // corrected away (it is gone). Either way the sign must not linger.
      this.root.remove(entry.mesh);
      entry.material.dispose();
      this.markers.delete(id);
    }
  }

  private opacityFor(ghost: RememberedStructure, now: number): number {
    const age = this.memory.ageOf(ghost, now);
    const decay = Math.min(1, age / FULL_DECAY_SECONDS);
    return FRESH_OPACITY + (STALE_OPACITY - FRESH_OPACITY) * decay;
  }

  private createMarker(ghost: RememberedStructure): { mesh: Mesh; material: MeshBasicMaterial } {
    const material = new MeshBasicMaterial({
      color: new Color(GHOST_COLOR[ghost.owner]),
      transparent: true,
      opacity: FRESH_OPACITY,
      depthWrite: false,
    });
    const mesh = new Mesh(this.geometry, material);
    mesh.name = `rts-structure-ghost-${ghost.structureId}`;
    // Above the fog plane (y 0.05): a ghost is a memory the fog must not swallow,
    // and it sits in fogged ground by definition.
    mesh.position.set(ghost.x, 0.06, ghost.z);
    mesh.renderOrder = 5;
    this.root.add(mesh);
    const entry = { mesh, material };
    this.markers.set(ghost.structureId, entry);
    return entry;
  }

  dispose(): void {
    for (const entry of this.markers.values()) entry.material.dispose();
    this.markers.clear();
    this.geometry.dispose();
    this.root.clear();
  }
}
