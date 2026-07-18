/**
 * Hides what the observing kingdom cannot see — Vertical Slice Plan v0.2 §59,
 * GDD 08 §39–§40.
 *
 * The fog plane (`fogView.ts`) darkens the *ground*; it cannot occlude a unit
 * body standing on it, and a building's roof would poke through a flat overlay
 * regardless. So object visibility is its own pass, driven by the same grid.
 *
 * The rules, and why they differ between the two kinds of thing:
 *
 *  - **Units** are hidden unless currently visible. There is no memory layer for
 *    them — §40 is explicit that "düşman birimleri görünmez" in explored fog,
 *    and a remembered army position is a far stronger claim than a remembered
 *    building, since armies move and buildings do not.
 *  - **Structures** are hidden when not currently visible, and a ghost marker is
 *    drawn in their place from {@link EnemyMemorySystem}. That is what keeps a
 *    scouted base on the map after the scout dies.
 *
 * Own-kingdom objects are never touched — this only ever hides the opponent's.
 *
 * View-side only: it reads vision and sets `visible`; it never decides what is
 * visible and never mutates simulation state.
 */
import type { Object3D } from "three";

import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { VisionSystem } from "./visionSystem";

export class FogVisibilityBinder {
  /**
   * World props (resource deposits, ridges, trees) still waiting to be revealed.
   *
   * Held as a shrinking worklist rather than re-walked every tick because
   * `explored` only ever latches on: once a prop is revealed it can never hide
   * again, so it leaves this list for good. The forest is the reason that
   * matters — re-testing every tree every tick would be the per-frame cost §59's
   * performance criterion is about.
   */
  private hiddenProps: Object3D[] = [];

  constructor(
    private readonly vision: VisionSystem,
    private readonly units: UnitSystem,
    private readonly structures: PlacedStructureSystem,
    /** The kingdom whose eyes the screen shows — the human player. */
    private readonly observer: UnitOwner,
  ) {}

  /**
   * Register the static map art that must stay hidden until scouted.
   *
   * GDD 08 §39 forbids showing resources and strategic detail in **unknown**
   * ground, while §40 keeps terrain and permanent natural elements visible once
   * seen — so these key off `isExplored`, not `isVisible`. A stone deposit you
   * walked past stays on your map; one you have never approached is not there
   * to plan around.
   */
  trackWorldProps(props: readonly Object3D[]): void {
    this.hiddenProps = [...props];
    for (const prop of this.hiddenProps) prop.visible = false;
  }

  /** Apply current visibility to every opponent-owned render object. */
  refresh(): void {
    if (this.hiddenProps.length > 0) {
      this.hiddenProps = this.hiddenProps.filter((prop) => {
        if (!this.vision.isExplored(this.observer, prop.position.x, prop.position.z)) return true;
        prop.visible = true;
        return false;
      });
    }
    for (const unit of this.units.all()) {
      if (unit.owner === this.observer) continue;
      unit.object.visible = this.vision.isVisible(this.observer, unit.position.x, unit.position.z);
    }
    for (const structure of this.structures.all()) {
      if (structure.owner === this.observer) continue;
      structure.object.visible = this.vision.isVisible(this.observer, structure.x, structure.z);
    }
  }

  /**
   * Restore everything to visible. Used when the match ends and when the system
   * is torn down, so a disabled or finished match never leaves objects
   * permanently hidden in the scene graph.
   */
  revealAll(): void {
    for (const unit of this.units.all()) unit.object.visible = true;
    for (const structure of this.structures.all()) structure.object.visible = true;
    for (const prop of this.hiddenProps) prop.visible = true;
    this.hiddenProps = [];
  }
}
