/**
 * Authoritative state for the map's wild animals — wildlife plan Faz 2.
 *
 * Deliberately a sibling of {@link UnitSystem} rather than a user of it. An
 * animal is not a `Unit`, and the reason is concrete: `PopulationSystem` counts
 * a kingdom's population as `units.unitsOf(owner).length`, so a deer registered
 * as a Unit would silently eat a population slot that nothing on screen explains
 * (wildlife plan §3.5/§4.2). Keeping wildlife in its own system leaves
 * population, team colours, the AI blackboard and the kingdom registry working
 * on the two owners they were written for.
 *
 * What an animal *does* lives next door in {@link ./wildlifeRoaming}, which is
 * pure. This file owns identity, health and the herd roster.
 *
 * Animals are {@link CombatTarget}s from the moment they exist, but nothing
 * offers them to the engagement system yet — hunting arrives in Faz 5. The
 * interface compliance is what lets that phase be additive.
 */
import { Vector3 } from "three";

import type { AnimalBalance, AnimalBalanceStats, UnitArmorClass } from "../../data/gameDataTypes";
import type { CombatTarget, CombatTargetOwner } from "../combat/combatTarget";
import type { UnitOwner } from "../units/unit";
import { HealthComponent } from "../units/health";
import type {
  ReservedResourceSource,
  ResourceHarvest,
  ResourceHarvestRequest,
  ResourceReach,
  ResourceSource,
} from "../economy/resourceSource";
import {
  advanceLed,
  advanceRoam,
  initialRoamState,
  makeWildlifeRng,
  randomPointInHerd,
  wildlifeSeed,
  type RoamProfile,
  type RoamState,
  type ThreatPoint,
  type WildlifeLead,
} from "./wildlifeRoaming";

/** Below this, a carcass counts as picked clean rather than carrying a rounding crumb. */
const MEAT_EPSILON = 1e-9;

/**
 * A wild herd's grazing circle, centred wherever the herd lives.
 *
 * One definition rather than two, because it is built in two places that must
 * agree: at spawn from the authored herd, and again when a razed pasture turns
 * its livestock loose where it stood (Faz 5).
 */
export function wildProfileFor(stats: AnimalBalanceStats, x: number, z: number): RoamProfile {
  return {
    homeX: x,
    homeZ: z,
    roamRadius: stats.roamRadius,
    walkSpeed: stats.walkClipSpeed,
    fleeSpeed: stats.moveSpeed,
    fleeRadius: stats.fleeRadius,
    fleeSeconds: stats.fleeSeconds,
    fleeRecoverySeconds: stats.fleeRecoverySeconds,
  };
}

/** One authored herd: a species, a centre, and how many animals stand in it. */
export interface RtsHerdDefinition {
  readonly id: string;
  readonly species: string;
  readonly x: number;
  readonly z: number;
  readonly count: number;
}

/** Read-only view for presentation, debug and tests. */
export interface WildlifeAnimalSnapshot {
  readonly id: string;
  readonly herdId: string;
  readonly species: string;
  readonly x: number;
  readonly z: number;
  readonly facing: number;
  /** Ground speed this tick — what the animation selector reads. */
  readonly speed: number;
  readonly dead: boolean;
  /** Food left on the carcass; the species' full `meatCapacity` while it lives. */
  readonly remainingMeat: number;
  /** `"wild"` until a shepherd pens it; then the kingdom that owns the pasture. */
  readonly owner: CombatTargetOwner;
}

/**
 * One wild animal.
 *
 * `armorClass` is fixed at `"light"` rather than authored: every huntable
 * species is unarmoured, and giving the balance table a knob whose only correct
 * value is one value invites a nonsensical one.
 */
