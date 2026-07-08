import {
  isBlackboardValueKind,
  normalizeBlackboardValue,
  type BlackboardKeyDef,
  type BlackboardValue,
} from "./blackboard";

export type AiBehaviorStatus = "success" | "failure" | "running";
export type AiBehaviorNodeKind = "selector" | "sequence" | "task" | "wait" | "subtree";
export type AiDecoratorOp = "equals" | "notEquals" | "isSet" | "isNotSet";
export type AiNumericCompareOp = "lt" | "lte" | "gt" | "gte";

/**
 * Mirrors engine/perception `PerceptionSense`. Kept local so the behavior-tree
 * schema module stays free of perception runtime imports.
 */
export type AiPerceptionSenseName = "sight" | "hearing" | "damage" | "alert" | "gameplay";

export type AiJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly AiJsonValue[]
  | { readonly [key: string]: AiJsonValue };

export interface AiBlackboardAsset {
  schema: 1;
  type: "blackboard";
  keys: BlackboardKeyDef[];
}

export interface AiBlackboardDecoratorDef {
  kind: "blackboard";
  key: string;
  op: AiDecoratorOp;
  value?: BlackboardValue;
}

/**
 * Passes when the pawn->target distance satisfies `op value`. `key` names a
 * Blackboard entry holding either an entity id or a vec3 position; a missing
 * position or missing world query is a safe failure.
 */
export interface AiDistanceDecoratorDef {
  kind: "distance";
  key: string;
  op: AiNumericCompareOp;
  value: number;
}

/**
 * Rate-limit gate: passes at most once per `seconds` of runtime time. The last
 * pass time is stored in per-agent, per-node runtime memory, so authored assets
 * stay immutable and shared safely across agents.
 */
export interface AiCooldownDecoratorDef {
  kind: "cooldown";
  seconds: number;
}

/**
 * Passes when the controller currently perceives a matching stimulus. All
 * filters are optional: omit `sense` to accept any sense, `minStrength` to
 * accept any strength, and `requireLineOfSight` to ignore LOS.
 */
export interface AiPerceptionDecoratorDef {
  kind: "hasPerceptionStimulus";
  sense?: AiPerceptionSenseName;
  minStrength?: number;
  requireLineOfSight?: boolean;
}

export type AiDecoratorDef =
  | AiBlackboardDecoratorDef
  | AiDistanceDecoratorDef
  | AiCooldownDecoratorDef
  | AiPerceptionDecoratorDef;

export interface AiBehaviorServiceDef {
  service: string;
  interval?: number;
  params?: Record<string, AiJsonValue>;
}

export interface AiBehaviorBaseNode {
  id?: string;
  kind: AiBehaviorNodeKind;
  decorators?: AiDecoratorDef[];
  services?: AiBehaviorServiceDef[];
}

export interface AiCompositeBehaviorNode extends AiBehaviorBaseNode {
  kind: "selector" | "sequence";
  children: AiBehaviorNode[];
}

export interface AiTaskBehaviorNode extends AiBehaviorBaseNode {
  kind: "task";
  task: string;
  params?: Record<string, AiJsonValue>;
}

export interface AiWaitBehaviorNode extends AiBehaviorBaseNode {
  kind: "wait";
  seconds: number;
}

export interface AiSubtreeBehaviorNode extends AiBehaviorBaseNode {
  kind: "subtree";
  behavior: string;
}

export type AiBehaviorNode =
  | AiCompositeBehaviorNode
  | AiTaskBehaviorNode
  | AiWaitBehaviorNode
  | AiSubtreeBehaviorNode;

export interface AiBehaviorTreeAsset {
  schema: 1;
  type: "behaviorTree";
  blackboard?: string;
  root: AiBehaviorNode;
}

const AI_BEHAVIOR_NODE_KINDS: readonly AiBehaviorNodeKind[] = [
  "selector",
  "sequence",
  "task",
  "wait",
  "subtree",
];

const AI_DECORATOR_OPS: readonly AiDecoratorOp[] = [
  "equals",
  "notEquals",
  "isSet",
  "isNotSet",
];

const AI_NUMERIC_COMPARE_OPS: readonly AiNumericCompareOp[] = ["lt", "lte", "gt", "gte"];

const AI_PERCEPTION_SENSES: readonly AiPerceptionSenseName[] = [
  "sight",
  "hearing",
  "damage",
  "alert",
  "gameplay",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainObject(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function isAiBehaviorNodeKind(value: unknown): value is AiBehaviorNodeKind {
  return typeof value === "string" && AI_BEHAVIOR_NODE_KINDS.includes(value as AiBehaviorNodeKind);
}

function isAiDecoratorOp(value: unknown): value is AiDecoratorOp {
  return typeof value === "string" && AI_DECORATOR_OPS.includes(value as AiDecoratorOp);
}

function isAiNumericCompareOp(value: unknown): value is AiNumericCompareOp {
  return typeof value === "string" && AI_NUMERIC_COMPARE_OPS.includes(value as AiNumericCompareOp);
}

function isAiPerceptionSense(value: unknown): value is AiPerceptionSenseName {
  return typeof value === "string" && AI_PERCEPTION_SENSES.includes(value as AiPerceptionSenseName);
}

function normalizeJsonValue(value: unknown, label: string): AiJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => normalizeJsonValue(entry, `${label}[${index}]`));
  }
  if (isPlainObject(value)) {
    const out: Record<string, AiJsonValue> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = normalizeJsonValue(child, `${label}.${key}`);
    }
    return out;
  }
  throw new Error(`${label} must be JSON-serializable`);
}

