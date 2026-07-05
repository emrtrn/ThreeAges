/**
 * AISubsystem: owns the lifecycle of every {@link AIController} in the live
 * scene. It derives a controller for each entity carrying an AIController
 * component (mirroring how {@link BehaviorSubsystem} derives behavior instances),
 * ticks them each frame, and exposes a debug snapshot.
 *
 * Faz 1 scope: derivation + lifecycle + debug + a Play-mode `setEnabled` gate.
 * The controllers hold memory only; the per-frame Behavior Tree decision tick is
 * added in Faz 2. This subsystem is registered *now* — on both the runtime host
 * and the editor host (disabled in edit mode, enabled in editor Play) — so the
 * tick order and wiring are fixed before decision logic exists.
 *
 * Pure engine module: no Three.js / DOM / editor imports. Value imports are
 * relative so the engine-test bundler (no path aliases) can run it.
 */
import type { EngineUpdateContext, Subsystem } from "../core/Subsystem";
import type { Entity, EntityId } from "../scene/entity";
import { readAIControllerComponent } from "../scene/components";
import { Blackboard } from "./blackboard";
import { AIController, type AIControllerDebugSnapshot, type AIControllerOptions } from "./aiController";
import type { AiBlackboardAsset, AiBehaviorTreeAsset } from "./behaviorAsset";
import {
  AiBehaviorRunner,
  createDefaultAiTaskRegistry,
  type AiBehaviorRunnerOptions,
  type AiTaskRegistry,
  type AiServiceRegistry,
  type AiMessageEmitInput,
  type AiMoveRequest,
} from "./behaviorRunner";

/** Stable registry id for the AI subsystem. */
export const AI_SUBSYSTEM_ID = "ai";

/** Debug view of the whole AI subsystem for the `?debug` overlay. */
export interface AiDebugSnapshot {
  /** False while the host has the subsystem gated off (editor edit mode). */
  readonly enabled: boolean;
  readonly controllerCount: number;
  readonly controllers: readonly AIControllerDebugSnapshot[];
}

export interface AiAssetLibrary {
  readonly blackboards?: ReadonlyMap<string, AiBlackboardAsset>;
  readonly behaviors?: ReadonlyMap<string, AiBehaviorTreeAsset>;
}

export interface AISubsystemOptions {
  readonly taskRegistry?: AiTaskRegistry;
  readonly serviceRegistry?: AiServiceRegistry;
  readonly emitMessage?: (input: AiMessageEmitInput) => void;
  readonly moveTo?: (request: AiMoveRequest) => "success" | "failure" | "running";
}

export class AISubsystem implements Subsystem {
  readonly id = AI_SUBSYSTEM_ID;

  /** One controller per possessed NPC pawn, keyed by the pawn's entity id. */
  private controllers = new Map<EntityId, AIController>();
  private runners = new Map<EntityId, AiBehaviorRunner>();
  private blackboardAssets: ReadonlyMap<string, AiBlackboardAsset> = new Map();
  private behaviorAssets: ReadonlyMap<string, AiBehaviorTreeAsset> = new Map();
  private enabled = true;
  private taskRegistry: AiTaskRegistry;
  private serviceRegistry: AiServiceRegistry | undefined;
  private emitMessage: ((input: AiMessageEmitInput) => void) | undefined;
  private moveTo: ((request: AiMoveRequest) => "success" | "failure" | "running") | undefined;

  constructor(options: AISubsystemOptions = {}) {
    this.taskRegistry = options.taskRegistry ?? createDefaultAiTaskRegistry();
    this.serviceRegistry = options.serviceRegistry;
    this.emitMessage = options.emitMessage;
    this.moveTo = options.moveTo;
  }

  configure(options: AISubsystemOptions): void {
    if (options.taskRegistry) this.taskRegistry = options.taskRegistry;
    if (options.serviceRegistry) this.serviceRegistry = options.serviceRegistry;
    if (options.emitMessage) this.emitMessage = options.emitMessage;
    if (options.moveTo) this.moveTo = options.moveTo;
  }

