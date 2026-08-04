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
 * Faz 5 gives it a second thing to want: the wild game its `preySpecies` names.
 * That half costs the map nothing and buys it a great deal — a herd beside a den
 * thins whether or not anybody is watching, and every deer the pack takes is one
 * the player will not (§2.8). It is the same chase, the same bite and the same
 * carcass the hunting camp already knows how to butcher; what it adds is a pause
 * over the kill, because a pack that started the next one on the frame the last
 * body dropped would clear a meadow before the player could read what happened.
 *
 * Movement is not owned here. This decides who is being chased and writes it to
 * {@link WildlifeAnimal.hunt}; the herd's own tick runs the third movement mode
 * over it, exactly as the pasture writes a `lead` and lets the animal walk it.
 */
import type { AnimalPredatorBalance } from "../../data/gameDataTypes";
import type { TerritoryOwner } from "../territory/territoryControlSystem";
import type { Unit } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { WildlifeAnimal, WildlifeSystem } from "./wildlifeSystem";
import {
  CAUGHT_DISTANCE,
  makeWildlifeRng,
  wildlifeSeed,
  type HuntQuarry,
} from "./wildlifeRoaming";

/**
 * How close a predator plants itself before biting, in world units.
 *
 * Under {@link CAUGHT_DISTANCE}, which is the reach of the bite itself, so a
 * predator that has finished closing is reliably inside its own strike range
 * instead of oscillating across the boundary. The gap is what keeps the wolf
 * standing *beside* its victim rather than inside him.
 */
const PREDATOR_STANDOFF = 1.2;

/**
 * One bite that has landed **on a person**, for the Faz 4 notification, the
 * retaliation call and the tests.
 *
 * Bites taken out of game (V3 Faz 5) deliberately produce none. A strike is
 * published so that something outside can *answer* it — a mauled worker turns on
 * the wolf, the notification feed says so — and a deer has no answer to give: it
 * is already running, and what becomes of it is written on the carcass rather
 * than in an event.
 */
export interface PredatorStrike {
  readonly predator: WildlifeAnimal;
  readonly victim: Unit;
  readonly damage: number;
}

/**
 * What a predator has picked, kept apart by kind rather than by a shared
 * interface — V3 Faz 5.
 *
 * The two bodies answer every question the chase itself asks (`position`,
 * `health`) identically, so the movement and the biting below are written once.
 * What differs is everything *around* the bite: only a person makes the wolf a
 * legitimate target for an army, only a person is worth a notification, and only
 * game leaves something behind to eat. A tag is what keeps those three rules
 * from having to guess.
 */
type PredatorQuarry =
  | { readonly kind: "worker"; readonly unit: Unit }
  | { readonly kind: "prey"; readonly animal: WildlifeAnimal };

/** The id of a held quarry, in whichever namespace its roster uses. */
type HeldQuarry =
  | { readonly kind: "worker"; readonly id: number }
  | { readonly kind: "prey"; readonly id: string };

/** A kill a predator is standing over, and how long it stays there. */
interface Meal {
  secondsLeft: number;
  readonly x: number;
  readonly z: number;
}

/** The body of whatever is being chased — the half both kinds share. */
function bodyOf(quarry: PredatorQuarry): Unit | WildlifeAnimal {
  return quarry.kind === "worker" ? quarry.unit : quarry.animal;
}

export class PredatorSystem {
  /**
   * What each predator is currently after, by id.
   *
   * Held rather than re-chosen every tick, and that is a behaviour decision, not
   * a cache: a wolf that took the nearest worker each frame would swap victims
   * whenever two crossed and end up oscillating between them, having bitten
   * neither. It commits until the target stops being valid.
   *
   * Keyed by id on both sides so nothing here keeps a dead body alive.
   */
  private readonly quarryByAnimalId = new Map<string, HeldQuarry>();

  /** The kill each predator is currently eating — see {@link chewOn}. */
  private readonly mealByAnimalId = new Map<string, Meal>();

  /**
   * Per-predator pause rolls, seeded from the animal's id.
   *
   * Seeded rather than `Math.random` for the reason the herd's own RNG is: how
   * long a wolf lingers decides how fast a meadow empties, so it is simulation,
   * and the headless AI has to see the same map the player does.
   */
  private readonly feedRngByAnimalId = new Map<string, () => number>();

