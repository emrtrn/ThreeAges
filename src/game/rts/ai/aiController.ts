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
import type { BarracksProductionSystem } from "../structures/barracksProductionSystem";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { StructureConstructionService } from "../structures/structureConstructionService";
import type { WorkerProductionSystem } from "../structures/workerProductionSystem";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { RoadConstructionService } from "../roads/roadConstructionService";
import type { RtsBuildAnchor, RtsExpansionRegion } from "../world/rtsMapBlockout";
import type { UnitOwner } from "../units/unit";
import { AiBlackboardReader, type AiBlackboard, type AiBlackboardSources } from "./aiBlackboard";
import { AiBuildManager } from "./aiBuildManager";
import { AiDecisionLog } from "./aiDecisionLog";
import { AiEconomyManager, type AiBottleneck } from "./aiEconomyManager";
import { AiExpansionManager } from "./aiExpansionManager";
import { AiProductionManager } from "./aiProductionManager";
import { ArmyManager } from "./armyManager";
import { KingdomDirector } from "./kingdomDirector";
import type { AiTargetScore } from "./armyTargeting";
import type { AiArmyMission, AiExpansionStep, AiIntent, AiIntentScore, AiPlan } from "./aiTypes";

export interface AiControllerOptions extends AiBlackboardSources {
  readonly balance: AiBalance;
  readonly profile: AiProfile;
  readonly navigation: RtsNavigation;
  readonly centers: CommandCenterSystem;
  /** §40: the authored slots this kingdom may build on. */
  readonly anchors: readonly RtsBuildAnchor[];
  /** §10/§45: the single authored region this kingdom may expand into. */
  readonly expansion: RtsExpansionRegion;
  readonly construction: StructureConstructionService;
  readonly roadConstruction: RoadConstructionService;
  readonly workerProduction: WorkerProductionSystem;
  readonly barracksProduction: BarracksProductionSystem;
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
  /** §54: how many guards the mission is holding at the base. */
  readonly garrisonCount: number;
  /** §60: the target the army is committed to, with the reason it won. */
  readonly target: AiTargetScore | null;
  /** §69: the AI has stopped deciding because the match is over. */
  readonly concluded: boolean;
  readonly bottleneck: AiBottleneck;
  readonly expansionStep: AiExpansionStep;
  readonly blackboard: AiBlackboard | null;
}

export class AiController {
  readonly log = new AiDecisionLog();
  private readonly reader: AiBlackboardReader;
  private readonly director: KingdomDirector;
  private readonly army: ArmyManager;
  private readonly builds: AiBuildManager;
  private readonly economy: AiEconomyManager;
  private readonly expansion: AiExpansionManager;
  private readonly production: AiProductionManager;
  private readonly profileBalance;
  private now = 0;
  private directorAccumulator = 0;
  private armyAccumulator = 0;
  private economyAccumulator = 0;
  private lastBlackboard: AiBlackboard | null = null;
  private matchConcluded = false;

  constructor(private readonly options: AiControllerOptions) {
    this.reader = new AiBlackboardReader(options);
    this.director = new KingdomDirector(options.balance, this.log);
    this.army = new ArmyManager(
      options.owner,
      options.units,
      options.centers,
      options.structures,
      options.navigation,
      options.balance,
      this.log,
    );
    this.builds = new AiBuildManager(
      options.owner,
      options.anchors,
      options.construction,
      options.structures,
      this.log,
    );
    this.economy = new AiEconomyManager(options.balance, this.builds, this.log);
    this.expansion = new AiExpansionManager(
      options.owner,
      options.expansion,
      this.builds,
      options.roadConstruction,
      options.structures,
      this.log,
    );
    this.production = new AiProductionManager(
      options.owner,
      options.workerProduction,
      options.barracksProduction,
      options.balance,
    );
    this.profileBalance = options.balance.profiles[options.profile];
  }

  /** §73: the economy multiplier this AI actually runs with, for debug/audit. */
  get economyMultiplier(): number {
    return this.profileBalance.economyMultiplier;
  }

  /** §69: true once the match is decided and this AI has stopped deciding. */
  get concluded(): boolean {
    return this.matchConcluded;
  }

