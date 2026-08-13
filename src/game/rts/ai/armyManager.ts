/**
 * Army Manager — `07_ENEMY_AI_DESIGN_v0.2.md` §15, §51, §54, §60–§67; plan §38;
 * Askerî AI v2 planı §2, §9, §10, §11.4, §12, §13.
 *
 * Runs the AI's single field army (§51: no second raid/siege army in AI-1). It
 * translates the director's intent into one mission, then issues the *same*
 * unit orders a human player's right-click produces — {@link Unit.setMovePath}
 * and {@link Unit.setAttackTarget} — so unit AI, combat and pathing behave
 * identically for both sides (§4, §16).
 *
 * Askerî AI v2 §2 is the seam that turned this from a swarm into an army: away
 * from contact the manager no longer walks units one at a time, it calls the
 * *player's own* {@link assignGroupDestinations} with a formation id. There is
 * no parallel AI placement code, and there is exactly one rule about when it
 * applies:
 *
 *   | phase                          | order source                    |
 *   | ------------------------------ | ------------------------------- |
 *   | march / approach / deploy      | group order (formation slots)   |
 *   | engage                         | per-unit targeting (unchanged)  |
 *   | reposition, regroup            | group order (`loose`)           |
 *
 * Formation governs everything *before* contact and nothing during it (§15), so
 * no soldier is ever tied to a slot by an invisible rubber band while fighting.
 *
 * This is the "Birim AI komut yürütmesini bağla" seam: the manager decides
 * *what* the army does; the existing movement/combat systems decide *how*.
 *
 * The world→candidate projection lives here; the §60 scoring formula it feeds
 * is pure and sits in {@link armyTargeting}, and the §7 formation formula is
 * pure and sits in {@link formationScorer}.
 */
import { Vector3 } from "three";

