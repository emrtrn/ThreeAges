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

  /** Match the drawn animals to the simulated ones and pose them. */
  sync(animals: readonly WildlifeAnimal[], deltaSeconds: number, cameraDistanceSquared: number | null): void {
    for (const animal of animals) {
      const handle = this.handleFor(animal);
      if (!handle) continue;
      handle.root.position.set(animal.position.x, animal.position.y, animal.position.z);
      handle.root.rotation.y = animal.facing;
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
  }
}
