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
  return roads.touchesFootprint(footprint) || roads.planAccessRoad(footprint)
    ? null
    : AI_ROAD_UNREACHABLE;
}
