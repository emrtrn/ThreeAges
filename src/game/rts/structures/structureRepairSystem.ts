/**
 * Automatic repair of damaged buildings — the settlement's own answer to a raid.
 *
 * A building that survives an assault used to keep its damage forever unless the
 * player selected it and pressed "Tamir Et". That button was never a decision:
 * the answer to "shall I fix this?" is always yes, so after a raid it was eight
 * selections and eight clicks to say yes eight times. Worse, the AI never
 * pressed it at all — nothing in `ai/` ever opened a repair order — so the verb
 * was the player's alone.
 *
 * So repair is a property of a building rather than an order given to one. A
 * damaged building waits {@link REPAIR_COOLDOWN_SECONDS} out of combat and then
 * heals itself, paying the kingdom's stockpile as it goes. Every kingdom's
 * buildings do it under the same rule, which is what makes it symmetric.
 *
 * Two rules carry the design:
 *
 * - **The cooldown is measured from the last blow, not from the first.** Every
 *   hit re-arms it, so a building under siege never heals while the siege is
 *   happening — the timer is "out of combat", and a wall that regenerated
 *   between two cannon shots would make the cannon unusable.
 * - **The bill is paid as the health lands, never up front.** Nobody clicked, so
 *   nobody agreed to a quoted price; taking the whole sum at once would empty a
 *   stockpile for a number the player never saw. Paying per hit point makes an
 *   empty stockpile *pause* the repair instead of cancelling it, and a building
 *   hit again mid-repair simply costs more as it goes.
 *
 * The price rule itself is unchanged: restoring a building costs
 * {@link REPAIR_FRACTION_OF_BUILD} of raising it, scaled to the health that is
 * actually missing, and takes that fraction of its construction time.
 */
import type { StartingResources } from "../../data/gameDataTypes";
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import { baseBuildingCost, type BuildingCostResolver } from "../economy/buildingCost";
import type { PlacedStructure } from "./placedStructureSystem";

/**
 * Repair is half of a build, in both currencies the kingdom spends: resources and
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

/**
 * How long a building must go unhit before it starts repairing itself.
 *
 * Long enough that it reads as "the fight here is over" rather than as combat
 * regeneration, short enough that the player is not left staring at a wrecked
 * base wondering whether the mechanic exists. Re-armed by every blow that lands
 * (see {@link StructureRepairSystem.update}), so its real job is separating a
 * lull in an assault from the end of one.
 */
export const REPAIR_COOLDOWN_SECONDS = 15;

/**
 * Largest health shortfall a finished repair treats as float rounding rather than
 * as damage. Health is authored in whole points, so anything at this scale cannot
 * be a wound — it is the residue of summing per-tick slices.
 */
const REPAIR_ROUNDING_EPSILON = 1e-6;

/** What a damaged building is doing about its damage right now. */
export type StructureRepairState =
  /** Hit too recently: the out-of-combat cooldown has not run out yet. */
  | "waiting"
  /** Healing, and the stockpile is covering it. */
  | "repairing"
  /** Ready and willing, but the kingdom cannot pay for the next hit point. */
  | "stalled";

/** What finishing this building's repair would still cost and take. */
export interface StructureRepairQuote {
  /** Hit points still missing. */
  readonly missingHealth: number;
  /** Whole-resource price, so the panel never quotes "2.5 Odun". */
  readonly cost: StartingResources;
  /** Seconds of repair left at this building's own rate. */
  readonly seconds: number;
}

/** A damaged building's live repair state, for the selection panel. */
export interface StructureRepairSnapshot {
  readonly structureId: number;
  readonly state: StructureRepairState;
  /** Seconds left on the cooldown; zero unless `state` is "waiting". */
  readonly secondsUntilStart: number;
}

/**
 * One building's standing repair account.
 *
 * `credit` is the reason this is an account rather than a timer. Resources come
 * in whole units and a tick of repair costs a fraction of one, so the kingdom
 * buys a whole unit and spends it down over the following ticks. Without it,
 * either every frame would round its own purchase up — charging a hundred times
 * the true price — or the repair would be free until it happened to cross a
 * whole number.
 */
interface RepairAccount {
  /** Last seen `health.impactCount`; a change means a fresh blow has landed. */
  lastImpactCount: number;
  secondsSinceDamage: number;
  /** Resource units paid for and not yet consumed by delivered health. */
  readonly credit: Map<string, number>;
  state: StructureRepairState;
}

/**
 * Hit points this building restores per second while its repair is running.
 *
 * Derived rather than authored: a full repair must take exactly
 * `constructionSeconds * REPAIR_FRACTION_OF_BUILD`, so the rate is the whole
 * building divided by that. It does not depend on how damaged the building is —
 * a scratch and a wreck heal at the same speed, they just have different amounts
 * to cover.
 */
export function repairHealthPerSecond(structure: PlacedStructure): number {
  const seconds = structure.stats.constructionSeconds * REPAIR_FRACTION_OF_BUILD;
  return seconds > 0 ? structure.health.max / seconds : structure.health.max;
}

