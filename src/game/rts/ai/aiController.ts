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
import type { AiBalance, AiProfile, UnitRoleId } from "../../data/gameDataTypes";
import type { BarracksProductionSystem } from "../structures/barracksProductionSystem";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { StructureConstructionService } from "../structures/structureConstructionService";
import type { StructureUpgradeSystem } from "../structures/structureUpgradeSystem";
import type { WorkerProductionSystem } from "../structures/workerProductionSystem";
import type { MarketTradeSystem } from "../economy/marketTradeSystem";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { RoadConstructionService } from "../roads/roadConstructionService";
import type { RtsBuildAnchor, RtsExpansionRegion, RtsMapPoint } from "../world/rtsMapBlockout";
import type { UnitOwner } from "../units/unit";
import type { AgeSystem } from "../progression/ageSystem";
import { AiAgeManager } from "./aiAgeManager";
import { AiBlackboardReader, type AiBlackboard, type AiBlackboardSources } from "./aiBlackboard";
import { AiBuildManager } from "./aiBuildManager";
import { AiDecisionLog } from "./aiDecisionLog";
import { AiEconomyManager, type AiBottleneck } from "./aiEconomyManager";
import { AiExpansionCoordinator, AI_MAX_EXPANSION_PLANS } from "./aiExpansionCoordinator";
import { AiInfrastructureManager, type AiInfrastructureStep } from "./aiInfrastructureManager";
import { AiProductionManager } from "./aiProductionManager";
import { AiTradeManager, type AiTradeStep } from "./aiTradeManager";
import { AiUpgradeManager, type AiUpgradeStep } from "./aiUpgradeManager";
import { ArmyManager, type AiObjectiveWatch, type AiRetreatReason } from "./armyManager";
import type { AiVisionFilter } from "./aiVisionFilter";
import { KingdomDirector } from "./kingdomDirector";
import type { AiTargetScore } from "./armyTargeting";
import type { AiArmyMission, AiExpansionStep, AiIntent, AiIntentScore, AiPlan } from "./aiTypes";

export interface AiControllerOptions extends AiBlackboardSources {
  readonly balance: AiBalance;
  readonly profile: AiProfile;
  /** §24: the same owner-scoped progression the player's centre panel drives. */
  readonly ages: AgeSystem;
  readonly navigation: RtsNavigation;
  readonly centers: CommandCenterSystem;
  /** §40: the authored slots this kingdom may build on. */
  readonly anchors: readonly RtsBuildAnchor[];
  /**
   * §37: the base road spine. Without it the base depot has no island and every
   * base producer stays stuck on its local buffer, so the AI has no income.
   */
  readonly baseRoute: readonly RtsMapPoint[];
  /**
   * §45/§49: the authored regions this kingdom may expand into, in preference
   * order. How many of them it actually runs is the AI's own cap
   * ({@link AI_MAX_EXPANSION_PLANS}), not the length of this list.
   */
  readonly expansions: readonly RtsExpansionRegion[];
  /**
   * §58: how the army reads the regional victory race. Explicitly `null` — not
   * optional — whenever the `regionalVictory` flag is off, so a disabled feature
   * adds no per-tick work *and* a future caller has to decide about objectives
   * rather than forget them into existence.
   */
  readonly objectives: (() => AiObjectiveWatch | null) | null;
  /**
   * §59: the information limit every enemy read is routed through. Explicitly
   * `null` — not optional — whenever the `fogOfWar` flag is off, for the same
   * reason as {@link objectives} above: a caller has to *decide* the AI sees
   * everything rather than arrive there by forgetting a field.
   */
  readonly vision: AiVisionFilter | null;
  readonly construction: StructureConstructionService;
  readonly roadConstruction: RoadConstructionService;
  readonly workerProduction: WorkerProductionSystem;
  readonly barracksProduction: BarracksProductionSystem;
  /**
   * §53: the same tier research the player's palette drives. Without it the AI's
   * composition ratio can never leave Guards — the Archer and the Ram are gated
   * on Barracks II.
   */
  readonly structureUpgrades: StructureUpgradeSystem;
  /** §53: which unit id fills a combat role, read off `balance/units.json`. */
  readonly unitIdForRole: (role: UnitRoleId) => string | null;
  /**
   * Faz M4: the same market the player's panel trades at. Shared rather than
   * mirrored, so the AI is bound by every rule the player is — the control-area
   * gate, the commission, and a price its own buying moves.
   */
  readonly marketTrade: MarketTradeSystem;
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
  /** §65: which retreat trigger stood the army down, while it is standing down. */
  readonly retreatReason: AiRetreatReason | null;
  /** §69: the AI has stopped deciding because the match is over. */
  readonly concluded: boolean;
  readonly bottleneck: AiBottleneck;
  readonly expansionStep: AiExpansionStep;
  /** §49: regions running and finished, against the AI's two-plan budget. */
  readonly expansionsCompleted: number;
  readonly expansionPlanAvailable: boolean;
  /** §37: how far the base depot + spine have got, for the §82 panel. */
  readonly infrastructureStep: AiInfrastructureStep;
  /** §53: how far the Barracks tier research the composition needs has got. */
  readonly upgradeStep: AiUpgradeStep;
  /** Faz M4: how the market rule last resolved — traded, saving, or no Market. */
  readonly tradeStep: AiTradeStep;
  /**
   * §82 "Aktif yapı planı": the building id occupying the §42 build slot, or
   * null when it is free. This is what separates "saving up" from "stuck".
   */
  readonly activeBuild: string | null;
  readonly blackboard: AiBlackboard | null;
}

