/**
 * Phase 4 depot nodes. A completed depot joins the global store only when a
 * touching road also reaches its owner's command centre. This keeps stock and
 * storage capacity physically rooted in the same road network.
 */
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import { roadCellFootprintGap, roadCellTouchesFootprint } from "../roads/roadFootprintTouch";
import type { RoadCell, RoadGraph } from "../roads/roadGraph";
import type { UnitOwner } from "../units/unit";

export type DepotNodeStatus = "unlinked" | "unlinked-main-network" | "linked";

export interface DepotNodeSnapshot {
  readonly structureId: number;
  readonly owner: UnitOwner;
  readonly x: number;
  readonly z: number;
  readonly roadCell: RoadCell | null;
  readonly componentId: number | null;
  readonly status: DepotNodeStatus;
}

/** A legal warehouse road endpoint; null id is the owner's command centre. */
export interface LogisticsEndpoint {
  readonly structureId: number | null;
  readonly roadCell: RoadCell;
}

/** Read-only depot-to-road node projection, recomputed from mutable world state. */
export class DepotLogisticsSystem {
  /**
   * Every answer here is a pure function of the road topology, the completed
   * standing set, and the command centres — nothing else. Callers ask several
   * times per tick (producer lanes, transfers, the HUD, the occupation sweep,
   * and `snapshots` itself through {@link endpointsFor}), so each answer is held
   * against the three versions that can invalidate it rather than rebuilt per
   * call. A memo that has to be *told* when to expire eventually is not; this one
   * simply cannot outlive its inputs.
   */
  private memo: {
    readonly key: string;
    snapshots?: readonly DepotNodeSnapshot[];
    mainComponentIds?: ReadonlyMap<UnitOwner, number | null>;
    componentIds?: Map<string, number>;
    readonly endpointsFor: Map<UnitOwner, readonly LogisticsEndpoint[]>;
  } | null = null;

  constructor(
    private readonly structures: PlacedStructureSystem,
    private readonly roads: RoadGraph,
    /** Omitted only by isolated harnesses that intentionally root logistics at a depot. */
    private readonly centers?: CommandCenterSystem,
  ) {}

  /**
   * The memo slot valid for the current world state, created on first use after
   * any of its three inputs changed.
   */
  private cache(): NonNullable<typeof this.memo> {
    const key = `${this.roads.version}:${this.structures.completedVersion}:${this.centers?.version ?? 0}`;
    const memo = this.memo;
    if (memo && memo.key === key) return memo;
    const fresh = { key, endpointsFor: new Map<UnitOwner, readonly LogisticsEndpoint[]>() };
    this.memo = fresh;
    return fresh;
  }

  /** Centre-road component for each kingdom; null means its centre lost its road. */
  mainComponentIds(): ReadonlyMap<UnitOwner, number | null> {
    const memo = this.cache();
    if (memo.mainComponentIds) return memo.mainComponentIds;
    const componentByCell = this.componentIds();
    const result = new Map<UnitOwner, number | null>();
    if (!this.centers) {
      memo.mainComponentIds = result;
      return result;
    }
    for (const center of this.centers.all()) {
      const roadCell = roadCellTouchingFootprint(
        this.roads,
        center.position.x,
        center.position.z,
        center.stats.footprint.width,
        center.stats.footprint.depth,
      );
      result.set(center.owner, roadCell ? componentByCell.get(this.key(roadCell)) ?? null : null);
    }
    memo.mainComponentIds = result;
    return result;
  }

  snapshots(): readonly DepotNodeSnapshot[] {
    const memo = this.cache();
    if (memo.snapshots) return memo.snapshots;
    const componentByCell = this.componentIds();
    const mainComponentByOwner = this.mainComponentIds();
    const snapshots: readonly DepotNodeSnapshot[] = this.structures.all()
      .filter((structure) => structure.construction.complete && structure.stats.id === "depot")
      .map((structure) => {
        const roadCell = roadCellTouchingFootprint(
          this.roads,
          structure.x,
          structure.z,
          structure.stats.footprint.width,
          structure.stats.footprint.depth,
        );
        const componentId = roadCell ? componentByCell.get(this.key(roadCell)) ?? null : null;
        const mainComponentId = mainComponentByOwner.get(structure.owner);
        return {
          structureId: structure.id,
          owner: structure.owner,
          x: structure.x,
          z: structure.z,
          roadCell,
          componentId,
          status: componentId === null
            ? "unlinked"
            : mainComponentId === undefined || mainComponentId === componentId
              ? "linked"
              : "unlinked-main-network",
        };
      });
    memo.snapshots = snapshots;
    return snapshots;
  }

