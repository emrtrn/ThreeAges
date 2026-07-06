import type { AiJsonValue } from "./behaviorAsset";

export type AiQueryContextKind =
  | "querier"
  | "targetEntity"
  | "blackboardEntity"
  | "blackboardPosition"
  | "allActorsWithTag"
  | "allActorsWithInterface";
export type AiQueryGeneratorKind =
  | "pointsAroundQuerier"
  | "gridAroundContext"
  | "actorsByTag"
  | "actorsByInterface"
  | "actorsByClassRef";
export type AiQueryTestKind = "distance" | "lineOfSight" | "navReachable" | "dot";
export type AiQueryScoreMode = "none" | "linear" | "inverse";

export interface AiQueryContextDef {
  kind: AiQueryContextKind;
  key?: string;
  tag?: string;
  interface?: string;
}

export interface AiQueryBaseGeneratorDef {
  kind: AiQueryGeneratorKind;
}

export interface AiQueryPointsAroundQuerierGeneratorDef extends AiQueryBaseGeneratorDef {
  kind: "pointsAroundQuerier";
  radius: number;
  points: number;
  rings?: number;
}

export interface AiQueryGridAroundContextGeneratorDef extends AiQueryBaseGeneratorDef {
  kind: "gridAroundContext";
  context?: AiQueryContextDef;
  radius: number;
  spacing: number;
}

export interface AiQueryActorsByTagGeneratorDef extends AiQueryBaseGeneratorDef {
  kind: "actorsByTag";
  tag: string;
}

export interface AiQueryActorsByInterfaceGeneratorDef extends AiQueryBaseGeneratorDef {
  kind: "actorsByInterface";
  interface: string;
}

export interface AiQueryActorsByClassRefGeneratorDef extends AiQueryBaseGeneratorDef {
  kind: "actorsByClassRef";
  classRef: string;
}

export type AiQueryGeneratorDef =
  | AiQueryPointsAroundQuerierGeneratorDef
  | AiQueryGridAroundContextGeneratorDef
  | AiQueryActorsByTagGeneratorDef
  | AiQueryActorsByInterfaceGeneratorDef
  | AiQueryActorsByClassRefGeneratorDef;

export interface AiQueryBaseTestDef {
  kind: AiQueryTestKind;
  score?: AiQueryScoreMode;
  weight?: number;
}

export interface AiQueryDistanceTestDef extends AiQueryBaseTestDef {
  kind: "distance";
  context?: AiQueryContextDef;
  min?: number;
  max?: number;
}

export interface AiQueryLineOfSightTestDef extends AiQueryBaseTestDef {
  kind: "lineOfSight";
  context?: AiQueryContextDef;
  require?: boolean;
}

export interface AiQueryNavReachableTestDef extends AiQueryBaseTestDef {
  kind: "navReachable";
  context?: AiQueryContextDef;
}

export interface AiQueryDotTestDef extends AiQueryBaseTestDef {
  kind: "dot";
  context?: AiQueryContextDef;
  min?: number;
}

export type AiQueryTestDef =
  | AiQueryDistanceTestDef
  | AiQueryLineOfSightTestDef
  | AiQueryNavReachableTestDef
  | AiQueryDotTestDef;

export interface AiQueryAsset {
  schema: 1;
  type: "query";
  generators: AiQueryGeneratorDef[];
  tests?: AiQueryTestDef[];
  maxCandidates?: number;
}

const QUERY_CONTEXT_KINDS: readonly AiQueryContextKind[] = [
  "querier",
  "targetEntity",
  "blackboardEntity",
  "blackboardPosition",
  "allActorsWithTag",
  "allActorsWithInterface",
];
const SCORE_MODES: readonly AiQueryScoreMode[] = ["none", "linear", "inverse"];

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

function normalizePositiveNumber(value: unknown, label: string, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return Number(value.toFixed(3));
}

function normalizeNonNegativeNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return Number(value.toFixed(3));
}

