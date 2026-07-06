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
import { readAIControllerComponent, readTransformComponent } from "../scene/components";
import { forwardVectorFromRotation } from "../scene/transform";
import {
  evaluatePerception,
  type NoiseStimulus,
  type PerceptionAabb,
  type PerceivedStimulus,
  type StimulusSource,
} from "../perception/perception";
import { Blackboard } from "./blackboard";
import { AIController, type AIControllerDebugSnapshot, type AIControllerOptions } from "./aiController";
import type { AiBlackboardAsset, AiBehaviorTreeAsset } from "./behaviorAsset";
import {
  AiBehaviorRunner,
  createDefaultAiServiceRegistry,
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
  readonly blockers?: () => readonly PerceptionAabb[];
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
  private blockers: (() => readonly PerceptionAabb[]) | undefined;
  private entities: readonly Entity[] = [];
  private pendingNoises: NoiseStimulus[] = [];
  private sightGrace = new Map<EntityId, SightGraceState>();

  constructor(options: AISubsystemOptions = {}) {
    this.taskRegistry = options.taskRegistry ?? createDefaultAiTaskRegistry();
    this.serviceRegistry = options.serviceRegistry ?? createDefaultAiServiceRegistry();
    this.emitMessage = options.emitMessage;
    this.moveTo = options.moveTo;
    this.blockers = options.blockers;
  }

  configure(options: AISubsystemOptions): void {
    if (options.taskRegistry) this.taskRegistry = options.taskRegistry;
    if (options.serviceRegistry) this.serviceRegistry = options.serviceRegistry;
    if (options.emitMessage) this.emitMessage = options.emitMessage;
    if (options.moveTo) this.moveTo = options.moveTo;
    if (options.blockers) this.blockers = options.blockers;
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
    this.entities = entities;
    this.pendingNoises = [];
    this.sightGrace.clear();
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
        ...(component.perception ? { perception: component.perception } : {}),
      };
      this.controllers.set(entity.id, new AIController(`ai:${entity.id}`, entity.id, blackboard, options));
    }
    this.rebuildRunners();
  }

  update(engine: EngineUpdateContext): void {
    if (!this.enabled) {
      this.pendingNoises = [];
      return;
    }
    this.updatePerception(engine.deltaSeconds);
    for (const runner of this.runners.values()) runner.tick(engine);
    this.pendingNoises = [];
  }

  emitNoise(position: readonly [number, number, number], sourceEntityId: EntityId, loudness = 1): void {
    this.pendingNoises.push({
      sourceEntityId,
      position: [position[0], position[1], position[2]],
      loudness,
    });
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
    this.entities = [];
    this.pendingNoises = [];
    this.sightGrace.clear();
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

  private updatePerception(deltaSeconds: number): void {
    const sources = perceptionSources(this.entities);
    const blockers = this.blockers?.() ?? [];
    for (const [pawnEntityId, controller] of this.controllers) {
      const entity = this.entities.find((candidate) => candidate.id === pawnEntityId);
      const transform = entity ? readTransformComponent(entity) : undefined;
      const config = controller.perceptionConfig;
      if (!transform || !config) {
        controller.setPerception([]);
        this.sightGrace.delete(pawnEntityId);
        continue;
      }
      const perceived = evaluatePerception({
        listener: {
          entityId: pawnEntityId,
          position: transform.position,
          forward: forwardVectorFromRotation(transform.rotation),
          ...config,
        },
        sources,
        noises: this.pendingNoises,
        blockers,
      });
      controller.setPerception(
        this.applySightGrace(pawnEntityId, perceived, config.targetLostGraceSeconds, deltaSeconds),
      );
    }
  }

  private applySightGrace(
    pawnEntityId: EntityId,
    perceived: readonly PerceivedStimulus[],
    graceSeconds: number | undefined,
    deltaSeconds: number,
  ): PerceivedStimulus[] {
    const sight = perceived.find((stimulus) => stimulus.sense === "sight" && stimulus.lineOfSight !== false);
    const grace = typeof graceSeconds === "number" && Number.isFinite(graceSeconds) && graceSeconds > 0
      ? graceSeconds
      : 0;
    if (sight) {
      if (grace > 0) {
        this.sightGrace.set(pawnEntityId, { stimulus: sight, remainingSeconds: grace, totalSeconds: grace });
      } else {
        this.sightGrace.delete(pawnEntityId);
      }
      return [...perceived];
    }
    const memory = this.sightGrace.get(pawnEntityId);
    if (!memory || grace <= 0) {
      this.sightGrace.delete(pawnEntityId);
      return [...perceived];
    }
    const remaining = memory.remainingSeconds - Math.max(0, deltaSeconds);
    if (remaining <= 0) {
      this.sightGrace.delete(pawnEntityId);
      return [...perceived];
    }
    this.sightGrace.set(pawnEntityId, { ...memory, remainingSeconds: remaining });
    const remembered = {
      ...memory.stimulus,
      lineOfSight: false,
      strength: memory.stimulus.strength * (remaining / Math.max(memory.totalSeconds, 1e-6)),
    };
    return [remembered, ...perceived].sort((a, b) => b.strength - a.strength || a.distance - b.distance);
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

interface SightGraceState {
  readonly stimulus: PerceivedStimulus;
  readonly remainingSeconds: number;
  readonly totalSeconds: number;
}

function perceptionSources(entities: readonly Entity[]): StimulusSource[] {
  const sources: StimulusSource[] = [];
  for (const entity of entities) {
    const transform = readTransformComponent(entity);
    if (!transform) continue;
    sources.push({ entityId: entity.id, position: transform.position });
  }
  return sources;
}