  /**
   * Every road-connected store a producer may choose between. The command centre
   * is deliberately in this list: a depot is an alternative endpoint, not a
   * rule that forces a longer trip just because one exists elsewhere.
   */
  endpointsFor(owner: UnitOwner): readonly LogisticsEndpoint[] {
    const memo = this.cache();
    const cached = memo.endpointsFor.get(owner);
    if (cached) return cached;
    const endpoints: LogisticsEndpoint[] = [];
    for (const center of this.centers?.all() ?? []) {
      if (center.owner !== owner) continue;
      const roadCell = roadCellTouchingFootprint(
        this.roads,
        center.position.x,
        center.position.z,
        center.stats.footprint.width,
        center.stats.footprint.depth,
      );
      if (roadCell) endpoints.push({ structureId: null, roadCell });
    }
    for (const depot of this.snapshots()) {
      if (depot.owner !== owner || depot.status !== "linked" || !depot.roadCell) continue;
      endpoints.push({ structureId: depot.structureId, roadCell: depot.roadCell });
    }
    memo.endpointsFor.set(owner, endpoints);
    return endpoints;
  }

  private componentIds(): Map<string, number> {
    const memo = this.cache();
    if (memo.componentIds) return memo.componentIds;
    const componentByCell = new Map<string, number>();
    for (const component of this.roads.components()) {
      for (const cell of component.cells) componentByCell.set(this.key(cell), component.id);
    }
    memo.componentIds = componentByCell;
    return componentByCell;
  }

  private key(cell: RoadCell): string {
    return `${cell.x}:${cell.z}`;
  }
}

/**
 * Every committed road tile that meets a structure, on any of its four sides,
 * nearest first.
 *
 * Which tiles those are is {@link roadCellTouchesFootprint}'s grid-aware answer;
 * the gap is only the ordering, so a caller that wants one cell gets a stable
 * one. The order is fully determined (gap, then x, then z), because a lane
 * endpoint that moved between ticks would re-route every caravan on it.
 */
export function roadCellsTouchingFootprint(
  roads: RoadGraph,
  x: number,
  z: number,
  width: number,
  depth: number,
): readonly RoadCell[] {
  const footprint = { x, z, width, depth };
  const cellSize = roads.cellSize;
  return roads.all()
    .filter((cell) => roadCellTouchesFootprint(cell, footprint, cellSize))
    .map((cell) => ({ cell, gap: roadCellFootprintGap(cell, footprint, cellSize) }))
    .sort((a, b) => a.gap - b.gap || a.cell.x - b.cell.x || a.cell.z - b.cell.z)
    .map((candidate) => ({ x: candidate.cell.x, z: candidate.cell.z }));
}

/**
 * The deterministic road tile that touches a structure, or null when none does.
 *
 * A road tile can never *overlap* a footprint — the footprint is a nav blocker,
 * so the graph refuses to route through it — which is why "touching" means the
 * first legal tile outside it rather than an adjacent one. Where that tile falls
 * depends on how the footprint's centre lands on the road grid, so the test is
 * derived from the grid ({@link roadTouchLines}) instead of measured with a
 * tolerance. See `roadFootprintTouch.ts` for why the tolerance version cut two
 * sides off every off-grid trade site.
 */
export function roadCellTouchingFootprint(
  roads: RoadGraph,
  x: number,
  z: number,
  width: number,
  depth: number,
): RoadCell | null {
  return roadCellsTouchingFootprint(roads, x, z, width, depth)[0] ?? null;
}