function normalizeInt(value: unknown, label: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function normalizeContext(value: unknown, label: string): AiQueryContextDef | undefined {
  if (value === undefined || value === null) return undefined;
  const input = requireObject(value, label);
  if (!QUERY_CONTEXT_KINDS.includes(input.kind as AiQueryContextKind)) {
    throw new Error(`${label}.kind is invalid`);
  }
  const context: AiQueryContextDef = { kind: input.kind as AiQueryContextKind };
  if (context.kind === "blackboardEntity" || context.kind === "blackboardPosition") {
    context.key = requireNonEmptyString(input.key, `${label}.key`);
  } else if (context.kind === "targetEntity" && input.key !== undefined) {
    context.key = requireNonEmptyString(input.key, `${label}.key`);
  } else if (context.kind === "allActorsWithTag") {
    context.tag = requireNonEmptyString(input.tag, `${label}.tag`);
  } else if (context.kind === "allActorsWithInterface") {
    context.interface = requireNonEmptyString(input.interface, `${label}.interface`);
  }
  return context;
}

function normalizeScoreMode(value: unknown): AiQueryScoreMode | undefined {
  if (value === undefined) return undefined;
  if (!SCORE_MODES.includes(value as AiQueryScoreMode)) throw new Error("query test score is invalid");
  return value as AiQueryScoreMode;
}

function normalizeGenerator(value: unknown, index: number): AiQueryGeneratorDef {
  const input = requireObject(value, `query.generators[${index}]`);
  switch (input.kind) {
    case "pointsAroundQuerier":
      return {
        kind: "pointsAroundQuerier",
        radius: normalizePositiveNumber(input.radius, `query.generators[${index}].radius`),
        points: normalizeInt(input.points, `query.generators[${index}].points`, 8),
        rings: normalizeInt(input.rings, `query.generators[${index}].rings`, 1),
      };
    case "gridAroundContext": {
      const context = normalizeContext(input.context, `query.generators[${index}].context`);
      return {
        kind: "gridAroundContext",
        ...(context ? { context } : {}),
        radius: normalizePositiveNumber(input.radius, `query.generators[${index}].radius`),
        spacing: normalizePositiveNumber(input.spacing, `query.generators[${index}].spacing`),
      };
    }
    case "actorsByTag":
      return {
        kind: "actorsByTag",
        tag: requireNonEmptyString(input.tag, `query.generators[${index}].tag`),
      };
    case "actorsByInterface":
      return {
        kind: "actorsByInterface",
        interface: requireNonEmptyString(input.interface, `query.generators[${index}].interface`),
      };
    case "actorsByClassRef":
      return {
        kind: "actorsByClassRef",
        classRef: requireNonEmptyString(input.classRef, `query.generators[${index}].classRef`),
      };
    default:
      throw new Error(`query.generators[${index}].kind is invalid`);
  }
}

function normalizeBaseTest(input: Record<string, unknown>): Pick<AiQueryBaseTestDef, "score" | "weight"> {
  const base: Pick<AiQueryBaseTestDef, "score" | "weight"> = {};
  const score = normalizeScoreMode(input.score);
  if (score) base.score = score;
  if (input.weight !== undefined) base.weight = normalizePositiveNumber(input.weight, "query test weight");
  return base;
}

function normalizeTest(value: unknown, index: number): AiQueryTestDef {
  const input = requireObject(value, `query.tests[${index}]`);
  const base = normalizeBaseTest(input);
  switch (input.kind) {
    case "distance": {
      const context = normalizeContext(input.context, `query.tests[${index}].context`);
      const min = normalizeNonNegativeNumber(input.min, `query.tests[${index}].min`);
      const max = normalizeNonNegativeNumber(input.max, `query.tests[${index}].max`);
      const test: AiQueryDistanceTestDef = { ...base, kind: "distance" };
      if (context) test.context = context;
      if (min !== undefined) test.min = min;
      if (max !== undefined) test.max = max;
      return test;
    }
    case "lineOfSight": {
      const context = normalizeContext(input.context, `query.tests[${index}].context`);
      return {
        ...base,
        kind: "lineOfSight",
        ...(context ? { context } : {}),
        require: input.require !== false,
      };
    }
    case "navReachable": {
      const context = normalizeContext(input.context, `query.tests[${index}].context`);
      return { ...base, kind: "navReachable", ...(context ? { context } : {}) };
    }
    case "dot": {
      const context = normalizeContext(input.context, `query.tests[${index}].context`);
      const min = normalizeNonNegativeNumber(input.min, `query.tests[${index}].min`);
      const test: AiQueryDotTestDef = { ...base, kind: "dot" };
      if (context) test.context = context;
      if (min !== undefined) test.min = min;
      return test;
    }
    default:
      throw new Error(`query.tests[${index}].kind is invalid`);
  }
}

export function normalizeAiQueryAsset(value: unknown): AiQueryAsset {
  const input = requireObject(value, "query");
  if (input.schema !== 1) throw new Error("query.schema must be 1");
  if (input.type !== "query") throw new Error('query.type must be "query"');
  if (!Array.isArray(input.generators) || input.generators.length === 0) {
    throw new Error("query.generators must be a non-empty array");
  }
  const generators = input.generators.map((generator, index) => normalizeGenerator(generator, index));
  const tests = Array.isArray(input.tests)
    ? input.tests.map((test, index) => normalizeTest(test, index))
    : undefined;
  const maxCandidates = input.maxCandidates === undefined
    ? undefined
    : normalizeInt(input.maxCandidates, "query.maxCandidates", 64);
  return {
    schema: 1,
    type: "query",
    generators,
    ...(tests && tests.length > 0 ? { tests } : {}),
    ...(maxCandidates ? { maxCandidates } : {}),
  };
}

export function aiQueryParams(
  value: Record<string, AiJsonValue>,
): { query: string | null; resultKey: string | null; intervalSeconds: number | null } {
  const interval = value.intervalSeconds ?? value.interval;
  return {
    query: typeof value.query === "string" && value.query.length > 0 ? value.query : null,
    resultKey: typeof value.resultKey === "string" && value.resultKey.length > 0 ? value.resultKey : null,
    intervalSeconds: typeof interval === "number" && Number.isFinite(interval) && interval > 0 ? interval : null,
  };
}
