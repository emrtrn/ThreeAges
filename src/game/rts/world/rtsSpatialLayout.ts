/** Resolves either the legacy blockout or a validated Level into RtsApp inputs. */
import type { RtsExpansionRegion, RtsMapPoint, RtsStrategicPoint } from "./rtsMapBlockout";
import { RTS_BLOCKOUT_MAP } from "./rtsMapBlockout";
import type { RtsResourceNodeDefinition } from "../economy/resourceNodeSystem";
import type { RtsTradeSiteDefinition } from "../economy/tradeSiteSystem";
import type { RtsTreeDefinition } from "../economy/forestSystem";
import type { RtsHerdDefinition } from "../wildlife/wildlifeSystem";
import type { NavBlocker } from "@engine/navigation/gridNavigation";
import { RtsLevelError, type RtsLevelDefinition } from "./rtsLevelAdapter";
import type { RtsWalkableDeck } from "./rtsTerrainSurface";

export interface RtsSpatialLayout {
  readonly playerStart: RtsMapPoint;
  readonly enemyStart: RtsMapPoint;
  readonly resourceNodes: readonly RtsResourceNodeDefinition[];
  readonly trees: readonly RtsTreeDefinition[];
  readonly herds: readonly RtsHerdDefinition[];
  readonly tradeSites: readonly RtsTradeSiteDefinition[];
  readonly strategicPoints: readonly RtsStrategicPoint[];
  readonly enemyBaseAnchors: typeof RTS_BLOCKOUT_MAP.enemyBaseAnchors;
  readonly enemyBaseRoute: readonly RtsMapPoint[];
  readonly enemyExpansions: readonly RtsExpansionRegion[];
  readonly navigationBlockers: readonly NavBlocker[];
  readonly walkableDecks: readonly RtsWalkableDeck[];
}

/**
 * Keeps the blockout fallback explicit until a Level provides the complete
 * gameplay surface.  No renderer data is owned here; authored-world mounting is
 * Faz E's responsibility.
 */
export function resolveRtsSpatialLayout(level?: RtsLevelDefinition): RtsSpatialLayout {
  if (!level) return RTS_BLOCKOUT_MAP;
  const enemyBaseRoute = level.routes.get("rts.route:enemy:base:0");
  if (!enemyBaseRoute) throw new RtsLevelError("Level requires rts.route:enemy:base:0");
  const enemyBaseAnchors = level.buildAnchors.filter((anchor) => anchor.owner === "enemy");
  if (enemyBaseAnchors.length === 0) throw new RtsLevelError("Level requires one enemy build anchor");
  return {
    playerStart: level.playerStart,
    enemyStart: level.enemyStart,
    resourceNodes: level.resourceNodes,
    trees: level.trees,
    herds: level.herds,
    tradeSites: level.tradeSites,
    strategicPoints: level.strategicPoints,
    enemyBaseAnchors,
    enemyBaseRoute,
    enemyExpansions: level.expansions,
    navigationBlockers: level.navigationBlockers,
    walkableDecks: level.walkableDecks,
  };
}
