/** Presentation mirror for automatic logistics caravans. */
import type { Group, Object3D } from "three";

import type { RtsPresentationHandle } from "../units/unit";
import type { UnitOwner } from "../units/unit";
import type { Caravan, CaravanPhase } from "./caravanSystem";

/** The single logistics Actor is data-mapped rather than pretending to be wildlife. */
export type CaravanPresentationFactory = (
  moveSpeed: number,
  walkClipSpeed: number,
) => RtsPresentationHandle | null;

/** The moving-unit fog rule, with the owner's always-visible exception. */
export function isCaravanVisible(
  owner: UnitOwner,
  x: number,
  z: number,
  isVisible?: (x: number, z: number) => boolean,
  viewer?: UnitOwner,
): boolean {
  return viewer === owner || !isVisible || isVisible(x, z);
}

/** Draws the simulation-owned caravan roster, without adding selection or input. */
export class CaravanView {
  private readonly handles = new Map<string, RtsPresentationHandle>();
  private readonly unavailable = new Set<string>();
  private readonly drawn = new Set<string>();
  private factory: CaravanPresentationFactory | null = null;

  constructor(private readonly parent: Group) {}

  setPresentationFactory(factory: CaravanPresentationFactory | null): void {
    this.factory = factory;
    this.clear();
  }

  sync(
    caravans: readonly Caravan[],
    deltaSeconds: number,
    isVisible?: (x: number, z: number) => boolean,
    viewer?: UnitOwner,
  ): void {
    this.drawn.clear();
    for (const caravan of caravans) {
      const handle = this.handleFor(caravan);
      if (!handle) continue;
      this.drawn.add(caravan.id);
      handle.root.position.copy(caravan.position);
      handle.root.rotation.y = caravan.facing;
      handle.root.visible = isCaravanVisible(caravan.owner, caravan.position.x, caravan.position.z, isVisible, viewer);
      handle.update?.({
        deltaSeconds,
        planarSpeed: caravan.speed,
        forceWalk: true,
        // A caravan neither swings nor is shot at nor dies: it is not a combat
        // target at all (see `RtsApp.combatTargets`), and it carries no health
        // to flinch or expire from. These three are the actor contract's, so
        // they are answered rather than omitted — flatly, because there is no
        // longer any state behind them that could say otherwise.
        attacking: false,
        dying: false,
        working: isLoading(caravan.phase),
        carrying: isCaravanCarrying(caravan.phase),
        attackCount: 0,
        impactCount: 0,
        cameraDistanceSquared: null,
      });
    }
    if (this.handles.size > this.drawn.size) this.retireUndrawn();
  }

  dispose(): void {
    this.clear();
  }

  /** The root accepted by the latest caravan presentation sync, if one exists. */
  presentationRoot(caravan: Caravan): Object3D | null {
    return this.handles.get(caravan.id)?.root ?? null;
  }

  private handleFor(caravan: Caravan): RtsPresentationHandle | null {
    const existing = this.handles.get(caravan.id);
    if (existing) return existing;
    if (!this.factory || this.unavailable.has("caravan")) return null;
    const handle = this.factory(caravan.moveSpeed, caravan.walkClipSpeed);
    if (!handle) {
      this.unavailable.add("caravan");
      return null;
    }
    this.parent.add(handle.root);
    this.handles.set(caravan.id, handle);
    return handle;
  }

  private retireUndrawn(): void {
    for (const [id, handle] of this.handles) {
      if (this.drawn.has(id)) continue;
      handle.root.removeFromParent();
      handle.dispose();
      this.handles.delete(id);
    }
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

function isLoading(phase: CaravanPhase): boolean {
  return phase === "loading" || phase === "unloading";
}

/**
 * Whether the animal's authored cargo should be on its back this frame.
 *
 * The load is picked up when the outbound leg begins and is gone once the store
 * has taken it, so `unloading` still counts: the donkey stands at the depot with
 * its barrels until the phase turns to `inbound`, and walks home empty. That
 * makes the round trip readable at a glance without the simulation gaining a
 * single field — {@link CaravanPhase} already knew all of this.
 *
 */
export function isCaravanCarrying(phase: CaravanPhase): boolean {
  return phase === "outbound" || phase === "unloading";
}
