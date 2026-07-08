/**
 * Runtime StateTree runner for Forge AI.
 *
 * Unreal's StateTree is a hierarchical state machine: sibling states are selected
 * by enter conditions, an active state runs tasks while current, and guarded
 * transitions hand off to other states. This runner implements that model on the
 * Forge `AiStateTreeAsset` schema and deliberately shares the Behavior Tree's
 * runtime surface — the same {@link AiTaskRegistry}/{@link AiServiceRegistry},
 * {@link AiTaskContext} shape, and the same decorator condition semantics
 * (`aiConditions.ts`) used for enter/transition guards. A behavior authored as a
 * StateTree therefore runs the identical tasks/conditions as one authored as a
 * Behavior Tree.
 *
 * Pure engine code: no DOM, Three.js or editor imports. Runtime memory is kept
 * per controller and per state so authored assets stay immutable and are shared
 * safely across agents.
 */
import type { EngineUpdateContext } from "../core/Subsystem";
import type { AIController } from "./aiController";
import { aiDecoratorsPass, type AiWorldQuery } from "./aiConditions";
import type { AiBehaviorStatus, AiJsonValue } from "./behaviorAsset";
import {
  PRESERVE_TASK_MEMORY,
  type AiMessageEmitInput,
  type AiMoveRequest,
  type AiQueryRequest,
  type AiServiceRegistry,
  type AiTaskRegistry,
} from "./behaviorRunner";
import type { AiQueryResult } from "./queryRunner";
import type { SmartObjectRuntime } from "./smartObjects";
import type { TargetPointIndex } from "./targetPoints";
import type {
  AiStateDef,
  AiStateTaskDef,
  AiStateTransitionDef,
  AiStateTreeAsset,
} from "./stateTreeAsset";

export interface AiStateTreeRunnerOptions {
  readonly taskRegistry?: AiTaskRegistry;
  readonly serviceRegistry?: AiServiceRegistry;
  readonly emitMessage?: (input: AiMessageEmitInput) => void;
  readonly moveTo?: (request: AiMoveRequest) => AiBehaviorStatus;
  readonly runQuery?: (request: AiQueryRequest) => AiQueryResult;
  readonly smartObjects?: SmartObjectRuntime;
  readonly world?: AiWorldQuery;
  readonly targetPoints?: TargetPointIndex;
}

export interface AiStateTreeTransitionRecord {
  /** Active leaf state before the transition, or null for the initial selection. */
  readonly from: string | null;
  /** Active leaf state after the transition. */
  readonly to: string;
  /** Why it fired: `"initial"`, `"conditions"`, or `"event:<name>"`. */
  readonly reason: string;
}

export interface AiStateTreeRunnerDebugSnapshot {
  /** Active state ids, root-first down to the current leaf. */
  readonly activePath: readonly string[];
  readonly lastStatus: AiBehaviorStatus | null;
  readonly lastTransition: AiStateTreeTransitionRecord | null;
  readonly elapsedSeconds: number;
}

interface StateNode {
  readonly def: AiStateDef;
  readonly parentId: string | null;
  readonly childIds: readonly string[];
}

const EMPTY_PARAMS: Record<string, AiJsonValue> = {};

export class AiStateTreeRunner {
  private readonly nodes = new Map<string, StateNode>();
  private readonly rootIds: string[] = [];

  /** Per-task runtime memory, keyed `${stateId}#${taskIndex}`. */
  private readonly taskMemory = new Map<string, Map<string, unknown>>();
  /** Per-state enter-condition cooldown memory, keyed by stateId. */
  private readonly enterCooldown = new Map<string, Map<number, number>>();
  /** Per-transition condition cooldown memory, keyed `${stateId}#${transitionIndex}`. */
  private readonly transitionCooldown = new Map<string, Map<number, number>>();
  /** Per-evaluator interval accumulator + shared service memory, keyed by index. */
  private readonly evaluatorElapsed = new Map<number, number>();
  private readonly evaluatorMemory = new Map<number, Map<string, unknown>>();

  private activePath: string[] = [];
  private pendingEvents = new Set<string>();
  private elapsedSeconds = 0;
  private lastStatus: AiBehaviorStatus | null = null;
  private lastTransition: AiStateTreeTransitionRecord | null = null;

  constructor(
    private readonly controller: AIController,
    private readonly asset: AiStateTreeAsset,
    private readonly options: AiStateTreeRunnerOptions = {},
  ) {
    for (const state of asset.states) this.indexState(state, null);
    this.rootIds = asset.states.map((state) => state.id);
  }

  /** Queues a gameplay event consumed by event-gated transitions on the next tick. */
  postEvent(name: string): void {
    if (name.length > 0) this.pendingEvents.add(name);
  }

  tick(engine: EngineUpdateContext): AiBehaviorStatus {
    this.elapsedSeconds += Math.max(0, engine.deltaSeconds);
    this.tickEvaluators(engine);

    const events = this.pendingEvents;
    this.pendingEvents = new Set();

    if (this.activePath.length === 0) {
      const initial = this.selectInitial(engine);
      if (initial.length > 0) this.applyPathChange([], initial, "initial");
    } else {
      const transition = this.findTransition(engine, events);
      if (transition) {
        this.applyPathChange(this.activePath, this.computePath(transition.to, engine), {
          from: this.leafId(),
          to: transition.to,
          reason: transition.reason,
        });
      }
    }

    const status = this.tickTasks(engine);
    this.lastStatus = status;
    this.controller.setGoal(this.leafId());
    return status;
  }

