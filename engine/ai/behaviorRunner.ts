/**
 * Runtime Behavior Tree runner for Forge AI.
 *
 * Pure engine code: no DOM, Three.js or editor imports. Runtime memory is kept
 * per controller and per node path so authored behavior assets remain immutable
 * and shared safely across agents.
 */
import type { EngineUpdateContext } from "../core/Subsystem";
import type { EntityId } from "../scene/entity";
import type { Vec3 } from "../scene/layout";
import type { AIController } from "./aiController";
import type { Blackboard, BlackboardValue } from "./blackboard";
import type { PerceivedStimulus, PerceptionSense } from "../perception/perception";
import type {
  AiBehaviorNode,
  AiBehaviorServiceDef,
  AiBehaviorStatus,
  AiBehaviorTreeAsset,
  AiJsonValue,
} from "./behaviorAsset";

export type AiTaskHandler = (context: AiTaskContext) => AiBehaviorStatus;
export type AiServiceHandler = (context: AiServiceContext) => void;

export interface AiTaskRegistry {
  get(taskId: string): AiTaskHandler | undefined;
}

export interface AiServiceRegistry {
  get(serviceId: string): AiServiceHandler | undefined;
}

export interface AiMessageEmitInput {
  readonly type: string;
  readonly source: EntityId;
  readonly target?: EntityId;
  readonly payload?: Record<string, unknown>;
}

export interface AiMoveRequest {
  readonly controller: AIController;
  readonly position: Vec3;
}

export interface AiBehaviorRunnerOptions {
  readonly taskRegistry?: AiTaskRegistry;
  readonly serviceRegistry?: AiServiceRegistry;
  readonly resolveSubtree?: (assetPath: string) => AiBehaviorTreeAsset | undefined;
  readonly emitMessage?: (input: AiMessageEmitInput) => void;
  readonly moveTo?: (request: AiMoveRequest) => AiBehaviorStatus;
}

export interface AiTaskContext {
  readonly controller: AIController;
  readonly blackboard: Blackboard;
  readonly engine: EngineUpdateContext;
  readonly params: Record<string, AiJsonValue>;
  readonly memory: Map<string, unknown>;
  readonly emitMessage?: (input: AiMessageEmitInput) => void;
  readonly moveTo?: (request: AiMoveRequest) => AiBehaviorStatus;
}

export interface AiServiceContext extends AiTaskContext {
  readonly service: AiBehaviorServiceDef;
}

export interface AiBehaviorRunnerDebugSnapshot {
  readonly activePath: readonly string[];
  readonly lastStatus: AiBehaviorStatus | null;
  readonly lastTask: string | null;
  readonly failedDecorator: string | null;
  readonly elapsedSeconds: number;
}

interface NodeMemory {
  childIndex: number;
  waitRemaining: number | null;
  readonly taskMemory: Map<string, unknown>;
  readonly serviceElapsed: Map<number, number>;
}

interface TickState {
  readonly activePath: string[];
  lastTask: string | null;
  failedDecorator: string | null;
}

const EMPTY_PARAMS: Record<string, AiJsonValue> = {};

export function createDefaultAiTaskRegistry(): AiTaskRegistry {
  const tasks = new Map<string, AiTaskHandler>([
    ["forge.wait", waitTask],
    ["forge.setBlackboard", setBlackboardTask],
    ["forge.sendMessage", sendMessageTask],
    ["forge.moveToPosition", moveToPositionTask],
    ["forge.moveToBlackboard", moveToBlackboardTask],
    ["forge.startConversation", startConversationTask],
  ]);
  return { get: (taskId) => tasks.get(taskId) };
}

export function createDefaultAiServiceRegistry(): AiServiceRegistry {
  const services = new Map<string, AiServiceHandler>([
    ["forge.updatePerceptionBlackboard", updatePerceptionBlackboardService],
  ]);
  return { get: (serviceId) => services.get(serviceId) };
}

export class AiBehaviorRunner {
  private readonly memory = new Map<string, NodeMemory>();
  private elapsedSeconds = 0;
  private activePath: string[] = [];
  private lastStatus: AiBehaviorStatus | null = null;
  private lastTask: string | null = null;
  private failedDecorator: string | null = null;

  constructor(
    private readonly controller: AIController,
    private readonly asset: AiBehaviorTreeAsset,
    private readonly options: AiBehaviorRunnerOptions = {},
  ) {}

