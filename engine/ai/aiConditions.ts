/**
 * Shared AI condition (decorator) evaluation for Forge.
 *
 * Both the Behavior Tree runner (`behaviorRunner.ts`) and the StateTree runner
 * (`stateTreeRunner.ts`) evaluate the same `AiDecoratorDef` union — as branch
 * guards in a Behavior Tree and as enter/transition guards in a StateTree. This
 * module is the single source of truth for that semantics so the two runners can
 * never drift. Pure engine code: no DOM, Three.js or editor imports.
 */
import type { EntityId } from "../scene/entity";
import type { Vec3 } from "../scene/layout";
import type { AIController } from "./aiController";
import type { Blackboard, BlackboardValue } from "./blackboard";
import type { PerceivedStimulus } from "../perception/perception";
import type {
  AiBlackboardDecoratorDef,
  AiCooldownDecoratorDef,
  AiDecoratorDef,
  AiDistanceDecoratorDef,
  AiNumericCompareOp,
  AiPerceptionDecoratorDef,
} from "./behaviorAsset";

export interface AiWorldQuery {
  readonly entityPosition: (entityId: EntityId) => Vec3 | null;
}

/**
 * Inputs a decorator needs to evaluate. `cooldownReadyAt` is per-slot runtime
 * memory owned by the caller (keyed by decorator index within its owning node /
 * state), so authored assets stay immutable and cooldowns are tracked per agent.
 */
export interface AiConditionContext {
  readonly controller: AIController;
  readonly world?: AiWorldQuery;
  readonly elapsedSeconds: number;
  readonly cooldownReadyAt: Map<number, number>;
}

export interface AiDecoratorEvaluation {
  readonly pass: boolean;
  /** Label of the first failing decorator, or null when all pass. */
  readonly failed: string | null;
}

/** Evaluates an ordered decorator list; fails on the first decorator that fails. */
export function aiDecoratorsPass(
  decorators: readonly AiDecoratorDef[] | undefined,
  ctx: AiConditionContext,
): AiDecoratorEvaluation {
  if (!decorators || decorators.length === 0) return { pass: true, failed: null };
  for (let index = 0; index < decorators.length; index += 1) {
    const decorator = decorators[index];
    if (!decorator) continue;
    if (!aiDecoratorPasses(decorator, index, ctx)) {
      return { pass: false, failed: aiDecoratorLabel(decorator) };
    }
  }
  return { pass: true, failed: null };
}

export function aiDecoratorPasses(
  decorator: AiDecoratorDef,
  index: number,
  ctx: AiConditionContext,
): boolean {
  switch (decorator.kind) {
    case "blackboard":
      return blackboardDecoratorPasses(decorator, ctx.controller.blackboard);
    case "distance":
      return distanceDecoratorPasses(decorator, ctx);
    case "cooldown":
      return cooldownDecoratorPasses(decorator, index, ctx);
    case "hasPerceptionStimulus":
      return perceptionDecoratorPasses(decorator, ctx.controller.getPerception());
  }
}

export function aiDecoratorLabel(decorator: AiDecoratorDef): string {
  switch (decorator.kind) {
    case "blackboard":
      return `blackboard:${decorator.key}:${decorator.op}`;
    case "distance":
      return `distance:${decorator.key}:${decorator.op}`;
    case "cooldown":
      return `cooldown:${decorator.seconds}`;
    case "hasPerceptionStimulus":
      return `perception:${decorator.sense ?? "any"}`;
  }
}

function blackboardDecoratorPasses(decorator: AiBlackboardDecoratorDef, blackboard: Blackboard): boolean {
  const actual = blackboard.get(decorator.key);
  switch (decorator.op) {
    case "equals":
      return blackboardValuesEqual(actual, decorator.value);
    case "notEquals":
      return !blackboardValuesEqual(actual, decorator.value);
    case "isSet":
      return actual !== undefined && actual !== null;
    case "isNotSet":
      return actual === undefined || actual === null;
  }
}

function distanceDecoratorPasses(decorator: AiDistanceDecoratorDef, ctx: AiConditionContext): boolean {
  const world = ctx.world;
  if (!world) return false;
  const pawnPosition = world.entityPosition(ctx.controller.pawnEntityId);
  if (!pawnPosition) return false;
  const target = resolveDecoratorPosition(ctx.controller.blackboard, decorator.key, world);
  if (!target) return false;
  return compareNumbers(distanceBetween(pawnPosition, target), decorator.op, decorator.value);
}

function cooldownDecoratorPasses(
  decorator: AiCooldownDecoratorDef,
  index: number,
  ctx: AiConditionContext,
): boolean {
  const readyAt = ctx.cooldownReadyAt.get(index);
  if (readyAt !== undefined && ctx.elapsedSeconds + 1e-9 < readyAt) return false;
  ctx.cooldownReadyAt.set(index, ctx.elapsedSeconds + decorator.seconds);
  return true;
}

function perceptionDecoratorPasses(
  decorator: AiPerceptionDecoratorDef,
  stimuli: readonly PerceivedStimulus[],
): boolean {
  for (const stimulus of stimuli) {
    if (decorator.sense !== undefined && stimulus.sense !== decorator.sense) continue;
    if (decorator.minStrength !== undefined && stimulus.strength < decorator.minStrength) continue;
    if (decorator.requireLineOfSight === true && stimulus.lineOfSight !== true) continue;
    return true;
  }
  return false;
}

export function distanceBetween(left: Vec3, right: Vec3): number {
  const dx = left[0] - right[0];
  const dy = left[1] - right[1];
  const dz = left[2] - right[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function vec3Param(value: unknown): Vec3 | null {
  if (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  ) {
    return [value[0] as number, value[1] as number, value[2] as number];
  }
  return null;
}

function compareNumbers(actual: number, op: AiNumericCompareOp, expected: number): boolean {
  switch (op) {
    case "lt":
      return actual < expected;
    case "lte":
      return actual <= expected;
    case "gt":
      return actual > expected;
    case "gte":
      return actual >= expected;
  }
}

function resolveDecoratorPosition(blackboard: Blackboard, key: string, world: AiWorldQuery): Vec3 | null {
  const value = blackboard.get(key);
  const direct = Array.isArray(value) ? vec3Param(value) : null;
  if (direct) return direct;
  const entity = blackboard.getEntity(key);
  return entity ? world.entityPosition(entity) : null;
}

function blackboardValuesEqual(
  left: BlackboardValue | undefined,
  right: BlackboardValue | undefined,
): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === 3 &&
      right.length === 3 &&
      left[0] === right[0] &&
      left[1] === right[1] &&
      left[2] === right[2]
    );
  }
  return left === right;
}