function normalizeParams(value: unknown, label: string): Record<string, AiJsonValue> | undefined {
  if (value === undefined || value === null) return undefined;
  const input = requireObject(value, label);
  const out: Record<string, AiJsonValue> = {};
  for (const [key, child] of Object.entries(input)) {
    out[key] = normalizeJsonValue(child, `${label}.${key}`);
  }
  return out;
}

function normalizePositiveNumber(
  value: unknown,
  label: string,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return Number(value.toFixed(3));
}

function normalizeOptionalId(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requireNonEmptyString(value, label);
}

function normalizeBlackboardAssetKey(value: unknown, index: number): BlackboardKeyDef {
  const input = requireObject(value, `blackboard.keys[${index}]`);
  const key = requireNonEmptyString(input.key, `blackboard.keys[${index}].key`);
  if (!isBlackboardValueKind(input.kind)) {
    throw new Error(`blackboard.keys[${index}].kind is invalid`);
  }
  const def: BlackboardKeyDef = { key, kind: input.kind };
  if (input.default !== undefined) {
    const normalizedDefault = normalizeBlackboardValue(input.kind, input.default);
    if (normalizedDefault === undefined) {
      throw new Error(`blackboard.keys[${index}].default does not match kind`);
    }
    def.default = normalizedDefault;
  }
  return def;
}

export function normalizeAiBlackboardAsset(value: unknown): AiBlackboardAsset {
  const input = requireObject(value, "blackboard");
  if (input.schema !== 1) throw new Error("blackboard.schema must be 1");
  if (input.type !== "blackboard") throw new Error('blackboard.type must be "blackboard"');
  if (!Array.isArray(input.keys)) throw new Error("blackboard.keys must be an array");
  const seen = new Set<string>();
  const keys = input.keys.map((raw, index) => {
    const key = normalizeBlackboardAssetKey(raw, index);
    if (seen.has(key.key)) throw new Error(`blackboard key "${key.key}" is duplicated`);
    seen.add(key.key);
    return key;
  });
  return { schema: 1, type: "blackboard", keys };
}

function normalizeDecorator(value: unknown, index: number): AiDecoratorDef {
  const input = requireObject(value, `decorators[${index}]`);
  switch (input.kind) {
    case "blackboard":
      return normalizeBlackboardDecorator(input, index);
    case "distance":
      return normalizeDistanceDecorator(input, index);
    case "cooldown":
      return normalizeCooldownDecorator(input, index);
    case "hasPerceptionStimulus":
      return normalizePerceptionDecorator(input, index);
    default:
      throw new Error(`decorators[${index}].kind is invalid`);
  }
}

function normalizeBlackboardDecorator(
  input: Record<string, unknown>,
  index: number,
): AiBlackboardDecoratorDef {
  const key = requireNonEmptyString(input.key, `decorators[${index}].key`);
  const op = isAiDecoratorOp(input.op) ? input.op : "equals";
  const out: AiBlackboardDecoratorDef = { kind: "blackboard", key, op };
  if ((op === "equals" || op === "notEquals") && input.value === undefined) {
    throw new Error(`decorators[${index}].value is required for ${op}`);
  }
  if (input.value !== undefined) {
    const jsonValue = normalizeJsonValue(input.value, `decorators[${index}].value`);
    if (
      jsonValue !== null &&
      typeof jsonValue !== "string" &&
      typeof jsonValue !== "number" &&
      typeof jsonValue !== "boolean" &&
      !(
        Array.isArray(jsonValue) &&
        jsonValue.length === 3 &&
        jsonValue.every((entry) => typeof entry === "number")
      )
    ) {
      throw new Error(`decorators[${index}].value must be a blackboard scalar or vec3`);
    }
    out.value = jsonValue as BlackboardValue;
  }
  return out;
}

function normalizeDistanceDecorator(
  input: Record<string, unknown>,
  index: number,
): AiDistanceDecoratorDef {
  const key = requireNonEmptyString(input.key, `decorators[${index}].key`);
  if (!isAiNumericCompareOp(input.op)) {
    throw new Error(`decorators[${index}].op must be one of lt|lte|gt|gte`);
  }
  if (typeof input.value !== "number" || !Number.isFinite(input.value)) {
    throw new Error(`decorators[${index}].value must be a finite number`);
  }
  return { kind: "distance", key, op: input.op, value: input.value };
}

