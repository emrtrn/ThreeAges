/**
 * Deterministic, renderer-free candidate generation for an AI base layout.
 *
 * It deliberately does not create structures or roads.  The construction
 * service remains the write gate; this module only turns authored spatial facts
 * plus balance data into a bounded, reproducible list of legal proposals.
 */
import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { AiLayoutBalance, BuildingBalance, BuildingBalanceStats } from "../../data/gameDataTypes";
import { RTS_RESOURCE_NODE_BLOCK_HALF_EXTENT } from "../economy/resourceNodeSystem";
import { RTS_TREE_BLOCK_HALF_EXTENT } from "../economy/forestSystem";
import {
  RTS_PLACEMENT_GRID_SIZE,
  buildingFootprintBlocker,
  snapToPlacementGrid,
  validateBuildingPlacement,
  type PlacementControl,
} from "../structures/placementGrid";
import type { UnitOwner } from "../units/unit";
import type { RtsMapPoint } from "../world/rtsMapBlockout";
import type { RtsSpatialLayout } from "../world/rtsSpatialLayout";

export type SettlementZone = "housing" | "logistics" | "military" | "resource";

export interface SettlementSiteCandidate {
  /** Stable across replans of the same layout version and seed. */
  readonly key: string;
  readonly buildingId: string;
  readonly x: number;
  readonly z: number;
  readonly zone: SettlementZone;
  /** Resource node, forest, or herd that justifies a source-bound producer. */
  readonly sourceId?: string;
  readonly score: number;
}

/** A candidate plus the sources it can work, kept only while the plan is ranked. */
interface ScoredCandidate extends SettlementSiteCandidate {
  readonly reach: readonly string[];
}

export interface SettlementLayoutPlan {
  readonly version: 1;
  readonly seed: number;
  readonly candidatesByBuilding: ReadonlyMap<string, readonly SettlementSiteCandidate[]>;
}

/** Pure territory boundary supplied by the live territory system at integration time. */
export interface SettlementTerritorySnapshot {
  readonly control: PlacementControl;
}

/** Dynamic structures may be supplied without teaching the planner about runtime entities. */
export interface SettlementPlacementRulesSnapshot {
  readonly occupied?: readonly NavBlocker[];
}

export interface SettlementLayoutPlanningInput {
  readonly seed: number;
  readonly owner: UnitOwner;
  readonly center: RtsMapPoint;
  readonly territory: SettlementTerritorySnapshot;
  readonly map: RtsSpatialLayout;
  readonly buildings: BuildingBalance;
  readonly placement?: SettlementPlacementRulesSnapshot;
  readonly layout: AiLayoutBalance;
  /**
   * Runtime-only availability gate used by the narrow P4 replan.  Level data
   * still owns the source's position; this merely prevents a spent node, forest
   * or herd from justifying another producer at the same place.
   */
  readonly isSourceAvailable?: (sourceId: string) => boolean;
  /** Limits a test or a future narrow replan to the relevant building types. */
  readonly buildingIds?: readonly string[];
}

interface LayoutSource extends RtsMapPoint {
  readonly id: string;
}

const SOURCE_RESERVE_HEIGHT = 3;
const HERD_SOURCE_HALF_EXTENT = 0.8;

/** Build every requested building's bounded, descending-score candidate list. */
export function planSettlementLayout(input: SettlementLayoutPlanningInput): SettlementLayoutPlan {
  if (!Number.isInteger(input.seed)) throw new RangeError("Settlement layout seed must be an integer");
  const buildingIds = [...new Set(input.buildingIds ?? Object.keys(input.buildings))]
    .filter((id) => id !== "command_center" && input.buildings[id] !== undefined)
    .sort();
  const occupied = [
    ...input.map.navigationBlockers,
    ...sourceReservationBlockers(input.map),
    // Reserve only the legacy fallback slots whose value is source/logistics
    // specific. Reserving every generic house/farm/military slot can erase the
    // tight base ring a procedural farm needs, while a generic fallback is not
    // a later source-bound recovery path.
    ...input.map.enemyBaseAnchors.flatMap((anchor) => {
      const stats = input.buildings[anchor.buildingId];
      return stats && (stats.id === "depot" || requiresExternalSource(stats))
        ? [buildingFootprintBlocker(stats, anchor.x, anchor.z)]
        : [];
    }),
    ...(input.placement?.occupied ?? []),
  ];
  const candidatesByBuilding = new Map<string, readonly SettlementSiteCandidate[]>();
  for (const buildingId of buildingIds) {
    const stats = input.buildings[buildingId];
    if (!stats) continue;
    candidatesByBuilding.set(buildingId, planBuildingCandidates(input, stats, occupied));
  }
  return { version: 1, seed: input.seed, candidatesByBuilding };
}

