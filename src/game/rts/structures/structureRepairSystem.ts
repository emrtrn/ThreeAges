/**
 * Worker repair of damaged buildings — the counterpart of construction.
 *
 * A building that survives an assault keeps its damage forever: nothing in the
 * game heals a structure. That made every raid permanent and left the player
 * with a base of half-dead buildings and no verb to answer with. Repair is that
 * verb, and it is deliberately priced off the thing it undoes: putting a
 * building back costs and takes **half** of what putting it up did, scaled to
 * how much of it is actually missing (see {@link REPAIR_FRACTION_OF_BUILD}).
 *
 * This module owns only the *economics* — the quote, the payment, and how much
 * health a worker-second buys. The worker logistics (who walks where, how many
 * may crowd one site) stay in {@link WorkerConstructionSystem}, which already
 * solves exactly that problem for foundations and drives this through
 * {@link StructureRepairSystem.advance}. Keeping them apart is what lets a
 * repairing worker count as busy everywhere a building worker does, without a
 * third system for the economy and the AI to cross-check against.
 */
import type { StartingResources } from "../../data/gameDataTypes";
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { ResourceReservation } from "../economy/resourceWallet";
import type { PlacedStructure } from "./placedStructureSystem";

/**
 * Repair is half of a build, in both currencies the player spends: resources and
 * time. One constant for both, because the two halves are the same design rule —
 * "restoring is cheaper than raising" — and letting them drift apart would make
 * the rule unstatable to the player.
 *
 * The resource half is the midpoint of the band GDD 12 §40 ("Onarım") asks for:
 * a total repair bill of 40–60% of the original building cost, scaled by the
 * missing health fraction.
 *
 * A code constant rather than a row in `balance/*.json` because it is a single
 * global ratio with no per-building variation to author; the per-building
 * numbers it scales (`cost`, `constructionSeconds`, `maxHealth`) are all data.
 * Promoting it to data later is a one-line change here.
 */
export const REPAIR_FRACTION_OF_BUILD = 0.5;

/** Why a repair order was refused. Each maps to one player-facing sentence. */
export type RepairRefusal =
  | "not-repairable"
  | "undamaged"
  | "already-repairing"
  | "insufficient-resources";

export type RepairOrderResult = "started" | RepairRefusal;

/** What a full repair would cost and take, quoted before anything is spent. */
export interface StructureRepairQuote {
  /** Hit points this repair would put back. */
  readonly missingHealth: number;
  /** Whole-resource price, so the panel never quotes "2.5 Odun". */
  readonly cost: StartingResources;
  /** Worker-seconds of work; four builders finish it four times as fast. */
  readonly workerSeconds: number;
}

/** A running repair, for the selection panel. */
export interface StructureRepairSnapshot {
  readonly structureId: number;
  readonly restoredHealth: number;
  readonly healthToRestore: number;
  /** 0..1 of the paid-for work delivered so far. */
  readonly progress: number;
}

/** What {@link StructureRepairSystem.advance} tells the worker system to do next. */
export type RepairTick = "repairing" | "done";

interface RepairJob {
  /** Held on the job, not read off the structure: a razed building is gone by the
   * time its job is settled, and the refund still has to reach the right wallet. */
  readonly owner: PlacedStructure["owner"];
  readonly reservation: ResourceReservation;
  readonly healthToRestore: number;
  /** Constant hit points per worker-second; see {@link healthPerWorkerSecond}. */
  readonly healthPerWorkerSecond: number;
  restoredHealth: number;
}

/**
 * Hit points one worker restores per second on this building.
 *
 * Derived rather than authored: a full repair must take exactly
 * `constructionSeconds * REPAIR_FRACTION_OF_BUILD` worker-seconds, so the rate
 * is the whole building divided by that. It does not depend on how damaged the
 * building is — a scratch and a wreck repair at the same speed, they just have
 * different amounts to cover.
 */
export function healthPerWorkerSecond(structure: PlacedStructure): number {
  const seconds = structure.stats.constructionSeconds * REPAIR_FRACTION_OF_BUILD;
  return seconds > 0 ? structure.health.max / seconds : structure.health.max;
}

/** True for a standing, damaged building — the only thing a repair can target. */
export function isRepairable(structure: PlacedStructure): boolean {
  return structure.construction.complete && !structure.health.depleted;
}

/**
 * Price and duration of putting this building back to full, right now. Null when
 * there is nothing to repair, so a caller cannot quote a free, instant job.
 */
export function quoteStructureRepair(structure: PlacedStructure): StructureRepairQuote | null {
  if (!isRepairable(structure)) return null;
  const missingHealth = structure.health.max - structure.health.current;
  if (missingHealth <= 0) return null;
  const missingRatio = missingHealth / structure.health.max;
  const cost: Record<string, number> = {};
  for (const [resourceId, amount] of Object.entries(structure.stats.cost)) {
    // Rounded up, and only when it rounds to something: a 1-wood scratch on a
    // 40-wood house should still cost the wood, but a building that was free to
    // raise stays free to fix.
    const price = Math.ceil(amount * REPAIR_FRACTION_OF_BUILD * missingRatio);
    if (price > 0) cost[resourceId] = price;
  }
  return {
    missingHealth,
    cost,
    workerSeconds: missingHealth / healthPerWorkerSecond(structure),
  };
}