function normalizeCooldownDecorator(
  input: Record<string, unknown>,
  index: number,
): AiCooldownDecoratorDef {
  if (typeof input.seconds !== "number" || !Number.isFinite(input.seconds) || input.seconds <= 0) {
    throw new Error(`decorators[${index}].seconds must be a positive number`);
  }
  return { kind: "cooldown", seconds: Number(input.seconds.toFixed(3)) };
}

function normalizePerceptionDecorator(
  input: Record<string, unknown>,
  index: number,
): AiPerceptionDecoratorDef {
  const out: AiPerceptionDecoratorDef = { kind: "hasPerceptionStimulus" };
  if (input.sense !== undefined) {
    if (!isAiPerceptionSense(input.sense)) {
      throw new Error(`decorators[${index}].sense is invalid`);
    }
    out.sense = input.sense;
  }
  if (input.minStrength !== undefined) {
    if (typeof input.minStrength !== "number" || !Number.isFinite(input.minStrength)) {
      throw new Error(`decorators[${index}].minStrength must be a finite number`);
    }
    out.minStrength = input.minStrength;
  }
  if (input.requireLineOfSight !== undefined) {
    if (typeof input.requireLineOfSight !== "boolean") {
      throw new Error(`decorators[${index}].requireLineOfSight must be a boolean`);
    }
    out.requireLineOfSight = input.requireLineOfSight;
  }
  return out;
}

function normalizeDecorators(value: unknown): AiDecoratorDef[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error("decorators must be an array");
  return value.map((decorator, index) => normalizeDecorator(decorator, index));
}

function normalizeService(value: unknown, index: number): AiBehaviorServiceDef {
  const input = requireObject(value, `services[${index}]`);
  const service = requireNonEmptyString(input.service, `services[${index}].service`);
  const out: AiBehaviorServiceDef = { service };
  if (input.interval !== undefined) {
    out.interval = normalizePositiveNumber(input.interval, `services[${index}].interval`, 0.25);
  }
  const params = normalizeParams(input.params, `services[${index}].params`);
  if (params) out.params = params;
  return out;
}

function normalizeServices(value: unknown): AiBehaviorServiceDef[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error("services must be an array");
  return value.map((service, index) => normalizeService(service, index));
}

function normalizeBaseNode(
  input: Record<string, unknown>,
  kind: AiBehaviorNodeKind,
): Pick<AiBehaviorBaseNode, "id" | "kind" | "decorators" | "services"> {
  const base: Pick<AiBehaviorBaseNode, "id" | "kind" | "decorators" | "services"> = { kind };
  const id = normalizeOptionalId(input.id, "node.id");
  if (id) base.id = id;
  const decorators = normalizeDecorators(input.decorators);
  if (decorators) base.decorators = decorators;
  const services = normalizeServices(input.services);
  if (services) base.services = services;
  return base;
}

export function normalizeAiBehaviorNode(value: unknown): AiBehaviorNode {
  const input = requireObject(value, "behavior node");
  if (!isAiBehaviorNodeKind(input.kind)) {
    throw new Error("behavior node.kind is invalid");
  }
  const base = normalizeBaseNode(input, input.kind);
  switch (input.kind) {
    case "selector":
    case "sequence": {
      if (!Array.isArray(input.children)) {
        throw new Error(`${input.kind}.children must be an array`);
      }
      return {
        ...base,
        kind: input.kind,
        children: input.children.map((child) => normalizeAiBehaviorNode(child)),
      };
    }
    case "task": {
      const task = requireNonEmptyString(input.task, "task.task");
      const params = normalizeParams(input.params, "task.params");
      return params
        ? { ...base, kind: "task", task, params }
        : { ...base, kind: "task", task };
    }
    case "wait":
      return {
        ...base,
        kind: "wait",
        seconds: normalizePositiveNumber(input.seconds, "wait.seconds", 1),
      };
    case "subtree":
      return {
        ...base,
        kind: "subtree",
        behavior: requireNonEmptyString(input.behavior, "subtree.behavior"),
      };
  }
}

/**
 * Shared condition/service/param normalizers, re-exported so the StateTree
 * schema (`engine/ai/stateTreeAsset.ts`) authors enter/transition conditions and
 * evaluators from the exact same registry as Behavior Trees — a single source of
 * truth for decorator/service shape across both AI asset kinds.
 */
export {
  normalizeDecorators as normalizeAiDecorators,
  normalizeServices as normalizeAiServices,
  normalizeParams as normalizeAiParams,
};

export function normalizeAiBehaviorTreeAsset(value: unknown): AiBehaviorTreeAsset {
  const input = requireObject(value, "behaviorTree");
  if (input.schema !== 1) throw new Error("behaviorTree.schema must be 1");
  if (input.type !== "behaviorTree") {
    throw new Error('behaviorTree.type must be "behaviorTree"');
  }
  const root = normalizeAiBehaviorNode(input.root);
  const blackboard = normalizeOptionalId(input.blackboard, "behaviorTree.blackboard");
  return blackboard
    ? { schema: 1, type: "behaviorTree", blackboard, root }
    : { schema: 1, type: "behaviorTree", root };
}