/** True for a standing, finished building — the only thing that repairs itself. */
export function isRepairable(structure: PlacedStructure): boolean {
  return structure.construction.complete && !structure.health.depleted;
}

/**
 * Price and duration of putting this building back to full, from right now. Null
 * when there is nothing to repair, so a caller cannot quote a free, instant job.
 */
export function quoteStructureRepair(
  structure: PlacedStructure,
  /**
   * What raising this building costs *today*, which is what fixing it is priced
   * against. Under this project's age rule a Yerleşim house was raised in timber
   * and is patched in stone once the kingdom reaches Kasaba — the repair follows
   * the kingdom's current material, not the one the walls went up in.
   *
   * Defaulted to the base price so the headless tests, which have no tier, keep
   * quoting the row they authored.
   */
  buildCost: StartingResources = structure.stats.cost,
): StructureRepairQuote | null {
  if (!isRepairable(structure)) return null;
  const missingHealth = structure.health.max - structure.health.current;
  if (missingHealth <= 0) return null;
  const missingRatio = missingHealth / structure.health.max;
  const cost: Record<string, number> = {};
  for (const [resourceId, amount] of Object.entries(buildCost)) {
    // Rounded up, and only when it rounds to something: a 1-wood scratch on a
    // 40-wood house should still cost the wood, but a building that was free to
    // raise stays free to fix.
    const price = Math.ceil(amount * REPAIR_FRACTION_OF_BUILD * missingRatio);
    if (price > 0) cost[resourceId] = price;
  }
  return {
    missingHealth,
    cost,
    seconds: missingHealth / repairHealthPerSecond(structure),
  };
}

export class StructureRepairSystem {
  private readonly accounts = new Map<number, RepairAccount>();

  constructor(
    private readonly kingdoms: KingdomRegistry,
    /** The owner's live building price; see {@link BuildingCostResolver}. */
    private readonly costFor: BuildingCostResolver = baseBuildingCost,
  ) {}

  /** See {@link quoteStructureRepair}; exposed here so the UI has one entry point. */
  quote(structure: PlacedStructure): StructureRepairQuote | null {
    return quoteStructureRepair(structure, this.costFor(structure.owner, structure.stats));
  }

  /**
   * Tick every building's repair.
   *
   * Driven from the live list rather than from damage hooks, for the reason
   * `structureDestruction` gives: every other system already reconciles against
   * `structures.all()`, and one observer cannot miss a removal path the way a
   * set of call sites can. Fresh damage is spotted the same way — by watching
   * `health.impactCount`, the one counter every damage source in the match
   * already passes through, rather than by asking five of them to report in.
   */
  update(structures: readonly PlacedStructure[], deltaSeconds: number): void {
    const live = new Set<number>();
    for (const structure of structures) {
      if (structure.health.depleted) continue;
      live.add(structure.id);
      this.advance(structure, deltaSeconds);
    }
    // A razed or demolished building takes its account with it. Nothing is owed
    // either way: the kingdom only ever paid for health already delivered.
    //
    // Every live building was just given an account, so the two sets can only
    // differ by accounts with no building left. Comparing the sizes first keeps
    // the common frame — nothing destroyed — down to one integer test.
    if (this.accounts.size === live.size) return;
    for (const id of this.accounts.keys()) {
      if (!live.has(id)) this.accounts.delete(id);
    }
  }

  /** True while this building is actively healing itself. */
  isRepairing(structure: PlacedStructure): boolean {
    return this.accounts.get(structure.id)?.state === "repairing";
  }

  /** The panel's view of one building's repair; null when it has no damage. */
  snapshot(structure: PlacedStructure): StructureRepairSnapshot | null {
    const account = this.accounts.get(structure.id);
    if (!account || !isRepairable(structure)) return null;
    if (structure.health.max - structure.health.current <= REPAIR_ROUNDING_EPSILON) return null;
    return {
      structureId: structure.id,
      state: account.state,
      secondsUntilStart: account.state === "waiting"
        ? Math.max(0, REPAIR_COOLDOWN_SECONDS - account.secondsSinceDamage)
        : 0,
    };
  }

  /** Drop every account: the match's buildings and wallets are being reset too. */
  reset(): void {
    this.accounts.clear();
  }