import type { AiBalance, BuildingBalanceStats, SettlementAge } from "../../data/gameDataTypes";
import type { CombatTarget } from "../combat/combatTarget";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { PlacedStructure, PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { Unit, UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import { issueAttackOrder } from "../units/attackPathing";
import { assignGroupDestinations } from "../units/groupOrders";
import { DEFAULT_RTS_FORMATION, type RtsFormationId } from "../units/formations/rtsFormationTypes";
import { armyPower, minimumDefensePowerFor, roleCounts, type AiBlackboard, type AiRoleCounts } from "./aiBlackboard";
import type { AiDecisionLog } from "./aiDecisionLog";
import type { AiVisionFilter } from "./aiVisionFilter";
import { commandCenterMemoryId } from "../vision/enemyMemorySystem";
import { structureRoleFor } from "../structures/structureRole";
import {
  betterFormation,
  enemyCompositionClass,
  scoreFormations,
  type AiEnemyCompositionClass,
  type AiFormationScore,
} from "./formationScorer";
import {
  bestTarget,
  logisticsDamage,
  AI_HIGH_VALUE_TARGET_SCORE,
  type AiTargetCandidate,
  type AiTargetKind,
  type AiTargetLogistics,
  type AiTargetScore,
} from "./armyTargeting";
import type { AiArmyMission, AiIntent, AiTacticalPhase } from "./aiTypes";

/** §65: retreat rallies to the friendly centre in AI-1 (no outposts to fall back to). */
const REGROUP_OFFSET = 10;
/** Re-issuing an identical order every tick would cancel movement; only move if drifted. */
const ORDER_TOLERANCE = 2.5;
/** §60 DefenseStrength: guards this close to a target are defending it. */
const TARGET_DEFENSE_RADIUS = 16;

/**
 * §2's performance rule, in world units: a target that moved less than this does
 * not re-open the slot assignment.
 *
 * Slot assignment is O(units × slots) plus one `navigation.plan` per unit and
 * the army is evaluated every 0.75s (`evaluation.armySeconds`), so re-assigning
 * per evaluation is exactly the cost the plan warns about. Slots are re-cut only
 * on a formation change, a phase change, a change in army size, or a cohesion
 * collapse — this quantises the fourth input, the destination itself.
 */
const SLOT_TARGET_STEP = 6;

/**
 * §12: how long a low-cohesion army waits before its slots are re-cut.
 *
 * Cohesion is measured over units that have *stopped*, so a normal march never
 * trips it. This is the floor under the pathological case — a squad grinding
 * against a corridor re-plans a few times a minute, not every evaluation.
 */
const COHESION_REASSIGN_SECONDS = 4;

/**
 * §14: how open the ground is, 0..1, until the nav-derived value is measured.
 *
 * Deliberately a constant and deliberately named. The plan defers terrain
 * awareness because the cost of deriving `availableWidth`/`obstacleDensity` has
 * not been measured and the repo's own frame-cost findings say navigation
 * queries are exactly where a cheap-looking read turns out expensive. The
 * scorer's *shape* already takes the term; when the real value arrives only this
 * line changes.
 */
const ASSUMED_TERRAIN_WIDTH = 0.8;

/** §82: the retreat triggers, in the words the panel and the log use. */
export const RETREAT_REASON_TEXT: Readonly<Record<AiRetreatReason, string>> = {
  outmatched: "güç oranı düştü",
  attrition: "ordu yıprandı",
};

/**
 * §65: why the army broke off. The two triggers are independent and mean
 * different things — `outmatched` is losing the exchange, `attrition` is being
 * ground down by a target that cannot be finished — so the §82 panel names which
 * one fired rather than showing an unexplained "regroup".
 */
export type AiRetreatReason = "outmatched" | "attrition";

/**
 * Askerî AI v2 planı §11.3: the read-only logistics view the target score needs.
 *
 * Deliberately one narrow question rather than the systems themselves. §11 is
 * explicit that no new system is written — `ProductionLogisticsSystem` already
 * knows which producers ship through which depot — so this is the seam that lets
 * the army *ask* without being handed the ability to mutate an economy, and
 * without the army manager growing a second world source.
 *
 * Null whenever the caller has no logistics view (every headless targeting
 * harness), and the score then falls back to the pre-§11 class value.
 */
export interface AiLogisticsWatch {
  /** Structure ids whose output is routed through `structureId`. */
  readonly producersServedBy: (structureId: number) => readonly number[];
}

/**
 * What the army needs to know about the §58 regional victory to answer it.
 *
 * A narrow read-only view rather than the objective systems themselves: the army
 * manager must not be able to *move* the counter, and — because §58 is behind
 * the `regionalVictory` flag — the whole feature has to be absent, not merely
 * inert, when it is off. A null provider is that absence (plan §13: "a disabled
 * flag must cost nothing at runtime").
 */
export interface AiObjectiveWatch {
  /**
   * True when the opponent's counter is close enough to completing that not
   * answering it loses the match. Below this bar the army keeps playing its
   * normal §60 game — an AI that abandoned every attack the moment an enemy
   * touched a pass would be trivially baited off its own offensive.
   */
  readonly urgent: boolean;
  /** Objectives the opponent currently holds; empty means nothing to contest. */
  readonly contestable: readonly { readonly id: string; readonly name: string; readonly x: number; readonly z: number }[];
}

export interface ArmyManagerState {
  readonly mission: AiArmyMission | null;
  readonly unitCount: number;
  readonly power: number;
  /** §54: units held at the base rather than sent out. */
  readonly garrisonCount: number;
  /** §60: what the army is currently going after, for the §82 panel. */
  readonly target: AiTargetScore | null;
  /** §65: set while the army is regrouping from a retreat, else null. */
  readonly retreatReason: AiRetreatReason | null;
  /** §9: the tactical sub-state, or null under a mission that has none. */
  readonly phase: AiTacticalPhase | null;
  /** §7: the formation the army is holding, or null before its first choice. */
  readonly formation: RtsFormationId | null;
  /** §16: every formation's score at the last choice, best first. */
  readonly formationScores: readonly AiFormationScore[];
  /** §7: why the held formation won, for the §82 panel. */
  readonly formationReason: string | null;
  /** §8: what the seen enemy army reduces to. */
  readonly enemyClass: AiEnemyCompositionClass;
  /** §12: share of the field army standing on (or walking to) its slot. */
  readonly cohesion: number;
}

export class ArmyManager {
  private mission: AiArmyMission | null = null;
  private target: CombatTarget | null = null;
  private targetScore: AiTargetScore | null = null;
  private retreatReason: AiRetreatReason | null = null;
  /** §58: the objective the contest mission is marching on, else null. */
  private contestPoint: AiObjectiveWatch["contestable"][number] | null = null;
  /** §9: null under every mission that has no tactical phase. */
  private phase: AiTacticalPhase | null = null;
  private formation: RtsFormationId | null = null;
  /** The phase the current formation was chosen for; a new phase reopens the choice. */
  private formationPhase: AiTacticalPhase | null = null;
  private formationChosenAt = 0;
  private formationScores: readonly AiFormationScore[] = [];
  private formationReason: string | null = null;
  private enemyClass: AiEnemyCompositionClass = "balanced";
  /** §12: the slot each unit was last given, by unit id. */
  private readonly slots = new Map<number, Vector3>();
  /** §2: the inputs the current slot assignment was cut for. */
  private slotSignature: string | null = null;
  private slotsAssignedAt = 0;
  private now = 0;
  /**
   * §54: the age as of the last army evaluation, because the garrison size is
   * age-scaled and {@link state} is read by the §82 panel outside a tick — there
   * is no blackboard to consult there, and reading the progression system
   * directly would give this manager a world source it otherwise does not have.
   */
  private age: SettlementAge = "settlement";

  constructor(
    private readonly owner: UnitOwner,
    private readonly units: UnitSystem,
    private readonly centers: CommandCenterSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly navigation: RtsNavigation,
    private readonly balance: AiBalance,
    private readonly log: AiDecisionLog,
    /**
     * §58 "AI Contest Objective davranışı". Null whenever the `regionalVictory`
     * flag is off, which is also the default: the parameter is optional so every
     * existing construction site — and every test written before Faz 11 — keeps
     * building an army manager that has never heard of objectives.
     */
    private readonly objectives: (() => AiObjectiveWatch | null) | null = null,
    /**
     * §59. Null whenever the `fogOfWar` flag is off — the same optional-parameter
     * shape as `objectives` above, so pre-Faz-11 construction sites and tests
     * keep building an army manager that sees the whole field.
     */
    private readonly vision: AiVisionFilter | null = null,
    /**
     * Askerî AI v2 §11.3. Null keeps the pre-§11 class-only target score, which
     * is what every harness without an economy gets.
     */
    private readonly logistics: AiLogisticsWatch | null = null,
  ) {}

  get currentMission(): AiArmyMission | null {
    return this.mission;
  }

  state(): ArmyManagerState {
    const army = this.fieldArmy();
    return {
      mission: this.mission,
      unitCount: army.length,
      power: armyPower(army, this.balance),
      garrisonCount: this.mission === "assaultTarget" || this.mission === "harassEconomy"
        ? this.garrison(army).length
        : 0,
      target: this.targetScore,
      retreatReason: this.mission === "regroup" ? this.retreatReason : null,
      phase: this.phase,
      formation: this.formation,
      formationScores: this.formationScores,
      formationReason: this.formationReason,
      enemyClass: this.enemyClass,
      cohesion: this.cohesion(army),
    };
  }

  /** One army evaluation (§78 cadence), driven by the director's intent. */
  update(blackboard: AiBlackboard, intent: AiIntent | null): void {
    this.age = blackboard.age;
    this.now = blackboard.now;
    const army = this.fieldArmy();
    if (army.length === 0) {
      this.setMission(null, blackboard, "ordu yok");
      this.clearTactics();
      return;
    }
    const next = this.chooseMission(blackboard, intent, army);
    this.setMission(next, blackboard, this.missionReason(next, blackboard));
    this.executeMission(next, army);
  }

  reset(): void {
    this.mission = null;
    this.target = null;
    this.targetScore = null;
    this.retreatReason = null;
    this.contestPoint = null;
    this.age = "settlement";
    this.clearTactics();
    this.formationScores = [];
    this.enemyClass = "balanced";
    this.now = 0;
  }

  /** §51: every live combat unit belongs to the one field army. */
  private fieldArmy(): Unit[] {
    return this.units.armyOf(this.owner).filter((unit) => !unit.dying);
  }

  private chooseMission(
    blackboard: AiBlackboard,
    intent: AiIntent | null,
    army: readonly Unit[],
  ): AiArmyMission {
    // §57 level 3 / §65: our own base outranks anything the director wanted.
    if (blackboard.baseThreat > 0) return this.withoutTarget("defendBase");
    if (intent === "defend") return this.withoutTarget("defendBase");

    // §58 "AI sayacı durdurmak için tepki veriyor", placed here on purpose:
    // *below* base defence, because a razed centre loses the match outright and
    // faster than any counter can; *above* the §60 attack logic, because that
    // logic scores buildings and a strategic point is not one — left to itself
    // the army would keep farming an outbuilding while the match was lost on a
    // pass it never walked to.
    //
    // Only when `urgent`. Contesting is not free (it pulls the field army across
    // the map), so it has to be the answer to actually losing, not a reflex.
    const contested = this.contestable(army);
    if (contested) {
      this.contestPoint = contested;
      this.target = null;
      this.targetScore = null;
      this.retreatReason = null;
      return "contestObjective";
    }

    const ratio = this.powerRatio(blackboard, army);
    if (this.attacking) {
      // §65: two independent retreat triggers — losing the exchange, and simply
      // being ground down. A power ratio alone misses an army that wiped the
      // defenders and is now dying to a centre it cannot finish.
      if (ratio < this.balance.army.retreatPowerRatio) return this.retreat("outmatched");
      if (meanHealth(army) < this.balance.army.retreatHealthRatio) return this.retreat("attrition");
    }
    if (intent !== "attack") return this.withoutTarget("regroup");

    // §54/§59: only what is left after the garrison may take the field, so an
    // army that is merely at the minimum never leaves the base undefended.
    if (armyPower(army, this.balance) - minimumDefensePowerFor(blackboard.age, this.balance) <= 0) {
      return this.withoutTarget("regroup");
    }

    const chosen = this.chooseTarget(army, ratio);
    if (!chosen) return this.withoutTarget("regroup");
    // §62: at full strength any target is fair; in the risky band (0.90–1.10)
    // only a genuinely valuable one is.
    const risky = ratio < this.balance.army.attackPowerRatio;
    if (risky && (ratio < this.balance.army.riskyAttackPowerRatio
      || chosen.score < AI_HIGH_VALUE_TARGET_SCORE)) {
      return this.withoutTarget("regroup");
    }
    this.targetScore = chosen;
    return chosen.candidate.kind === "center" ? "assaultTarget" : "harassEconomy";
  }

  /**
   * §58: the objective to march on, or null when there is no reason to.
   *
   * Nearest to the army's centroid, ties broken on id so §80's determinism
   * survives a symmetric map — and this map is deliberately symmetric, so the
   * tie is reachable rather than theoretical.
   */
  private contestable(army: readonly Unit[]): AiObjectiveWatch["contestable"][number] | null {
    const watch = this.objectives?.() ?? null;
    if (!watch?.urgent || watch.contestable.length === 0) return null;
    const origin = centroid(army);
    return [...watch.contestable].sort((a, b) =>
      Math.hypot(origin.x - a.x, origin.z - a.z) - Math.hypot(origin.x - b.x, origin.z - b.z)
      || a.id.localeCompare(b.id))[0] ?? null;
  }

  /**
   * §58: stand on the objective. Standing there *is* the mechanism —
   * {@link StrategicPointSystem} counts an opponent inside the radius as
   * contesting, which stalls the counter — so this issues no attack of its own
   * and simply walks the army onto the point. Anything defending it is then
   * engaged by the same rule the assault mission uses, because a defender in
   * reach is a defender in reach regardless of why we came.
   */
  private contest(army: readonly Unit[]): void {
    const point = this.contestPoint;
    if (!point) return;
    for (const unit of army) {
      const defender = this.nearestEnemyUnit(unit, this.opponent);
      if (defender && defender.position.distanceTo(unit.position) <= TARGET_DEFENSE_RADIUS) {
        issueAttackOrder(unit, defender, this.navigation);
        continue;
      }
      this.moveTo(unit, point.x, point.z);
    }
  }

  /** §60: project the visible enemy into candidates, then take the best. */
  private chooseTarget(army: readonly Unit[], ratio: number): AiTargetScore | null {
    const opponent = this.opponent;
    const origin = centroid(army);
    // §60 DefenseStrength counts every defender. Filtering to Guards would let
    // an Archer-screened target score as undefended and invite the army into it.
    const enemyGuards = this.visibleEnemyUnits();
    const candidates: AiTargetCandidate[] = [];
    const targets = new Map<string, CombatTarget>();

    // §59: under fog the AI may only score what it *remembers* seeing. It still
    // needs the live object to attack, so memory gates the candidate list while
    // the live systems supply the CombatTarget. A remembered building that has
    // since been razed simply yields no live target — the army marches there,
    // finds nothing, and re-scores, which is the honest outcome.
    const remembered = this.vision
      ? new Set(this.vision.knownEnemyStructures().map((known) => known.structureId))
      : null;

    const center = this.centers.get(opponent);
    if (center && !center.health.depleted
      && (!remembered || remembered.has(commandCenterMemoryId(opponent)))) {
      const id = `center:${opponent}`;
      candidates.push(this.candidate(id, "center", center.position.x, center.position.z,
        center.health.ratio, origin, enemyGuards, null, remembered));
      targets.set(id, center);
    }
    for (const structure of this.structures.ownedBy(opponent)) {
      // §60 scores standing assets; a site with nothing in it yet is not one.
      if (!structure.construction.complete || structure.health.depleted) continue;
      if (remembered && !remembered.has(structure.id)) continue;
      const id = `structure:${structure.id}`;
      candidates.push(this.candidate(id, targetKindFor(structure.stats), structure.x, structure.z,
        structure.health.ratio, origin, enemyGuards, structure, remembered));
      targets.set(id, structure);
    }

    const chosen = bestTarget(candidates, this.balance.army.targetWeights, {
      dominance: this.dominance(ratio),
    });
    if (!chosen) return null;
    this.target = targets.get(chosen.candidate.id) ?? null;
    return this.target ? chosen : null;
  }

  private candidate(
    id: string,
    kind: AiTargetKind,
    x: number,
    z: number,
    healthRatio: number,
    origin: { x: number; z: number },
    enemyGuards: readonly Unit[],
    structure: PlacedStructure | null,
    remembered: ReadonlySet<number> | null,
  ): AiTargetCandidate {
    const defensePower = armyPower(
      enemyGuards.filter((guard) =>
        Math.hypot(guard.position.x - x, guard.position.z - z) <= TARGET_DEFENSE_RADIUS),
      this.balance,
    );
    const logistics = this.logisticsFor(structure, remembered);
    return {
      id,
      kind,
      x,
      z,
      healthRatio,
      defensePower,
      distance: Math.hypot(origin.x - x, origin.z - z),
      ...(logistics ? { logistics } : {}),
    };
  }

  /**
   * §11.3: what this structure's fall would cut, read off the live systems.
   *
   * §17.2 is the constraint that shapes it: the producer list is intersected
   * with the remembered set, so a depot the AI has scouted never leaks the
   * existence of the three farms behind it that it has not. Territory radius is
   * read off the target's own balance row — seeing the Karakol *is* seeing that
   * it holds ground, so nothing extra is revealed.
   */
  private logisticsFor(
    structure: PlacedStructure | null,
    remembered: ReadonlySet<number> | null,
  ): AiTargetLogistics | undefined {
    if (!structure) return undefined;
    const served = this.logistics?.producersServedBy(structure.id) ?? [];
    const seenServed = remembered ? served.filter((id) => remembered.has(id)) : served;
    const territoryRadius = structure.stats.territory?.controlRadius ?? 0;
    if (seenServed.length === 0 && territoryRadius === 0) return undefined;
    return { servedProducers: seenServed.length, territoryRadius };
  }

  private executeMission(mission: AiArmyMission, army: readonly Unit[]): void {
    switch (mission) {
      case "assaultTarget":
      case "harassEconomy": return this.assault(army);
      case "contestObjective": return this.contest(army);
      case "defendBase": return this.defendBase(army);
      case "regroup":
      default: return this.regroup(army);
    }
  }

  /**
   * §60: strike the chosen target; §54 keeps the garrison home while we do.
   *
   * Askerî AI v2 §2/§9: everything before contact is one group order in a chosen
   * formation, and contact hands the army straight back to the per-unit combat
   * code that has always run it.
   */
  private assault(army: readonly Unit[]): void {
    const target = this.target;
    const score = this.targetScore;
    if (!target || target.health.depleted || !score) return;
    const garrison = new Set(this.garrison(army));
    for (const unit of army) {
      if (garrison.has(unit)) this.moveToRally(unit);
    }
    const field = army.filter((unit) => !garrison.has(unit));
    if (field.length === 0) {
      this.clearTactics();
      return;
    }

    const point = new Vector3(score.candidate.x, 0, score.candidate.z);
    const phase = this.tacticalPhase(field, point);
    const formation = this.chooseFormation(field, phase);
    this.phase = phase;
    if (phase === "engage") {
      // §15: no formation order in contact. Slots are dropped so the cohesion
      // reading cannot claim an army mid-melee is "out of position".
      this.slots.clear();
      this.slotSignature = null;
      this.engage(field, target);
      return;
    }
    this.manoeuvre(field, point, formation, phase);
  }

  /**
   * §9: which tactical phase an attacking mission is in.
   *
   * Distance to the target decides the manoeuvre phases; a *seen* enemy inside
   * the engage ring decides contact. `reposition` is the one sticky state: it is
   * held until the army is back inside the deploy ring, because releasing it the
   * moment it fires would flip straight back into `engage` on the same runner
   * that pulled the army off its mission (§10.4).
   */
  private tacticalPhase(field: readonly Unit[], point: Vector3): AiTacticalPhase {
    const { approachDistance, deployDistance, engageDistance, pursuitLeash } = this.balance.army.tactics;
    const origin = centroid(field);
    const targetDistance = Math.hypot(origin.x - point.x, origin.z - point.z);
    const enemyDistance = this.nearestVisibleEnemyDistance(origin);

    // §10.4: the army-scale leash. `attack.chaseRange` already stops one soldier
    // chasing a bait; nothing stopped the *army* being walked off its own
    // mission by that soldier's friends.
    if (this.phase === "reposition" && targetDistance > deployDistance) return "reposition";
    if (targetDistance > pursuitLeash && enemyDistance <= engageDistance) return "reposition";

    // Contact is either kind: a defender inside the engage ring, or the target
    // itself under our nose. Without the second clause an army that marched onto
    // an undefended farm would stand in a tidy line and never hit it.
    if (enemyDistance <= engageDistance || targetDistance <= engageDistance) return "engage";
    if (targetDistance <= deployDistance) return "deploy";
    if (targetDistance <= approachDistance || enemyDistance <= approachDistance) return "approach";
    return "march";
  }

  /**
   * §7: score every formation and hold the winner.
   *
   * Hysteresis is the director's, not a third mechanism: a challenger has to
   * beat the incumbent by `evaluation.hysteresisMargin`, and the incumbent is
   * held for `evaluation.minimumCommitmentSeconds`. That commitment is scoped to
   * the phase — a column that has just reached the deploy ring must be allowed
   * to become a line immediately, or the single most readable thing the army
   * does would be delayed by a timer meant for strategy.
   */
  private chooseFormation(field: readonly Unit[], phase: AiTacticalPhase): RtsFormationId {
    this.enemyClass = this.seenEnemyClass();
    const context = {
      phase,
      mission: this.mission ?? "assaultTarget",
      enemyClass: this.enemyClass,
      friendly: roleCounts(field),
      terrainWidth: ASSUMED_TERRAIN_WIDTH,
      cohesion: this.cohesion(field),
      current: this.formation,
      unitCount: field.length,
    } as const;
    const weights = this.balance.army.formationWeights;
    this.formationScores = scoreFormations(context, weights);

    const committed = this.formation !== null
      && this.formationPhase === phase
      && this.now - this.formationChosenAt < this.balance.evaluation.minimumCommitmentSeconds;
    if (committed && this.formationScores.some((entry) => entry.formation === this.formation)) {
      return this.formation ?? DEFAULT_RTS_FORMATION;
    }

    const chosen = betterFormation(context, weights, this.balance.evaluation.hysteresisMargin);
    if (!chosen) return this.formation ?? DEFAULT_RTS_FORMATION;
    if (chosen.formation !== this.formation) {
      this.formationChosenAt = this.now;
      this.log.record({
        at: this.now,
        kind: "army-formation",
        reason: `${chosen.formation} (${phase}): ${chosen.reason}`,
      });
    }
    this.formation = chosen.formation;
    this.formationPhase = phase;
    this.formationReason = chosen.reason;
    return chosen.formation;
  }

  /**
   * §2: one group order, through the player's own placement path.
   *
   * The whole point of the seam is the call below — `assignGroupDestinations` is
   * what a human right-click runs, and the AI passes through it rather than
   * owning a parallel copy. The guard in front of it is §2's performance rule:
   * slots are re-cut only when a formation, phase, army size or destination
   * actually changed, or when cohesion has collapsed for long enough to matter.
   */
  private manoeuvre(
    field: readonly Unit[],
    point: Vector3,
    formation: RtsFormationId,
    phase: AiTacticalPhase,
  ): void {
    const signature = `${phase}:${formation}:${field.length}`
      + `:${Math.round(point.x / SLOT_TARGET_STEP)}:${Math.round(point.z / SLOT_TARGET_STEP)}`;
    const shaken = this.cohesion(field) < this.balance.army.tactics.cohesionThreshold
      && this.now - this.slotsAssignedAt >= COHESION_REASSIGN_SECONDS;
    if (signature === this.slotSignature && !shaken) return;

    this.slotSignature = signature;
    this.slotsAssignedAt = this.now;
    this.slots.clear();
    for (const entry of assignGroupDestinations(field, point, this.navigation, [], formation)) {
      this.slots.set(entry.unit.id, new Vector3(entry.destination.x, 0, entry.destination.z));
      // A unit marching to a slot is not fighting: a stale attack target would
      // have it break formation to walk back at whatever it last acquired.
      if (entry.unit.attackTarget) entry.unit.setAttackTarget(null);
      if (entry.path) entry.unit.setMovePath(entry.path);
    }
  }

  /**
   * §15: contact. Per-unit targeting, exactly as before §2 — plus the two role
   * doctrines that only make sense once the army has a shape (§10.1, §10.2).
   */
  private engage(field: readonly Unit[], target: CombatTarget): void {
    const enemies = this.visibleEnemyUnits();
    const pulledBack = this.archerStandoff(field, enemies);
    for (const unit of field) {
      // §10.2: an Archer walking its support line back is already under orders.
      if (pulledBack.has(unit)) continue;
      // §10.1: a Guard's job is to screen, so it answers what is reaching for
      // the guns and the bows before it answers what is in front of its own face.
      const screened = this.screenTarget(unit, field, enemies);
      const defender = screened ?? this.nearestEnemyUnit(unit, this.opponent);
      // Prefer a live defender in reach, else keep hitting the target (§64).
      issueAttackOrder(unit, defender ?? target, this.navigation);
    }
  }

  /**
   * §10.1: the enemy this Guard should be screening, or null.
   *
   * Priority is "whoever is reaching for something fragile", nearest first:
   * threat to a Topçu, then threat to an Okçu, then — via the caller — whatever
   * is nearest. Ties break on unit id (§17.3).
   */
  private screenTarget(
    unit: Unit,
    field: readonly Unit[],
    enemies: readonly Unit[],
  ): Unit | null {
    if (unit.role !== "guard" || enemies.length === 0) return null;
    const reach = this.balance.army.tactics.engageDistance;
    const nearestThreatTo = (protectees: readonly Unit[]): Unit | null => {
      if (protectees.length === 0) return null;
      let best: Unit | null = null;
      let bestGap = Number.POSITIVE_INFINITY;
      for (const enemy of enemies) {
        let gap = Number.POSITIVE_INFINITY;
        for (const protectee of protectees) {
          gap = Math.min(gap, enemy.position.distanceTo(protectee.position));
        }
        if (gap > reach) continue;
        if (gap > bestGap || (gap === bestGap && best !== null && enemy.id >= best.id)) continue;
        best = enemy;
        bestGap = gap;
      }
      return best;
    };
    return nearestThreatTo(field.filter((member) => member.role === "siege"))
      ?? nearestThreatTo(field.filter((member) => member.role === "archer"));
  }

  /**
   * §10.2: hold the support line's distance.
   *
   * The important word is *line*. Every Archer running from its own attacker
   * individually is how a support line dissolves into a rout, so when the line
   * is pressed it is walked back **as a group**, through the same
   * {@link assignGroupDestinations} seam §2 opened. Returns the units now under
   * a move order, so the caller does not immediately hand them an attack order
   * that would cancel it.
   *
   * The overkill limiter §10.2 also mentions is not here, and deliberately:
   * instant hits are never reserved anywhere (`PendingImpactQueue` holds only
   * projectiles in flight), so "expected incoming damage" cannot be computed
   * without a wider change than this phase owns (plan §19).
   */
  private archerStandoff(field: readonly Unit[], enemies: readonly Unit[]): Set<Unit> {
    const archers = field.filter((unit) => unit.role === "archer");
    if (archers.length < 2 || enemies.length === 0) return new Set();
    const standoff = this.balance.army.tactics.archerStandoff;
    const nearestEnemyGap = (unit: Unit): number => Math.min(
      ...enemies.map((enemy) => enemy.position.distanceTo(unit.position)),
    );
    const pressed = archers.filter((archer) => nearestEnemyGap(archer) < standoff);
    if (pressed.length === 0) return new Set();
    // Already walking back; re-issuing every evaluation is what would turn the
    // withdrawal into a stutter.
    if (archers.every((archer) => archer.pathWaypointCount > 0)) return new Set(archers);

    const line = centroid(archers);
    const threat = centroid(pressed.flatMap((archer) => enemies
      .filter((enemy) => enemy.position.distanceTo(archer.position) < standoff)));
    const awayX = line.x - threat.x;
    const awayZ = line.z - threat.z;
    const length = Math.hypot(awayX, awayZ);
    // A threat standing exactly on the line has no direction to give; falling
    // back on +z keeps the order deterministic instead of NaN.
    const stepX = length > 0.001 ? (awayX / length) * standoff : 0;
    const stepZ = length > 0.001 ? (awayZ / length) * standoff : standoff;
    const point = new Vector3(line.x + stepX, 0, line.z + stepZ);
    const moved = new Set<Unit>();
    for (const entry of assignGroupDestinations(archers, point, this.navigation, [], "line")) {
      if (!entry.path) continue;
      entry.unit.setMovePath(entry.path);
      moved.add(entry.unit);
    }
    return moved;
  }

  /**
   * §57/§11.4: answer the attack, and answer it where losing hurts most.
   *
   * Anything already in reach is engaged; everyone else converges on the
   * threatened building whose fall would cost the most — which under §11 is no
   * longer "the nearest one" but "the Karakol that holds two mines and a road".
   */
  private defendBase(army: readonly Unit[]): void {
    const anchor = this.defenseAnchor();
    for (const unit of army) {
      const attacker = this.nearestEnemyUnit(unit, this.opponent);
      if (attacker) {
        issueAttackOrder(unit, attacker, this.navigation);
        continue;
      }
      // A building's own footprint is a nav blocker, so the anchor point itself
      // is unreachable; the rally is the fallback rather than leaving the unit
      // standing still because the place it should defend is solid.
      if (anchor && this.moveTo(unit, anchor.x, anchor.z)) continue;
      this.moveToRally(unit);
    }
  }

  /**
   * §11.4: of our own buildings currently under threat, the one worth holding.
   *
   * The same logistics reading the attack side uses, pointed inward — if the
   * player is pressing a Kışla and a Karakol at once and the Karakol's fall
   * takes two mines, a depot and a road corridor with it, the army defends the
   * Karakol. Null when nothing of ours is threatened.
   */
  private defenseAnchor(): { readonly x: number; readonly z: number } | null {
    const enemies = this.visibleEnemyUnits();
    if (enemies.length === 0) return null;
    let best: { x: number; z: number; value: number; id: number } | null = null;
    for (const structure of this.structures.ownedBy(this.owner)) {
      if (!structure.construction.complete || structure.health.depleted) continue;
      const threatened = enemies.some((enemy) =>
        Math.hypot(enemy.position.x - structure.x, enemy.position.z - structure.z) <= TARGET_DEFENSE_RADIUS);
      if (!threatened) continue;
      const value = logisticsDamage(this.logisticsFor(structure, null))
        + DEFENSE_KIND_VALUE[targetKindFor(structure.stats)];
      // §17.3: a value tie must not reorder between two identical runs.
      if (best && (value < best.value || (value === best.value && structure.id >= best.id))) continue;
      best = { x: structure.x, z: structure.z, value, id: structure.id };
    }
    return best;
  }

  /**
   * §66: hold near the centre, absorbing newly trained units, awaiting orders.
   *
   * §2's REGROUP row: one `loose` group order rather than N individual walks, so
   * an army that broke off arrives as a body instead of as a queue.
   */
  private regroup(army: readonly Unit[]): void {
    // §65: a retreating army does not chase whatever followed it home.
    for (const unit of army) {
      if (unit.attackTarget) unit.setAttackTarget(null);
    }
    this.phase = null;
    const rally = this.rallyPoint(army);
    if (!rally) return;
    const combat = army.filter((unit) => unit.role !== "worker");
    if (combat.length < 2) {
      for (const unit of army) this.moveTo(unit, rally.x, rally.z);
      return;
    }
    this.manoeuvre(combat, rally, "loose", "reposition");
  }

  /**
   * §54: the units held back to defend the base — the ones already nearest to
   * it, taken until they cover `minimumDefensePower`. §54 explicitly allows this
   * "keep a few units around the centre" form instead of a separate group.
   */
  private garrison(army: readonly Unit[]): readonly Unit[] {
    const minimum = minimumDefensePowerFor(this.age, this.balance);
    if (minimum <= 0) return [];
    const center = this.centers.get(this.owner);
    if (!center) return [];
    const byDistanceToBase = [...army].sort((a, b) =>
      a.position.distanceToSquared(center.position) - b.position.distanceToSquared(center.position)
      // §80: distance ties must not reorder between two identical runs.
      || a.id - b.id);
    const held: Unit[] = [];
    let power = 0;
    for (const unit of byDistanceToBase) {
      if (power >= minimum) break;
      held.push(unit);
      power += unit.health.ratio;
    }
    return held;
  }

  private moveToRally(unit: Unit): void {
    const rally = this.rallyPoint([unit]);
    if (rally) this.moveTo(unit, rally.x, rally.z);
  }

  /**
   * §11.4: where a broken-off army actually falls back to.
   *
   * The retreat *triggers* have always existed (§65); what was missing was the
   * destination, and "ten metres off the centre, on the enemy's side" is the one
   * place a beaten army should not be standing. The order the plan asks for:
   *
   *     nearby safe Karakol → Kışla ground → Merkez
   *
   * "Safe" means no enemy the AI can see is standing on it — falling back onto
   * the outpost that is currently being stormed is not falling back.
   */
  private rallyPoint(army: readonly Unit[]): Vector3 | null {
    const origin = centroid(army);
    const enemies = this.visibleEnemyUnits();
    const safe = (x: number, z: number): boolean => !enemies.some((enemy) =>
      Math.hypot(enemy.position.x - x, enemy.position.z - z) <= TARGET_DEFENSE_RADIUS);
    const nearestOfKind = (kind: AiTargetKind): PlacedStructure | null => {
      let best: PlacedStructure | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const structure of this.structures.ownedBy(this.owner)) {
        if (!structure.construction.complete || structure.health.depleted) continue;
        if (targetKindFor(structure.stats) !== kind) continue;
        if (!safe(structure.x, structure.z)) continue;
        const distance = Math.hypot(origin.x - structure.x, origin.z - structure.z);
        // §17.3: distance ties break on id, never on iteration order.
        if (distance > bestDistance || (distance === bestDistance && best !== null && structure.id >= best.id)) continue;
        best = structure;
        bestDistance = distance;
      }
      return best;
    };
    const fallback = nearestOfKind("outpost") ?? nearestOfKind("military");
    if (fallback) return new Vector3(fallback.x, 0, fallback.z);

    const center = this.centers.get(this.owner);
    if (!center) return null;
    const enemyCenter = this.centers.get(this.opponent);
    // Rally on the threatened side of the base rather than a fixed corner.
    const towardX = enemyCenter ? Math.sign(enemyCenter.position.x - center.position.x) : 0;
    const towardZ = enemyCenter ? Math.sign(enemyCenter.position.z - center.position.z) : 1;
    return new Vector3(
      center.position.x + towardX * REGROUP_OFFSET,
      0,
      center.position.z + towardZ * REGROUP_OFFSET,
    );
  }

  /**
   * Walk a unit to a world position, leaving an already-moving unit alone.
   *
   * Returns false only when the destination could not be routed to at all, so a
   * caller with a second choice can take it. "Already there" and "already
   * walking" both count as handled.
   */
  private moveTo(unit: Unit, x: number, z: number): boolean {
    if (Math.hypot(unit.position.x - x, unit.position.z - z) <= ORDER_TOLERANCE) {
      // Already holding the spot; re-pathing here would jitter the unit.
      return true;
    }
    if (unit.pathWaypointCount > 0) return true;
    const path = this.navigation.plan(unit.position, new Vector3(x, 0, z));
    if (!path) return false;
    unit.setMovePath(path);
    return true;
  }

  /**
   * §59: every live enemy unit the kingdom can currently see.
   *
   * One read rather than three, because "what the AI may know" has to be
   * answered identically for DefenseStrength, for the §8 composition class and
   * for the screening doctrine — three copies of a fog filter is three chances
   * for one of them to quietly see through it.
   */
  private visibleEnemyUnits(): readonly Unit[] {
    return this.units.armyOf(this.opponent)
      .filter((unit) => !unit.dying)
      .filter((unit) => !this.vision || this.vision.canSee(unit.position.x, unit.position.z));
  }

  private seenEnemyCounts(): AiRoleCounts {
    return roleCounts(this.visibleEnemyUnits());
  }

  /**
   * §8: what the seen enemy reduces to.
   *
   * `fortified` is asked off the *target*, not the enemy army: a Karakol is the
   * game's fortification, and marching on one is a different problem from
   * meeting the same troops in the open.
   */
  private seenEnemyClass(): AiEnemyCompositionClass {
    return enemyCompositionClass(this.seenEnemyCounts(), {
      fortifiedTarget: this.targetScore?.candidate.kind === "outpost",
    });
  }

  private nearestVisibleEnemyDistance(origin: { x: number; z: number }): number {
    let best = Number.POSITIVE_INFINITY;
    for (const enemy of this.visibleEnemyUnits()) {
      best = Math.min(best, Math.hypot(origin.x - enemy.position.x, origin.z - enemy.position.z));
    }
    return best;
  }

  /**
   * §12: the share of the army standing on its assigned slot.
   *
   * A unit still walking its route counts as holding: cohesion is meant to catch
   * an army that has been *broken up* — jammed in a corridor, split by a rock,
   * scattered by a fight — not one that is simply mid-march. Without that, every
   * march would read as a collapse and re-cut its slots on every evaluation,
   * which is precisely the cost §2 forbids.
   */
  private cohesion(units: readonly Unit[]): number {
    if (this.slots.size === 0 || units.length === 0) return 1;
    const radius = this.balance.army.tactics.cohesionRadius;
    let held = 0;
    for (const unit of units) {
      const slot = this.slots.get(unit.id);
      if (!slot) continue;
      if (unit.pathWaypointCount > 0
        || Math.hypot(unit.position.x - slot.x, unit.position.z - slot.z) <= radius) {
        held += 1;
      }
    }
    return held / units.length;
  }

  private nearestEnemyUnit(unit: Unit, opponent: UnitOwner): Unit | null {
    let best: Unit | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of this.units.unitsOf(opponent)) {
      if (candidate.dying) continue;
      // §59: engaging a unit nobody in the kingdom can see would be the clearest
      // possible tell that the AI is reading the field directly.
      if (this.vision && !this.vision.canSee(candidate.position.x, candidate.position.z)) continue;
      const distance = unit.position.distanceToSquared(candidate.position);
      if (distance >= bestDistance) continue;
      best = candidate;
      bestDistance = distance;
    }
    return best;
  }

  private get opponent(): UnitOwner {
    return this.owner === "player" ? "enemy" : "player";
  }

  private get attacking(): boolean {
    return this.mission === "assaultTarget" || this.mission === "harassEconomy";
  }

  /**
   * §62's ratio, now §13-aware.
   *
   * The blackboard's own `ownArmyPower` stays the plain §52 sum — it answers
   * "how big is this army", which is what the economy and the population
   * ceiling need. Only *this* decision asks the harder question: how big is it
   * against the army it is actually looking at. Ten Guards against ten Archers
   * and ten Guards against ten Guards are not the same fight, and the thresholds
   * that read this number (`ai.json`, untouched) could never say so alone.
   */
  private powerRatio(blackboard: AiBlackboard, army: readonly Unit[]): number {
    return blackboard.ownArmyPower * this.matchupMultiplier(army)
      / Math.max(0.5, blackboard.knownEnemyArmyPower);
  }

  /**
   * §13: what the army's own composition is worth against the one it can see.
   *
   * Expressed as a multiplier on the blackboard's §52 power rather than as a
   * replacement for it, and that is deliberate: the blackboard number is the
   * kingdom's single answer to "how big is my army", read by the economy and the
   * population ceiling too, and two systems disagreeing about the size of the
   * same army is worse than either answer. This scales it for one decision. With
   * nothing seen the multiplier is exactly 1, so the pre-§13 ratio survives.
   */
  private matchupMultiplier(army: readonly Unit[]): number {
    const plain = armyPower(army, this.balance);
    if (plain <= 0) return 1;
    return armyPower(army, this.balance, this.seenEnemyCounts()) / plain;
  }

  /**
   * §69: 0 while the fight is still a fight, 1 once we are decisively winning.
   * Measured from the *attack* bar up to the dominance bar rather than from
   * zero, so merely being allowed to attack grants the enemy centre no victory
   * value — that is what keeps §60's "Merkez her zaman en iyi hedef olmamalıdır"
   * true instead of aspirational.
   */
  private dominance(ratio: number): number {
    const { attackPowerRatio, dominancePowerRatio } = this.balance.army;
    const band = Math.max(0.01, dominancePowerRatio - attackPowerRatio);
    return (ratio - attackPowerRatio) / band;
  }

  /** Missions that are not an attack must not leave a stale target behind. */
  private withoutTarget(mission: AiArmyMission): AiArmyMission {
    this.target = null;
    this.targetScore = null;
    // §58: likewise for the objective, or a mission that stopped contesting
    // would still report the pass it walked away from.
    this.contestPoint = null;
    // An army that regroups because it was never sent out did not retreat; only
    // the two §65 triggers may claim a reason, or the panel would explain a
    // stand-down that never happened.
    this.retreatReason = null;
    return mission;
  }

  /** §9: a mission without a tactical phase must not report the last one's. */
  private clearTactics(): void {
    this.phase = null;
    this.slots.clear();
    this.slotSignature = null;
  }

  /** §65: break off, and record which of the two triggers did it. */
  private retreat(reason: AiRetreatReason): AiArmyMission {
    const mission = this.withoutTarget("regroup");
    this.retreatReason = reason;
    return mission;
  }

  private setMission(mission: AiArmyMission | null, blackboard: AiBlackboard, reason: string): void {
    if (this.mission === mission) return;
    this.mission = mission;
    // A new mission is a new tactical situation; the phase and its slots belong
    // to the mission that ended.
    this.clearTactics();
    if (!mission) return;
    this.log.record({ at: blackboard.now, kind: "army-mission", mission, reason });
  }

  private missionReason(mission: AiArmyMission, blackboard: AiBlackboard): string {
    switch (mission) {
      case "defendBase": return `üs tehdit altında (${blackboard.baseThreat.toFixed(1)})`;
      case "contestObjective": return this.contestPoint
        ? `bölgesel zafer sayacı durduruluyor: ${this.contestPoint.name}`
        : "stratejik nokta tartışmaya açıldı";
      case "assaultTarget":
      case "harassEconomy": return this.targetScore
        ? `${this.targetScore.reason} (puan ${this.targetScore.score.toFixed(2)}, güç ${blackboard.ownArmyPower.toFixed(1)} vs ${blackboard.knownEnemyArmyPower.toFixed(1)})`
        : `güç oranı saldırıya uygun (${blackboard.ownArmyPower.toFixed(1)} vs ${blackboard.knownEnemyArmyPower.toFixed(1)})`;
      case "regroup": return this.retreatReason
        ? `geri çekilme: ${RETREAT_REASON_TEXT[this.retreatReason]}`
        : "ordu toplanıyor";
      default: return mission;
    }
  }
}