  tick(engine: EngineUpdateContext): AiBehaviorStatus {
    this.elapsedSeconds += Math.max(0, engine.deltaSeconds);
    const state: TickState = {
      activePath: [],
      lastTask: null,
      failedDecorator: null,
    };
    const status = this.tickNode(this.asset.root, "root", engine, state, []);
    this.activePath = state.activePath;
    this.lastStatus = status;
    this.lastTask = state.lastTask;
    this.failedDecorator = state.failedDecorator;
    this.controller.setGoal(status === "running" && state.lastTask ? state.lastTask : null);
    return status;
  }

  reset(): void {
    this.memory.clear();
    this.activePath = [];
    this.lastStatus = null;
    this.lastTask = null;
    this.failedDecorator = null;
    this.elapsedSeconds = 0;
    this.controller.setGoal(null);
  }

  getDebugSnapshot(): AiBehaviorRunnerDebugSnapshot {
    return {
      activePath: this.activePath,
      lastStatus: this.lastStatus,
      lastTask: this.lastTask,
      failedDecorator: this.failedDecorator,
      elapsedSeconds: this.elapsedSeconds,
    };
  }

  private tickNode(
    node: AiBehaviorNode,
    path: string,
    engine: EngineUpdateContext,
    state: TickState,
    subtreeStack: readonly string[],
  ): AiBehaviorStatus {
    state.activePath.push(path);
    if (!this.decoratorsPass(node, state)) return this.record(path, "failure");
    this.tickServices(node, path, engine);

    switch (node.kind) {
      case "selector":
        return this.tickComposite(node.children, path, engine, state, subtreeStack, "selector");
      case "sequence":
        return this.tickComposite(node.children, path, engine, state, subtreeStack, "sequence");
      case "task":
        return this.tickTask(node.task, node.params ?? EMPTY_PARAMS, path, engine, state);
      case "wait":
        return this.tickWait(node.seconds, path, engine);
      case "subtree":
        return this.tickSubtree(node.behavior, path, engine, state, subtreeStack);
    }
  }

  private tickComposite(
    children: readonly AiBehaviorNode[],
    path: string,
    engine: EngineUpdateContext,
    state: TickState,
    subtreeStack: readonly string[],
    mode: "selector" | "sequence",
  ): AiBehaviorStatus {
    if (children.length === 0) return this.record(path, mode === "sequence" ? "success" : "failure");
    const memory = this.memoryFor(path);
    let index = clampIndex(memory.childIndex, children.length);
    while (index < children.length) {
      const child = children[index];
      if (!child) break;
      const childPath = `${path}/${child.id ?? `${child.kind}:${index}`}`;
      const status = this.tickNode(child, childPath, engine, state, subtreeStack);
      if (status === "running") {
        memory.childIndex = index;
        return this.record(path, "running");
      }
      if (mode === "selector" && status === "success") {
        memory.childIndex = 0;
        return this.record(path, "success");
      }
      if (mode === "sequence" && status === "failure") {
        memory.childIndex = 0;
        return this.record(path, "failure");
      }
      index += 1;
    }
    memory.childIndex = 0;
    return this.record(path, mode === "selector" ? "failure" : "success");
  }

  private tickTask(
    taskId: string,
    params: Record<string, AiJsonValue>,
    path: string,
    engine: EngineUpdateContext,
    state: TickState,
  ): AiBehaviorStatus {
    state.lastTask = taskId;
    const task = this.options.taskRegistry?.get(taskId);
    if (!task) return this.record(path, "failure");
    const status = task({
      controller: this.controller,
      blackboard: this.controller.blackboard,
      engine,
      params,
      memory: this.memoryFor(path).taskMemory,
      ...(this.options.emitMessage ? { emitMessage: this.options.emitMessage } : {}),
      ...(this.options.moveTo ? { moveTo: this.options.moveTo } : {}),
    });
    if (status !== "running") this.memoryFor(path).taskMemory.clear();
    return this.record(path, status);
  }

  private tickWait(seconds: number, path: string, engine: EngineUpdateContext): AiBehaviorStatus {
    const memory = this.memoryFor(path);
    if (memory.waitRemaining === null) memory.waitRemaining = seconds;
    memory.waitRemaining -= Math.max(0, engine.deltaSeconds);
    if (memory.waitRemaining > 0) return this.record(path, "running");
    memory.waitRemaining = null;
    return this.record(path, "success");
  }

