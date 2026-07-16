/**
 * Army Manager — `07_ENEMY_AI_DESIGN_v0.2.md` §15, §51, §54, §60–§67; plan §38.
 *
 * Runs the AI's single field army (§51: no second raid/siege army in AI-1). It
 * translates the director's intent into one mission, then issues the *same*
 * unit orders a human player's right-click produces — {@link Unit.setMovePath}
 * and {@link Unit.setAttackTarget} — so unit AI, combat and pathing behave
 * identically for both sides (§4, §16).
 *
 * This is the "Birim AI komut yürütmesini bağla" seam: the manager decides
 * *what* the army does; the existing movement/combat systems decide *how*.
 *
 * The world→candidate projection lives here; the §60 scoring formula it feeds
 * is pure and sits in {@link armyTargeting}.
 */
import { Vector3 } from "three";

import type { AiBalance, BuildingBalanceStats } from "../../data/gameDataTypes";
import type { CombatTarget } from "../combat/combatTarget";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { Unit, UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import { issueAttackOrder } from "../units/attackPathing";
import { armyPower, type AiBlackboard } from "./aiBlackboard";
import type { AiDecisionLog } from "./aiDecisionLog";
import {
  bestTarget,
  AI_HIGH_VALUE_TARGET_SCORE,
  type AiTargetCandidate,
  type AiTargetKind,
  type AiTargetScore,
} from "./armyTargeting";
import type { AiArmyMission, AiIntent } from "./aiTypes";

/** §65: retreat rallies to the friendly centre in AI-1 (no outposts to fall back to). */
const REGROUP_OFFSET = 10;
/** Re-issuing an identical order every tick would cancel movement; only move if drifted. */
const ORDER_TOLERANCE = 2.5;
/** §60 DefenseStrength: guards this close to a target are defending it. */
const TARGET_DEFENSE_RADIUS = 16;

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
}

export class ArmyManager {
  private mission: AiArmyMission | null = null;
  private target: CombatTarget | null = null;
  private targetScore: AiTargetScore | null = null;
  private retreatReason: AiRetreatReason | null = null;

