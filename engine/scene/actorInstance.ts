/**
 * Actor Script *instance* spawning: turns a placed {@link LayoutActorInstance}
 * (a `classRef` + world transform) plus its resolved {@link ActorScriptDef}
 * class into an engine {@link Entity}.
 *
 * This is the runtime half of "Sınıf ≠ Instance": the class (`*.actor.json`) is
 * authored once; a level places it many times; here each placement is flattened
 * into a single entity the existing subsystems already understand (physics +
 * behavior read it via `setEntities`, the render shell reads its mesh/transform).
 *
 * v1 collapse (documented, not an oversight): Forge entities are flat — one
 * component per type. An actor's component *tree* (which can hold several nodes
 * of the same kind) collapses to a single entity taking the FIRST node of each
 * kind. The instance's world transform is authoritative (the root Transform
 * node's props are ignored for placement). Event bindings are preserved as an
 * `EventBindings` list; per-instance overrides and multi-node hierarchy are
 * later phases (see docs B4).
 *
 * Pure module: no Three.js, no DOM. Both the runtime (spawning) and headless
 * tests read this; `props` flow straight through as component data because
 * `read*Component` already parses an arbitrary `EntityComponentData` record.
 */
import type { ActorScriptDef } from "./actorScript";
import {
  BEHAVIOR_COMPONENT,
  EVENT_BINDINGS_COMPONENT,
  MESSAGE_BINDINGS_COMPONENT,
  SCRIPT_ACTOR_COMPONENT,
  SCRIPT_DISPATCHERS_COMPONENT,
  SCRIPT_INTERFACES_COMPONENT,
  SCRIPT_REFERENCES_COMPONENT,
  TRANSFORM_COMPONENT,
  type TransformComponent,
} from "./components";
import type { Entity, EntityComponentData, EntityComponentMap, SceneJsonValue } from "./entity";
import type { LayoutActorInstance } from "./layout";
import { readRotation, readScale } from "./transform";

/** A placed actor instance paired with its resolved class + layout index. */
export interface ResolvedActorClass {
  index: number;
  instance: LayoutActorInstance;
  def: ActorScriptDef;
}

/** Entity id for the actor instance at `index` (mirrors the `character:<n>` scheme). */
export function actorInstanceEntityId(index: number): string {
  return `actor:${index}`;
}

/** Entity id for a runtime-spawned actor (not backed by layout.actors). */
export function spawnedActorEntityId(index: number): string {
  return `spawned:${index}`;
}

/** Parses a `spawned:<index>` runtime actor id, or null. */
export function parseSpawnedActorEntityIndex(entityId: string): number | null {
  if (!entityId.startsWith("spawned:")) return null;
  const index = Number(entityId.slice("spawned:".length));
  return Number.isInteger(index) && index >= 0 ? index : null;
}

/** Parses an `actor:<index>` entity id back to its layout index, or null. */
export function parseActorInstanceEntityIndex(entityId: string): number | null {
  if (!entityId.startsWith("actor:")) return null;
  const index = Number(entityId.slice("actor:".length));
  return Number.isInteger(index) && index >= 0 ? index : null;
}

export interface ActorInstanceToEntityOptions {
  /** Override the default layout-backed `actor:<index>` id (runtime spawn uses `spawned:<n>`). */
  readonly entityId?: string;
  /** Exposed-on-spawn params merged into every behavior/event/message binding params object. */
  readonly params?: Record<string, SceneJsonValue>;
}

function mergeSpawnParams(
  params: Record<string, SceneJsonValue> | undefined,
  spawnParams: Record<string, SceneJsonValue> | undefined,
): Record<string, SceneJsonValue> | undefined {
  if (!params && !spawnParams) return undefined;
  return {
    ...(params ?? {}),
    ...(spawnParams ?? {}),
  };
}

