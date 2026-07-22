/** Pure Level marker -> RTS spatial-data adapter (assetization Faz D). */
import { resolveActorInstanceVariables, type ResolvedActorClass } from "@engine/scene/actorInstance";
import type { LayoutSplineActor } from "@engine/scene/layout";
import type { BuildingBalance, ResourceBalance } from "../../data/gameDataTypes";
import type { RtsResourceNodeDefinition } from "../economy/resourceNodeSystem";
import type { RtsBuildAnchor, RtsMapPoint } from "./rtsMapBlockout";

export class RtsLevelError extends Error {
  constructor(message: string) { super(message); this.name = "RtsLevelError"; }
}

export interface RtsLevelDefinition {
  readonly playerStart: RtsMapPoint;
  readonly enemyStart: RtsMapPoint;
  readonly resourceNodes: readonly RtsResourceNodeDefinition[];
  readonly buildAnchors: readonly RtsBuildAnchor[];
  readonly routes: ReadonlyMap<string, readonly RtsMapPoint[]>;
}

/**
 * Adapts only RTS-named Actor classes. The generic Level/Actor format remains
 * unaware of `owner`, resources, or building ids; these semantics live here.
 */
export function adaptRtsLevel(
  actors: readonly ResolvedActorClass[],
  splines: readonly LayoutSplineActor[],
  balance: { readonly buildings: BuildingBalance; readonly resources: ResourceBalance },
): RtsLevelDefinition {
  const starts = new Map<string, RtsMapPoint>();
  const nodes: RtsResourceNodeDefinition[] = [];
  const anchors: RtsBuildAnchor[] = [];
  for (const { def, instance } of actors) {
    const values = resolveActorInstanceVariables(def, instance.variableOverrides);
    const point = { x: instance.position[0], z: instance.position[2] };
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
    } else if (def.name === "BP_RTS_BuildAnchor") {
      const buildingId = values.buildingId;
      if (typeof buildingId !== "string" || !balance.buildings[buildingId]) throw new RtsLevelError("invalid build anchor buildingId");
      anchors.push({ buildingId, ...point });
    }
  }
  const playerStart = starts.get("player"); const enemyStart = starts.get("enemy");
  if (!playerStart || !enemyStart) throw new RtsLevelError("level requires one player and one enemy start");
  const routes = new Map<string, readonly RtsMapPoint[]>();
  for (const spline of splines) for (const tag of spline.runtime?.tags ?? []) {
    if (!tag.startsWith("rts.route:")) continue;
    const points = spline.spline.points.map((p) => ({ x: spline.position[0] + p.position[0], z: spline.position[2] + p.position[2] }));
    if (points.length < 2) throw new RtsLevelError(`route ${tag} needs at least two points`);
    routes.set(tag, points);
  }
  return { playerStart, enemyStart, resourceNodes: nodes, buildAnchors: anchors, routes };
}