  /** Advance AI time by one simulation step; evaluates only on its own cadence. */
  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("AI delta must be a non-negative finite number");
    }
    this.now += deltaSeconds;
    // §69/plan §38 ("Maç bittikten sonra karar üretmeyi durdurma"): once a centre
    // has fallen the match is over. Deciding past that point would keep issuing
    // orders behind a result screen, and the AI checks this itself rather than
    // trusting a caller to stop stepping it — engine tests step it directly.
    if (this.checkMatchEnd()) return;
    this.directorAccumulator += deltaSeconds;
    this.armyAccumulator += deltaSeconds;
    this.economyAccumulator += deltaSeconds;

    const { evaluation } = this.options.balance;
    // §70: difficulty adds reaction delay rather than resources.
    const directorPeriod = evaluation.directorSeconds + this.profileBalance.reactionDelaySeconds;
    const directorDue = this.directorAccumulator >= directorPeriod;
    const economyDue = this.economyAccumulator >= evaluation.economySeconds;
    const armyDue = this.armyAccumulator >= evaluation.armySeconds;
    if (!directorDue && !economyDue && !armyDue) return;

    if (directorDue) {
      // §79: drop whole missed periods after a stall rather than replaying them.
      this.directorAccumulator = 0;
      this.director.evaluate(this.readBlackboard());
    }
    if (economyDue) {
      this.economyAccumulator = 0;
      const blackboard = this.readBlackboard();
      // §17/§55: the production queues are a standing concern — they keep the
      // population unlocked whatever the director is currently committed to.
      this.production.update(blackboard);
      // §17: these only execute; which one runs is the director's committed plan.
      if (this.director.currentIntent === "economy") this.economy.update(blackboard);
      // §26 warns that a claimed-but-unconnected region is the failure mode to
      // avoid, and the recipe outlasts any one plan. So once the outpost is down
      // the recipe finishes even if an emergency pulls the director elsewhere —
      // otherwise a stray population lock strands the expansion mid-step.
      const claimed = this.expansion.currentStep !== "outpost";
      if (this.director.currentIntent === "expand" || (claimed && !this.expansion.settled)) {
        this.runExpansion(blackboard);
      }
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
      garrisonCount: armyState.garrisonCount,
      target: armyState.target,
      concluded: this.matchConcluded,
      bottleneck: this.economy.bottleneck,
      expansionStep: this.expansion.currentStep,
      blackboard: this.lastBlackboard,
    };
  }

  reset(): void {
    this.now = 0;
    this.directorAccumulator = 0;
    this.armyAccumulator = 0;
    this.economyAccumulator = 0;
    this.lastBlackboard = null;
    this.matchConcluded = false;
    this.director.reset();
    this.army.reset();
    this.builds.reset();
    this.economy.reset();
    this.expansion.reset();
    this.log.clear();
  }

  /**
   * §32: an executor owns its plan's outcome. Closing the plan here is what
   * frees the director to re-decide immediately instead of holding a finished
   * (or abandoned) expansion until its timeout.
   */
  private runExpansion(blackboard: AiBlackboard): void {
    const step = this.expansion.update(blackboard);
    const plan = this.director.currentPlan;
    if (!plan || plan.intent !== "expand") return;
    if (step === "done") this.director.completePlan(plan, this.now, true);
    else if (step === "failed") this.director.completePlan(plan, this.now, false, "no-valid-placement");
  }

  /**
   * §69: stop at the first decided match. The army is stood down on the way out
   * so no guard is left walking at a centre that no longer exists.
   */
  private checkMatchEnd(): boolean {
    if (this.matchConcluded) return true;
    const own = this.options.centers.get(this.options.owner);
    const opponent: UnitOwner = this.options.owner === "player" ? "enemy" : "player";
    const rival = this.options.centers.get(opponent);
    const won = !rival || rival.health.depleted;
    const lost = !own || own.health.depleted;
    if (!won && !lost) return false;
    this.matchConcluded = true;
    this.army.reset();
    this.director.reset();
    this.log.record({
      at: this.now,
      kind: "match-ended",
      reason: won ? "maç bitti: rakip merkezi yıkıldı" : "maç bitti: merkezimiz yıkıldı",
    });
    return true;
  }

  private readBlackboard(): AiBlackboard {
    this.lastBlackboard = this.reader.read({
      now: this.now,
      currentIntent: this.director.currentIntent,
      currentPlan: this.director.currentPlan,
      armyMission: this.army.currentMission,
      expansionStep: this.expansion.currentStep,
    });
    return this.lastBlackboard;
  }
}
