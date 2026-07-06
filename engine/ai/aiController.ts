/**
 * AIController: the runtime "brain" that possesses one NPC pawn (Unreal
 * `AAIController`). Where the game's PlayerController turns human input into a
 * pawn's movement/actions, an AIController turns world state + its own
 * {@link Blackboard} memory into decisions.
 *
 * Faz 1 scope: the controller is a possession record + typed memory + a current
 * high-level goal label, all observable in the `?debug` overlay. It performs no
 * per-frame decision-making yet — the Behavior Tree runner that ticks a
 * controller each frame lands in Faz 2, and path following in Faz 3. The class is
 * shaped now so that wiring, debug and tests exist before the decision logic.
 *
 * Runtime-only, pure module (no Three.js / DOM). AI state is never serialized to
 * the layout; only the authoring inputs (behavior tree / blackboard asset paths)
 * come from the actor's data.
 */
import { Blackboard } from "./blackboard";
import type { BlackboardDebugSnapshot } from "./blackboard";
import type { AiBehaviorRunnerDebugSnapshot } from "./behaviorRunner";
import type { AIPerceptionConfig } from "../scene/components";
import type { EntityId } from "../scene/entity";
import type { PerceivedStimulus } from "../perception/perception";

/** Stable controller id, derived from the possessed pawn's entity id. */
export type AIControllerId = string;

export interface AIControllerOptions {
  /** Authored `*.behavior.json` asset path this controller runs (resolved in Faz 2). */
  readonly behaviorTreeAsset?: string;
  /** Authored `*.blackboard.json` asset path backing the memory (resolved in Faz 2). */
  readonly blackboardAsset?: string;
  /** Authored perception tuning copied from the AIController component. */
  readonly perception?: AIPerceptionConfig;
}

/** Debug view of one controller for the `?debug` overlay / editor inspector. */
export interface AIControllerDebugSnapshot {
  readonly controllerId: AIControllerId;
  readonly pawnEntityId: EntityId;
  /** Current high-level goal label, or null when the controller is idle. */
  readonly goal: string | null;
  /** Referenced behavior tree asset path, or null when none is authored. */
  readonly behaviorTreeAsset: string | null;
  readonly behavior: AiBehaviorRunnerDebugSnapshot | null;
  readonly perception?: readonly PerceivedStimulus[];
  readonly blackboard: BlackboardDebugSnapshot;
}

export class AIController {
  readonly id: AIControllerId;
  /** The pawn this controller possesses (the entity carrying the AIController component). */
  readonly pawnEntityId: EntityId;
  readonly blackboard: Blackboard;
  readonly behaviorTreeAsset: string | null;
  readonly blackboardAsset: string | null;
  readonly perceptionConfig: AIPerceptionConfig | null;

  private currentGoal: string | null = null;
  private perceived: PerceivedStimulus[] = [];

  constructor(
    id: AIControllerId,
    pawnEntityId: EntityId,
    blackboard: Blackboard,
    options: AIControllerOptions = {},
  ) {
    this.id = id;
    this.pawnEntityId = pawnEntityId;
    this.blackboard = blackboard;
    this.behaviorTreeAsset = options.behaviorTreeAsset ?? null;
    this.blackboardAsset = options.blackboardAsset ?? null;
    this.perceptionConfig = options.perception ?? null;
  }

  /** Current high-level goal label, or null when idle. */
  get goal(): string | null {
    return this.currentGoal;
  }

  /** Sets (or clears, with null/empty) the current goal label shown in debug. */
  setGoal(goal: string | null): void {
    this.currentGoal = goal && goal.length > 0 ? goal : null;
  }

  setPerception(stimuli: readonly PerceivedStimulus[]): void {
    this.perceived = stimuli.map((stimulus) => ({
      ...stimulus,
      position: [stimulus.position[0], stimulus.position[1], stimulus.position[2]],
    }));
  }

  getDebugSnapshot(behavior: AiBehaviorRunnerDebugSnapshot | null = null): AIControllerDebugSnapshot {
    return {
      controllerId: this.id,
      pawnEntityId: this.pawnEntityId,
      goal: this.currentGoal,
      behaviorTreeAsset: this.behaviorTreeAsset,
      behavior,
      perception: this.perceived,
      blackboard: this.blackboard.getDebugSnapshot(),
    };
  }
}