/** Selects a legacy Behavior component node, used as a fallback tick behavior. */
function selectBehaviorData(def: ActorScriptDef): EntityComponentData | null {
  const behaviorNode = def.components.find((node) => node.component === BEHAVIOR_COMPONENT);
  if (behaviorNode && typeof behaviorNode.props.scriptId === "string") {
    return { ...behaviorNode.props } as EntityComponentData;
  }
  return null;
}

/** Builds the instance's authoritative transform component data from its placement. */
function instanceTransform(instance: LayoutActorInstance): TransformComponent {
  return {
    position: [instance.position[0], instance.position[1], instance.position[2]],
    rotation: readRotation(instance),
    scale: readScale(instance),
  };
}

/**
 * Flattens a placed actor instance + its resolved class into one entity.
 *
 * The component map is seeded with the instance's Transform, then each non-root
 * component node contributes its props as that component's data (first node of
 * each kind wins). Authored event bindings are carried separately so multiple
 * event-specific behaviors can run on the same actor. `parentId` is left to the
 * caller to resolve from the layout `nodeId`/`parentId` space (like the legacy
 * adapter's second pass).
 */
export function actorInstanceToEntity(
  def: ActorScriptDef,
  instance: LayoutActorInstance,
  index: number,
  options: ActorInstanceToEntityOptions = {},
): Entity {
  const components: EntityComponentMap = {
    [TRANSFORM_COMPONENT]: instanceTransform(instance) as unknown as EntityComponentData,
  };

  for (const node of def.components) {
    // The instance transform is authoritative; any Transform node is skipped.
    if (node.component === TRANSFORM_COMPONENT) continue;
    // First node of each kind wins (flat entity = one component per type).
    if (components[node.component]) continue;
    components[node.component] = { ...node.props };
  }

  if (!components[BEHAVIOR_COMPONENT]) {
    const behavior = selectBehaviorData(def);
    if (behavior) {
      const params = mergeSpawnParams(
        behavior.params as Record<string, SceneJsonValue> | undefined,
        options.params,
      );
      components[BEHAVIOR_COMPONENT] = params ? { ...behavior, params } : behavior;
    }
  }
  if (def.eventBindings.length > 0) {
    components[EVENT_BINDINGS_COMPONENT] = {
      bindings: def.eventBindings.map((binding) => ({
        ...binding,
        params: mergeSpawnParams(binding.params, options.params),
      })),
    } as unknown as EntityComponentData;
  }
  if (def.interfaces.length > 0) {
    components[SCRIPT_INTERFACES_COMPONENT] = {
      interfaces: [...def.interfaces],
    } as unknown as EntityComponentData;
  }
  if (def.messageBindings.length > 0) {
    components[MESSAGE_BINDINGS_COMPONENT] = {
      bindings: def.messageBindings.map((binding) => ({
        ...binding,
        params: mergeSpawnParams(binding.params, options.params),
      })),
    } as unknown as EntityComponentData;
  }
  if (def.dispatchers.length > 0) {
    components[SCRIPT_DISPATCHERS_COMPONENT] = {
      dispatchers: def.dispatchers.map((dispatcher) => ({
        name: dispatcher.name,
        payload: { ...dispatcher.payload },
      })),
    } as unknown as EntityComponentData;
  }
  components[SCRIPT_ACTOR_COMPONENT] = {
    classRef: instance.classRef,
    ...(instance.nodeId ? { nodeId: instance.nodeId } : {}),
  } as unknown as EntityComponentData;
  if (def.references.length > 0) {
    components[SCRIPT_REFERENCES_COMPONENT] = {
      references: def.references.map((reference) => ({ ...reference })),
    } as unknown as EntityComponentData;
  }

  const tags: string[] = [];
  if (instance.hidden) tags.push("hidden");
  if (instance.locked) tags.push("locked");

  const entity: Entity = {
    id: options.entityId ?? actorInstanceEntityId(index),
    components,
  };
  const name = instance.name ?? def.name;
  if (name) entity.name = name;
  if (tags.length > 0) entity.tags = tags;
  return entity;
}
