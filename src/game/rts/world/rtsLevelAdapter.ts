/** Pure Level marker -> RTS spatial-data adapter (assetization Faz D). */
import { resolveActorInstanceVariables, type ResolvedActorClass } from "@engine/scene/actorInstance";
import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { LayoutBlockingVolume, LayoutSplineActor } from "@engine/scene/layout";
import { resolveBlockingVolume } from "@engine/scene/blockingVolume";
import type { AnimalBalance, BuildingBalance, ResourceBalance } from "../../data/gameDataTypes";
import type { RtsResourceNodeDefinition } from "../economy/resourceNodeSystem";
import type { RtsTradeSiteDefinition } from "../economy/tradeSiteSystem";
import type { RtsTreeDefinition } from "../economy/forestSystem";
import type { RtsHerdDefinition } from "../wildlife/wildlifeSystem";
import type { RtsBuildAnchor, RtsExpansionRegion, RtsMapPoint, RtsStrategicPoint } from "./rtsMapBlockout";
import { RTS_WORLD_BUILD_HALF_EXTENT, RTS_WORLD_HALF_EXTENT } from "./rtsGround";
import type { UnitOwner } from "../units/unit";
import type { RtsWalkableDeck } from "./rtsTerrainSurface";

export class RtsLevelError extends Error {
  constructor(message: string) { super(message); this.name = "RtsLevelError"; }
}

export interface RtsLevelDefinition {
  readonly playerStart: RtsMapPoint;
  readonly enemyStart: RtsMapPoint;
  readonly resourceNodes: readonly RtsResourceNodeDefinition[];
  readonly trees: readonly RtsTreeDefinition[];
  /** Authored wildlife clusters; one marker stands for a whole herd. */
  readonly herds: readonly RtsHerdDefinition[];
  /** Authored market supply points; the marker names where and which kind. */
  readonly tradeSites: readonly RtsTradeSiteDefinition[];
  readonly strategicPoints: readonly RtsStrategicPoint[];
  readonly navigationBlockers: readonly NavBlocker[];
  /** Horizontal walkable floors, such as bridge decks, that raise unit visuals. */
  readonly walkableDecks: readonly RtsWalkableDeck[];
  readonly buildAnchors: readonly RtsLevelBuildAnchor[];
  readonly expansions: readonly RtsExpansionRegion[];
  readonly routes: ReadonlyMap<string, readonly RtsMapPoint[]>;
}

/** A Level-owned build slot. Simulation still only needs the base anchor shape. */
export interface RtsLevelBuildAnchor extends RtsBuildAnchor {
  readonly owner: UnitOwner;
}

type ExpansionRole = "outpost" | "depot" | "production";

interface ExpansionMembers {
  readonly id: string;
  readonly members: Partial<Record<ExpansionRole, RtsBuildAnchor>>;
}

function mapPoint(position: readonly number[], label: string): RtsMapPoint {
  const [x, , z] = position;
  if (typeof x !== "number" || typeof z !== "number" || !Number.isFinite(x) || !Number.isFinite(z)
    || Math.abs(x) > RTS_WORLD_HALF_EXTENT || Math.abs(z) > RTS_WORLD_HALF_EXTENT) {
    throw new RtsLevelError(`${label} is outside RTS world bounds`);
  }
  return { x, z };
}

/**
 * Refuse an authored build site whose footprint would reach into the map's
 * border band.
 *
 * Placement already rejects those coordinates at runtime, but silently: the AI
 * would keep asking for an expansion it can never legally build, and the level
 * would look correct in the editor. Failing here names the marker, so a site
 * dragged too near the edge is caught when the level loads instead of as a
 * stalled kingdom mid-match.
 */
function requireBuildableSite(
  point: RtsMapPoint,
  stats: { readonly footprint: { readonly width: number; readonly depth: number } },
  label: string,
): RtsMapPoint {
  const halfWidth = stats.footprint.width / 2;
  const halfDepth = stats.footprint.depth / 2;
  if (Math.abs(point.x) + halfWidth > RTS_WORLD_BUILD_HALF_EXTENT
    || Math.abs(point.z) + halfDepth > RTS_WORLD_BUILD_HALF_EXTENT) {
    throw new RtsLevelError(
      `${label} at (${point.x}, ${point.z}) reaches the map border band; `
      + `keep its footprint within ±${RTS_WORLD_BUILD_HALF_EXTENT}`,
    );
  }
  return point;
}

function requireText(values: Readonly<Record<string, unknown>>, key: string, label: string): string {
  const value = values[key];
  if (typeof value !== "string" || !value) throw new RtsLevelError(`${label} ${key} must be a non-empty string`);
  return value;
}

