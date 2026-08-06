/**
 * Phase 4 depot nodes. A completed depot joins the global store only when a
 * touching road also reaches its owner's command centre. This keeps stock and
 * storage capacity physically rooted in the same road network.
 */
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
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
 * Returns the deterministic road tile whose footprint touches a structure.
 *
 * The tolerance is half a road cell rather than zero because a road tile can
 * never *overlap* a footprint — the footprint is a nav blocker, so the graph
 * refuses to route through it. "Touching" therefore means the nearest legal
 * tile outside the footprint, and whether one lands exactly on the edge depends
 * on how the footprint's half-width falls on the 2-unit road grid.
 *
 * Even footprints (depot/farm/outpost, 6) happen to line up; the 7-unit command
 * centre does not, and with a zero tolerance *no* tile could ever touch it —
 * which silently made {@link RtsApp.outpostConnectedToMainRoad} always false and
 * withheld the outpost's connected control radius from both kingdoms.
 */
export function roadCellTouchingFootprint(
  roads: RoadGraph,
  x: number,
  z: number,
  width: number,
  depth: number,
): RoadCell | null {
  const halfRoad = roads.cellSize / 2;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  return roads.all()
    .map((cell) => ({
      cell,
      distance: Math.hypot(
        Math.max(0, Math.abs(cell.x - x) - halfWidth - halfRoad),
        Math.max(0, Math.abs(cell.z - z) - halfDepth - halfRoad),
      ),
    }))
    .filter((candidate) => candidate.distance <= halfRoad)
    .sort((a, b) => a.distance - b.distance || a.cell.x - b.cell.x || a.cell.z - b.cell.z)
    .map((candidate) => ({ x: candidate.cell.x, z: candidate.cell.z }))[0] ?? null;
}
