/**
 * What a wolf does about the people walking past its den — V3 Faz 3.
 *
 * The door {@link WildlifeRetaliationSystem} deliberately left shut. That system
 * is one sentence — *an animal that fights back hurts the worker already touching
 * it* — and it has no target selection at all, because the claim register had
 * already answered the only question it asks. A predator asks the opposite
 * question: nobody has hold of it, so **it picks**. Folding the two together
 * would mean hanging a choosing rule off a rule written precisely because there
 * was nothing to choose, which is why V3 §9 keeps them apart.
 *
 * The choice itself is one line of KARAR 1: a lone worker on **unowned ground**.
 * Not "whoever is in range", which would drag the player's army into wolf
 * clearance, and not "whoever is alone", which would be a second tunable radius
 * for a rule that already reads off {@link TerritoryControlSystem}. Binding it to
 * territory is what makes the Karakol and the control area *true by definition*
 * rather than true on the current tuning — the whole claim V3 §1 is built on.
 *
 * Movement is not owned here. This decides who is being chased and writes it to
 * {@link WildlifeAnimal.hunt}; the herd's own tick runs the third movement mode
 * over it, exactly as the pasture writes a `lead` and lets the animal walk it.
 */
import type { TerritoryOwner } from "../territory/territoryControlSystem";
import type { Unit } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { WildlifeAnimal, WildlifeSystem } from "./wildlifeSystem";
import { CAUGHT_DISTANCE, type HuntQuarry } from "./wildlifeRoaming";

/**
 * How close a predator plants itself before biting, in world units.
 *
 * Under {@link CAUGHT_DISTANCE}, which is the reach of the bite itself, so a
 * predator that has finished closing is reliably inside its own strike range
 * instead of oscillating across the boundary. The gap is what keeps the wolf
 * standing *beside* its victim rather than inside him.
 */
const PREDATOR_STANDOFF = 1.2;

/** One bite that has landed, for narration, the Faz 4 notification and the tests. */
export interface PredatorStrike {
  readonly predator: WildlifeAnimal;
  readonly victim: Unit;
  readonly damage: number;
}

export class PredatorSystem {
  /**
   * Which unit each predator is currently after, by id.
   *
   * Held rather than re-chosen every tick, and that is a behaviour decision, not
   * a cache: a wolf that took the nearest worker each frame would swap victims
   * whenever two crossed and end up oscillating between them, having bitten
   * neither. It commits until the target stops being valid.
   *
   * Keyed by id on both sides so nothing here keeps a dead body alive.
   */
  private readonly victimIdByAnimalId = new Map<string, number>();

  /**
   * The predators that held a victim on the last tick — see {@link aggressors}.
   *
   * Rebuilt each pass rather than derived from {@link victimIdByAnimalId} on
   * demand, because the two answer subtly different questions: the map still
   * names the worker a wolf was after when he died, while this is the list of
   * animals that were actually hunting somebody when the pass ended.
   */
  private hunting: WildlifeAnimal[] = [];

  constructor(
    private readonly units: UnitSystem,
    private readonly wildlife: WildlifeSystem,
    /** Who holds the ground at a point — KARAR 1's whole rule. */
    private readonly ownerAt: (x: number, z: number) => TerritoryOwner,
  ) {}