export class WildlifeAnimal implements CombatTarget {
  /**
   * Who this animal answers to. Written only by {@link WildlifeSystem.tame}.
   *
   * The type was already wide enough (V1 Faz 2 made it {@link CombatTargetOwner}),
   * so ownership costs a mutable field and nothing else — no second roster, no
   * kingdom registration, and population still cannot see it.
   */
  owner: CombatTargetOwner = "wild";
  readonly armorClass: UnitArmorClass = "light";
  readonly position = new Vector3();
  readonly health: HealthComponent;

  facing = 0;
  /** Ground speed travelled last tick, republished for the clip selector. */
  speed = 0;
  /**
   * Food left to take off this animal.
   *
   * Full while it lives, because that is what the herd is *worth* to a camp
   * deciding whether it still has a source — the hunt is how you earn it, not a
   * discount on it. Death changes nothing about the number; it only makes it
   * reachable.
   */
  remainingMeat: number;
  /**
   * The one worker who has claimed this animal — herd-plan §3.4's
   * one-worker-per-tree rule, shared by the hunt and the drive.
   *
   * Deliberately one field rather than two: a hunter and a shepherd wanting the
   * same cow is a real race, and a second claim register would have let both win
   * it.
   */
  reservedByWorkerId: number | null = null;
  /**
   * Set while a shepherd has hold of this animal (Faz 4). Overrides grazing and
   * fleeing entirely — see {@link advanceLed}.
   */
  lead: WildlifeLead | null = null;

  private roam: RoamState;
  private readonly random: () => number;

  constructor(
    readonly id: string,
    readonly herdId: string,
    readonly stats: AnimalBalanceStats,
    private profile: RoamProfile,
  ) {
    this.health = new HealthComponent(stats.maxHealth);
    this.remainingMeat = stats.meatCapacity;
    this.random = makeWildlifeRng(wildlifeSeed(id));
    // Scattered across the herd's circle at spawn rather than stacked on its
    // centre, so a herd reads as a herd on the first frame.
    const start = randomPointInHerd(profile, this.random);
    this.position.set(start.x, 0, start.z);
    this.roam = initialRoamState(profile, this.random);
  }

  get dead(): boolean {
    return this.health.depleted;
  }

  /** True once it has been killed and picked clean; nothing is left to hunt here. */
  get spent(): boolean {
    return this.dead && this.remainingMeat <= 0;
  }

  /** The herd centre this animal belongs to — a fixed point a bolt cannot move. */
  get homeX(): number {
    return this.profile.homeX;
  }

  get homeZ(): number {
    return this.profile.homeZ;
  }

  /** Where this animal grazes now — its herd's circle, or its pasture's yard. */
  get roamProfile(): RoamProfile {
    return this.profile;
  }

  /**
   * Move this animal's home to a new circle and re-seat it inside it.
   *
   * The roam state is rebuilt rather than kept: its target is a point in the old
   * herd's ground, so an animal penned without this would walk straight back to
   * the meadow it was driven out of.
   */
  rehome(profile: RoamProfile): void {
    this.profile = profile;
    this.roam = initialRoamState(profile, this.random);
  }

  /** Graze one tick, or bolt from `threat`. A carcass holds still. */
  update(deltaSeconds: number, threat: ThreatPoint | null = null): void {
    if (this.dead) {
      this.speed = 0;
      return;
    }
    if (this.lead) {
      const led = advanceLed(
        { x: this.position.x, z: this.position.z, facing: this.facing },
        this.lead,
        this.profile,
        deltaSeconds,
      );
      this.position.set(led.x, this.position.y, led.z);
      this.facing = led.facing;
      this.speed = led.speed;
      return;
    }
    const pose = advanceRoam(
      this.roam,
      { x: this.position.x, z: this.position.z, facing: this.facing },
      this.profile,
      deltaSeconds,
      this.random,
      threat,
    );
    this.position.set(pose.x, this.position.y, pose.z);
    this.facing = pose.facing;
    this.speed = pose.speed;
  }