function requirePositiveNumber(values: Readonly<Record<string, unknown>>, key: string, label: string): number {
  const value = values[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new RtsLevelError(`${label} ${key} must be a positive finite number`);
  }
  return value;
}

/**
 * Adapts only RTS-named Actor classes. The generic Level/Actor format remains
 * unaware of `owner`, resources, or building ids; these semantics live here.
 */
export function adaptRtsLevel(
  actors: readonly ResolvedActorClass[],
  splines: readonly LayoutSplineActor[],
  balance: {
    readonly buildings: BuildingBalance;
    readonly resources: ResourceBalance;
    readonly animals: AnimalBalance;
  },
  blockingVolumes: readonly LayoutBlockingVolume[] = [],
): RtsLevelDefinition {
  const starts = new Map<string, RtsMapPoint>();
  const nodes: RtsResourceNodeDefinition[] = [];
  const trees: RtsTreeDefinition[] = [];
  const herds: RtsHerdDefinition[] = [];
  const tradeSites: RtsTradeSiteDefinition[] = [];
  const strategicPoints: RtsStrategicPoint[] = [];
  const navigationBlockers: NavBlocker[] = [];
  const walkableDecks: RtsWalkableDeck[] = [];
  const anchors: RtsLevelBuildAnchor[] = [];
  const expansionMembers = new Map<string, ExpansionMembers>();
  /**
   * The one wood yield every authored tree is stamped with. Read on demand so a
   * treeless level still loads against a resource table that omits wood, and so
   * the failure — when a level does have a forest — names the missing balance
   * field rather than whichever tree happened to be adapted first.
   */
  const treeCapacity = (): number => {
    const capacity = balance.resources.wood?.tree?.capacity;
    if (capacity === undefined) {
      throw new RtsLevelError('balance/resources.json is missing "wood".tree.capacity, which every tree needs');
    }
    return capacity;
  };
  for (const volume of blockingVolumes) {
    const deck = blockingVolumeWalkableDeck(volume);
    if (deck) walkableDecks.push(deck);
    else if (resolveBlockingVolume(volume).navigationRole !== "ignored") {
      navigationBlockers.push(blockingVolumeNavigationBlocker(volume));
    }
  }
  for (const { def, instance } of actors) {
    const values = resolveActorInstanceVariables(def, instance.variableOverrides);
    const point = mapPoint(instance.position, `Actor ${def.name}`);
    if (def.name === "BP_RTS_KingdomStart") {
      const owner = values.owner;
      if (owner !== "player" && owner !== "enemy") throw new RtsLevelError("KingdomStart owner must be player or enemy");
      if (starts.has(owner)) throw new RtsLevelError(`duplicate ${owner} start`);
      starts.set(owner, point);
    } else if (def.name === "BP_RTS_ResourceNode") {
      const id = values.nodeId; const resourceId = values.resourceId; const kind = values.kind;
      // A deposit profile, not merely a known resource: wood is in the resource
      // table too now, and it is grown rather than deposited.
      if (typeof id !== "string" || !id || typeof resourceId !== "string" || !balance.resources[resourceId]?.safeNode) throw new RtsLevelError("invalid resource marker");
      if (kind !== "safe" && kind !== "external") throw new RtsLevelError(`resource ${id} has invalid kind`);
      if (nodes.some((node) => node.id === id)) throw new RtsLevelError(`duplicate resource node ${id}`);
      nodes.push({ id, resourceId, kind, ...point });
    } else if (def.name === "BP_RTS_Tree") {
      const id = requireText(values, "treeId", "Tree");
      const forestId = requireText(values, "forestId", "Tree");
      // Yield is a balance number, not a per-marker one, exactly as a deposit's
      // is: the marker says where a tree stands and which model it wears, and
      // `resources.json` says what every tree holds. Authoring it per instance
      // meant a forest could only be retuned by editing hundreds of actors, and
      // in practice every one of them carried the same number anyway.
      const capacity = treeCapacity();
      const variant = values.variant;
      if (variant !== "pine" && variant !== "tree1" && variant !== "tree2") throw new RtsLevelError(`Tree ${id} has invalid variant`);
      if (trees.some((tree) => tree.id === id)) throw new RtsLevelError(`duplicate tree ${id}`);
      trees.push({ id, forestId, capacity, variant, ...point });
    } else if (def.name === "BP_RTS_Herd") {
      // One marker stands for the whole herd: authoring twelve deer by hand
      // would make a herd a chore to move, and the individual animals do not
      // hold still anyway — `WildlifeSystem` scatters them around this centre.
      const id = requireText(values, "herdId", "Herd");
      const species = requireText(values, "species", `Herd ${id}`);
      if (!balance.animals[species]) throw new RtsLevelError(`Herd ${id} references unknown species "${species}"`);
      const count = requirePositiveNumber(values, "count", `Herd ${id}`);
      if (!Number.isInteger(count)) throw new RtsLevelError(`Herd ${id} count must be a whole number`);
      if (herds.some((herd) => herd.id === id)) throw new RtsLevelError(`duplicate herd ${id}`);
      herds.push({ id, species, count, ...point });
    } else if (def.name === "BP_RTS_TradeSite") {
      // Only *where* and *which kind* (supply plan §5.3). Throughput, buffer,
      // fleet size and dock size stay in `balance/trade-sites.json`, so a tuning
      // pass never reopens a level — and the site's resource is named in exactly
      // one place, where it cannot contradict itself.
      //
      // `siteType` is checked against the balance table by
      // {@link TradeSiteSystem}'s constructor rather than here, which is where
      // `resourceId` is checked for a deposit too: the adapter's job is the
      // marker's shape, and pulling a fifth balance table through this signature
      // would buy nothing the constructor does not already refuse.
      const id = requireText(values, "siteId", "TradeSite");
      const siteType = requireText(values, "siteType", `TradeSite ${id}`);
      if (tradeSites.some((site) => site.id === id)) throw new RtsLevelError(`duplicate trade site ${id}`);
      tradeSites.push({ id, siteType, ...point });
    } else if (def.name === "BP_RTS_StrategicPoint") {
      const id = requireText(values, "pointId", "StrategicPoint");
      const captureRadius = requirePositiveNumber(values, "captureRadius", `StrategicPoint ${id}`);
      if (strategicPoints.some((strategicPoint) => strategicPoint.id === id)) throw new RtsLevelError(`duplicate strategic point ${id}`);
      strategicPoints.push({ id, nameKey: `objective.point.${id}.name`, captureRadius, ...point });
    } else if (def.name === "BP_RTS_NavigationBlocker") {
      const width = requirePositiveNumber(values, "width", "NavigationBlocker");
      const depth = requirePositiveNumber(values, "depth", "NavigationBlocker");
      const height = requirePositiveNumber(values, "height", "NavigationBlocker");
      const y = instance.position[1];
      if (!Number.isFinite(y)) throw new RtsLevelError("NavigationBlocker position Y must be finite");
      navigationBlockers.push({
        min: [point.x - width / 2, y - height / 2, point.z - depth / 2],
        max: [point.x + width / 2, y + height / 2, point.z + depth / 2],
      });
    } else if (def.name === "BP_RTS_BuildAnchor") {
      const owner = values.owner;
      const buildingId = requireText(values, "buildingId", "BuildAnchor");
      if (owner !== "player" && owner !== "enemy") throw new RtsLevelError("BuildAnchor owner must be player or enemy");
      const stats = balance.buildings[buildingId];
      if (!stats) throw new RtsLevelError("invalid build anchor buildingId");
      anchors.push({ owner, buildingId, ...requireBuildableSite(point, stats, `BuildAnchor ${buildingId}`) });
    } else if (def.name === "BP_RTS_ExpansionMarker") {
      const regionId = requireText(values, "regionId", "ExpansionMarker");
      const role = values.role;
      const buildingId = requireText(values, "buildingId", "ExpansionMarker");
      if (role !== "outpost" && role !== "depot" && role !== "production") {
        throw new RtsLevelError(`ExpansionMarker ${regionId} has invalid role`);
      }
      const stats = balance.buildings[buildingId];
      if (!stats) throw new RtsLevelError(`ExpansionMarker ${regionId} has invalid buildingId`);
      if ((role === "outpost" && buildingId !== "outpost") || (role === "depot" && buildingId !== "depot")) {
        throw new RtsLevelError(`ExpansionMarker ${regionId} ${role} must use its matching buildingId`);
      }
      const region = expansionMembers.get(regionId) ?? { id: regionId, members: {} };
      if (region.members[role]) throw new RtsLevelError(`ExpansionMarker ${regionId} has duplicate ${role}`);
      const site = requireBuildableSite(point, stats, `ExpansionMarker ${regionId} ${role}`);
      region.members[role] = { buildingId, ...site };
      expansionMembers.set(regionId, region);
    }
  }
  const playerStart = starts.get("player"); const enemyStart = starts.get("enemy");
  if (!playerStart || !enemyStart) throw new RtsLevelError("level requires one player and one enemy start");
  const routes = new Map<string, readonly RtsMapPoint[]>();
  for (const spline of splines) for (const tag of spline.runtime?.tags ?? []) {
    if (!tag.startsWith("rts.route:")) continue;
    if (!/^rts\.route:enemy:[a-z][a-z0-9_-]*:[0-9]+$/.test(tag)) {
      throw new RtsLevelError(`route tag ${tag} must be rts.route:enemy:<region>:<index>`);
    }
    if (routes.has(tag)) throw new RtsLevelError(`duplicate route ${tag}`);
    const points = spline.spline.points.map((p) => mapPoint([
      spline.position[0] + p.position[0],
      spline.position[1] + p.position[1],
      spline.position[2] + p.position[2],
    ], `route ${tag}`));
    if (points.length < 2) throw new RtsLevelError(`route ${tag} needs at least two points`);
    routes.set(tag, points);
  }
  const expansions: RtsExpansionRegion[] = [];
  for (const region of expansionMembers.values()) {
    const outpost = region.members.outpost;
    const depot = region.members.depot;
    const production = region.members.production;
    if (!outpost || !depot || !production) throw new RtsLevelError(`ExpansionMarker ${region.id} needs outpost, depot and production`);
    const regionRoutes = [...routes.entries()]
      .filter(([tag]) => tag.startsWith(`rts.route:enemy:${region.id}:`))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, route]) => route);
    if (regionRoutes.length === 0) throw new RtsLevelError(`ExpansionMarker ${region.id} needs an authored route`);
    expansions.push({ id: region.id, outpost, depot, production, routes: regionRoutes });
  }
  return {
    playerStart,
    enemyStart,
    resourceNodes: nodes,
    trees,
    herds,
    tradeSites,
    strategicPoints,
    navigationBlockers,
    walkableDecks,
    buildAnchors: anchors,
    expansions,
    routes,
  };
}

