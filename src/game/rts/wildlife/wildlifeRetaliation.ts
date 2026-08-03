/**
 * What a bull does about being handled — pasture plan V2 Faz 6.
 *
 * The whole system is one sentence: **an animal that fights back hurts the
 * worker already touching it.** There is no acquisition, no target choice and no
 * range table, because the claim register has already answered the only question
 * that matters — `reservedByWorkerId` is, by construction, the one worker with
 * hands on this animal, whether he is calming it for a pasture or shooting it
 * for a hunting camp. That is why this file is twenty lines of rule rather than
 * a second engagement system, and it is the deliberately narrow door §9 asks
 * for: V3's predator will want to pick its own victim, and it will have to open
 * that door itself.
 *
 * Deliberately outside {@link WildlifeSystem}: that system is the herd's own
 * state and knows nothing about `Unit`s. It is equally deliberately outside
 * {@link PastureSystem}, because half the blows land during a *hunt*, which the
 * pasture has never heard of.
 */
import type { Unit } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { WildlifeAnimal, WildlifeSystem } from "./wildlifeSystem";
import { CAUGHT_DISTANCE } from "./wildlifeRoaming";

/** One blow that has landed, for narration, debug and the tests. */
export interface WildlifeStrike {
  readonly animal: WildlifeAnimal;
  readonly worker: Unit;
  readonly damage: number;
}

export class WildlifeRetaliationSystem {
  constructor(
    private readonly units: UnitSystem,
    private readonly wildlife: WildlifeSystem,
  ) {}

  /**
   * Advance every struggle and land whatever blows came due.
   *
   * Run *after* both the movers — the shepherd's step and the animal's — so
   * "is he still touching it" is asked of where the two actually are this frame,
   * not of where they were before either moved.
   */
  update(deltaSeconds: number): readonly WildlifeStrike[] {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("Retaliation delta must be a non-negative finite number");
    }
    const strikes: WildlifeStrike[] = [];
    let workers: Map<number, Unit> | null = null;
    for (const animal of this.wildlife.all()) {
      animal.attacking = false;
      const profile = animal.stats.retaliation;
      if (!profile) continue;
      const worker = this.grappler(animal, () => (workers ??= this.workerIndex()));
      if (!worker) {
        // The struggle is over, not paused: an animal let go of has calmed down,
        // and banking a half-finished wind-up would let a shepherd who backed off
        // and stepped in again take a free headbutt on arrival.
        animal.strikeSeconds = 0;
        continue;
      }
      animal.attacking = true;
      animal.strikeSeconds += deltaSeconds;
      const interval = 60 / profile.attacksPerMinute;
      // A loop rather than one blow per tick: at eight-times game speed a single
      // step can span two intervals, and a bull that hit less often the faster
      // the match ran would be a difficulty setting nobody chose.
      while (animal.strikeSeconds >= interval) {
        animal.strikeSeconds -= interval;
        animal.strikeCount += 1;
        worker.health.damage(profile.damage);
        strikes.push({ animal, worker, damage: profile.damage });
        // Whatever else happens to a dead shepherd happens elsewhere
        // (`PastureSystem` drops the job, `unitDeath` removes the body); here it
        // only means there is nobody left to hit.
        if (worker.health.depleted) break;
      }
    }
    return strikes;
  }

  // --- internals ------------------------------------------------------------

  /**
   * The worker this animal is currently fighting, or null if it is fighting
   * nobody.
   *
   * Four conditions, and each is a different sentence the player would read off
   * the screen:
   *
   * - **Alive and still wild.** A carcass hits nothing, and a penned bull is a
   *   bull that has already been won — it must not spend the rest of the match
   *   goring the kingdom that owns it.
   * - **Claimed.** No claim, no contact: this is the whole of target selection.
   * - **Not being led home.** `follow` is the moment the calming finished, so a
   *   driven animal is by definition a beaten one. Without this the shepherd
   *   would be gored all the way back to the pasture for winning.
   * - **Within {@link CAUGHT_DISTANCE}.** A headbutt is contact, and a claim
   *   deliberately survives range (the chase would restart forever otherwise) —
   *   so range is the check that keeps a bolting bull from hitting a hunter it
   *   has run fifty units away from.
   */
  private grappler(animal: WildlifeAnimal, index: () => Map<number, Unit>): Unit | null {
    if (animal.dead || animal.owner !== "wild") return null;
    const workerId = animal.reservedByWorkerId;
    if (workerId === null) return null;
    if (animal.lead?.follow) return null;
    const worker = index().get(workerId);
    if (!worker || worker.health.depleted || worker.dying) return null;
    const gap = Math.hypot(
      animal.position.x - worker.position.x,
      animal.position.z - worker.position.z,
    );
    return gap <= CAUGHT_DISTANCE ? worker : null;
  }

  /** Built once per tick, and only if some species can actually fight back. */
  private workerIndex(): Map<number, Unit> {
    return new Map(this.units.all().map((unit) => [unit.id, unit]));
  }
}