  snapshot(): WildlifeAnimalSnapshot {
    return {
      id: this.id,
      herdId: this.herdId,
      species: this.stats.id,
      x: this.position.x,
      z: this.position.z,
      facing: this.facing,
      speed: this.speed,
      dead: this.dead,
      remainingMeat: this.remainingMeat,
      owner: this.owner,
    };
  }
}

/** Shared wildlife state for presentation, the hunt and the AI. */
export class WildlifeSystem implements ResourceSource {
  private readonly animals: WildlifeAnimal[] = [];
  private readonly byId = new Map<string, WildlifeAnimal>();
  private readonly animalIdByWorkerId = new Map<number, string>();
  /** Monotonic, so a newborn never inherits a dead animal's id (see {@link bear}). */
  private bornCount = 0;

  /**
   * One deer is as good as the next. A hunter walled off from his quarry takes
   * the neighbouring animal, and one who has just delivered goes to whichever
   * camp is closest to live game — the grove rule, for the same reason: what the
   * camp banks is meat, not this particular deer.
   */
  readonly sourcesAreInterchangeable = true;

  constructor(private readonly balance: AnimalBalance, herds: readonly RtsHerdDefinition[]) {
    const seen = new Set<string>();
    for (const herd of herds) {
      if (seen.has(herd.id)) throw new Error(`Duplicate herd "${herd.id}"`);
      seen.add(herd.id);
      const stats = balance[herd.species];
      if (!stats) throw new Error(`Herd "${herd.id}" references unknown species "${herd.species}"`);
      if (!Number.isInteger(herd.count) || herd.count <= 0) {
        throw new RangeError(`Herd "${herd.id}" count must be a positive integer`);
      }
      const profile = wildProfileFor(stats, herd.x, herd.z);
      for (let index = 0; index < herd.count; index += 1) {
        const animal = new WildlifeAnimal(`${herd.id}:${index}`, herd.id, stats, profile);
        this.animals.push(animal);
        this.byId.set(animal.id, animal);
      }
    }
  }