  private tickSubtree(
    behavior: string,
    path: string,
    engine: EngineUpdateContext,
    state: TickState,
    subtreeStack: readonly string[],
  ): AiBehaviorStatus {
    if (subtreeStack.includes(behavior)) return this.record(path, "failure");
    const asset = this.options.resolveSubtree?.(behavior);
    if (!asset) return this.record(path, "failure");
    return this.tickNode(asset.root, `${path}/subtree:${behavior}`, engine, state, [...subtreeStack, behavior]);
  }

  private decoratorsPass(node: AiBehaviorNode, state: TickState): boolean {
    for (const decorator of node.decorators ?? []) {
      const actual = this.controller.blackboard.get(decorator.key);
      let pass = false;
      switch (decorator.op) {
        case "equals":
          pass = blackboardValuesEqual(actual, decorator.value);
          break;
        case "notEquals":
          pass = !blackboardValuesEqual(actual, decorator.value);
          break;
        case "isSet":
          pass = actual !== undefined && actual !== null;
          break;
        case "isNotSet":
          pass = actual === undefined || actual === null;
          break;
      }
      if (!pass) {
        state.failedDecorator = `${decorator.kind}:${decorator.key}:${decorator.op}`;
        return false;
      }
    }
    return true;
  }

  private tickServices(node: AiBehaviorNode, path: string, engine: EngineUpdateContext): void {
    if (!node.services || node.services.length === 0) return;
    const memory = this.memoryFor(path);
    for (let index = 0; index < node.services.length; index += 1) {
      const service = node.services[index];
      if (!service) continue;
      const interval = service.interval ?? 0.25;
      const elapsed = (memory.serviceElapsed.get(index) ?? interval) + Math.max(0, engine.deltaSeconds);
      if (elapsed + 1e-9 < interval) {
        memory.serviceElapsed.set(index, elapsed);
        continue;
      }
      memory.serviceElapsed.set(index, 0);
      const handler = this.options.serviceRegistry?.get(service.service);
      handler?.({
        controller: this.controller,
        blackboard: this.controller.blackboard,
        engine,
        params: service.params ?? EMPTY_PARAMS,
        memory: memory.taskMemory,
        service,
        ...(this.options.emitMessage ? { emitMessage: this.options.emitMessage } : {}),
        ...(this.options.moveTo ? { moveTo: this.options.moveTo } : {}),
      });
    }
  }

  private memoryFor(path: string): NodeMemory {
    let memory = this.memory.get(path);
    if (!memory) {
      memory = {
        childIndex: 0,
        waitRemaining: null,
        taskMemory: new Map(),
        serviceElapsed: new Map(),
      };
      this.memory.set(path, memory);
    }
    return memory;
  }

  private record(_path: string, status: AiBehaviorStatus): AiBehaviorStatus {
    return status;
  }
}

function waitTask(context: AiTaskContext): AiBehaviorStatus {
  const seconds = numberParam(context.params.seconds, 1);
  const remaining = (context.memory.get("remaining") as number | undefined) ?? seconds;
  const next = remaining - Math.max(0, context.engine.deltaSeconds);
  if (next > 0) {
    context.memory.set("remaining", next);
    return "running";
  }
  context.memory.delete("remaining");
  return "success";
}

function setBlackboardTask(context: AiTaskContext): AiBehaviorStatus {
  const key = stringParam(context.params.key);
  if (!key) return "failure";
  const value = context.params.value;
  return context.blackboard.set(key, toBlackboardValue(value)) ? "success" : "failure";
}

function sendMessageTask(context: AiTaskContext): AiBehaviorStatus {
  const type = stringParam(context.params.type);
  if (!type || !context.emitMessage) return "failure";
  const target = stringParam(context.params.target);
  const payload = plainPayload(context.params.payload);
  context.emitMessage({
    type,
    source: context.controller.pawnEntityId,
    ...(target ? { target } : {}),
    ...(payload ? { payload } : {}),
  });
  return "success";
}

function moveToPositionTask(context: AiTaskContext): AiBehaviorStatus {
  if (!context.moveTo) return "failure";
  const position = vec3Param(context.params.position);
  if (!position) return "failure";
  return context.moveTo({ controller: context.controller, position });
}

function moveToBlackboardTask(context: AiTaskContext): AiBehaviorStatus {
  if (!context.moveTo) return "failure";
  const key = stringParam(context.params.key);
  if (!key) return "failure";
  const value = context.blackboard.get(key);
  const position = Array.isArray(value) ? vec3Param(value) : null;
  if (!position) return "failure";
  return context.moveTo({ controller: context.controller, position });
}

