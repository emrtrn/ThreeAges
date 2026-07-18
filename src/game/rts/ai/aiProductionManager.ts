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
  private gatedRole: keyof AiArmyComposition | null = null;

  constructor(
    private readonly owner: UnitOwner,
    private readonly workers: WorkerProductionSystem,
    private readonly army: BarracksProductionSystem,
    private readonly balance: AiBalance,
    /** Which unit id trains a given role, read off the same balance the player uses. */
    private readonly unitIdForRole: (role: UnitRoleId) => string | null,
    /** Build the missing military line through the AI's shared construction slot. */
    private readonly requestMilitaryBuilding: (buildingId: string, now: number) => void,
  ) {}

  /**
   * §53: the role the composition wants but this Barracks tier cannot train, or
   * null. {@link AiUpgradeManager} acts on this — the gate itself stays in the
   * unit data (`requiredBuildingLevel`), which is why this is *reported* from a
   * refused queue rather than re-derived from a tier rule copied into the AI.
   */
  get upgradeGatedRole(): keyof AiArmyComposition | null {
    return this.gatedRole;
  }

  update(bb: AiBlackboard): void {
    // §55 step 1: never queue into a full population — that is the economy
    // manager's housing problem, and queuing here would just reserve-and-fail.
    if (bb.population >= bb.populationCap) return;

    // §35: workers first; the whole economy scales off them. The target rises
    // with the age, because a Town economy runs four resources rather than two
    // and the extra producers each want their own hands ("çağ hazırlığı işçi
    // dağılımı"): producers pull idle workers themselves, so the AI shapes the
    // distribution by how many workers exist, not by assigning them.
    //
    // Orders in flight count, exactly as they do for the army below: the centre
    // holds an age-scaled queue, and a target compared against live workers
    // alone is overshot by every worker still training. That overshoot is not
    // cosmetic — the surplus eats the population the army budget was sized
    // against, and the two together wedge the AI at its cap.
    if (bb.workerCount + this.workers.queuedCount(this.owner) < workerTargetFor(bb, this.balance)) {
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
    // Orders already paid for count against the budget: the Barracks holds a
    // whole age-scaled queue, so a ceiling read off the live army alone is
    // overshot by everything still training — up to a full queue of Rams.
    const committed = bb.armyPopulation + this.army.queuedPopulation(this.owner);
    if (committed >= bb.populationCap * this.balance.army.populationShare) return;
    if ((bb.buildingCounts["barracks"] ?? 0) === 0) return;
    this.gatedRole = null;
    // §53: take the most wanted role, but do not stall the whole army on it. A
    // Town-age AI wants an Archer from its separate Range; an AI that queued
    // nothing until that line was built would field no army through the one
    // window it is most likely to be attacked in.
    for (const role of this.rolesByDeficit(bb)) {
      const unitId = this.unitIdForRole(role);
      if (!unitId) continue;
      const result = this.army.queueUnit(this.owner, unitId);
      if (result === "no-completed-production-building") {
        const buildingId = this.army.productionBuildingFor(unitId);
        if (buildingId) this.requestMilitaryBuilding(buildingId, bb.now);
        return;
      }
      // A full Barracks queue must not suppress the independent Archer line.
      // Try the next deficit role: it may have a different production building.
      if (result === "queue-full") continue;
      if (result !== "requires-production-building-upgrade") return;
      // The first gated role is the one the upgrade is *for*; keep it and drop to
      // whatever this tier can still train.
      this.gatedRole ??= role;
    }
  }

  reset(): void {
    this.gatedRole = null;
  }

  /**
   * §53: the age's roles, most starved of its share of the composition first.
   *
   * Comparing *deficits against the ratio* rather than counts is what keeps the
   * mix honest while the army is small: with a 3:2:1 Town ratio and an army of
   * one Guard, the Archer is further behind its share than a second Guard is,
   * so the AI actually diversifies instead of stacking whichever role it opened
   * with.
   */
  private rolesByDeficit(bb: AiBlackboard): readonly (keyof AiArmyComposition)[] {
    const composition = this.balance.army.composition[bb.age];
    const totalShare = COMPOSITION_ROLES.reduce((total, role) => total + composition[role], 0);
    if (totalShare <= 0) return [];
    const armySize = COMPOSITION_ROLES.reduce((total, role) => total + bb.armyComposition[role], 0);

    return COMPOSITION_ROLES
      // A role the age's ratio does not ask for is not a fallback: queuing a
      // Settlement Archer would answer the tier gate by ignoring §53 entirely.
      .filter((role) => composition[role] > 0)
      .map((role) => ({
        role,
        // How many of this role an army of this size *should* already have.
        deficit: (composition[role] / totalShare) * (armySize + 1) - bb.armyComposition[role],
      }))
      .filter((entry) => entry.deficit > 0)
      // §80: ties must not reorder between two identical runs, so the fixed list
      // order breaks them rather than whichever the sort happened to reach.
      .sort((left, right) => right.deficit - left.deficit
        || COMPOSITION_ROLES.indexOf(left.role) - COMPOSITION_ROLES.indexOf(right.role))
      .map((entry) => entry.role);
  }
}