  /**
   * Advance every animal, bolting from the nearest of `threats`.
   *
   * Every person on the field frightens wildlife, not only the hunter who
   * claimed it: a herd that scattered for its assigned hunter and stood placidly
   * in an army's path would look like scenery with one scripted reaction. It
   * also keeps this system from having to learn which workers are hunting.
   */
  update(deltaSeconds: number, threats: readonly ThreatPoint[] = []): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("Wildlife delta must be a non-negative finite number");
    }
    for (const animal of this.animals) {
      // Livestock is not frightened by people. A penned cow that still bolted
      // would spend the match being spooked by the very workers who own it, and
      // the caught-branch freeze would pin it every time one walked past.
      const threat = animal.owner === "wild" ? this.nearestThreat(animal, threats) : null;
      animal.update(deltaSeconds, threat);
    }
  }

  /** Every animal, dead ones included — presentation still draws a carcass. */
  all(): readonly WildlifeAnimal[] {
    return this.animals;
  }

  /**
   * Living animals within `radius` of a point, nearest first.
   *
   * The query a hunting camp asks (Faz 5) and the one that decides whether a
   * camp may be built at all (Faz 4).
   */
  liveAnimalsNear(x: number, z: number, radius: number): readonly WildlifeAnimal[] {
    if (!Number.isFinite(radius) || radius < 0) {
      throw new RangeError("Wildlife search radius must be non-negative and finite");
    }
    return this.animals
      .filter((animal) => !animal.dead && this.distanceSquared(animal, x, z) <= radius * radius)
      .sort((left, right) => this.distanceSquared(left, x, z) - this.distanceSquared(right, x, z));
  }

  /**
   * Live animals in reach that still belong to nobody — what a hunting camp may
   * actually work, and so what may justify building one.
   *
   * The placement half of §3.7: without it a camp raised beside a full pasture
   * would be legal and then immediately report `source-depleted`, because the
   * only animals in its circle are cattle it is forbidden to shoot.
   */
  huntableAnimalsNear(x: number, z: number, radius: number): readonly WildlifeAnimal[] {
    return this.liveAnimalsNear(x, z, radius).filter((animal) => animal.owner === "wild");
  }

  /**
   * Live, wild, tameable animals within `radius`, nearest first.
   *
   * Deliberately narrower than {@link liveAnimalsNear} on both counts the pasture
   * plan §2 cares about. A species the table says cannot be tamed justifies no
   * pasture — a ring of deer would otherwise let a player build one that could
   * never fill. And an animal that is already someone's counts for nobody: a full
   * pen must stop being the reason a second pasture is legal beside it.
   *
   * This is the placement question, and it is also which animal a shepherd walks
   * out to ({@link reserveForTaming}).
   */
  tameableAnimalsNear(x: number, z: number, radius: number): readonly WildlifeAnimal[] {
    return this.huntableAnimalsNear(x, z, radius).filter((animal) => animal.stats.tameable);
  }

  /**
   * Claim the nearest unclaimed tameable animal for a shepherd — the drive's
   * counterpart of {@link reserveNearest}, sharing its one claim register so a
   * hunter and a shepherd can never both take the same cow.
   *
   * Like a hunter's claim it survives range: the point of calming an animal is
   * that it bolted first, and a claim dropped when the quarry crossed the
   * pasture's circle would restart the chase forever.
   */
  reserveForTaming(workerId: number, x: number, z: number, radius: number): WildlifeAnimal | null {
    const heldId = this.animalIdByWorkerId.get(workerId);
    const held = heldId ? this.byId.get(heldId) : undefined;
    if (held && !held.dead && held.owner === "wild" && held.stats.tameable) return held;
    this.releaseReservation(workerId);
    const next = this.tameableAnimalsNear(x, z, radius)
      .find((animal) => animal.reservedByWorkerId === null);
    if (!next) return null;
    next.reservedByWorkerId = workerId;
    this.animalIdByWorkerId.set(workerId, next.id);
    return next;
  }

  /** One animal by id, for systems that hold ids rather than references. */
  animalById(animalId: string): WildlifeAnimal | null {
    return this.byId.get(animalId) ?? null;
  }

  /** The animal this worker is holding, hunt or drive alike; null if none. */
  reservationOf(workerId: number): WildlifeAnimal | null {
    const animalId = this.animalIdByWorkerId.get(workerId);
    return (animalId ? this.byId.get(animalId) : undefined) ?? null;
  }

  /**
   * Hand a calmed animal to a kingdom and re-home it in its pasture's yard.
   *
   * This is the one call that takes an animal out of the wild economy: from here
   * `huntable` refuses it, so the hunting camp next door stops counting it as
   * meat and can never shoot it. Its claim is dropped at the same moment — the
   * shepherd's job is done, and a claim left behind would keep the next shepherd
   * away from an animal nobody is walking any more.
   */
  tame(animalId: string, owner: UnitOwner, pen: RoamProfile): boolean {
    const animal = this.byId.get(animalId);
    if (!animal || animal.dead || animal.owner !== "wild") return false;
    animal.owner = owner;
    animal.lead = null;
    animal.rehome(pen);
    if (animal.reservedByWorkerId !== null) this.releaseReservation(animal.reservedByWorkerId);
    return true;
  }

  /**
   * Turn an owned animal loose where it stands — a razed pasture, Faz 5.
   *
   * It re-enters the wild economy completely: huntable again, frightened again,
   * and grazing a fresh circle centred on wherever the pen was. Deleting it
   * instead would be the cheaper code and the worse rule — the plan is explicit
   * that razing a pasture *frees* the herd rather than destroying it, and an
   * opponent who burns your barn should have to hunt the cattle down.
   */
  returnToWild(animalId: string): boolean {
    const animal = this.byId.get(animalId);
    if (!animal || animal.owner === "wild") return false;
    animal.owner = "wild";
    animal.lead = null;
    animal.rehome(wildProfileFor(animal.stats, animal.position.x, animal.position.z));
    return true;
  }

  /**
   * Add an animal born in a pen (Faz 5's breeding), already owned and already
   * standing in its pasture's yard.
   *
   * Ids are minted rather than authored, and they must stay unique for the life
   * of the match: presentation keys its bodies on them, and a reused id would
   * hand a newborn the art of an animal that is no longer there.
   */
  bear(species: string, owner: UnitOwner, pen: RoamProfile): WildlifeAnimal | null {
    const stats = this.balance[species];
    if (!stats) return null;
    const id = `born:${species}:${this.bornCount += 1}`;
    const animal = new WildlifeAnimal(id, id, stats, pen);
    animal.owner = owner;
    this.animals.push(animal);
    this.byId.set(id, animal);
    return animal;
  }

  snapshots(): readonly WildlifeAnimalSnapshot[] {
    return this.animals
      .map((animal) => animal.snapshot())
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  // --- ResourceSource -------------------------------------------------------

  /**
   * Meat still standing (or lying) in reach, never null: to a player a camp with
   * no herd nearby and one that has hunted its herd out are the same sentence —
   * there is nothing to hunt here — which is the forest's rule, not the mine's.
   *
   * An animal a hunter has claimed counts even when its bolt has carried it out
   * of range, provided its herd still lives inside the camp's reach. That is the
   * hysteresis §9 asks for: without it a fleeing deer would flip the camp between
   * "producing" and "source-depleted" every few seconds, and the panel would read
   * as broken while the hunt was going perfectly.
   */
  remainingNear(reach: ResourceReach): number {
    return this.huntable(reach).reduce((total, animal) => total + animal.remainingMeat, 0);
  }

  nearestSourceDistanceSquared(reach: ResourceReach): number {
    const nearest = this.huntable(reach)
      .sort((a, b) => this.distanceSquared(a, reach.x, reach.z) - this.distanceSquared(b, reach.x, reach.z))[0];
    return nearest ? this.distanceSquared(nearest, reach.x, reach.z) : Number.POSITIVE_INFINITY;
  }

  /**
   * Claim the nearest unclaimed animal with meat on it.
   *
   * One hunter per animal, the tree rule rather than the deposit rule: two
   * hunters bringing the same deer down would stand inside each other, and the
   * carcass would be picked twice as fast for no reason a player could see.
   *
   * An existing claim is kept **regardless of range**, which is the other half of
   * the hysteresis: the whole point of a chase is that the quarry has run off,
   * and a claim dropped the moment it crossed the camp's reach would send the
   * hunter home mid-pursuit, every time, forever.
   */
  reserveNearest(
    workerId: number,
    reach: ResourceReach,
    rejectedSourceIds: ReadonlySet<string> = new Set(),
  ): ReservedResourceSource | null {
    const heldId = this.animalIdByWorkerId.get(workerId);
    const held = heldId ? this.byId.get(heldId) : undefined;
    if (held && !held.spent && !rejectedSourceIds.has(held.id)) {
      return { id: held.id, x: held.position.x, z: held.position.z };
    }
    this.releaseReservation(workerId);
    const next = this.huntable(reach)
      .filter((animal) => animal.reservedByWorkerId === null && !rejectedSourceIds.has(animal.id))
      .sort((a, b) => this.distanceSquared(a, reach.x, reach.z) - this.distanceSquared(b, reach.x, reach.z))[0];
    if (!next) return null;
    next.reservedByWorkerId = workerId;
    this.animalIdByWorkerId.set(workerId, next.id);
    return { id: next.id, x: next.position.x, z: next.position.z };
  }

  /** Where the quarry is *now* — the query a static source answers with a constant. */
  positionOf(sourceId: string): { readonly x: number; readonly z: number } | null {
    const animal = this.byId.get(sourceId);
    return animal ? { x: animal.position.x, z: animal.position.z } : null;
  }

  /**
   * One tick of hunting: bring the animal down, then butcher it.
   *
   * The kill is timed rather than metered — `huntSeconds` is what a tuner reads,
   * and the damage rate falls out of it — so this is the one source that uses the
   * request's `deltaSeconds`. While the animal still stands it reports
   * `working: true` with nothing earned, which keeps the hunter on station
   * instead of walking home empty-handed every frame.
   */
  harvest({ workerId, sourceId, amount, deltaSeconds }: ResourceHarvestRequest): ResourceHarvest {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new RangeError("Requested meat harvest must be a non-negative finite number");
    }
    const animal = this.byId.get(sourceId);
    if (!animal || animal.reservedByWorkerId !== workerId || animal.spent) {
      return { amount: 0, working: false };
    }
    if (!animal.dead) {
      animal.health.damage((animal.stats.maxHealth / animal.stats.huntSeconds) * deltaSeconds);
      return { amount: 0, working: true };
    }
    const taken = Math.min(amount, animal.remainingMeat);
    animal.remainingMeat -= taken;
    if (animal.remainingMeat <= MEAT_EPSILON) animal.remainingMeat = 0;
    return { amount: taken, working: taken > 0 };
  }

  releaseReservation(workerId: number): void {
    const animalId = this.animalIdByWorkerId.get(workerId);
    const animal = animalId ? this.byId.get(animalId) : undefined;
    if (animal?.reservedByWorkerId === workerId) animal.reservedByWorkerId = null;
    this.animalIdByWorkerId.delete(workerId);
  }

  // --- internals ------------------------------------------------------------

  /**
   * Animals with meat left that a camp at `reach` may work.
   *
   * A camp claims a **herd**, not whichever animals happen to be standing in its
   * circle this second, so an animal counts when either it or its herd's centre
   * is in reach. The herd centre is the part that matters: a hunted deer bolts
   * away from the camp and dies where it stopped, and a carcass judged only by
   * where it fell would drop out of reach the moment its hunter let go of it —
   * the camp would report `source-depleted` with meat lying on the ground.
   *
   * That is the hysteresis §9 asks for, and it is deliberately *not* how
   * placement decides (`liveAnimalsNear`, on live positions): where a camp may be
   * built stays a local question about animals you can see, while what it may
   * work follows the herd it was built for.
   */
  private huntable(reach: ResourceReach): WildlifeAnimal[] {
    if (!Number.isFinite(reach.radius) || reach.radius < 0) {
      throw new RangeError("Wildlife search radius must be non-negative and finite");
    }
    const radiusSquared = reach.radius * reach.radius;
    // Wild only, §3.7: a camp built beside its owner's pasture would otherwise
    // count the pen as its herd and send hunters to shoot the kingdom's own
    // cattle. A tamed animal leaves the wild economy completely.
    return this.animals.filter((animal) => !animal.spent && animal.owner === "wild"
      && (this.distanceSquared(animal, reach.x, reach.z) <= radiusSquared
        || this.homeInRange(animal, reach, radiusSquared)));
  }

  private homeInRange(animal: WildlifeAnimal, reach: ResourceReach, radiusSquared: number): boolean {
    const dx = animal.homeX - reach.x;
    const dz = animal.homeZ - reach.z;
    return dx * dx + dz * dz <= radiusSquared;
  }

  private nearestThreat(animal: WildlifeAnimal, threats: readonly ThreatPoint[]): ThreatPoint | null {
    let nearest: ThreatPoint | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const threat of threats) {
      const distance = this.distanceSquared(animal, threat.x, threat.z);
      if (distance >= bestDistance) continue;
      nearest = threat;
      bestDistance = distance;
    }
    return nearest;
  }

  private distanceSquared(animal: WildlifeAnimal, x: number, z: number): number {
    const dx = animal.position.x - x;
    const dz = animal.position.z - z;
    return dx * dx + dz * dz;
  }
}