function planBuildingCandidates(
  input: SettlementLayoutPlanningInput,
  stats: BuildingBalanceStats,
  occupied: readonly NavBlocker[],
): readonly SettlementSiteCandidate[] {
  const zone = zoneFor(stats);
  const sources = sourcesFor(stats, input.map)
    .filter((source) => !source.id || input.isSourceAvailable?.(source.id) !== false);
  // A farm is a resource-zone producer but has no external source; it searches
  // around the base like the other rings. A mine with no matching deposit has no
  // candidate at all, which is the explicit and safe failure state.
  const searchOrigins = sources.length > 0 ? sources : stats.economy && requiresExternalSource(stats) ? [] : [{ id: "", ...input.center }];
  const zoneBalance = input.layout.zones[zone];
  const candidates: ScoredCandidate[] = [];
  for (const source of searchOrigins) {
    for (const point of gridPointsInRing(source, zoneBalance.minRadius, zoneBalance.maxRadius)) {
      const result = validateBuildingPlacement(stats, point.x, point.z, occupied, input.territory.control);
      if (!result.valid) continue;
      if (!sourceSupports(stats, source, result.x, result.z)) continue;
      const distance = Math.hypot(result.x - source.x, result.z - source.z);
      const preferredRadius = (zoneBalance.minRadius + zoneBalance.maxRadius) * 0.5;
      const key = candidateKey(input.seed, stats.id, source.id || undefined, result.x, result.z);
      // What this site could actually work, not merely what it is near. A grove
      // is scored as one centroid, so "within gatherRadius of the grove" says
      // nothing about whether ten trees are in reach or one.
      const reach = workableSources(stats, input.map, result.x, result.z);
      const score = roundScore(
        -Math.abs(distance - preferredRadius) * input.layout.scoring.distancePenalty
        // Resource sites still need a real source, but this soft preference
        // prevents a seed from repeatedly selecting the far side of that
        // source and spending the opening wood bank on its access road.
        -Math.hypot(result.x - input.center.x, result.z - input.center.z)
          * input.layout.scoring.centerDistancePenalty
        + reach.length * input.layout.scoring.sourceRichnessWeight
        + seededUnit(key) * input.layout.scoring.seedTieBreakWeight,
      );
      candidates.push({
        key,
        buildingId: stats.id,
        x: result.x,
        z: result.z,
        zone,
        ...(source.id ? { sourceId: source.id } : {}),
        score,
        reach,
      });
    }
  }
  return spreadOverSources(
    candidates.sort((left, right) => right.score - left.score || left.key.localeCompare(right.key)),
    input.layout.scoring.sourceOverlapPenalty,
    input.layout.candidateLimit,
  );
}

/**
 * Rank the list so each successive entry works ground the ones above it do not.
 *
 * The plan is a *list*, and a building the age plan wants two of takes its first
 * two entries. Sorting on score alone made those two neighbours — the same trees
 * scored best twice — so the second camp doubled up on the first one's grove
 * while the rest of the wood on the map stood untouched, which is exactly the
 * shape a player never builds.
 *
 * Greedy rather than exhaustive: pick the best remaining, charge every candidate
 * for the sources it now shares, repeat. That is enough to push the runner-up
 * onto the next stand, and it keeps the pass linear in the candidate limit.
 * Ties still fall through to `key`, so §80 determinism is untouched.
 */
function spreadOverSources(
  ranked: readonly ScoredCandidate[],
  overlapPenalty: number,
  limit: number,
): readonly SettlementSiteCandidate[] {
  if (overlapPenalty <= 0) return ranked.slice(0, limit).map(stripReach);
  const remaining = [...ranked];
  const chosen: ScoredCandidate[] = [];
  const taken = new Set<string>();
  while (chosen.length < limit && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      if (!candidate) continue;
      const shared = candidate.reach.reduce((count, id) => count + (taken.has(id) ? 1 : 0), 0);
      const adjusted = candidate.score - shared * overlapPenalty;
      // Strictly greater, so an exact tie keeps the earlier entry and the list
      // stays a deterministic function of the sorted input.
      if (adjusted > bestScore) {
        bestScore = adjusted;
        bestIndex = index;
      }
    }
    const [picked] = remaining.splice(bestIndex, 1);
    if (!picked) break;
    for (const id of picked.reach) taken.add(id);
    chosen.push(picked);
  }
  return chosen.map(stripReach);
}

const stripReach = ({ reach: _reach, ...candidate }: ScoredCandidate): SettlementSiteCandidate => candidate;

/**
 * The individual sources this site could work, by id.
 *
 * Ids rather than a count, because {@link spreadOverSources} has to know *which*
 * trees two camps would share, not merely how many each can see.
 */