/**
 * RTS navigation is a 2D grid, so a Forge Blocking Volume becomes its
 * conservative horizontal AABB. Upright boxes preserve their authored size;
 * yawed boxes expand only as much as needed to remain safely blocked. This is a
 * gameplay adapter, not a replacement collision system: the generic volume
 * remains authored and rendered by Forge exactly as before.
 */
function blockingVolumeNavigationBlocker(volume: LayoutBlockingVolume): NavBlocker {
  const resolved = resolveBlockingVolume(volume);
  const scale = typeof volume.scale === "number"
    ? [volume.scale, volume.scale, volume.scale] as const
    : volume.scale ?? [1, 1, 1] as const;
  const halfX = Math.abs(resolved.size[0] * scale[0]) / 2;
  const halfY = Math.abs(resolved.size[1] * scale[1]) / 2;
  const halfZ = Math.abs(resolved.size[2] * scale[2]) / 2;
  const yaw = ((volume.rotation?.[1] ?? 0) * Math.PI) / 180;
  const horizontalX = Math.abs(Math.cos(yaw)) * halfX + Math.abs(Math.sin(yaw)) * halfZ;
  const horizontalZ = Math.abs(Math.sin(yaw)) * halfX + Math.abs(Math.cos(yaw)) * halfZ;
  return {
    min: [volume.position[0] - horizontalX, volume.position[1] - halfY, volume.position[2] - horizontalZ],
    max: [volume.position[0] + horizontalX, volume.position[1] + halfY, volume.position[2] + horizontalZ],
  };
}

