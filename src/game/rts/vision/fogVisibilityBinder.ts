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
 * **Objects only.** Static map art used to be hidden from here too, as a
 * worklist of props each shown or hidden whole. It no longer is: a mountain is
 * not in one place, so no single reveal point could be right for it, and every
 * choice of point either kept the horizon hidden until the player walked into it
 * or revealed the whole range on the first frame. That art is now cut per
 * fragment against the fog texture in `fogMask.ts`, which has no notion of a
 * prop at all.
 *
 * Units, structures and command centres deliberately stayed here. Cutting them
 * per fragment would draw the half of an enemy army that stands in lit ground
 * and leak where the rest of it is — object-level hiding is the honest answer
 * for anything whose position is information.
 *
 * Two more kinds of thing are fogged elsewhere, both for the same reason: their
 * own sync loop already owns `visible`, and a second writer here would fight it
 * at whichever rate the two ran at. Trees and deposits are decided in
 * `rtsMapArt.syncForest`/`syncResourceNodes`, wild animals in
 * `wildlifeView.sync` — which is also the only loop that runs before a match
 * starts, when this binder is not being ticked at all. Wildlife takes the
 * **unit** rule rather than the forest's, because a herd moves.
 *
 * View-side only: it reads vision and sets `visible`; it never decides what is
 * visible and never mutates simulation state.
 */
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { VisionSystem } from "./visionSystem";

export class FogVisibilityBinder {
  constructor(
    private readonly vision: VisionSystem,
    private readonly units: UnitSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly centers: CommandCenterSystem,
    /** The kingdom whose eyes the screen shows — the human player. */
    private readonly observer: UnitOwner,
  ) {}

  /** Apply current visibility to every opponent-owned render object. */
  refresh(): void {
    for (const unit of this.units.all()) {
      if (unit.owner === this.observer) continue;
      unit.object.visible = this.vision.isVisible(this.observer, unit.position.x, unit.position.z);
    }
    for (const structure of this.structures.all()) {
      if (structure.owner === this.observer) continue;
      structure.object.visible = this.vision.isVisible(this.observer, structure.x, structure.z);
    }
    // Command centres live in their own registry rather than the placed-structure
    // one, so iterating `structures` alone leaves the single most informative
    // building on the map permanently visible — the enemy's town hall, glowing
    // in ground the player has never scouted.
    for (const center of this.centers.all()) {
      if (center.owner === this.observer) continue;
      center.object.visible = this.vision.isVisible(
        this.observer,
        center.position.x,
        center.position.z,
      );
    }
  }

  /**
   * Restore everything to visible. Used when the match ends and when the system
   * is torn down, so a disabled or finished match never leaves objects
   * permanently hidden in the scene graph.
   *
   * Static map art is not restored here — it is not hidden here. `RtsApp` turns
   * `FogMask` off at the same call sites, which is one uniform rather than a
   * walk of the world.
   */
  revealAll(): void {
    for (const unit of this.units.all()) unit.object.visible = true;
    for (const structure of this.structures.all()) structure.object.visible = true;
    for (const center of this.centers.all()) center.object.visible = true;
  }
}