  private advance(structure: PlacedStructure, deltaSeconds: number): void {
    const account = this.accountFor(structure);
    if (structure.health.impactCount !== account.lastImpactCount) {
      account.lastImpactCount = structure.health.impactCount;
      account.secondsSinceDamage = 0;
    }
    const elapsed = Math.max(0, deltaSeconds);
    const waited = account.secondsSinceDamage;
    // Clamped rather than left to run: nothing above the cooldown means anything,
    // and an unbounded accumulator on a building that stands for an hour is a
    // number growing for no reader.
    account.secondsSinceDamage = Math.min(REPAIR_COOLDOWN_SECONDS, waited + elapsed);
    if (!isRepairable(structure)) {
      account.state = "waiting";
      account.credit.clear();
      return;
    }
    const missing = structure.health.max - structure.health.current;
    if (missing <= REPAIR_ROUNDING_EPSILON) {
      // Absorb the rounding residue, and only that. Summing the per-tick slices
      // back up undershoots full health by a few parts in 1e13, and the shortfall
      // is permanent: the bar never fills and the building reports damage no
      // player can see. Sub-unit credit left over is forfeited here — it is a
      // fraction of one resource, and carrying it on a whole building would be
      // bookkeeping nobody can spend.
      if (missing > 0) structure.health.heal(missing);
      account.state = "waiting";
      account.credit.clear();
      return;
    }
    // Only the part of this tick that falls *after* the cooldown does any work.
    // The frame the countdown runs out on is mostly still cooldown, and treating
    // all of it as repair would hand the building the wait as free health — at a
    // 60 Hz tick that is invisible, but a paused game resuming with one long
    // delta would heal a wreck in a single step.
    const working = waited >= REPAIR_COOLDOWN_SECONDS ? elapsed : waited + elapsed - REPAIR_COOLDOWN_SECONDS;
    if (!(working > 0)) {
      account.state = "waiting";
      return;
    }
    this.deliverPaidHealth(structure, account, Math.min(missing, repairHealthPerSecond(structure) * working));
  }

  /**
   * Buy this tick's hit points and apply them, healing only as far as the
   * stockpile reaches.
   *
   * Purchases are whole units bought against {@link RepairAccount.credit}, so
   * over a long repair the kingdom pays the quoted bill plus at most the
   * rounding of one unit per resource — the same rounding
   * {@link quoteStructureRepair} shows.
   */
  private deliverPaidHealth(structure: PlacedStructure, account: RepairAccount, wanted: number): void {
    const price = this.pricePerHealth(structure);
    let health = wanted;
    let stalled = false;
    const purchase: Record<string, number> = {};
    for (const [resourceId, perHealth] of price) {
      const shortfall = perHealth * health - (account.credit.get(resourceId) ?? 0);
      if (shortfall > 0) purchase[resourceId] = Math.ceil(shortfall);
    }
    if (Object.keys(purchase).length > 0) {
      const wallet = this.kingdoms.get(structure.owner).wallet;
      const reservation = wallet.reserve(purchase);
      if (reservation) {
        // Reserved and committed in the same breath: there is no order to cancel,
        // so there is nothing this payment could ever be refunded against.
        wallet.commit(reservation);
        for (const [resourceId, amount] of Object.entries(purchase)) {
          account.credit.set(resourceId, (account.credit.get(resourceId) ?? 0) + amount);
        }
      } else {
        // Broke. Deliver only what earlier purchases already cover, which is
        // usually nothing — the repair pauses here and resumes on its own the
        // moment the stockpile can pay again.
        stalled = true;
        for (const [resourceId, perHealth] of price) {
          health = Math.min(health, (account.credit.get(resourceId) ?? 0) / perHealth);
        }
      }
    }
    if (!(health > 0)) {
      account.state = stalled ? "stalled" : "waiting";
      return;
    }
    const healed = structure.health.heal(health).applied;
    for (const [resourceId, perHealth] of price) {
      account.credit.set(resourceId, Math.max(0, (account.credit.get(resourceId) ?? 0) - perHealth * healed));
    }
    account.state = stalled ? "stalled" : "repairing";
  }

  /**
   * What one hit point of this building costs, per resource, right now.
   *
   * Computed from the live maximum and the owner's live building price, so an
   * age change or a durability upgrade is priced from the tick it lands rather
   * than from whatever held when the damage was taken. Reached only by a
   * building that is actually healing this tick, so the per-frame cost of an
   * undamaged base stays a map lookup and two additions.
   */
  private pricePerHealth(structure: PlacedStructure): Map<string, number> {
    const price = new Map<string, number>();
    if (structure.health.max <= 0) return price;
    for (const [resourceId, amount] of Object.entries(this.costFor(structure.owner, structure.stats))) {
      if (amount > 0) price.set(resourceId, (amount * REPAIR_FRACTION_OF_BUILD) / structure.health.max);
    }
    return price;
  }

  private accountFor(structure: PlacedStructure): RepairAccount {
    const existing = this.accounts.get(structure.id);
    if (existing) return existing;
    const account: RepairAccount = {
      lastImpactCount: structure.health.impactCount,
      // Starts ready rather than waiting: a building first seen already damaged
      // was not hit on this tick — it was authored that way, or the system was
      // reset under it — and holding it for a cooldown it never earned would
      // read as the mechanic being broken.
      secondsSinceDamage: REPAIR_COOLDOWN_SECONDS,
      credit: new Map(),
      state: "waiting",
    };
    this.accounts.set(structure.id, account);
    return account;
  }
}