export class StructureRepairSystem {
  private readonly jobs = new Map<number, RepairJob>();

  constructor(private readonly kingdoms: KingdomRegistry) {}

  /** See {@link quoteStructureRepair}; exposed here so the UI has one entry point. */
  quote(structure: PlacedStructure): StructureRepairQuote | null {
    return quoteStructureRepair(structure);
  }

  /**
   * Pay for a repair and open the job. The whole price is taken up front, for the
   * damage standing at this moment: the player agrees to a quoted number rather
   * than watching a trickle they cannot predict, and a building hit *again*
   * mid-repair does not silently raise the bill — the rest is a second order.
   */
  begin(structure: PlacedStructure): RepairOrderResult {
    if (!isRepairable(structure)) return "not-repairable";
    if (this.jobs.has(structure.id)) return "already-repairing";
    const quote = quoteStructureRepair(structure);
    if (!quote) return "undamaged";
    const reservation = this.kingdoms.get(structure.owner).wallet.reserve(quote.cost);
    if (!reservation) return "insufficient-resources";
    this.jobs.set(structure.id, {
      owner: structure.owner,
      reservation,
      healthToRestore: quote.missingHealth,
      healthPerWorkerSecond: healthPerWorkerSecond(structure),
      restoredHealth: 0,
    });
    return "started";
  }

  /**
   * Apply one tick of `workerCount` builders' work. Returns "done" when the job
   * is finished or was never open, which is the worker system's cue to release
   * its crew — the same signal a completed foundation gives it.
   */
  advance(structure: PlacedStructure, deltaSeconds: number, workerCount: number): RepairTick {
    const job = this.jobs.get(structure.id);
    if (!job) return "done";
    if (!(deltaSeconds > 0) || !(workerCount > 0)) return "repairing";
    const remaining = job.healthToRestore - job.restoredHealth;
    const healed = structure.health.heal(
      Math.min(remaining, job.healthPerWorkerSecond * deltaSeconds * workerCount),
    ).applied;
    job.restoredHealth += healed;
    // Full health ends the job even with paid work left over — there is nothing
    // more to restore, and the alternative is a crew kneeling at an intact
    // building. The unspent remainder is committed: the health was delivered.
    if (job.restoredHealth < job.healthToRestore && structure.health.ratio < 1) return "repairing";
    this.settle(structure.id, job);
    return "done";
  }

  /**
   * Stop a job the player called off, or one whose building has left the field.
   *
   * Refunded in full only while no hit point has been delivered — an order the
   * worker never reached is an order the kingdom never received. Past that the
   * payment is committed: the building is carrying the health it bought, and a
   * proportional refund would make "repair to 99%, cancel" the cheapest repair
   * in the game.
   */
  cancel(structure: PlacedStructure): boolean {
    const job = this.jobs.get(structure.id);
    if (!job) return false;
    this.settle(structure.id, job);
    return true;
  }

  isRepairing(structure: PlacedStructure): boolean {
    return this.jobs.has(structure.id);
  }

  snapshot(structure: PlacedStructure): StructureRepairSnapshot | null {
    const job = this.jobs.get(structure.id);
    if (!job) return null;
    return {
      structureId: structure.id,
      restoredHealth: job.restoredHealth,
      healthToRestore: job.healthToRestore,
      progress: job.healthToRestore > 0 ? Math.min(1, job.restoredHealth / job.healthToRestore) : 1,
    };
  }

  /**
   * Settle jobs whose building has been razed or cancelled since the last tick.
   *
   * Driven from the live list rather than a destruction hook, for the reason
   * `structureDestruction` gives: every other system already reconciles against
   * `structures.all()`, and one observer cannot miss a removal path the way a
   * set of call sites can. An unpaid job is refunded here exactly as a
   * player-cancelled one is.
   */
  update(structures: readonly PlacedStructure[]): void {
    if (this.jobs.size === 0) return;
    const live = new Set(structures.filter((structure) => !structure.health.depleted).map((structure) => structure.id));
    for (const [id, job] of [...this.jobs]) {
      if (live.has(id)) continue;
      this.settle(id, job);
    }
  }

  /** Drop every job without refunding: the match's wallets are being reset too. */
  reset(): void {
    this.jobs.clear();
  }

  /** Close a job's books against the wallet that opened it. */
  private settle(id: number, job: RepairJob): void {
    this.jobs.delete(id);
    const wallet = this.kingdoms.get(job.owner).wallet;
    if (job.restoredHealth <= 0) wallet.refund(job.reservation);
    else wallet.commit(job.reservation);
  }
}
