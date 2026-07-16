/**
 * Army Manager — `07_ENEMY_AI_DESIGN_v0.2.md` §15, §51, §61–§65; plan §38.
 *
 * Runs the AI's single field army (§51: no second raid/siege army in AI-1). It
 * translates the director's intent into one mission, then issues the *same*
 * unit orders a human player's right-click produces — {@link Unit.setMovePath}
 * and {@link Unit.setAttackTarget} — so unit AI, combat and pathing behave
 * identically for both sides (§4, §16).
 *
 * This is the "Birim AI komut yürütmesini bağla" seam: the manager decides
 * *what* the army does; the existing movement/combat systems decide *how*.
 */
import { Vector3 } from "three";

import type { AiBalance } from "../../data/gameDataTypes";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { Unit, UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { AiBlackboard } from "./aiBlackboard";
import type { AiDecisionLog } from "./aiDecisionLog";
import type { AiArmyMission, AiIntent } from "./aiTypes";

/** §65: retreat rallies to the friendly centre in AI-1 (no outposts to fall back to). */
const REGROUP_OFFSET = 10;
/** Re-issuing an identical order every tick would cancel movement; only move if drifted. */
const ORDER_TOLERANCE = 2.5;

export interface ArmyManagerState {
  readonly mission: AiArmyMission | null;
  readonly unitCount: number;
  readonly power: number;
}

export class ArmyManager {
  private mission: AiArmyMission | null = null;

  constructor(
    private readonly owner: UnitOwner,
    private readonly units: UnitSystem,
    private readonly centers: CommandCenterSystem,
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
      power: army.reduce((total, unit) => total + unit.health.ratio, 0),
    };
  }

  /** One army evaluation (§78 cadence), driven by the director's intent. */
  update(blackboard: AiBlackboard, intent: AiIntent | null): void {
    const army = this.fieldArmy();
    if (army.length === 0) {
      this.setMission(null, blackboard, "ordu yok");
      return;
    }
    const next = this.chooseMission(blackboard, intent);
    this.setMission(next, blackboard, this.missionReason(next, blackboard));
    this.executeMission(next, army);
  }

  reset(): void {
    this.mission = null;
  }

  /** §51: every live guard belongs to the one field army. */
  private fieldArmy(): Unit[] {
    return this.units.unitsOf(this.owner).filter((unit) => unit.role === "guard" && !unit.dying);
  }

  private chooseMission(blackboard: AiBlackboard, intent: AiIntent | null): AiArmyMission {
    // §57 level 3 / §65: our own base outranks anything the director wanted.
    if (blackboard.baseThreat > 0) return "defendBase";
    // §62: retreat once the power ratio collapses.
    const ratio = blackboard.ownArmyPower / Math.max(0.5, blackboard.knownEnemyArmyPower);
    if (this.mission === "assaultTarget" && ratio < this.balance.army.retreatPowerRatio) return "regroup";
    if (intent === "attack" && blackboard.enemyCenterExists
      && ratio >= this.balance.army.attackPowerRatio) return "assaultTarget";
    if (intent === "defend") return "defendBase";
    // §54: new units wait near the centre until the army is strong enough.
    return "regroup";
  }

  private executeMission(mission: AiArmyMission, army: readonly Unit[]): void {
    switch (mission) {
      case "assaultTarget": return this.assault(army);
      case "defendBase": return this.defendBase(army);
      case "regroup":
      default: return this.regroup(army);
    }
  }

  /** §60: AI-1 has one target worth assaulting — the enemy command centre. */
  private assault(army: readonly Unit[]): void {
    const opponent: UnitOwner = this.owner === "player" ? "enemy" : "player";
    const target = this.centers.get(opponent);
    if (!target) return;
    for (const unit of army) {
      // Prefer a live defender in reach, else keep hitting the centre (§64).
      const defender = this.nearestEnemyUnit(unit, opponent);
      const next = defender ?? target;
      if (unit.attackTarget !== next) unit.setAttackTarget(next);
    }
  }

  private defendBase(army: readonly Unit[]): void {
    const opponent: UnitOwner = this.owner === "player" ? "enemy" : "player";
    for (const unit of army) {
      const attacker = this.nearestEnemyUnit(unit, opponent);
      if (attacker) {
        if (unit.attackTarget !== attacker) unit.setAttackTarget(attacker);
        continue;
      }
      this.moveToRally(unit);
    }
  }

  /** §66: hold near the centre, absorbing newly trained units, awaiting orders. */
  private regroup(army: readonly Unit[]): void {
    for (const unit of army) {
      if (unit.attackTarget) unit.setAttackTarget(null);
      this.moveToRally(unit);
    }
  }

  private moveToRally(unit: Unit): void {
    const center = this.centers.get(this.owner);
    if (!center) return;
    const opponent: UnitOwner = this.owner === "player" ? "enemy" : "player";
    const enemyCenter = this.centers.get(opponent);
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

  private setMission(mission: AiArmyMission | null, blackboard: AiBlackboard, reason: string): void {
    if (this.mission === mission) return;
    this.mission = mission;
    if (!mission) return;
    this.log.record({ at: blackboard.now, kind: "army-mission", mission, reason });
  }

  private missionReason(mission: AiArmyMission, blackboard: AiBlackboard): string {
    switch (mission) {
      case "defendBase": return `üs tehdit altında (${blackboard.baseThreat.toFixed(1)})`;
      case "assaultTarget": return `güç oranı saldırıya uygun (${blackboard.ownArmyPower.toFixed(1)} vs ${blackboard.knownEnemyArmyPower.toFixed(1)})`;
      case "regroup": return "ordu toplanıyor";
      default: return mission;
    }
  }
}