  setAssetLibrary(library: AiAssetLibrary): void {
    this.blackboardAssets = library.blackboards ?? new Map();
    this.behaviorAssets = library.behaviors ?? new Map();
    this.rebuildRunners();
  }

  /**
   * Derives the live controller set from the scene's entities: every entity with
   * an AIController component gets a controller possessing it, with a blackboard
   * built from the component's inline key schema (asset-referenced blackboards
   * are resolved in Faz 2). Replaces any previous set — call with `[]` to clear
   * on scene teardown/reload.
   */
  setEntities(entities: readonly Entity[]): void {
    this.controllers.clear();
    this.runners.clear();
    for (const entity of entities) {
      const component = readAIControllerComponent(entity);
      if (!component) continue;
      const behaviorAsset = component.behaviorTree
        ? this.behaviorAssets.get(component.behaviorTree)
        : undefined;
      const blackboardRef = component.blackboard ?? behaviorAsset?.blackboard;
      const blackboardKeys = blackboardRef
        ? this.blackboardAssets.get(blackboardRef)?.keys
        : undefined;
      const blackboard = new Blackboard(blackboardKeys ?? component.blackboardKeys ?? []);
      const options: AIControllerOptions = {
        ...(component.behaviorTree ? { behaviorTreeAsset: component.behaviorTree } : {}),
        ...(blackboardRef ? { blackboardAsset: blackboardRef } : {}),
      };
      this.controllers.set(entity.id, new AIController(`ai:${entity.id}`, entity.id, blackboard, options));
    }
    this.rebuildRunners();
  }

  update(engine: EngineUpdateContext): void {
    if (!this.enabled) return;
    for (const runner of this.runners.values()) runner.tick(engine);
  }

  /**
   * Enables/disables AI simulation. Disabled, {@link update} is a no-op so an
   * editor edit-mode host keeps authored NPCs static until Play runs (same gate
   * as BehaviorSubsystem / PhysicsSubsystem).
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** The controller possessing `pawnEntityId`, or undefined (Faz 3 move-intent hook). */
  getControllerForPawn(pawnEntityId: EntityId): AIController | undefined {
    return this.controllers.get(pawnEntityId);
  }

  controllerCount(): number {
    return this.controllers.size;
  }

  /** Drops all controllers (scene teardown / reload). */
  clear(): void {
    this.controllers.clear();
    this.runners.clear();
  }

  dispose(): void {
    this.clear();
  }

  getDebugSnapshot(): AiDebugSnapshot {
    return {
      enabled: this.enabled,
      controllerCount: this.controllers.size,
      controllers: [...this.controllers.entries()].map(([pawnEntityId, controller]) =>
        controller.getDebugSnapshot(this.runners.get(pawnEntityId)?.getDebugSnapshot() ?? null),
      ),
    };
  }

  private rebuildRunners(): void {
    this.runners.clear();
    for (const [pawnEntityId, controller] of this.controllers) {
      const behaviorTreeAsset = controller.behaviorTreeAsset;
      if (!behaviorTreeAsset) continue;
      const asset = this.behaviorAssets.get(behaviorTreeAsset);
      if (!asset) continue;
      this.runners.set(
        pawnEntityId,
        new AiBehaviorRunner(controller, asset, this.runnerOptions()),
      );
    }
  }

  private runnerOptions(): AiBehaviorRunnerOptions {
    return {
      taskRegistry: this.taskRegistry,
      ...(this.serviceRegistry ? { serviceRegistry: this.serviceRegistry } : {}),
      resolveSubtree: (assetPath) => this.behaviorAssets.get(assetPath),
      ...(this.emitMessage ? { emitMessage: this.emitMessage } : {}),
      ...(this.moveTo ? { moveTo: this.moveTo } : {}),
    };
  }
}
