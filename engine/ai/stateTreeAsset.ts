import {
  normalizeAiDecorators,
  normalizeAiParams,
  normalizeAiServices,
  type AiBehaviorServiceDef,
  type AiDecoratorDef,
  type AiJsonValue,
} from "./behaviorAsset";

/**
 * StateTree asset schema (`*.stateTree.json`). Unreal's StateTree is a
 * hierarchical state machine: states are selected by enter conditions, run tasks
 * while active, and hand off to sibling/other states through guarded
 * transitions. Global evaluators tick regardless of the active state.
 *
 * Forge's first schema reuses the Behavior Tree condition/service registry
 * (`AiDecoratorDef` for enter/transition guards, `AiBehaviorServiceDef` for
 * evaluators) so a single normalizer owns their shape. The runtime runner and
 * shared task/condition dispatch land in a later slice; this module is the
 * authored-asset contract used by the loader and `tools/saveValidator.ts`.
 */

export interface AiStateTaskDef {
  task: string;
  params?: Record<string, AiJsonValue>;
}

export interface AiStateTransitionDef {
  /** Target state id (must resolve to a state declared anywhere in the tree). */
  to: string;
  /** Optional gameplay event name that arms this transition. */
  event?: string;
  /** Guard conditions; all must pass for the transition to fire. */
  conditions?: AiDecoratorDef[];
}

export interface AiStateDef {
  id: string;
  /** Enter conditions selecting this state among its siblings. */
  enter?: AiDecoratorDef[];
  /** Tasks run while the state (and its active child) is current. */
  tasks?: AiStateTaskDef[];
  /** Outgoing transitions evaluated while the state is active. */
  transitions?: AiStateTransitionDef[];
  /** Nested child states (hierarchical StateTree). */
  states?: AiStateDef[];
}

export interface AiStateTreeAsset {
  schema: 1;
  type: "stateTree";
  blackboard?: string;
  /**
   * Tree-wide default params merged into every StateTree task/evaluator call.
   * Local task/evaluator params override these keys.
   */
  parameters?: Record<string, AiJsonValue>;
  /**
   * Read-only authored context data exposed to tasks/evaluators as
   * `params.context`. Useful for long-lived routines that share role/phase IDs
   * or authored references without duplicating them on every state task.
   */
  context?: Record<string, AiJsonValue>;
  states: AiStateDef[];
  evaluators?: AiBehaviorServiceDef[];
}

interface NormalizeContext {
  ids: Set<string>;
  transitionTargets: { to: string; label: string }[];
}

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

function normalizeOptionalId(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requireNonEmptyString(value, label);
}

function normalizeTask(value: unknown, index: number, label: string): AiStateTaskDef {
  const input = requireObject(value, `${label}[${index}]`);
  const task = requireNonEmptyString(input.task, `${label}[${index}].task`);
  const params = normalizeAiParams(input.params, `${label}[${index}].params`);
  return params ? { task, params } : { task };
}

function normalizeTasks(value: unknown, label: string): AiStateTaskDef[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const tasks = value.map((task, index) => normalizeTask(task, index, label));
  return tasks.length > 0 ? tasks : undefined;
}

function normalizeTransition(
  value: unknown,
  index: number,
  label: string,
  ctx: NormalizeContext,
): AiStateTransitionDef {
  const input = requireObject(value, `${label}[${index}]`);
  const to = requireNonEmptyString(input.to, `${label}[${index}].to`);
  const out: AiStateTransitionDef = { to };
  if (input.event !== undefined) {
    out.event = requireNonEmptyString(input.event, `${label}[${index}].event`);
  }
  const conditions = normalizeAiDecorators(input.conditions);
  if (conditions) out.conditions = conditions;
  ctx.transitionTargets.push({ to, label: `${label}[${index}].to` });
  return out;
}

function normalizeTransitions(
  value: unknown,
  label: string,
  ctx: NormalizeContext,
): AiStateTransitionDef[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const transitions = value.map((transition, index) =>
    normalizeTransition(transition, index, label, ctx),
  );
  return transitions.length > 0 ? transitions : undefined;
}

function normalizeState(
  value: unknown,
  index: number,
  label: string,
  ctx: NormalizeContext,
): AiStateDef {
  const input = requireObject(value, `${label}[${index}]`);
  const id = requireNonEmptyString(input.id, `${label}[${index}].id`);
  if (ctx.ids.has(id)) throw new Error(`stateTree state id "${id}" is duplicated`);
  ctx.ids.add(id);
  const state: AiStateDef = { id };
  const enter = normalizeAiDecorators(input.enter);
  if (enter) state.enter = enter;
  const tasks = normalizeTasks(input.tasks, `state "${id}".tasks`);
  if (tasks) state.tasks = tasks;
  const transitions = normalizeTransitions(input.transitions, `state "${id}".transitions`, ctx);
  if (transitions) state.transitions = transitions;
  if (input.states !== undefined && input.states !== null) {
    if (!Array.isArray(input.states)) throw new Error(`state "${id}".states must be an array`);
    const children = input.states.map((child, childIndex) =>
      normalizeState(child, childIndex, `state "${id}".states`, ctx),
    );
    if (children.length > 0) state.states = children;
  }
  return state;
}

export function normalizeAiStateTreeAsset(value: unknown): AiStateTreeAsset {
  const input = requireObject(value, "stateTree");
  if (input.schema !== 1) throw new Error("stateTree.schema must be 1");
  if (input.type !== "stateTree") throw new Error('stateTree.type must be "stateTree"');
  if (!Array.isArray(input.states) || input.states.length === 0) {
    throw new Error("stateTree.states must be a non-empty array");
  }
  const ctx: NormalizeContext = { ids: new Set(), transitionTargets: [] };
  const states = input.states.map((state, index) =>
    normalizeState(state, index, "stateTree.states", ctx),
  );
  for (const target of ctx.transitionTargets) {
    if (!ctx.ids.has(target.to)) {
      throw new Error(`${target.label} references unknown state "${target.to}"`);
    }
  }
  const blackboard = normalizeOptionalId(input.blackboard, "stateTree.blackboard");
  const parameters = normalizeAiParams(input.parameters, "stateTree.parameters");
  const context = normalizeAiParams(input.context, "stateTree.context");
  const evaluators = normalizeAiServices(input.evaluators);
  return {
    schema: 1,
    type: "stateTree",
    ...(blackboard ? { blackboard } : {}),
    ...(parameters && Object.keys(parameters).length > 0 ? { parameters } : {}),
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
    states,
    ...(evaluators && evaluators.length > 0 ? { evaluators } : {}),
  };
}
