/** Pure Level marker -> RTS spatial-data adapter (assetization Faz D). */
import { resolveActorInstanceVariables, type ResolvedActorClass } from "@engine/scene/actorInstance";
import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { LayoutBlockingVolume, LayoutSplineActor } from "@engine/scene/layout";
import { resolveBlockingVolume } from "@engine/scene/blockingVolume";
import type { AnimalBalance, BuildingBalance, ResourceBalance } from "../../data/gameDataTypes";
import type { RtsResourceNodeDefinition } from "../economy/resourceNodeSystem";
import type { RtsTreeDefinition } from "../economy/forestSystem";
import type { RtsHerdDefinition } from "../wildlife/wildlifeSystem";
import type { RtsBuildAnchor, RtsExpansionRegion, RtsMapPoint, RtsStrategicPoint } from "./rtsMapBlockout";
import { RTS_WORLD_HALF_EXTENT } from "./rtsGround";
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
  const strategicPoints: RtsStrategicPoint[] = [];
  const navigationBlockers: NavBlocker[] = [];
  const walkableDecks: RtsWalkableDeck[] = [];
  const anchors: RtsLevelBuildAnchor[] = [];
  const expansionMembers = new Map<string, ExpansionMembers>();
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
      if (typeof id !== "string" || !id || typeof resourceId !== "string" || !balance.resources[resourceId]) throw new RtsLevelError("invalid resource marker");
      if (kind !== "safe" && kind !== "external") throw new RtsLevelError(`resource ${id} has invalid kind`);
      if (nodes.some((node) => node.id === id)) throw new RtsLevelError(`duplicate resource node ${id}`);
      nodes.push({ id, resourceId, kind, ...point });
    } else if (def.name === "BP_RTS_Tree") {
      const id = requireText(values, "treeId", "Tree");
      const forestId = requireText(values, "forestId", "Tree");
      const capacity = requirePositiveNumber(values, "capacity", `Tree ${id}`);
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
    } else if (def.name === "BP_RTS_StrategicPoint") {
      const id = requireText(values, "pointId", "StrategicPoint");
      const name = requireText(values, "label", `StrategicPoint ${id}`);
      const captureRadius = requirePositiveNumber(values, "captureRadius", `StrategicPoint ${id}`);
      if (strategicPoints.some((strategicPoint) => strategicPoint.id === id)) throw new RtsLevelError(`duplicate strategic point ${id}`);
      strategicPoints.push({ id, name, captureRadius, ...point });
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
      if (!balance.buildings[buildingId]) throw new RtsLevelError("invalid build anchor buildingId");
      anchors.push({ owner, buildingId, ...point });
    } else if (def.name === "BP_RTS_ExpansionMarker") {
      const regionId = requireText(values, "regionId", "ExpansionMarker");
      const role = values.role;
      const buildingId = requireText(values, "buildingId", "ExpansionMarker");
      if (role !== "outpost" && role !== "depot" && role !== "production") {
        throw new RtsLevelError(`ExpansionMarker ${regionId} has invalid role`);
      }
      if (!balance.buildings[buildingId]) throw new RtsLevelError(`ExpansionMarker ${regionId} has invalid buildingId`);
      if ((role === "outpost" && buildingId !== "outpost") || (role === "depot" && buildingId !== "depot")) {
        throw new RtsLevelError(`ExpansionMarker ${regionId} ${role} must use its matching buildingId`);
      }
      const region = expansionMembers.get(regionId) ?? { id: regionId, members: {} };
      if (region.members[role]) throw new RtsLevelError(`ExpansionMarker ${regionId} has duplicate ${role}`);
      region.members[role] = { buildingId, ...point };
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
