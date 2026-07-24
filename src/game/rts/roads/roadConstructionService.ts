/**
 * Headless road construction — Vertical Slice Plan v0.2 §38 (Faz 5.0).
 *
 * Mirrors {@link StructureConstructionService}: Faz 4 kept plan → pay → commit
 * inside the pointer-driven {@link RoadPlacementSystem}, but the Faz 5 AI has to
 * connect its outpost with a road (plan §38 "Hazır veya sınırlı rota ile yol
 * bağla") through the same wood cost the player pays (AI design §4).
 *
 * Roads themselves stay unowned — AI-1 has no road capture (AI design §50) — so
 * only the *payer* is owner-scoped here.
 */
import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { UnitOwner } from "../units/unit";
import type { RoadCell, RoadGraph, RoadPlan } from "./roadGraph";

export type RoadBuildFailure = "invalid-route" | "insufficient-resources";

export type RoadBuildResult =
  | { readonly built: true; readonly plan: RoadPlan }
  | { readonly built: false; readonly reason: RoadBuildFailure; readonly plan: RoadPlan | null };

export class RoadConstructionService {
  constructor(
    private readonly roads: RoadGraph,
    private readonly kingdoms: KingdomRegistry,
    private readonly blockers: () => readonly NavBlocker[],
    /** Lets the view re-render only when committed topology actually changed. */
    private readonly onCommitted: () => void = () => {},
  ) {}

  /** Preview a route and its wood cost without spending. Null when unroutable. */
  plan(start: RoadCell, end: RoadCell): RoadPlan | null {
    return this.roads.plan(start, end, this.blockers());
  }

  /** Plan, charge the owner's wood for new cells only, and commit the route. */
  build(owner: UnitOwner, start: RoadCell, end: RoadCell): RoadBuildResult {
    const plan = this.plan(start, end);
    if (!plan) return { built: false, reason: "invalid-route", plan: null };
    if (plan.woodCost > 0) {
      const wallet = this.kingdoms.get(owner).wallet;
      const reservation = wallet.reserve({ wood: plan.woodCost });
      if (!reservation) return { built: false, reason: "insufficient-resources", plan };
      wallet.commit(reservation);
    }
    this.roads.commit(plan);
    this.onCommitted();
    return { built: true, plan };
  }

  /**
   * Commit an already-planned route without charging anyone. Used for the access
   * road auto-built under a freshly placed building, whose price already covers
   * it (see {@link planAutoRoadConnection}). Roads are unowned, so there is no
   * wallet to touch — this simply commits and fires the same post-commit hook
   * `build` does, keeping the road visuals and territory grid in sync.
   */
  commitFree(plan: RoadPlan): void {
    this.roads.commit(plan);
    this.onCommitted();
  }
}
