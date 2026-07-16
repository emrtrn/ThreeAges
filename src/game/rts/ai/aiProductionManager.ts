/**
 * AI production executor — `07_ENEMY_AI_DESIGN_v0.2.md` §17
 * (ProductionManager), §54–§55; plan §38 ("İşçi üretimi", "Minimum savunma
 * gücü").
 *
 * Queues workers and guards through the *same* {@link WorkerProductionSystem} /
 * {@link BarracksProductionSystem} the player's buttons drive (§4), so cost,
 * population and training time are identical for both kingdoms.
 *
 * §55 priority: secure population capacity → complete the minimum defence →
 * grow the field army. The first step is housing, which the economy manager
 * owns, so this module simply declines to queue into a locked population rather
 * than fighting it for resources.
 */
import type { AiArmyComposition, AiBalance, UnitRoleId } from "../../data/gameDataTypes";
import type { BarracksProductionSystem } from "../structures/barracksProductionSystem";
import type { WorkerProductionSystem } from "../structures/workerProductionSystem";
import type { UnitOwner } from "../units/unit";
import type { AiBlackboard } from "./aiBlackboard";
import { workerTargetFor } from "./intentScorer";

/** §53: the roles a composition ratio covers, in tie-break order. */
const COMPOSITION_ROLES: readonly (keyof AiArmyComposition)[] = ["guard", "archer", "siege"];

export class AiProductionManager {
  constructor(
    private readonly owner: UnitOwner,
    private readonly workers: WorkerProductionSystem,
    private readonly army: BarracksProductionSystem,
    private readonly balance: AiBalance,
    /** Which unit id trains a given role, read off the same balance the player uses. */
    private readonly unitIdForRole: (role: UnitRoleId) => string | null,
  ) {}

  update(bb: AiBlackboard): void {
    // §55 step 1: never queue into a full population — that is the economy
    // manager's housing problem, and queuing here would just reserve-and-fail.
    if (bb.population >= bb.populationCap) return;

    // §35: workers first; the whole economy scales off them. The target rises
    // with the age, because a Town economy runs four resources rather than two
    // and the extra producers each want their own hands ("çağ hazırlığı işçi
    // dağılımı"): producers pull idle workers themselves, so the AI shapes the
    // distribution by how many workers exist, not by assigning them.
    if (bb.workerCount < workerTargetFor(bb, this.balance)) {
      this.workers.queueWorker(this.owner);
      return;
    }
    // §54/§55: with the economy staffed, fill the minimum base defence and then
    // keep adding to the single field army — but only up to its share of the
    // population. An army with no ceiling grows until the population is full,
    // and once every authored house slot is taken, §7's PopulationBlocked can
    // never be relieved: it fires forever, pins the director on Economy, and the
    // AI stops ageing up or acting at all. The ceiling is what keeps that
    // emergency a passing state rather than a terminal one.
    if (bb.armyPopulation >= bb.populationCap * this.balance.army.populationShare) return;
    if ((bb.buildingCounts["barracks"] ?? 0) === 0) return;
    const role = this.nextRole(bb);
    if (!role) return;
    const unitId = this.unitIdForRole(role);
    if (unitId) this.army.queueUnit(this.owner, unitId);
  }

  /**
   * §53: the role furthest below its share of the age's composition.
   *
   * Comparing *deficits against the ratio* rather than counts is what keeps the
   * mix honest while the army is small: with a 3:2:1 Town ratio and an army of
   * one Guard, the Archer is further behind its share than a second Guard is,
   * so the AI actually diversifies instead of stacking whichever role it opened
   * with. A role whose training building is still Barracks I simply fails to
   * queue and is skipped next tick, so the gate stays in the data (§45).
   */
  private nextRole(bb: AiBlackboard): keyof AiArmyComposition | null {
    const composition = this.balance.army.composition[bb.age];
    const totalShare = COMPOSITION_ROLES.reduce((total, role) => total + composition[role], 0);
    if (totalShare <= 0) return null;
    const armySize = COMPOSITION_ROLES.reduce((total, role) => total + bb.armyComposition[role], 0);

    let best: keyof AiArmyComposition | null = null;
    let bestDeficit = 0;
    for (const role of COMPOSITION_ROLES) {
      const share = composition[role];
      if (share <= 0) continue;
      // How many of this role an army of this size *should* already have.
      const wanted = (share / totalShare) * (armySize + 1);
      const deficit = wanted - bb.armyComposition[role];
      // §80: ties must not reorder between two identical runs, so the first role
      // in the fixed list wins rather than whichever the iteration reached.
      if (deficit <= bestDeficit) continue;
      best = role;
      bestDeficit = deficit;
    }
    return best;
  }
}