/**
 * Converts a `Walkable Deck` box volume into the top surface an RTS unit stands
 * on. It deliberately accepts only horizontal boxes: cylinders/cones/spheres
 * do not represent a predictable bridge floor, and tilted floors need a future
 * slope-aware navigation slice rather than a misleading flat height.
 */
function blockingVolumeWalkableDeck(volume: LayoutBlockingVolume): RtsWalkableDeck | null {
  const resolved = resolveBlockingVolume(volume);
  if (resolved.navigationRole !== "walkable" || resolved.brushShape !== "box") return null;
  const rotation = volume.rotation ?? [0, 0, 0];
  if (Math.abs(rotation[0]) > 0.001 || Math.abs(rotation[2]) > 0.001) return null;
  const scale = typeof volume.scale === "number"
    ? [volume.scale, volume.scale, volume.scale] as const
    : volume.scale ?? [1, 1, 1] as const;
  const halfWidth = Math.abs(resolved.size[0] * scale[0]) / 2;
  const halfHeight = Math.abs(resolved.size[1] * scale[1]) / 2;
  const halfDepth = Math.abs(resolved.size[2] * scale[2]) / 2;
  return {
    x: volume.position[0],
    y: volume.position[1] + halfHeight,
    z: volume.position[2],
    halfWidth,
    halfDepth,
    yawDeg: rotation[1],
  };
}
