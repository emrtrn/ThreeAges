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
import { roadCellTouchingFootprint } from "../economy/depotLogisticsSystem";
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { UnitOwner } from "../units/unit";
import { planAutoRoadConnection, type AutoRoadFootprint } from "./autoRoadConnector";
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

  /** Shared local hand-off reach, owned by the road balance rather than AI tuning. */
  get autoConnectMaximumDistance(): number {
    return this.roads.autoConnectMaximumDistance;
  }

  /** Preview a route and its wood cost without spending. Null when unroutable. */
  plan(start: RoadCell, end: RoadCell): RoadPlan | null {
    return this.roads.plan(start, end, this.blockers());
  }

  /** Preview a route against one prospective footprint without mutating the graph. */
  planWithAdditionalBlockers(
    start: RoadCell,
    end: RoadCell,
    additionalBlockers: readonly NavBlocker[],
  ): RoadPlan | null {
    return this.roads.plan(start, end, [...this.blockers(), ...additionalBlockers]);
  }

  /** Plan, charge the owner's wood for new cells only, and commit the route. */
  build(owner: UnitOwner, start: RoadCell, end: RoadCell): RoadBuildResult {
    const plan = this.plan(start, end);
    return this.buildPlanned(owner, plan);
  }

  /**
   * Charge and commit a route that a higher-level planner has already shaped.
   *
   * The AI uses this for a structure access spur: the generic road graph still
   * chooses every traversed cell, while the caller owns only the choice of
   * which already-placed footprint needs to be joined.  Keeping payment here
   * prevents a procedural settlement from getting the player-only free access
   * roads.
   */
  buildPlanned(owner: UnitOwner, plan: RoadPlan | null): RoadBuildResult {
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
   * Plan a paid access spur from an already-placed footprint to the current
   * road network. The player continues to use the same pure planner with
   * `commitFree`; AI infrastructure uses this wrapper so its wood is charged.
   */
  planAccessRoad(footprint: AutoRoadFootprint, maxNewCells = Number.MAX_SAFE_INTEGER): RoadPlan | null {
    return planAutoRoadConnection(
      this.roads,
      footprint,
      (start, end) => this.plan(start, end),
      { maxNewCells },
    );
  }

  /** Charge and commit one legal structure-access spur. */
  buildAccessRoad(
    owner: UnitOwner,
    footprint: AutoRoadFootprint,
    maxNewCells = Number.MAX_SAFE_INTEGER,
  ): RoadBuildResult {
    return this.buildPlanned(owner, this.planAccessRoad(footprint, maxNewCells));
  }

  /** Whether the committed graph already reaches a structure footprint. */
  touchesFootprint(footprint: AutoRoadFootprint): boolean {
    return roadCellTouchingFootprint(this.roads, footprint.x, footprint.z, footprint.width, footprint.depth) !== null;
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

  /**
   * Unpave road tiles (GDD 10 §44 "Yol Silme"), returning how many were actually
   * there. Roads reserve build space, so before this existed a paved tile was a
   * permanent claim on its ground — a route laid across a stone or gold deposit
   * retired that deposit for the whole match with no way to take it back.
   *
   * No refund: the wood went into the ground and roads are unowned, so there is
   * no wallet to credit — the same asymmetry {@link commitFree} relies on. Fires
   * the commit hook only when topology really changed, so the visuals and the
   * territory grid refresh exactly once per erase.
   */
  demolish(cells: readonly RoadCell[]): number {
    const removed = this.roads.remove(cells);
    if (removed > 0) this.onCommitted();
    return removed;
  }
}