  constructor(
    private readonly owner: UnitOwner,
    private readonly units: UnitSystem,
    private readonly centers: CommandCenterSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly navigation: RtsNavigation,
    private readonly balance: AiBalance,
    private readonly log: AiDecisionLog,
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
    };
  }

  /** One army evaluation (§78 cadence), driven by the director's intent. */
  update(blackboard: AiBlackboard, intent: AiIntent | null): void {
    const army = this.fieldArmy();
    if (army.length === 0) {
      this.setMission(null, blackboard, "ordu yok");
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

    const ratio = this.powerRatio(blackboard);
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
    if (armyPower(army, this.balance) - this.balance.army.minimumDefensePower <= 0) {
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

  /** §60: project the visible enemy into candidates, then take the best. */
  private chooseTarget(army: readonly Unit[], ratio: number): AiTargetScore | null {
    const opponent = this.opponent;
    const origin = centroid(army);
    // §60 DefenseStrength counts every defender. Filtering to Guards would let
    // an Archer-screened target score as undefended and invite the army into it.
    const enemyGuards = this.units.armyOf(opponent).filter((unit) => !unit.dying);
    const candidates: AiTargetCandidate[] = [];
    const targets = new Map<string, CombatTarget>();

    const center = this.centers.get(opponent);
    if (center && !center.health.depleted) {
      const id = `center:${opponent}`;
      candidates.push(this.candidate(id, "center", center.position.x, center.position.z,
        center.health.ratio, origin, enemyGuards));
      targets.set(id, center);
    }
    for (const structure of this.structures.ownedBy(opponent)) {
      // §60 scores standing assets; a site with nothing in it yet is not one.
      if (!structure.construction.complete || structure.health.depleted) continue;
      const id = `structure:${structure.id}`;
      candidates.push(this.candidate(id, targetKindFor(structure.stats), structure.x, structure.z,
        structure.health.ratio, origin, enemyGuards));
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
  ): AiTargetCandidate {
    const defensePower = armyPower(
      enemyGuards.filter((guard) =>
        Math.hypot(guard.position.x - x, guard.position.z - z) <= TARGET_DEFENSE_RADIUS),
      this.balance,
    );
    return {
      id,
      kind,
      x,
      z,
      healthRatio,
      defensePower,
      distance: Math.hypot(origin.x - x, origin.z - z),
    };
  }

  private executeMission(mission: AiArmyMission, army: readonly Unit[]): void {
    switch (mission) {
      case "assaultTarget":
      case "harassEconomy": return this.assault(army);
      case "defendBase": return this.defendBase(army);
      case "regroup":
      default: return this.regroup(army);
    }
  }

  /** §60: strike the chosen target; §54 keeps the garrison home while we do. */
  private assault(army: readonly Unit[]): void {
    const target = this.target;
    if (!target || target.health.depleted) return;
    const garrison = new Set(this.garrison(army));
    for (const unit of army) {
      if (garrison.has(unit)) {
        this.moveToRally(unit);
        continue;
      }
      // Prefer a live defender in reach, else keep hitting the target (§64).
      const defender = this.nearestEnemyUnit(unit, this.opponent);
      issueAttackOrder(unit, defender ?? target, this.navigation);
    }
  }

  private defendBase(army: readonly Unit[]): void {
    for (const unit of army) {
      const attacker = this.nearestEnemyUnit(unit, this.opponent);
      if (attacker) {
        issueAttackOrder(unit, attacker, this.navigation);
        continue;
      }
      this.moveToRally(unit);
    }
  }

  /** §66: hold near the centre, absorbing newly trained units, awaiting orders. */
  private regroup(army: readonly Unit[]): void {
    for (const unit of army) {
      // §65: a retreating army does not chase whatever followed it home.
      if (unit.attackTarget) unit.setAttackTarget(null);
      this.moveToRally(unit);
    }
  }

  /**
   * §54: the units held back to defend the base — the ones already nearest to
   * it, taken until they cover `minimumDefensePower`. §54 explicitly allows this
   * "keep a few units around the centre" form instead of a separate group.
   */
  private garrison(army: readonly Unit[]): readonly Unit[] {
    const minimum = this.balance.army.minimumDefensePower;
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
    const center = this.centers.get(this.owner);
    if (!center) return;
    const enemyCenter = this.centers.get(this.opponent);
    // Rally on the threatened side of the base rather than a fixed corner.
    const towardX = enemyCenter ? Math.sign(enemyCenter.position.x - center.position.x) : 0;
    const towardZ = enemyCenter ? Math.sign(enemyCenter.position.z - center.position.z) : 1;
    const rallyX = center.position.x + towardX * REGROUP_OFFSET;
    const rallyZ = center.position.z + towardZ * REGROUP_OFFSET;
    if (Math.hypot(unit.position.x - rallyX, unit.position.z - rallyZ) <= ORDER_TOLERANCE) {
      // Already holding the rally point; re-pathing here would jitter the unit.
      return;
    }
    if (unit.pathWaypointCount > 0) return;
    const path = this.navigation.plan(unit.position, new Vector3(rallyX, 0, rallyZ));
    if (path) unit.setMovePath(path);
  }

  private nearestEnemyUnit(unit: Unit, opponent: UnitOwner): Unit | null {
    let best: Unit | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of this.units.unitsOf(opponent)) {
      if (candidate.dying) continue;
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

  private powerRatio(blackboard: AiBlackboard): number {
    return blackboard.ownArmyPower / Math.max(0.5, blackboard.knownEnemyArmyPower);
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
    // An army that regroups because it was never sent out did not retreat; only
    // the two §65 triggers may claim a reason, or the panel would explain a
    // stand-down that never happened.
    this.retreatReason = null;
    return mission;
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
    if (!mission) return;
    this.log.record({ at: blackboard.now, kind: "army-mission", mission, reason });
  }

  private missionReason(mission: AiArmyMission, blackboard: AiBlackboard): string {
    switch (mission) {
      case "defendBase": return `üs tehdit altında (${blackboard.baseThreat.toFixed(1)})`;
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

/** §60's classes, read off the same data the rest of the game keys on. */
function targetKindFor(stats: BuildingBalanceStats): AiTargetKind {
  if (stats.economy) return "economy";
  if (stats.territory) return "outpost";
  if (stats.id === "depot") return "depot";
  if (stats.id === "barracks") return "military";
  return "support";
}

function meanHealth(army: readonly Unit[]): number {
  if (army.length === 0) return 1;
  return army.reduce((total, unit) => total + unit.health.ratio, 0) / army.length;
}

function centroid(army: readonly Unit[]): { x: number; z: number } {
  if (army.length === 0) return { x: 0, z: 0 };
  let x = 0;
  let z = 0;
  for (const unit of army) {
    x += unit.position.x;
    z += unit.position.z;
  }
  return { x: x / army.length, z: z / army.length };
}
