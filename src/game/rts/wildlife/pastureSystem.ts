/**
 * Shepherds, the drive, and the pen — pasture plan V2 Faz 4.
 *
 * Driving an animal home is a **job**, not a gather trip, and the difference is
 * the whole reason this file exists rather than a fourth `ResourceSource`
 * (plan §3.4). A source's `harvest` returns a *number*, the loop adds it to the
 * worker's cargo, and the cargo is banked as the building's `resourceId` — so a
 * cow driven through that machinery would arrive at the pasture and be deposited
 * as food. What comes home here is an animal, and the pasture keeps it.
 *
 * So this follows {@link WorkerConstructionSystem} instead: it pulls its own
 * workers out of the idle pool, runs its own small state machine, and the
 * economy only ever asks it "is this worker busy?". The three states are the
 * three sentences the plan's §2 promises — walk out to it, calm it, walk it
 * home — and nothing else is in here.
 *
 * The animal itself is still not a navigation agent (Faz 2's decision, kept). It
 * follows the shepherd's live position, and the shepherd is the one who walks a
 * planned route.
 */
import { Vector3 } from "three";

import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { PlacedStructure, PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { Unit, UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { AnimalBalanceStats } from "../../data/gameDataTypes";
import type { WildlifeAnimal, WildlifeSystem } from "./wildlifeSystem";
import { CAUGHT_DISTANCE, type RoamProfile } from "./wildlifeRoaming";

export type ShepherdState = "moving-to-animal" | "calming" | "driving";

/**
 * How wide a ring the pen's yard is, in world units.
 *
 * Its *inner* radius is the building's own half-diagonal, so penned animals
 * graze around the barn rather than inside it; this is only how far out the yard
 * then reaches. Small on purpose: a pen that sprawled would read as a herd that
 * merely happens to live near a building, which is the picture the pasture is
 * meant to replace.
 */
const PEN_RING_WIDTH = 3;

/** Close enough to the shepherd to start calming; the contact distance an animal is caught at. */
const CONTACT_RANGE = CAUGHT_DISTANCE;

/** How far a claimed animal may drift from the walk aimed at it before it is re-planned. */
const CHASE_SLACK = CONTACT_RANGE * 1.5;

interface ShepherdAssignment {
  readonly worker: Unit;
  readonly pasture: PastureRecord;
  readonly animalId: string;
  state: ShepherdState;
  /** Seconds of calming banked so far, against the species' `tameSeconds`. */
  calmedSeconds: number;
  /** The point the worker is currently walking to. */
  approach: Vector3;
}

interface PastureRecord {
  readonly structure: PlacedStructure;
  readonly penned: Set<string>;
  readonly pen: PenGeometry;
  /**
   * Seconds of gestation banked per species standing in this pen.
   *
   * Per species rather than one shared timer, because `breedSeconds` is authored
   * per species and averaging two of them would be a number no table contains.
   * It also keeps the yield decision honest: a pen of bulls breeds at the bull's
   * pace, which is the price of the bull's richer output.
   */
  readonly gestation: Map<string, number>;
}

/** One pasture's livestock state, for the panel, the AI and the tests. */
export interface PastureSnapshot {
  readonly structureId: number;
  readonly owner: UnitOwner;
  readonly pennedAnimals: number;
  readonly livestockCapacity: number;
  readonly shepherds: number;
  /** Animals claimed by a shepherd but not home yet — what fills the pen next. */
  readonly incomingAnimals: number;
}

export class PastureSystem {
  private readonly pastures = new Map<number, PastureRecord>();
  private readonly assignments = new Map<number, ShepherdAssignment>();

  constructor(
    private readonly units: UnitSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly navigation: RtsNavigation,
    private readonly wildlife: WildlifeSystem,
    /** A worker the construction or economy loop already owns is not free to herd. */
    private readonly isWorkerBusyElsewhere: (worker: Unit) => boolean = () => false,
  ) {}

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("Pasture delta must be a non-negative finite number");
    }
    this.syncPastures();
    this.dropInvalidAssignments();
    for (const pasture of this.pastures.values()) {
      this.prunePen(pasture);
      this.breed(pasture, deltaSeconds);
      this.hireShepherds(pasture);
    }
    for (const assignment of [...this.assignments.values()]) {
      this.advance(assignment, deltaSeconds);
    }
  }

  /**
   * The pen's total {@link AnimalBalanceStats.pastureYield} — what Faz 5's
   * production is measured in.
   *
   * A number rather than a count, because the two species are not worth the same:
   * §4.4 puts "how good this animal is" in the species table and "how good this
   * building is" in the building table, exactly as `perWorkerPerMinute × workers`
   * splits them.
   */
  pennedYield(structure: PlacedStructure): number {
    return this.pennedAnimals(structure)
      .reduce((total, animal) => total + (animal.stats.pastureYield ?? 0), 0);
  }

  /** True while this worker is out herding, so nothing else may claim it. */
  isShepherd(worker: Unit): boolean {
    return this.assignments.has(worker.id);
  }

  stateFor(worker: Unit): ShepherdState | "idle" {
    return this.assignments.get(worker.id)?.state ?? "idle";
  }

  /**
   * The animals this pasture holds. Faz 5 turns this into food; today it is what
   * the pen counter and the tests read.
   */
  pennedAnimals(structure: PlacedStructure): readonly WildlifeAnimal[] {
    const record = this.pastures.get(structure.id);
    return record ? this.pennedOf(record) : [];
  }

  snapshots(owner?: UnitOwner): readonly PastureSnapshot[] {
    return [...this.pastures.values()]
      .filter((pasture) => owner === undefined || pasture.structure.owner === owner)
      .map((pasture) => ({
        structureId: pasture.structure.id,
        owner: pasture.structure.owner,
        pennedAnimals: pasture.penned.size,
        livestockCapacity: pasture.structure.economy?.livestockCapacity ?? 0,
        shepherds: this.crewOf(pasture).length,
        incomingAnimals: this.crewOf(pasture).length,
      }));
  }

  /** Free this worker from herding — a player order, a death, a lost pasture. */
  release(worker: Unit): boolean {
    const assignment = this.assignments.get(worker.id);
    if (!assignment) return false;
    // The animal is let go with him. A calmed cow left holding a lead nobody is
    // walking would stand in the field forever, neither wild nor penned.
    const animal = this.wildlife.reservationOf(worker.id);
    if (animal) animal.lead = null;
    this.wildlife.releaseReservation(worker.id);
    worker.stop();
    worker.setWorking(false);
    this.assignments.delete(worker.id);
    return true;
  }

  reset(): void {
    for (const assignment of [...this.assignments.values()]) this.release(assignment.worker);
    this.pastures.clear();
  }

  // --- internals ------------------------------------------------------------

  private syncPastures(): void {
    const live = new Set(this.structures.all());
    for (const record of [...this.pastures.values()]) {
      if (live.has(record.structure) && record.structure.construction.complete
        && record.structure.economy?.requiresLivestock) {
        continue;
      }
      for (const assignment of this.crewOf(record)) this.release(assignment.worker);
      // A razed pasture frees its herd where it stood rather than deleting it:
      // the animals were driven in one at a time and are still standing there.
      // Whoever burned the barn now has to hunt them.
      for (const animalId of record.penned) this.wildlife.returnToWild(animalId);
      this.pastures.delete(record.structure.id);
    }
    for (const structure of this.structures.all()) {
      if (!structure.construction.complete || !structure.economy?.requiresLivestock) continue;
      if (this.pastures.has(structure.id)) continue;
      this.pastures.set(structure.id, {
        structure,
        penned: new Set(),
        pen: penGeometryFor(structure),
        gestation: new Map(),
      });
    }
  }

  /** Forget animals that died or were freed, so the pen count is what is standing there. */
  private prunePen(pasture: PastureRecord): void {
    for (const animalId of [...pasture.penned]) {
      const animal = this.wildlife.animalById(animalId);
      if (animal && !animal.dead && animal.owner === pasture.structure.owner) continue;
      pasture.penned.delete(animalId);
    }
  }

  /**
   * Advance gestation and, when a species comes to term, put a newborn in the
   * yard.
   *
   * Committed animals — penned plus the ones shepherds are walking home — are
   * what the capacity bounds, not just the penned ones. Counting only the pen
   * would let a birth take the last slot out from under a drive that is already
   * halfway across the field.
   */
  private breed(pasture: PastureRecord, deltaSeconds: number): void {
    const capacity = pasture.structure.economy?.livestockCapacity ?? 0;
    const residents = this.pennedOf(pasture);
    const committed = pasture.penned.size + this.crewOf(pasture).length;
    // An empty pen breeds nothing — the plan's rule, and the reason a pasture
    // still has to be filled by hand before it pays for itself.
    for (const species of new Set(residents.map((animal) => animal.stats.id))) {
      const elapsed = (pasture.gestation.get(species) ?? 0) + deltaSeconds;
      const term = residents.find((animal) => animal.stats.id === species)?.stats.breedSeconds ?? 0;
      if (term <= 0 || committed >= capacity) {
        // Held at the gate rather than reset: a full pen that loses an animal
        // should not restart the clock from zero, or a pasture under raid would
        // never replace anything.
        pasture.gestation.set(species, Math.min(elapsed, term));
        continue;
      }
      if (elapsed < term) {
        pasture.gestation.set(species, elapsed);
        continue;
      }
      pasture.gestation.set(species, 0);
      const parent = residents.find((animal) => animal.stats.id === species);
      if (!parent) continue;
      const born = this.wildlife.bear(species, pasture.structure.owner, penProfileFor(pasture.pen, parent.stats));
      if (born) pasture.penned.add(born.id);
    }
    // A species that has left the pen entirely forgets its progress, so a pen
    // restocked with a different animal does not inherit a stranger's timer.
    for (const species of [...pasture.gestation.keys()]) {
      if (!residents.some((animal) => animal.stats.id === species)) pasture.gestation.delete(species);
    }
  }

  private dropInvalidAssignments(): void {
    for (const assignment of [...this.assignments.values()]) {
      const animal = this.wildlife.reservationOf(assignment.worker.id);
      const alive = !assignment.worker.health.depleted && this.units.all().includes(assignment.worker);
      // A shepherd who died mid-drive, an animal shot out from under him by the
      // opponent, or a claim that has gone elsewhere: in every case the job is
      // over and the worker goes back to the pool.
      if (alive && animal && animal.id === assignment.animalId && !animal.dead && animal.owner === "wild") continue;
      this.release(assignment.worker);
    }
  }

  /**
   * Fill a pasture's shepherd crew from the idle pool.
   *
   * Bounded twice, and the second bound is the one that matters: never more
   * shepherds than the pen has room for. Without it a Lv1 pasture with three
   * workers would drive four cows into a pen of four and then keep going, and
   * §9's "endless income" risk would arrive through the back door.
   */
  private hireShepherds(pasture: PastureRecord): void {
    const economy = pasture.structure.economy;
    if (!economy) return;
    const capacity = economy.livestockCapacity ?? 0;
    const reach = economy.gatherRadius ?? 0;
    const crew = this.crewOf(pasture);
    const room = capacity - pasture.penned.size - crew.length;
    // A pen that filled while a shepherd was still walking — a birth took the
    // last slot — sends him back rather than letting him finish a drive that has
    // nowhere to end. §55: nothing may hold a worker at a job that cannot pay.
    if (capacity - pasture.penned.size <= 0) {
      for (const assignment of crew) this.release(assignment.worker);
      return;
    }
    const openings = Math.min(economy.workerCapacity - crew.length, room);
    if (openings <= 0) return;
    const candidates = this.units.workersOf(pasture.structure.owner)
      .filter((worker) => !this.assignments.has(worker.id)
        && !worker.blocksAutomaticWorkerAssignment
        && !this.isWorkerBusyElsewhere(worker))
      .sort((a, b) => a.position.distanceToSquared(pasture.structure.object.position)
        - b.position.distanceToSquared(pasture.structure.object.position));
    let hired = 0;
    for (const worker of candidates) {
      if (hired >= openings) return;
      const animal = this.wildlife.reserveForTaming(
        worker.id,
        pasture.structure.x,
        pasture.structure.z,
        reach,
      );
      if (!animal) return;
      const approach = new Vector3(animal.position.x, 0, animal.position.z);
      const path = this.navigation.plan(worker.position, approach);
      if (!path) {
        this.wildlife.releaseReservation(worker.id);
        continue;
      }
      worker.setMovePath(path);
      this.assignments.set(worker.id, {
        worker,
        pasture,
        animalId: animal.id,
        state: "moving-to-animal",
        calmedSeconds: 0,
        approach,
      });
      hired += 1;
    }
  }

  private advance(assignment: ShepherdAssignment, deltaSeconds: number): void {
    const animal = this.wildlife.reservationOf(assignment.worker.id);
    if (!animal) return;
    const { worker } = assignment;
    const gap = Math.hypot(animal.position.x - worker.position.x, animal.position.z - worker.position.z);

    if (assignment.state === "moving-to-animal") {
      if (gap > CONTACT_RANGE) {
        this.chase(assignment, animal);
        return;
      }
      worker.stop();
      assignment.state = "calming";
    }

    if (assignment.state === "calming") {
      // Held rather than merely frightened into stillness: the caught branch in
      // `advanceRoam` would do it too, but only for as long as the shepherd
      // happens to be inside contact range, and a calming that restarts every
      // time the animal twitches never finishes (V1 Faz 5's lesson).
      animal.lead = { x: worker.position.x, z: worker.position.z, follow: false };
      worker.setWorking(true);
      assignment.calmedSeconds += deltaSeconds;
      if (assignment.calmedSeconds < (animal.stats.tameSeconds ?? 0)) return;
      worker.setWorking(false);
      assignment.state = "driving";
      assignment.approach = this.penApproach(assignment.pasture, worker);
      const path = this.navigation.plan(worker.position, assignment.approach);
      if (path) worker.setMovePath(path);
    }

    if (assignment.state === "driving") {
      // The animal follows the shepherd, at its own walking pace — see
      // `advanceLed`. He may well reach the yard first and stand there waiting;
      // that is what leading looks like, and it is also why arrival is measured
      // on the animal rather than on him.
      animal.lead = { x: worker.position.x, z: worker.position.z, follow: true };
      if (this.isHome(assignment.pasture, animal)) {
        this.pen(assignment, animal);
        return;
      }
      if (worker.pathTarget || worker.moveTarget) return;
      if (worker.position.distanceTo(assignment.approach) <= CONTACT_RANGE) return;
      const path = this.navigation.plan(worker.position, assignment.approach);
      if (path) worker.setMovePath(path);
      else this.release(worker);
    }
  }

  /** Walk to where the animal is *now*, re-planning only once it has really moved. */
  private chase(assignment: ShepherdAssignment, animal: WildlifeAnimal): void {
    const { worker } = assignment;
    const drift = Math.hypot(
      animal.position.x - assignment.approach.x,
      animal.position.z - assignment.approach.z,
    );
    if (drift <= CHASE_SLACK && (worker.pathTarget || worker.moveTarget)) return;
    const target = new Vector3(animal.position.x, 0, animal.position.z);
    const path = this.navigation.plan(worker.position, target);
    // A failed path is not fatal: the quarry is moving, so the next tick offers a
    // different point to aim at. Only a shepherd with no route *and* no walk left
    // is genuinely stuck.
    if (path) {
      assignment.approach = target;
      worker.setMovePath(path);
      return;
    }
    if (!worker.pathTarget && !worker.moveTarget) this.release(worker);
  }

  private pen(assignment: ShepherdAssignment, animal: WildlifeAnimal): void {
    const { pasture, worker } = assignment;
    const owner = pasture.structure.owner;
    const capacity = pasture.structure.economy?.livestockCapacity ?? 0;
    // The last word on capacity, and the reason it is checked here as well as at
    // hiring: a birth can take the final slot while this animal is still walking.
    // Refused, it simply stays wild where it stands.
    if (pasture.penned.size < capacity
      && this.wildlife.tame(animal.id, owner, penProfileFor(pasture.pen, animal.stats))) {
      pasture.penned.add(animal.id);
    } else {
      animal.lead = null;
    }
    // Released rather than sent straight out again: the hiring pass at the top of
    // the next tick re-checks the pen's room and the crew size, so a shepherd who
    // has just filled the last slot goes back to the economy instead of walking
    // out to an animal he would have to abandon.
    this.assignments.delete(worker.id);
    this.wildlife.releaseReservation(worker.id);
    worker.stop();
    worker.setWorking(false);
  }

  /** Home is the yard the animal is about to graze in, not the building's pivot. */
  private isHome(pasture: PastureRecord, animal: WildlifeAnimal): boolean {
    const dx = animal.position.x - pasture.structure.x;
    const dz = animal.position.z - pasture.structure.z;
    return Math.hypot(dx, dz) <= pasture.pen.roamRadius;
  }

  private penApproach(pasture: PastureRecord, worker: Unit): Vector3 {
    const halfW = pasture.structure.stats.footprint.width / 2;
    const halfD = pasture.structure.stats.footprint.depth / 2;
    const gap = CONTACT_RANGE * 0.7;
    const edges = [
      new Vector3(pasture.structure.x + halfW + gap, 0, pasture.structure.z),
      new Vector3(pasture.structure.x - halfW - gap, 0, pasture.structure.z),
      new Vector3(pasture.structure.x, 0, pasture.structure.z + halfD + gap),
      new Vector3(pasture.structure.x, 0, pasture.structure.z - halfD - gap),
    ].sort((a, b) => worker.position.distanceToSquared(a) - worker.position.distanceToSquared(b));
    return edges.find((point) => this.navigation.plan(worker.position, point) !== null) ?? edges[0]!;
  }

  private pennedOf(pasture: PastureRecord): readonly WildlifeAnimal[] {
    return [...pasture.penned]
      .map((id) => this.wildlife.animalById(id))
      .filter((animal): animal is WildlifeAnimal => animal !== null);
  }

  private crewOf(pasture: PastureRecord): readonly ShepherdAssignment[] {
    return [...this.assignments.values()].filter((assignment) => assignment.pasture === pasture);
  }
}