function workableSources(
  stats: BuildingBalanceStats,
  map: RtsSpatialLayout,
  x: number,
  z: number,
): readonly string[] {
  const economy = stats.economy;
  const radius = economy?.gatherRadius;
  if (!economy || radius === undefined) return [];
  const within = (px: number, pz: number): boolean =>
    (px - x) * (px - x) + (pz - z) * (pz - z) <= radius * radius;
  if (economy.requiresForest) {
    return map.trees.filter((tree) => within(tree.x, tree.z)).map((tree) => `tree:${tree.id}`);
  }
  if (economy.requiresResourceNode) {
    return map.resourceNodes
      .filter((node) => node.resourceId === economy.resourceId && within(node.x, node.z))
      .map((node) => `node:${node.id}`);
  }
  if (economy.requiresGame || economy.requiresLivestock) {
    return map.herds.filter((herd) => within(herd.x, herd.z)).map((herd) => `herd:${herd.id}`);
  }
  return [];
}

function zoneFor(stats: BuildingBalanceStats): SettlementZone {
  if (stats.id === "house") return "housing";
  if (stats.id === "depot") return "logistics";
  if (stats.economy) return "resource";
  return "military";
}

function requiresExternalSource(stats: BuildingBalanceStats): boolean {
  return stats.economy?.requiresResourceNode === true
    || stats.economy?.requiresForest === true
    || stats.economy?.requiresGame === true
    || stats.economy?.requiresLivestock === true;
}

function sourcesFor(stats: BuildingBalanceStats, map: RtsSpatialLayout): readonly LayoutSource[] {
  const economy = stats.economy;
  if (!economy) return [];
  if (economy.requiresResourceNode) {
    return map.resourceNodes
      .filter((node) => node.resourceId === economy.resourceId)
      .map((node) => ({ id: `node:${node.id}`, x: node.x, z: node.z }));
  }
  if (economy.requiresForest) return forestSources(map);
  if (economy.requiresGame || economy.requiresLivestock) {
    return map.herds.map((herd) => ({ id: `herd:${herd.id}`, x: herd.x, z: herd.z }));
  }
  return [];
}

function forestSources(map: RtsSpatialLayout): readonly LayoutSource[] {
  const sums = new Map<string, { x: number; z: number; count: number }>();
  for (const tree of map.trees) {
    const sum = sums.get(tree.forestId) ?? { x: 0, z: 0, count: 0 };
    sum.x += tree.x;
    sum.z += tree.z;
    sum.count += 1;
    sums.set(tree.forestId, sum);
  }
  return [...sums.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([forestId, sum]) => ({ id: `forest:${forestId}`, x: sum.x / sum.count, z: sum.z / sum.count }));
}

function sourceSupports(stats: BuildingBalanceStats, source: LayoutSource, x: number, z: number): boolean {
  if (!requiresExternalSource(stats)) return true;
  const radius = stats.economy?.gatherRadius;
  if (radius === undefined) return false;
  const dx = x - source.x;
  const dz = z - source.z;
  return dx * dx + dz * dz <= radius * radius;
}

function* gridPointsInRing(center: RtsMapPoint, minRadius: number, maxRadius: number): Generator<RtsMapPoint> {
  const snappedCenter = snapToPlacementGrid(center.x, center.z);
  const minSquared = minRadius * minRadius;
  const maxSquared = maxRadius * maxRadius;
  for (let x = snappedCenter.x - maxRadius; x <= snappedCenter.x + maxRadius; x += RTS_PLACEMENT_GRID_SIZE) {
    for (let z = snappedCenter.z - maxRadius; z <= snappedCenter.z + maxRadius; z += RTS_PLACEMENT_GRID_SIZE) {
      const point = snapToPlacementGrid(x, z);
      const dx = point.x - center.x;
      const dz = point.z - center.z;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared >= minSquared && distanceSquared <= maxSquared) yield point;
    }
  }
}

function sourceReservationBlockers(map: RtsSpatialLayout): readonly NavBlocker[] {
  return [
    ...map.resourceNodes.map((node) => pointReservation(node, RTS_RESOURCE_NODE_BLOCK_HALF_EXTENT)),
    ...map.trees.map((tree) => pointReservation(tree, RTS_TREE_BLOCK_HALF_EXTENT)),
    ...map.herds.map((herd) => pointReservation(herd, HERD_SOURCE_HALF_EXTENT)),
  ];
}

function pointReservation(point: RtsMapPoint, halfExtent: number): NavBlocker {
  return {
    min: [point.x - halfExtent, 0, point.z - halfExtent],
    max: [point.x + halfExtent, SOURCE_RESERVE_HEIGHT, point.z + halfExtent],
  };
}

function candidateKey(seed: number, buildingId: string, sourceId: string | undefined, x: number, z: number): string {
  return `v1:${seed}:${buildingId}:${sourceId ?? "base"}:${x}:${z}`;
}

/** FNV-1a supplies stable pseudo-randomness without ever consulting Math.random(). */
function seededUnit(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

function roundScore(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
