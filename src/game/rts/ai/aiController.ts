/**
 * AI Controller — `07_ENEMY_AI_DESIGN_v0.2.md` §76; plan §38.
 *
 * §76 is explicit that this class only *composes* the AI and drives its update
 * cadences — all logic stays in the modules below it.
 *
 * Cadence (§78): the director re-evaluates every few seconds and the army every
 * fraction of a second, both on accumulated **match** time. Because the RTS
 * simulation already scales its delta by the selected game speed, running at 8X
 * accelerates the AI exactly as much as everything else — that is the plan §38
 * "AI hızlandırılmış test modu", and it needs no AI-specific switch. This class
 * touches no renderer or DOM, so engine tests can also step a whole match
 * headlessly at any rate (§80 determinism).
 */
import type { AiBalance, AiProfile } from "../../data/gameDataTypes";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { UnitOwner } from "../units/unit";
import { AiBlackboardReader, type AiBlackboard, type AiBlackboardSources } from "./aiBlackboard";
import { AiDecisionLog } from "./aiDecisionLog";
import { ArmyManager } from "./armyManager";
import { KingdomDirector } from "./kingdomDirector";
import type { AiArmyMission, AiIntent, AiIntentScore, AiPlan } from "./aiTypes";

export interface AiControllerOptions extends AiBlackboardSources {
  readonly balance: AiBalance;
  readonly profile: AiProfile;
  readonly navigation: RtsNavigation;
  readonly centers: CommandCenterSystem;
}

/** Everything the debug panel needs (§82), in one read. */
export interface AiControllerSnapshot {
  readonly owner: UnitOwner;
  readonly intent: AiIntent | null;
  readonly plan: AiPlan | null;
  readonly planSeconds: number;
  readonly scores: readonly AiIntentScore[];
  readonly mission: AiArmyMission | null;
  readonly armyPower: number;
  readonly blackboard: AiBlackboard | null;
}

export class AiController {
  readonly log = new AiDecisionLog();
  private readonly reader: AiBlackboardReader;
  private readonly director: KingdomDirector;
  private readonly army: ArmyManager;
  private readonly profileBalance;
  private now = 0;
  private directorAccumulator = 0;
  private armyAccumulator = 0;
  private lastBlackboard: AiBlackboard | null = null;

  constructor(private readonly options: AiControllerOptions) {
    this.reader = new AiBlackboardReader(options);
    this.director = new KingdomDirector(options.balance, this.log);
    this.army = new ArmyManager(
      options.owner,
      options.units,
      options.centers,
      options.navigation,
      options.balance,
      this.log,
    );
    this.profileBalance = options.balance.profiles[options.profile];
  }

  /** §73: the economy multiplier this AI actually runs with, for debug/audit. */
  get economyMultiplier(): number {
    return this.profileBalance.economyMultiplier;
  }

  /** Advance AI time by one simulation step; evaluates only on its own cadence. */
  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("AI delta must be a non-negative finite number");
    }
    this.now += deltaSeconds;
    this.directorAccumulator += deltaSeconds;
    this.armyAccumulator += deltaSeconds;

    const { evaluation } = this.options.balance;
    // §70: difficulty adds reaction delay rather than resources.
    const directorPeriod = evaluation.directorSeconds + this.profileBalance.reactionDelaySeconds;
    const directorDue = this.directorAccumulator >= directorPeriod;
    const armyDue = this.armyAccumulator >= evaluation.armySeconds;
    if (!directorDue && !armyDue) return;

    const blackboard = this.readBlackboard();
    if (directorDue) {
      // §79: drop whole missed periods after a stall rather than replaying them.
      this.directorAccumulator = 0;
      this.director.evaluate(blackboard);
    }
    if (armyDue) {
      this.armyAccumulator = 0;
      this.army.update(this.readBlackboard(), this.director.currentIntent);
    }
  }

  snapshot(): AiControllerSnapshot {
    const armyState = this.army.state();
    const plan = this.director.currentPlan;
    return {
      owner: this.options.owner,
      intent: this.director.currentIntent,
      plan,
      planSeconds: plan ? Math.max(0, this.now - plan.startedAt) : 0,
      scores: this.director.state().scores,
      mission: armyState.mission,
      armyPower: armyState.power,
      blackboard: this.lastBlackboard,
    };
  }

  reset(): void {
    this.now = 0;
    this.directorAccumulator = 0;
    this.armyAccumulator = 0;
    this.lastBlackboard = null;
    this.director.reset();
    this.army.reset();
    this.log.clear();
  }

  private readBlackboard(): AiBlackboard {
    this.lastBlackboard = this.reader.read({
      now: this.now,
      currentIntent: this.director.currentIntent,
      currentPlan: this.director.currentPlan,
      armyMission: this.army.currentMission,
    });
    return this.lastBlackboard;
  }
}
