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

/** Stable registry id for the AI subsystem. */
export const AI_SUBSYSTEM_ID = "ai";

/** Debug view of the whole AI subsystem for the `?debug` overlay. */
export interface AiDebugSnapshot {
  /** False while the host has the subsystem gated off (editor edit mode). */
  readonly enabled: boolean;
  readonly controllerCount: number;
  readonly controllers: readonly AIControllerDebugSnapshot[];
}

export class AISubsystem implements Subsystem {
  readonly id = AI_SUBSYSTEM_ID;

  /** One controller per possessed NPC pawn, keyed by the pawn's entity id. */
  private controllers = new Map<EntityId, AIController>();
  private enabled = true;

  /**
   * Derives the live controller set from the scene's entities: every entity with
   * an AIController component gets a controller possessing it, with a blackboard
   * built from the component's inline key schema (asset-referenced blackboards
   * are resolved in Faz 2). Replaces any previous set — call with `[]` to clear
   * on scene teardown/reload.
   */
  setEntities(entities: readonly Entity[]): void {
    this.controllers.clear();
    for (const entity of entities) {
      const component = readAIControllerComponent(entity);
      if (!component) continue;
      const blackboard = new Blackboard(component.blackboardKeys ?? []);
      const options: AIControllerOptions = {
        ...(component.behaviorTree ? { behaviorTreeAsset: component.behaviorTree } : {}),
        ...(component.blackboard ? { blackboardAsset: component.blackboard } : {}),
      };
      this.controllers.set(entity.id, new AIController(`ai:${entity.id}`, entity.id, blackboard, options));
    }
  }

  update(_engine: EngineUpdateContext): void {
    if (!this.enabled) return;
    // Faz 1: AIControllers are possession + blackboard-memory containers only.
    // The per-frame Behavior Tree decision tick (which reads world/perception and
    // writes the blackboard + drives move-intent) is added in Faz 2/Faz 3. This
    // method is registered now so the tick order is fixed before that logic exists.
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
  }

  dispose(): void {
    this.clear();
  }

  getDebugSnapshot(): AiDebugSnapshot {
    return {
      enabled: this.enabled,
      controllerCount: this.controllers.size,
      controllers: [...this.controllers.values()].map((controller) => controller.getDebugSnapshot()),
    };
  }
}
