/**
 * Draws whatever {@link WildlifeSystem} says is on the field — wildlife plan Faz 2.
 *
 * The simulation half never learns that a renderer exists: this reads snapshots
 * and owns Object3Ds, exactly the split `RtsBuildingVisuals` makes for
 * structures. A match booted without an Actor pack simply gets no animals drawn
 * and keeps grazing them in simulation, which is the same "art is optional,
 * gameplay is not" rule the rest of the RTS follows.
 */
import type { Group, Object3D } from "three";

import type { RtsPresentationHandle } from "../units/unit";
import type { WildlifeAnimal } from "./wildlifeSystem";

/**
 * Whether one animal's body is drawn — §59's wildlife rule, extracted so the
 * loop below and `test:engine` read the same decision (the forest's
 * `isTreeVisible` pattern).
 *
 * Keyed off **currently visible** rather than explored, and that is the whole
 * difference from a tree: a forest remembered where it stood is still standing
 * there, while a herd remembered where it grazed has walked off, been hunted out
 * by the opponent, or both. GDD 08 §40 keeps *permanent natural elements* on the
 * map once seen and refuses that same memory to anything that moves — which is
 * why enemy units follow this rule too (`fogVisibilityBinder.ts`).
 *
 * A carcass is the one thing here that does hold still, and it still hides: what
 * a player would read off a remembered carcass is "there is meat lying there",
 * which stops being true the moment someone else's hunter picks it clean.
 */
export function isWildlifeVisible(
  x: number,
  z: number,
  isVisible?: (x: number, z: number) => boolean,
): boolean {
  // No predicate = the `fogOfWar` flag is off; the whole herd is on the map.
  return !isVisible || isVisible(x, z);
}

/** How a presentation is obtained for one species; null when art is unavailable. */
export type WildlifePresentationFactory = (
  species: string,
  moveSpeed: number,
  walkClipSpeed: number,
) => RtsPresentationHandle | null;

export class WildlifeView {
  private readonly handles = new Map<string, RtsPresentationHandle>();
  /** Species that produced no art, so a broken ref is asked for once, not per frame. */
  private readonly unavailable = new Set<string>();
  /** Ids drawn this sync; whatever is held but not in here has left the field. */
  private readonly drawn = new Set<string>();
  private factory: WildlifePresentationFactory | null = null;

  constructor(private readonly parent: Group) {}

  /**
   * Supply (or replace) the art source. Called once the Actor pack finishes
   * loading, which is *after* the first animals already exist — so this also
   * drops any handles built by an earlier factory rather than leaving two
   * generations of art on the field.
   */
  setPresentationFactory(factory: WildlifePresentationFactory | null): void {
    this.factory = factory;
    this.clear();
  }

  /**
   * Match the drawn animals to the simulated ones and pose them.
   *
   * @param isVisible §59: whether the observing kingdom can see a point right
   *   now. Omitted (the `fogOfWar` flag off) draws every animal.
   */
  sync(
    animals: readonly WildlifeAnimal[],
    deltaSeconds: number,
    cameraDistanceSquared: number | null,
    isVisible?: (x: number, z: number) => boolean,
  ): void {
    this.drawn.clear();
    for (const animal of animals) {
      // A carcass picked clean leaves the field, the felled tree's rule
      // (`isTreeVisible`): once there is nothing left to take, what stands there
      // is not a body but the memory of one, and it would lie on the map for the
      // rest of the match. Skipped before `handleFor` so a spent animal is never
      // given art again on the next frame.
      if (animal.spent) continue;
      const handle = this.handleFor(animal);
      if (!handle) continue;
      this.drawn.add(animal.id);
      handle.root.position.set(animal.position.x, animal.position.y, animal.position.z);
      handle.root.rotation.y = animal.facing;
      handle.root.visible = isWildlifeVisible(animal.position.x, animal.position.z, isVisible);
      handle.update?.({
        deltaSeconds,
        planarSpeed: animal.speed,
        attacking: false,
        dying: animal.dead,
        // A standing animal is grazing, and grazing is an in-place job — which is
        // what puts it on the `work` role and so on the asset's `Eating` clip.
        // Without this a herd at rest reads as a field of statues.
        working: !animal.dead && animal.speed <= 0,
        attackCount: 0,
        cameraDistanceSquared,
      });
    }
    // Only when the two disagree, which is the tick an animal was picked clean —
    // every other frame this is one integer compare rather than a walk of the map.
    if (this.handles.size > this.drawn.size) this.retireUndrawn();
  }

  dispose(): void {
    this.clear();
  }

  private handleFor(animal: WildlifeAnimal): RtsPresentationHandle | null {
    const existing = this.handles.get(animal.id);
    if (existing) return existing;
    if (!this.factory || this.unavailable.has(animal.stats.id)) return null;
    const handle = this.factory(animal.stats.id, animal.stats.moveSpeed, animal.stats.walkClipSpeed);
    if (!handle) {
      this.unavailable.add(animal.stats.id);
      return null;
    }
    this.attach(handle.root);
    this.handles.set(animal.id, handle);
    return handle;
  }

  /**
   * Drop the art of everything the last {@link sync} did not draw.
   *
   * Written against "not drawn" rather than against `spent` so it covers the
   * other way a body can leave — an animal gone from the roster entirely, which
   * is how a tamed one will leave the herd in V2 — with one rule instead of two.
   * Disposal is safe because nothing here ever comes back: a picked carcass
   * cannot refill, and a removed animal returns under a new id.
   */
  private retireUndrawn(): void {
    for (const [id, handle] of this.handles) {
      if (this.drawn.has(id)) continue;
      handle.root.removeFromParent();
      handle.dispose();
      this.handles.delete(id);
    }
  }

  private attach(root: Object3D): void {
    this.parent.add(root);
  }

  private clear(): void {
    for (const handle of this.handles.values()) {
      handle.root.removeFromParent();
      handle.dispose();
    }
    this.handles.clear();
    this.unavailable.clear();
    this.drawn.clear();
  }
}