  reset(): void {
    this.taskMemory.clear();
    this.enterCooldown.clear();
    this.transitionCooldown.clear();
    this.evaluatorElapsed.clear();
    this.evaluatorMemory.clear();
    this.activePath = [];
    this.pendingEvents = new Set();
    this.elapsedSeconds = 0;
    this.lastStatus = null;
    this.lastTransition = null;
    this.controller.setGoal(null);
  }

  getDebugSnapshot(): AiStateTreeRunnerDebugSnapshot {
    return {
      activePath: this.activePath,
      lastStatus: this.lastStatus,
      lastTransition: this.lastTransition,
      elapsedSeconds: this.elapsedSeconds,
    };
  }

  private indexState(state: AiStateDef, parentId: string | null): void {
    const childIds = (state.states ?? []).map((child) => child.id);
    this.nodes.set(state.id, { def: state, parentId, childIds });
    for (const child of state.states ?? []) this.indexState(child, state.id);
  }

  private leafId(): string | null {
    return this.activePath.length > 0 ? (this.activePath[this.activePath.length - 1] ?? null) : null;
  }

  private selectInitial(engine: EngineUpdateContext): string[] {
    for (const rootId of this.rootIds) {
      if (this.enterPasses(rootId, engine)) return this.descendFrom(rootId, engine);
    }
    return [];
  }

  /** Builds the active chain from `id` down, greedily entering the first eligible child. */
  private descendFrom(id: string, engine: EngineUpdateContext): string[] {
    const path = [id];
    let current = id;
    for (;;) {
      const node = this.nodes.get(current);
      if (!node || node.childIds.length === 0) break;
      const next = node.childIds.find((childId) => this.enterPasses(childId, engine));
      if (!next) break;
      path.push(next);
      current = next;
    }
    return path;
  }

  /** Root→target ancestor chain, then a fresh descent into the target's children. */
  private computePath(targetId: string, engine: EngineUpdateContext): string[] {
    const chain: string[] = [];
    let id: string | null = targetId;
    while (id) {
      chain.unshift(id);
      id = this.nodes.get(id)?.parentId ?? null;
    }
    return [...chain, ...this.descendFrom(targetId, engine).slice(1)];
  }

  private enterPasses(stateId: string, engine: EngineUpdateContext): boolean {
    const node = this.nodes.get(stateId);
    if (!node) return false;
    return aiDecoratorsPass(node.def.enter, {
      controller: this.controller,
      ...(this.options.world ? { world: this.options.world } : {}),
      elapsedSeconds: engine.elapsedSeconds,
      cooldownReadyAt: this.cooldownMemory(this.enterCooldown, stateId),
    }).pass;
  }

  private findTransition(
    engine: EngineUpdateContext,
    events: ReadonlySet<string>,
  ): { to: string; reason: string } | null {
    // Leaf-first: a deeper active state's transitions take priority over its ancestors'.
    for (let i = this.activePath.length - 1; i >= 0; i -= 1) {
      const stateId = this.activePath[i];
      if (!stateId) continue;
      const node = this.nodes.get(stateId);
      if (!node) continue;
      const transitions = node.def.transitions ?? [];
      for (let t = 0; t < transitions.length; t += 1) {
        const transition = transitions[t];
        if (!transition) continue;
        if (this.transitionEligible(stateId, t, transition, engine, events)) {
          return {
            to: transition.to,
            reason: transition.event ? `event:${transition.event}` : "conditions",
          };
        }
      }
    }
    return null;
  }

  private transitionEligible(
    stateId: string,
    index: number,
    transition: AiStateTransitionDef,
    engine: EngineUpdateContext,
    events: ReadonlySet<string>,
  ): boolean {
    if (transition.event !== undefined && !events.has(transition.event)) return false;
    return aiDecoratorsPass(transition.conditions, {
      controller: this.controller,
      ...(this.options.world ? { world: this.options.world } : {}),
      elapsedSeconds: engine.elapsedSeconds,
      cooldownReadyAt: this.cooldownMemory(this.transitionCooldown, `${stateId}#${index}`),
    }).pass;
  }

  private applyPathChange(
    oldPath: readonly string[],
    newPath: readonly string[],
    record: AiStateTreeTransitionRecord | "initial",
  ): void {
    let common = 0;
    while (common < oldPath.length && common < newPath.length && oldPath[common] === newPath[common]) {
      common += 1;
    }
    // Exit states that left the active chain (deepest first) and drop their memory.
    for (let i = oldPath.length - 1; i >= common; i -= 1) {
      const id = oldPath[i];
      if (id) this.clearStateMemory(id);
    }
    this.activePath = [...newPath];
    if (record === "initial") {
      const leaf = this.leafId();
      this.lastTransition = leaf ? { from: null, to: leaf, reason: "initial" } : this.lastTransition;
    } else {
      this.lastTransition = { ...record, to: this.leafId() ?? record.to };
    }
  }

