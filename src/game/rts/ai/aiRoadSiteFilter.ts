/**
 * Road feasibility gate for procedural base sites.
 *
 * A structure must not be started merely because its footprint is legal when
 * its required depot/producer access spur has no legal route. The filter is
 * deliberately a read-only preflight: construction and road payment remain in
 * their existing services.
 */
import type { BuildingBalance } from "../../data/gameDataTypes";
import type { RoadConstructionService } from "../roads/roadConstructionService";
import type { RtsMapPoint } from "../world/rtsMapBlockout";
import type { AiBuildSite } from "./aiSiteProvider";

export const AI_ROAD_UNREACHABLE = "road-unreachable";

/**
 * Reject only planned logistics endpoints. Legacy anchors are the controlled
 * fallback and non-logistics base buildings do not require a delivery road.
 */
export function proceduralRoadSiteFailure(
  site: AiBuildSite,
  buildings: BuildingBalance,
  roads: RoadConstructionService,
  baseRoute: readonly RtsMapPoint[] = [],
): string | null {
  if (site.source !== "procedural") return null;
  const stats = buildings[site.buildingId];
  if (!stats || (stats.id !== "depot" && !stats.economy)) return null;
  const footprint = {
    x: site.x,
    z: site.z,
    width: stats.footprint.width,
    depth: stats.footprint.depth,
  };
  if (!roads.touchesFootprint(footprint) && !roads.planAccessRoad(footprint)) return AI_ROAD_UNREACHABLE;
  return baseRouteRemainsReachable(roads, footprint, baseRoute) ? null : AI_ROAD_UNREACHABLE;
}

/**
 * Prefer a viable planned depot with the smallest paid centre connection and
 * the shortest residual gap to one candidate of each planned producer type.
 *
 * The result is only a tie-breaking preference among sites the pure planner
 * already judged legal. It deliberately does not write roads or replace the
 * planner's seed-based ordering for non-depot buildings.
 */
export function proceduralDepotRoadRank(
  site: AiBuildSite,
  buildings: BuildingBalance,
  roads: RoadConstructionService,
  plannedSites: readonly AiBuildSite[],
): number | null {
  if (site.source !== "procedural" || site.buildingId !== "depot") return null;
  const depot = buildings.depot;
  if (!depot) return null;
  const access = roads.planAccessRoad({
    x: site.x,
    z: site.z,
    width: depot.footprint.width,
    depth: depot.footprint.depth,
  });
  if (!access) return null;
  const producerTypes = [...new Set(plannedSites
    .filter((candidate) => candidate.source === "procedural" && buildings[candidate.buildingId]?.economy)
    .map((candidate) => candidate.buildingId))]
    .sort();
  const residualProducerGap = producerTypes.reduce((total, buildingId) => {
    const producer = buildings[buildingId];
    if (!producer) return total;
    const nearest = plannedSites
      .filter((candidate) => candidate.buildingId === buildingId && candidate.source === "procedural")
      .map((candidate) => footprintGap(site, depot.footprint.width, depot.footprint.depth, candidate,
        producer.footprint.width, producer.footprint.depth))
      .sort((left, right) => left - right)[0];
    // A producer within the data-owned local hand-off radius contributes no
    // residual logistics distance; beyond it, only the gap matters.
    return total + Math.max(0, (nearest ?? 0) - roads.autoConnectMaximumDistance);
  }, 0);
  return access.woodCost + residualProducerGap;
}

/** The authored supply spine stays a live fallback during P3, so do not bury it. */
function baseRouteRemainsReachable(
  roads: RoadConstructionService,
  footprint: Readonly<{ x: number; z: number; width: number; depth: number }>,
  baseRoute: readonly RtsMapPoint[],
): boolean {
  const blocker = {
    min: [footprint.x - footprint.width / 2, 0, footprint.z - footprint.depth / 2] as [number, number, number],
    max: [footprint.x + footprint.width / 2, 3, footprint.z + footprint.depth / 2] as [number, number, number],
  };
  for (let index = 0; index < baseRoute.length - 1; index += 1) {
    const from = baseRoute[index];
    const to = baseRoute[index + 1];
    if (!from || !to || !roads.planWithAdditionalBlockers(from, to, [blocker])) return false;
  }
  return true;
}

function footprintGap(
  left: AiBuildSite,
  leftWidth: number,
  leftDepth: number,
  right: AiBuildSite,
  rightWidth: number,
  rightDepth: number,
): number {
  const gapX = Math.max(0, Math.abs(left.x - right.x) - (leftWidth + rightWidth) / 2);
  const gapZ = Math.max(0, Math.abs(left.z - right.z) - (leftDepth + rightDepth) / 2);
  return Math.hypot(gapX, gapZ);
}