  /**
   * Pick targets, aim the chases, and land whatever bites came due.
   *
   * Run *before* the herd's own tick, the drive's rule: a victim chosen this
   * frame has to move the animal this frame, or every chase trails a step behind
   * the worker it is aimed at. Contact is therefore measured against the units'
   * post-movement positions (they moved at the top of the tick) and the
   * predator's pre-movement one — a fraction of {@link PREDATOR_STANDOFF} of
   * staleness, which is why it is not worth a second pass.
   */
  update(deltaSeconds: number): readonly PredatorStrike[] {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("Predator delta must be a non-negative finite number");
    }
    const strikes: PredatorStrike[] = [];
    this.hunting = [];
    let workers: readonly Unit[] | null = null;
    for (const animal of this.wildlife.all()) {
      const predator = animal.stats.predator;
      if (!predator) continue;
      // Only the animals this system governs have their flag cleared here, so
      // the retaliation pass and this one never overwrite each other's answer.
      animal.attacking = false;
      // A carcass hunts nobody, and a tamed predator is its owner's animal
      // rather than a danger on the map (KARAR 5's line, drawn once).
      if (animal.dead || animal.owner !== "wild") {
        this.giveUp(animal);
        continue;
      }
      const victim = this.victimFor(animal, () => (workers ??= this.huntableWorkers()));
      if (!victim) {
        this.giveUp(animal);
        continue;
      }
      this.victimIdByAnimalId.set(animal.id, victim.id);
      this.hunting.push(animal);

      const gap = Math.hypot(
        animal.position.x - victim.position.x,
        animal.position.z - victim.position.z,
      );
      const quarry: HuntQuarry = {
        x: victim.position.x,
        z: victim.position.z,
        pursuitRadius: predator.pursuitRadius,
        standoff: PREDATOR_STANDOFF,
      };
      animal.hunt = quarry;
      if (gap > CAUGHT_DISTANCE) {
        // Still closing. Banking the wind-up would hand a wolf that has just
        // caught up a free bite on arrival — the bull's rule, same reasoning.
        animal.strikeSeconds = 0;
        continue;
      }
      animal.attacking = true;
      animal.strikeSeconds += deltaSeconds;
      const interval = 60 / predator.attacksPerMinute;
      // A loop rather than one bite per tick: at eight-times game speed a single
      // step can span two intervals, and a wolf that bit less often the faster
      // the match ran would be a difficulty setting nobody chose.
      while (animal.strikeSeconds >= interval) {
        animal.strikeSeconds -= interval;
        animal.strikeCount += 1;
        victim.health.damage(predator.damage);
        strikes.push({ predator: animal, victim, damage: predator.damage });
        // What happens to the body happens elsewhere — `updateUnitDeaths` removes
        // it, and every job system drops a depleted worker on its own next pass.
        // Here it only means there is nobody left to bite.
        if (victim.health.depleted) break;
      }
    }
    return strikes;
  }

  /**
   * The predators currently hunting somebody — V3 Faz 4's answer to §3.4.
   *
   * What the composition root adds to `combatTargets()`, and the reason it is a
   * *list of animals* rather than a species check: wildlife is a
   * {@link CombatTarget} and `nearestHostile` reads owner alone, so handing it
   * the whole roster would make every grazing deer hostile to both kingdoms and
   * send half an army off after venison mid-raid (§9's first risk). A state
   * cannot do that. The deer only becomes a target by *becoming a hunter*, and
   * it stops being one the tick it gives up.
   *
   * A predator that is still closing counts, not only one already biting: the
   * Guard beside a worker being charged must be allowed to meet the wolf rather
   * than wait for the first bite to land.
   */
  aggressors(): readonly WildlifeAnimal[] {
    return this.hunting;
  }

  // --- internals ------------------------------------------------------------

  /**
   * The unit this predator is after, or null when it should be patrolling.
   *
   * A held victim is re-checked rather than re-chosen, so the two questions
   * "may this still be hunted" and "is there anything to hunt" share one set of
   * conditions ({@link huntable}) and can never disagree — the way a wolf keeps
   * chasing a worker who has just stepped into a Karakol's shadow.
   */
  private victimFor(animal: WildlifeAnimal, workers: () => readonly Unit[]): Unit | null {
    const predator = animal.stats.predator;
    if (!predator) return null;
    const heldId = this.victimIdByAnimalId.get(animal.id);
    if (heldId !== undefined) {
      const held = workers().find((unit) => unit.id === heldId);
      if (held && this.withinLeash(animal, held)) return held;
    }
    let best: Unit | null = null;
    let bestDistance = predator.acquisitionRadius * predator.acquisitionRadius;
    for (const worker of workers()) {
      if (!this.withinLeash(animal, worker)) continue;
      const distance = this.distanceSquared(animal, worker);
      // `<` rather than `<=` so the roster's own order breaks a tie, which keeps
      // acquisition deterministic for the headless AI (the wildlife RNG rule).
      if (distance >= bestDistance) continue;
      best = worker;
      bestDistance = distance;
    }
    return best;
  }

  /**
   * Everyone a predator is allowed to want, before distance is considered.
   *
   * Two filters and both are rules rather than optimisations. **Workers only**:
   * a soldier is never the wolf's problem, because a predator that picked fights
   * with the army would be an army chore, and §2.9 refuses that. **Unowned
   * ground**: KARAR 1 itself, read straight off the territory grid — inside any
   * kingdom's control area a worker is simply not on this list, which is what
   * makes "the control area protects you" a definition rather than a tuning.
   */
  private huntableWorkers(): readonly Unit[] {
    return this.units.all().filter((unit) => unit.role === "worker"
      && !unit.health.depleted
      && !unit.dying
      && this.ownerAt(unit.position.x, unit.position.z) === "neutral");
  }

  /**
   * Whether this victim is inside the den's leash.
   *
   * Measured from the **den**, not from the predator, and that is the difference
   * between a dangerous stretch of map and a wolf that follows a worker home. It
   * is the same circle {@link advanceHunt} clamps the body to, so a target this
   * accepts is by construction one the animal can actually reach — without it a
   * wolf would stand at the end of its leash with its teeth in the air.
   */
  private withinLeash(animal: WildlifeAnimal, victim: Unit): boolean {
    const predator = animal.stats.predator;
    if (!predator) return false;
    const dx = victim.position.x - animal.homeX;
    const dz = victim.position.z - animal.homeZ;
    return dx * dx + dz * dz <= predator.pursuitRadius * predator.pursuitRadius;
  }

  /**
   * Call off a chase and send the animal back to its patrol.
   *
   * The walk home is a chase aimed at the den rather than a fourth mode, and it
   * has to exist: the grazing mode holds an animal inside its home circle by
   * clamping, so a wolf released outside that circle would be *snapped* back to
   * the rim on its first patrol step — a teleport of most of the leash.
   *
   * Re-homing it where it stands (V3 §3.6's suggestion) was the cheaper call and
   * the wrong one: the den is the fixed point the leash, the nest-placement rule
   * and the map-fairness test are all measured from, and a den that walked with
   * the wolf would let a pack drift into a starting control area one chase at a
   * time.
   */
  private giveUp(animal: WildlifeAnimal): void {
    this.victimIdByAnimalId.delete(animal.id);
    animal.strikeSeconds = 0;
    const predator = animal.stats.predator;
    if (!predator || animal.dead || animal.owner !== "wild") {
      animal.hunt = null;
      return;
    }
    const fromDen = Math.hypot(animal.position.x - animal.homeX, animal.position.z - animal.homeZ);
    animal.hunt = fromDen > animal.roamProfile.roamRadius
      ? { x: animal.homeX, z: animal.homeZ, pursuitRadius: predator.pursuitRadius }
      : null;
  }

  private distanceSquared(animal: WildlifeAnimal, unit: Unit): number {
    const dx = animal.position.x - unit.position.x;
    const dz = animal.position.z - unit.position.z;
    return dx * dx + dz * dz;
  }
}