  private clearStateMemory(stateId: string): void {
    const node = this.nodes.get(stateId);
    const taskCount = node?.def.tasks?.length ?? 0;
    for (let i = 0; i < taskCount; i += 1) this.taskMemory.delete(`${stateId}#${i}`);
    this.enterCooldown.delete(stateId);
    const transitionCount = node?.def.transitions?.length ?? 0;
    for (let i = 0; i < transitionCount; i += 1) this.transitionCooldown.delete(`${stateId}#${i}`);
  }

  private tickTasks(engine: EngineUpdateContext): AiBehaviorStatus {
    let running = false;
    let failure = false;
    let ran = false;
    for (const stateId of this.activePath) {
      const node = this.nodes.get(stateId);
      const tasks = node?.def.tasks ?? [];
      for (let i = 0; i < tasks.length; i += 1) {
        const task = tasks[i];
        if (!task) continue;
        ran = true;
        const status = this.runTask(stateId, i, task, engine);
        if (status === "running") running = true;
        else if (status === "failure") failure = true;
      }
    }
    if (!ran) return "success";
    if (running) return "running";
    return failure ? "failure" : "success";
  }

  private runTask(
    stateId: string,
    index: number,
    task: AiStateTaskDef,
    engine: EngineUpdateContext,
  ): AiBehaviorStatus {
    const handler = this.options.taskRegistry?.get(task.task);
    if (!handler) return "failure";
    const memory = this.taskMemoryFor(`${stateId}#${index}`);
    const status = handler({
      controller: this.controller,
      blackboard: this.controller.blackboard,
      engine,
      params: this.resolveParams(task.params),
      memory,
      ...(this.options.emitMessage ? { emitMessage: this.options.emitMessage } : {}),
      ...(this.options.moveTo ? { moveTo: this.options.moveTo } : {}),
      ...(this.options.runQuery ? { runQuery: this.options.runQuery } : {}),
      ...(this.options.smartObjects ? { smartObjects: this.options.smartObjects } : {}),
      ...(this.options.world ? { world: this.options.world } : {}),
      ...(this.options.targetPoints ? { targetPoints: this.options.targetPoints } : {}),
    });
    if (status !== "running" && memory.get(PRESERVE_TASK_MEMORY) !== true) memory.clear();
    return status;
  }

  private tickEvaluators(engine: EngineUpdateContext): void {
    const evaluators = this.asset.evaluators;
    if (!evaluators || evaluators.length === 0) return;
    for (let index = 0; index < evaluators.length; index += 1) {
      const evaluator = evaluators[index];
      if (!evaluator) continue;
      const interval = evaluator.interval ?? 0.25;
      const elapsed = (this.evaluatorElapsed.get(index) ?? interval) + Math.max(0, engine.deltaSeconds);
      if (elapsed + 1e-9 < interval) {
        this.evaluatorElapsed.set(index, elapsed);
        continue;
      }
      this.evaluatorElapsed.set(index, 0);
      const handler = this.options.serviceRegistry?.get(evaluator.service);
      handler?.({
        controller: this.controller,
        blackboard: this.controller.blackboard,
        engine,
        params: this.resolveParams(evaluator.params),
        memory: this.evaluatorMemoryFor(index),
        service: evaluator,
        ...(this.options.emitMessage ? { emitMessage: this.options.emitMessage } : {}),
        ...(this.options.moveTo ? { moveTo: this.options.moveTo } : {}),
        ...(this.options.runQuery ? { runQuery: this.options.runQuery } : {}),
        ...(this.options.smartObjects ? { smartObjects: this.options.smartObjects } : {}),
        ...(this.options.world ? { world: this.options.world } : {}),
        ...(this.options.targetPoints ? { targetPoints: this.options.targetPoints } : {}),
      });
    }
  }

  private resolveParams(localParams?: Record<string, AiJsonValue>): Record<string, AiJsonValue> {
    const shared = this.asset.parameters;
    const context = this.asset.context;
    if (!shared && !context) return localParams ?? EMPTY_PARAMS;
    const merged: Record<string, AiJsonValue> = {};
    if (shared) Object.assign(merged, shared);
    if (context) merged.context = context;
    if (localParams) Object.assign(merged, localParams);
    return merged;
  }

  private cooldownMemory(
    store: Map<string, Map<number, number>>,
    key: string,
  ): Map<number, number> {
    let memory = store.get(key);
    if (!memory) {
      memory = new Map();
      store.set(key, memory);
    }
    return memory;
  }

  private taskMemoryFor(key: string): Map<string, unknown> {
    let memory = this.taskMemory.get(key);
    if (!memory) {
      memory = new Map();
      this.taskMemory.set(key, memory);
    }
    return memory;
  }

  private evaluatorMemoryFor(index: number): Map<string, unknown> {
    let memory = this.evaluatorMemory.get(index);
    if (!memory) {
      memory = new Map();
      this.evaluatorMemory.set(index, memory);
    }
    return memory;
  }
}
