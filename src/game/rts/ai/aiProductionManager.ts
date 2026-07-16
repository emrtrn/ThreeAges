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
import type { AiBalance } from "../../data/gameDataTypes";
import type { BarracksProductionSystem } from "../structures/barracksProductionSystem";
import type { WorkerProductionSystem } from "../structures/workerProductionSystem";
import type { UnitOwner } from "../units/unit";
import type { AiBlackboard } from "./aiBlackboard";

export class AiProductionManager {
  constructor(
    private readonly owner: UnitOwner,
    private readonly workers: WorkerProductionSystem,
    private readonly guards: BarracksProductionSystem,
    private readonly balance: AiBalance,
  ) {}

  update(bb: AiBlackboard): void {
    // §55 step 1: never queue into a full population — that is the economy
    // manager's housing problem, and queuing here would just reserve-and-fail.
    if (bb.population >= bb.populationCap) return;

    // §35: workers first; the whole economy scales off them.
    if (bb.workerCount < this.balance.economy.workerTarget) {
      this.workers.queueWorker(this.owner);
      return;
    }
    // §54/§55: with the economy staffed, fill the minimum base defence and then
    // keep adding to the single field army.
    if ((bb.buildingCounts["barracks"] ?? 0) > 0) this.guards.queueGuard(this.owner);
  }
}