/**
 * §60's classes, read off the same data the rest of the game keys on — and now
 * off the same function a siege gun uses to choose between two walls (§10.3),
 * so the strategic and the tactical layer cannot disagree about what a building
 * is.
 */
function targetKindFor(stats: BuildingBalanceStats): AiTargetKind {
  return structureRoleFor(stats);
}

/**
 * §11.4: what each class is worth *to hold*, which is not what it is worth to
 * take. A Karakol is the region's claim and a depot is the economy's throat;
 * housing is replaceable, and defending it with the field army is how the
 * region is lost while the army stands in a village.
 */
const DEFENSE_KIND_VALUE: Readonly<Record<AiTargetKind, number>> = {
  outpost: 1,
  depot: 0.9,
  economy: 0.7,
  military: 0.6,
  center: 1.2,
  support: 0.2,
};

function meanHealth(army: readonly Unit[]): number {
  if (army.length === 0) return 1;
  return army.reduce((total, unit) => total + unit.health.ratio, 0) / army.length;
}

function centroid(army: readonly { readonly position: Vector3 }[]): { x: number; z: number } {
  if (army.length === 0) return { x: 0, z: 0 };
  let x = 0;
  let z = 0;
  for (const unit of army) {
    x += unit.position.x;
    z += unit.position.z;
  }
  return { x: x / army.length, z: z / army.length };
}
