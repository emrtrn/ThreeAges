/** Phase 4 producer-to-depot graph attachment; transfer remains a later step. */
import type { RoadCell, RoadGraph } from "../roads/roadGraph";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { TerritoryControlSystem } from "../territory/territoryControlSystem";
import type { UnitOwner } from "../units/unit";
import { type DepotLogisticsSystem, roadCellTouchingFootprint } from "./depotLogisticsSystem";
import type { LogisticsOccupationSystem } from "./logisticsOccupationSystem";

export type ProducerLogisticsStatus = "outside-control" | "unlinked-road" | "unlinked-depot" | "unlinked-main-network" | "depot-occupied" | "linked";
/** Explicit only for a nearby no-caravan hand-off; normal links keep their legacy caravan route. */
export type ProducerTransport = "direct";

export interface ProducerLogisticsSnapshot {
  readonly structureId: number;
  readonly owner: UnitOwner;
  readonly resourceId: string;
  readonly roadCell: RoadCell | null;
  readonly componentId: number | null;
  readonly depotStructureId: number | null;
  readonly status: ProducerLogisticsStatus;
  readonly transport?: ProducerTransport;
}

interface LocalTransferEndpoint {
  readonly structureId: number | null;
  readonly owner: UnitOwner;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
}

/** Resolves a producer's physical road contact and its route back to the kingdom's store. */
export class ProductionLogisticsSystem {
  constructor(
    private readonly structures: PlacedStructureSystem,
    private readonly roads: RoadGraph,
    private readonly depots: DepotLogisticsSystem,
    private readonly territory?: TerritoryControlSystem,
    private readonly occupation?: LogisticsOccupationSystem,
    /** Optional in isolated harnesses; live RTS uses it for no-caravan local delivery. */
    private readonly centers?: CommandCenterSystem,
  ) {}

  snapshots(): readonly ProducerLogisticsSnapshot[] {
    const componentByCell = new Map<string, number>();
    for (const component of this.roads.components()) {
      for (const cell of component.cells) componentByCell.set(this.key(cell), component.id);
    }
    const mainComponentByOwner = this.depots.mainComponentIds();
    const localEndpoints = this.localEndpoints();
    return this.structures.all()
      .filter((structure) => structure.construction.complete && structure.economy)
      .map((structure) => {
        const economy = structure.economy;
        if (!economy) throw new Error("Completed producer missing economy balance");
        const controlled = this.territory?.ownsFootprint(
          structure.owner, structure.x, structure.z, structure.stats.footprint.width, structure.stats.footprint.depth,
        ) ?? true;
        const localEndpoint = controlled ? this.localEndpointFor(structure, localEndpoints) : null;
        const roadCell = roadCellTouchingFootprint(
          this.roads,
          structure.x,
          structure.z,
          structure.stats.footprint.width,
          structure.stats.footprint.depth,
        );
        const componentId = roadCell ? componentByCell.get(this.key(roadCell)) ?? null : null;
        const mainComponentId = mainComponentByOwner.get(structure.owner);
        const endpoint = localEndpoint || roadCell === null ? null : this.depots.endpointsFor(structure.owner)
          .filter((candidate) => candidate.structureId === null
            || (this.occupation?.isUsable(candidate.structureId) ?? true))
          .map((candidate) => ({ candidate, route: this.roads.route(roadCell, candidate.roadCell) }))
          .filter((candidate): candidate is { candidate: { structureId: number | null; roadCell: RoadCell }; route: readonly RoadCell[] } => candidate.route !== null)
          .sort((a, b) => a.route.length - b.route.length
            || (a.candidate.structureId ?? -1) - (b.candidate.structureId ?? -1))[0]?.candidate ?? null;
        const depotStructureId = localEndpoint?.structureId ?? endpoint?.structureId ?? null;
        const occupiedDepotOnComponent = componentId !== null && this.occupation !== undefined
          && this.depots.snapshots().some((depot) => depot.owner === structure.owner
            && depot.componentId === componentId
            && !this.occupation!.isUsable(depot.structureId));
        return {
          structureId: structure.id,
          owner: structure.owner,
          resourceId: economy.resourceId,
          roadCell,
          componentId,
          depotStructureId,
          status: !controlled
            ? "outside-control"
            : localEndpoint !== null
              ? "linked"
            : componentId === null
              ? "unlinked-road"
              : endpoint !== null
                ? "linked"
                : occupiedDepotOnComponent
                  ? "depot-occupied"
                  : mainComponentId !== undefined
                    ? "unlinked-main-network"
                    : "unlinked-depot",
          ...(localEndpoint !== null ? { transport: "direct" as const } : {}),
        };
      });
  }

  /** Stores close enough for an instantaneous hand-off; an unlinked depot is not one. */
  private localEndpoints(): readonly LocalTransferEndpoint[] {
    // Isolated logistics harnesses omit the command-centre registry on purpose;
    // without that global-store authority they retain the historical
    // arrival-gated semantics.
    if (!this.centers) return [];
    const endpoints: LocalTransferEndpoint[] = [];
    for (const center of this.centers?.all() ?? []) {
      endpoints.push({
        structureId: null,
        owner: center.owner,
        x: center.position.x,
        z: center.position.z,
        width: center.stats.footprint.width,
        depth: center.stats.footprint.depth,
      });
    }
    const depotsById = new Map(this.depots.snapshots().map((depot) => [depot.structureId, depot]));
    for (const structure of this.structures.all()) {
      if (!structure.construction.complete || structure.stats.id !== "depot") continue;
      const depot = depotsById.get(structure.id);
      if (!depot || depot.status !== "linked" || !(this.occupation?.isUsable(structure.id) ?? true)) continue;
      endpoints.push({
        structureId: structure.id,
        owner: structure.owner,
        x: structure.x,
        z: structure.z,
        width: structure.stats.footprint.width,
        depth: structure.stats.footprint.depth,
      });
    }
    return endpoints;
  }

  private localEndpointFor(
    structure: { readonly owner: UnitOwner; readonly x: number; readonly z: number; readonly stats: { readonly footprint: { readonly width: number; readonly depth: number } } },
    endpoints: readonly LocalTransferEndpoint[],
  ): LocalTransferEndpoint | null {
    const maximumDistance = this.roads.autoConnectMaximumDistance;
    if (maximumDistance <= 0) return null;
    return endpoints
      .filter((endpoint) => endpoint.owner === structure.owner)
      .map((endpoint) => ({ endpoint, distance: footprintDistance(structure, endpoint) }))
      .filter((candidate) => candidate.distance <= maximumDistance)
      .sort((left, right) => left.distance - right.distance || (left.endpoint.structureId ?? -1) - (right.endpoint.structureId ?? -1))[0]
      ?.endpoint ?? null;
  }

  private key(cell: RoadCell): string {
    return `${cell.x}:${cell.z}`;
  }
}

/** Minimum X/Z gap between two axis-aligned building footprints. */
function footprintDistance(
  left: { readonly x: number; readonly z: number; readonly stats: { readonly footprint: { readonly width: number; readonly depth: number } } },
  right: { readonly x: number; readonly z: number; readonly width: number; readonly depth: number },
): number {
  const x = Math.max(0, Math.abs(left.x - right.x) - (left.stats.footprint.width + right.width) / 2);
  const z = Math.max(0, Math.abs(left.z - right.z) - (left.stats.footprint.depth + right.depth) / 2);
  return Math.hypot(x, z);
}