function startConversationTask(context: AiTaskContext): AiBehaviorStatus {
  const conversationId = stringParam(context.params.conversationId);
  if (!conversationId || !context.emitMessage) return "failure";
  context.emitMessage({
    type: "start-conversation",
    source: context.controller.pawnEntityId,
    payload: { conversationId },
  });
  return "success";
}

function updatePerceptionBlackboardService(context: AiServiceContext): void {
  const stimuli = context.controller.getPerception();
  const sight = strongestStimulus(stimuli, "sight");
  const hearing = strongestStimulus(stimuli, "hearing");
  const gameplay = strongestGameplayStimulus(stimuli);

  const targetKey = stringParam(context.params.targetKey);
  const hasLineOfSightKey = stringParam(context.params.hasLineOfSightKey);
  const lastKnownPositionKey = stringParam(context.params.lastKnownPositionKey);
  const lastHeardPositionKey = stringParam(context.params.lastHeardPositionKey);
  const lastHeardSourceKey = stringParam(context.params.lastHeardSourceKey);
  const lastStimulusPositionKey = stringParam(context.params.lastStimulusPositionKey);
  const lastStimulusSourceKey = stringParam(context.params.lastStimulusSourceKey);
  const lastStimulusSenseKey = stringParam(context.params.lastStimulusSenseKey);
  const lastStimulusEventKey = stringParam(context.params.lastStimulusEventKey);

  if (hasLineOfSightKey) context.blackboard.set(hasLineOfSightKey, sight?.lineOfSight === true);
  if (sight) {
    if (targetKey) context.blackboard.set(targetKey, sight.sourceEntityId);
    if (lastKnownPositionKey) context.blackboard.set(lastKnownPositionKey, sight.position);
  }
  if (hearing) {
    if (lastHeardPositionKey) context.blackboard.set(lastHeardPositionKey, hearing.position);
    if (lastHeardSourceKey) context.blackboard.set(lastHeardSourceKey, hearing.sourceEntityId);
  }
  if (gameplay) {
    if (lastStimulusPositionKey) context.blackboard.set(lastStimulusPositionKey, gameplay.position);
    if (lastStimulusSourceKey) context.blackboard.set(lastStimulusSourceKey, gameplay.sourceEntityId);
    if (lastStimulusSenseKey) context.blackboard.set(lastStimulusSenseKey, gameplay.sense);
    if (lastStimulusEventKey) context.blackboard.set(lastStimulusEventKey, gameplay.eventType ?? gameplay.sense);
  }
}

function numberParam(value: AiJsonValue | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function strongestStimulus(
  stimuli: readonly PerceivedStimulus[],
  sense: PerceptionSense,
): PerceivedStimulus | null {
  let best: PerceivedStimulus | null = null;
  for (const stimulus of stimuli) {
    if (stimulus.sense !== sense) continue;
    if (
      !best ||
      stimulus.strength > best.strength ||
      (stimulus.strength === best.strength && stimulus.distance < best.distance)
    ) {
      best = stimulus;
    }
  }
  return best;
}

function strongestGameplayStimulus(stimuli: readonly PerceivedStimulus[]): PerceivedStimulus | null {
  let best: PerceivedStimulus | null = null;
  for (const stimulus of stimuli) {
    if (stimulus.sense === "sight" || stimulus.sense === "hearing") continue;
    if (
      !best ||
      stimulus.strength > best.strength ||
      (stimulus.strength === best.strength && stimulus.distance < best.distance)
    ) {
      best = stimulus;
    }
  }
  return best;
}

function stringParam(value: AiJsonValue | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function vec3Param(value: AiJsonValue | undefined | BlackboardValue): Vec3 | null {
  if (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  ) {
    return [value[0] as number, value[1] as number, value[2] as number];
  }
  return null;
}

function plainPayload(value: AiJsonValue | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return { ...value };
}

function toBlackboardValue(value: AiJsonValue | undefined): BlackboardValue {
  if (value === undefined) return null;
  if (Array.isArray(value)) return vec3Param(value) ?? null;
  if (typeof value === "object" && value !== null) return null;
  return value;
}

function blackboardValuesEqual(left: BlackboardValue | undefined, right: BlackboardValue | undefined): boolean {
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

function clampIndex(index: number, length: number): number {
  if (!Number.isInteger(index) || index < 0) return 0;
  return Math.min(index, Math.max(0, length - 1));
}