/** §53: the building whose tier gates the age composition's roles. */
const AI_COMPOSITION_BUILDING_ID = "barracks";

export class AiController {
  readonly log = new AiDecisionLog();
  private readonly reader: AiBlackboardReader;
  private readonly director: KingdomDirector;
  private readonly army: ArmyManager;
  private readonly age: AiAgeManager;
  private readonly builds: AiBuildManager;
  private readonly economy: AiEconomyManager;
  private readonly expansion: AiExpansionCoordinator;
  private readonly infrastructure: AiInfrastructureManager;
  private readonly production: AiProductionManager;
  private readonly upgrades: AiUpgradeManager;
  private readonly trades: AiTradeManager;
  private readonly profileBalance;
  private now = 0;
  private directorAccumulator = 0;
  private armyAccumulator = 0;
  private economyAccumulator = 0;
  private lastBlackboard: AiBlackboard | null = null;
  private matchConcluded = false;

  constructor(private readonly options: AiControllerOptions) {
    this.reader = new AiBlackboardReader(options, options.balance);
    this.director = new KingdomDirector(options.balance, this.log);
    this.age = new AiAgeManager(options.owner, options.ages, this.log, options.structureUpgrades);
    this.army = new ArmyManager(
      options.owner,
      options.units,
      options.centers,
      options.structures,
      options.navigation,
      options.balance,
      this.log,
      options.objectives ?? null,
      options.vision ?? null,
    );
    this.builds = new AiBuildManager(
      options.owner,
      options.anchors,
      options.construction,
      options.structures,
      this.log,
    );
    this.economy = new AiEconomyManager(options.balance, this.builds, this.log);
    const depotAnchor = options.anchors.find((anchor) => anchor.buildingId === "depot");
    if (!depotAnchor) {
      // A base with no depot slot can never earn income (§37), so this is a map
      // authoring error rather than a state the AI should quietly limp through.
      throw new Error(`No base depot anchor authored for AI owner "${options.owner}"`);
    }
    this.infrastructure = new AiInfrastructureManager(
      options.owner,
      depotAnchor,
      options.baseRoute,
      this.builds,
      options.roadConstruction,
      options.structures,
      this.log,
    );
    this.expansion = new AiExpansionCoordinator(
      options.owner,
      options.expansions,
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
      options.unitIdForRole,
      (buildingId, now) => { this.builds.request(buildingId, now); },
    );
    this.upgrades = new AiUpgradeManager(
      options.owner,
      // The Barracks is what trains the §53 composition, so its tier is the one
      // the composition can be gated on. Scoped here rather than searched for:
      // the same single building {@link BarracksProductionSystem} is scoped to.
      AI_COMPOSITION_BUILDING_ID,
      options.structureUpgrades,
      this.log,
    );
    this.trades = new AiTradeManager(options.owner, options.marketTrade, this.log);
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
      // §53: so is the tier the composition needs. It reads the gate the
      // production manager just hit rather than a rule of its own, so the AI
      // researches Barracks II exactly when its own ratio is asking for a unit
      // the current tier refuses — and never merely because it could.
      this.upgrades.update(blackboard, this.production.upgradeGatedRole !== null);
      // Faz M4: so is the market. A standing concern rather than the economy
      // intent's business, for the same reason the age it trades for is: a
      // kingdom whose stone deposit was lost mid-plan has to be able to convert
      // its way out while the director is committed elsewhere.
      this.trades.update(blackboard);
      // §37: so is the base link. A base whose producers cannot reach a depot
      // has no income at all, so this outranks the committed plan rather than
      // waiting for the economy intent to come back around — and because it runs
      // first, the depot and spine take the build slot before the opening does.
      this.infrastructure.update(blackboard);
      // §17: these only execute; which one runs is the director's committed plan.
      if (this.director.currentIntent === "economy") this.economy.update(blackboard);
      if (this.director.currentIntent === "ageUp") this.runAgeUp(blackboard);
      // §26 warns that a claimed-but-unconnected region is the failure mode to
      // avoid, and the recipe outlasts any one plan. So a claimed region finishes
      // — and a finished one keeps its outpost, depot and road standing — even if
      // an emergency pulls the director elsewhere; otherwise a stray population
      // lock strands the expansion mid-step, or a razed outpost is never noticed.
      if (this.director.currentIntent === "expand" || this.expansion.hasClaims) {
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
      retreatReason: armyState.retreatReason,
      concluded: this.matchConcluded,
      bottleneck: this.economy.bottleneck,
      expansionStep: this.expansion.currentStep,
      expansionsCompleted: this.expansion.completedCount,
      expansionPlanAvailable: this.expansion.planAvailable,
      infrastructureStep: this.infrastructure.currentStep,
      upgradeStep: this.upgrades.currentStep,
      tradeStep: this.trades.currentStep,
      activeBuild: this.builds.activeStructure?.stats.id ?? null,
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
    this.infrastructure.reset();
    this.production.reset();
    // The upgrade *system* is shared with the player and reset by the match, not
    // by one kingdom's AI; only this executor's own view of it resets here.
    this.upgrades.reset();
    // Like the upgrade system, the market itself is shared with the player and
    // reset by the match; only this executor's own view of it resets here.
    this.trades.reset();
    this.log.clear();
  }

  /**
   * §32: the age plan closes only once the transition has *completed*. A started
   * upgrade is left running rather than reported as success: the age is what the
   * plan is for, and freeing the director at the moment the resources were spent
   * would let it re-plan into an economy it just emptied.
   */
  private runAgeUp(blackboard: AiBlackboard): void {
    const outcome = this.age.update(blackboard);
    const plan = this.director.currentPlan;
    if (!plan || plan.intent !== "ageUp") return;
    if (outcome.kind === "done") this.director.completePlan(plan, this.now, true);
    else if (outcome.kind === "failed") this.director.completePlan(plan, this.now, false, outcome.reason);
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
      expansionPlanAvailable: this.expansion.planAvailable,
    });
    return this.lastBlackboard;
  }
}