  /**
   * The predators that were answerable when the last pass ended — see
   * {@link hostile}.
   *
   * Rebuilt each pass rather than derived from {@link victimIdByAnimalId} on
   * demand, because the two answer different questions: the map still names the
   * worker a wolf was after when he died, and half this list was never in the
   * map at all (a trespasser hunting nobody).
   */
  private hostileNow: WildlifeAnimal[] = [];

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
    this.hostileNow = [];
    let workers: readonly Unit[] | null = null;
    for (const animal of this.wildlife.all()) {
      const predator = animal.stats.predator;
      if (!predator) continue;
      // Only the animals this system governs have their flags cleared here, so
      // the retaliation pass and this one never overwrite each other's answer.
      animal.attacking = false;
      animal.feeding = false;
      // A carcass hunts nobody, and a tamed predator is its owner's animal
      // rather than a danger on the map (KARAR 5's line, drawn once).
      if (animal.dead || animal.owner !== "wild") {
        this.giveUp(animal);
        continue;
      }
      // A predator on its kill picks nothing, which is the whole brake on §2.8.
      const eating = this.chewOn(animal, predator, deltaSeconds);
      const quarry = eating
        ? null
        : this.victimFor(animal, predator, () => (workers ??= this.huntableWorkers()));
      // Answerable on either count, and the second one is what makes a Karakol
      // worth building against a den: KARAR 1 keeps a hunting wolf *outside* the
      // control area by definition, and the shipped tower owns further
      // (`controlRadius`) than it can shoot (`attackRange`) — so "is it hunting"
      // alone would have been a rule the tower could never once satisfy.
      //
      // Only a chase after a *person* counts. A wolf running down a deer three
      // meadows away threatens nobody, and putting it on offer would send the
      // escort §2.9 refuses to spend off after it — the same half of §9's first
      // risk, arriving through the hunt instead of through the roster. Trespass
      // still answers for the wolf on your ground, kill or no kill.
      if (quarry?.kind === "worker" || this.trespassing(animal)) this.hostileNow.push(animal);
      if (eating) continue;
      if (!quarry) {
        this.giveUp(animal);
        continue;
      }
      this.hold(animal, quarry);

      const body = bodyOf(quarry);
      const gap = Math.hypot(
        animal.position.x - body.position.x,
        animal.position.z - body.position.z,
      );
      const chase: HuntQuarry = {
        x: body.position.x,
        z: body.position.z,
        pursuitRadius: predator.pursuitRadius,
        standoff: PREDATOR_STANDOFF,
      };
      animal.hunt = chase;
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
        body.health.damage(predator.damage);
        if (quarry.kind === "worker") {
          strikes.push({ predator: animal, victim: quarry.unit, damage: predator.damage });
        }
        if (body.health.depleted) {
          // What happens to a fallen *worker* happens elsewhere —
          // `updateUnitDeaths` removes him and every job system drops a depleted
          // worker on its own next pass — so here his death only means there is
          // nobody left to bite. Game is the opposite: the carcass stays on the
          // map as meat (V3 Faz 5), and the wolf stays on the carcass.
          if (quarry.kind === "prey") this.beginMeal(animal, quarry.animal);
          break;
        }
      }
    }
    return strikes;
  }

  /**
   * The predators an army and a tower may answer — V3 Faz 4's answer to §3.4.
   *
   * What the composition root adds to `combatTargets()`, and the reason it is a
   * *list of animals* rather than a species check: wildlife is a
   * {@link CombatTarget} and `nearestHostile` reads owner alone, so handing it
   * the whole roster would make every grazing deer hostile to both kingdoms and
   * send half an army off after venison mid-raid (§9's first risk). A **state**
   * cannot do that, and there are two of them here — both ones an animal can
   * walk out of again:
   *
   * - **Hunting somebody.** One that is still closing counts, not only one
   *   already biting: the Guard beside a charged worker has to be allowed to meet
   *   the wolf rather than wait for the first bite to land.
   * - **Standing on a kingdom's ground.** A wolf inside a control area is a
   *   trespasser, and this is the half that makes §2.7 real. KARAR 1 holds a
   *   *hunting* wolf outside the control area by construction, while the Karakol
   *   owns 16 and shoots 12 — so on the first state alone the tower's arrows
   *   could never once fire, which is exactly how it played. It also answers what
   *   the pack looked like once a tower went up beside the den: unmolestable
   *   workers walking past unmolested wolves, "as if they had been tamed".
   *
   * Grazing wildlife is in neither, whichever ground it wanders onto: a deer in
   * your territory is livestock you have not caught, not a threat.
   */
  hostile(): readonly WildlifeAnimal[] {
    return this.hostileNow;
  }

  // --- internals ------------------------------------------------------------

  /**
   * Whether this predator is standing on ground some kingdom holds.
   *
   * The same {@link ownerAt} read KARAR 1 makes about the *victim*, asked about
   * the animal instead — so the two halves of V3's territory rule are one grid
   * lookup with the sign flipped: unowned ground is where a worker may be taken,
   * owned ground is where a wolf may be shot.
   */
  private trespassing(animal: WildlifeAnimal): boolean {
    return this.ownerAt(animal.position.x, animal.position.z) !== "neutral";
  }

  /**
   * What this predator is after, or null when it should be patrolling.
   *
   * A held quarry is re-checked rather than re-chosen, so the two questions
   * "may this still be hunted" and "is there anything to hunt" share one set of
   * conditions and can never disagree — the way a wolf keeps chasing a worker
   * who has just stepped into a Karakol's shadow.
   *
   * People outrank game, and that ordering is total on purpose: a worker who
   * walks past a wolf already running down a deer takes the chase over, but
   * nothing ever hands it back, so the priority cannot become the oscillation
   * the held quarry exists to prevent. It is also the honest reading of the
   * feature — §1 sells the wolf as the reason to escort a worker, and a wolf
   * that finished its venison first would be scenery at the exact moment it was
   * supposed to be a threat.
   */
  private victimFor(
    animal: WildlifeAnimal,
    predator: AnimalPredatorBalance,
    workers: () => readonly Unit[],
  ): PredatorQuarry | null {
    const held = this.quarryByAnimalId.get(animal.id);
    if (held?.kind === "worker") {
      const unit = workers().find((candidate) => candidate.id === held.id);
      if (unit && this.withinLeash(animal, predator, unit.position)) return { kind: "worker", unit };
    }
    const worker = this.nearest(animal, predator, workers());
    if (worker) return { kind: "worker", unit: worker };
    if (held?.kind === "prey") {
      const kept = this.wildlife.animalById(held.id);
      if (kept && this.isPrey(animal, predator, kept) && this.withinLeash(animal, predator, kept.position)) {
        return { kind: "prey", animal: kept };
      }
    }
    const prey = this.nearest(
      animal,
      predator,
      this.wildlife.all().filter((candidate) => this.isPrey(animal, predator, candidate)),
    );
    return prey ? { kind: "prey", animal: prey } : null;
  }

  /**
   * Whether this animal is game the hunter is allowed to bring down — KARAR 5,
   * and the only place that decision is taken.
   *
   * `preySpecies` names wild game and nothing else; the table is what refuses a
   * tameable species there (`validateAnimalBalance`), so livestock cannot be
   * listed and a driven cow is doubly safe: the owner check below takes an
   * animal out of the wild economy the moment a shepherd pens it, exactly as it
   * does for the hunting camp. Buildings never come up — a structure is not on
   * any roster this system reads.
   */
  private isPrey(
    hunter: WildlifeAnimal,
    predator: AnimalPredatorBalance,
    candidate: WildlifeAnimal,
  ): boolean {
    return candidate !== hunter
      && !candidate.dead
      && candidate.owner === "wild"
      && predator.preySpecies.includes(candidate.stats.id);
  }

  /** The nearest of `candidates` inside both the eye and the leash, or null. */
  private nearest<T extends { readonly position: { readonly x: number; readonly z: number } }>(
    animal: WildlifeAnimal,
    predator: AnimalPredatorBalance,
    candidates: readonly T[],
  ): T | null {
    let best: T | null = null;
    let bestDistance = predator.acquisitionRadius * predator.acquisitionRadius;
    for (const candidate of candidates) {
      if (!this.withinLeash(animal, predator, candidate.position)) continue;
      const distance = this.distanceSquared(animal, candidate.position);
      // `<` rather than `<=` so the roster's own order breaks a tie, which keeps
      // acquisition deterministic for the headless AI (the wildlife RNG rule).
      if (distance >= bestDistance) continue;
      best = candidate;
      bestDistance = distance;
    }
    return best;
  }

  /**
   * Age the pause a predator takes over its kill, and hold it there.
   *
   * Returns whether it is still eating. Two things happen in this window and
   * both are the point of it. The pack thins a herd at a pace a player can
   * watch — §2.8 asks for a meadow that empties "over time", and back-to-back
   * kills would empty one in the time it takes to notice the first — and the
   * wolf is *visibly* on the body rather than trotting off the instant it
   * stops moving.
   *
   * The carcass is held as a quarry rather than by releasing the animal, and
   * that is the Faz 3 lesson repeated: grazing clamps a body inside its patrol
   * circle, so a wolf let go over a kill outside that circle snaps back to the
   * rim in one frame. Standing still is a chase whose target it has already
   * reached.
   *
   * How long is the species' own `restSeconds` — the pause it already takes
   * between moves — rather than a new balance field. A carnivore has no grazing
   * pause to spend it on, so the number was authored and unused; the meal is
   * exactly what it means for this species.
   */
  private chewOn(
    animal: WildlifeAnimal,
    predator: AnimalPredatorBalance,
    deltaSeconds: number,
  ): boolean {
    const meal = this.mealByAnimalId.get(animal.id);
    if (!meal) return false;
    meal.secondsLeft -= deltaSeconds;
    if (meal.secondsLeft <= 0) {
      // Done eating: hand it straight back to the same walk home a called-off
      // chase takes, in this tick rather than the next, so it may also pick a
      // fresh target on the way if one has wandered into range.
      this.giveUp(animal);
      return false;
    }
    animal.feeding = true;
    animal.hunt = {
      x: meal.x,
      z: meal.z,
      pursuitRadius: predator.pursuitRadius,
      standoff: PREDATOR_STANDOFF,
    };
    return true;
  }

  /** Settle a predator onto the kill it has just made. */
  private beginMeal(animal: WildlifeAnimal, prey: WildlifeAnimal): void {
    this.quarryByAnimalId.delete(animal.id);
    animal.strikeSeconds = 0;
    const { min, max } = animal.stats.restSeconds;
    this.mealByAnimalId.set(animal.id, {
      secondsLeft: min + this.feedRandom(animal)() * (max - min),
      x: prey.position.x,
      z: prey.position.z,
    });
  }

  private feedRandom(animal: WildlifeAnimal): () => number {
    let random = this.feedRngByAnimalId.get(animal.id);
    if (!random) {
      random = makeWildlifeRng(wildlifeSeed(`feed:${animal.id}`));
      this.feedRngByAnimalId.set(animal.id, random);
    }
    return random;
  }

  private hold(animal: WildlifeAnimal, quarry: PredatorQuarry): void {
    this.quarryByAnimalId.set(
      animal.id,
      quarry.kind === "worker"
        ? { kind: "worker", id: quarry.unit.id }
        : { kind: "prey", id: quarry.animal.id },
    );
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
  private withinLeash(
    animal: WildlifeAnimal,
    predator: AnimalPredatorBalance,
    victim: { readonly x: number; readonly z: number },
  ): boolean {
    const dx = victim.x - animal.homeX;
    const dz = victim.z - animal.homeZ;
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
   * time. Faz 5 weighed it again where §3.6 asked it to be weighed — over a
   * finished kill — and the answer got stronger rather than weaker: a den that
   * moved to each carcass would walk a pack across the map one deer at a time,
   * and the meadow it was placed to guard would be behind it by the third meal.
   */
  private giveUp(animal: WildlifeAnimal): void {
    this.quarryByAnimalId.delete(animal.id);
    this.mealByAnimalId.delete(animal.id);
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

  private distanceSquared(
    animal: WildlifeAnimal,
    point: { readonly x: number; readonly z: number },
  ): number {
    const dx = animal.position.x - point.x;
    const dz = animal.position.z - point.z;
    return dx * dx + dz * dz;
  }
}