/** Where a pasture's yard is, independent of which species ends up standing in it. */
export interface PenGeometry {
  readonly homeX: number;
  readonly homeZ: number;
  readonly roamInnerRadius: number;
  readonly roamRadius: number;
}

/**
 * The yard a pasture's animals graze in: a ring around the building, never over
 * it, and always inside the building's own reach so a penned animal cannot
 * wander out of the pasture that owns it.
 *
 * Derived from the footprint rather than authored, because it is not a balance
 * decision — it is where the building physically is.
 */
export function penGeometryFor(structure: PlacedStructure): PenGeometry {
  const inner = Math.hypot(structure.stats.footprint.width / 2, structure.stats.footprint.depth / 2);
  return {
    homeX: structure.x,
    homeZ: structure.z,
    roamInnerRadius: inner,
    roamRadius: inner + PEN_RING_WIDTH,
  };
}

/**
 * One species' grazing profile inside that yard.
 *
 * `walkSpeed` stays the species' own `walkClipSpeed` — the pen changes where an
 * animal walks, never how fast, because that equality is the whole foot-slide
 * fix (`RoamProfile.walkSpeed`). Only the flight trigger is closed: penned
 * livestock has nothing left to run from, and an animal that still bolted would
 * be spooked all day by the workers who own it.
 *
 * The turn rate and the pause range carry over untouched for the same reason:
 * they say what *animal* this is, and a cow does not become a different one for
 * standing in a barn yard.
 */
export function penProfileFor(pen: PenGeometry, stats: AnimalBalanceStats): RoamProfile {
  return {
    ...pen,
    walkSpeed: stats.walkClipSpeed,
    fleeSpeed: stats.moveSpeed,
    fleeRadius: 0,
    fleeSeconds: stats.fleeSeconds,
    fleeRecoverySeconds: stats.fleeRecoverySeconds,
    turnRateDegPerSecond: stats.turnRateDegPerSecond,
    restSecondsMin: stats.restSeconds.min,
    restSecondsMax: stats.restSeconds.max,
  };
}
