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
 *
 * **V2 Faz 8 — the pen is a feeding line, not a yard.** What arrives at the barn
 * stops being a simulated animal: it takes a numbered stall in a row along the
 * building's front, faces the wall, and plays its `Eating` clip there for good
 * (`WildlifeAnimal.stall`). So this file owns the *positions* of a pasture's
 * livestock as well as its count, and that is the whole of the change — the
 * roster, the ownership, the breeding and the razing rule are all Faz 4/5's,
 * unmoved. Raze the pasture and each of those bodies becomes a wild animal again
 * exactly where it was standing, which is why the row is authored here rather
 * than by the renderer: it is a simulation position that presentation reads, not
 * a decoration presentation invents.
 */
import { Vector3 } from "three";

import type { SettlementAge } from "../../data/gameDataTypes";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { PlacedStructure, PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { Unit, UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { WildlifeAnimal, WildlifeSystem } from "./wildlifeSystem";
import { CAUGHT_DISTANCE, type WildlifeStall } from "./wildlifeRoaming";

export type ShepherdState = "moving-to-animal" | "calming" | "driving";

/**
 * Which face of the building the animals line up along, as a unit vector in
 * world space.
 *
 * A constant rather than data because a {@link PlacedStructure} has no rotation:
 * every building on this map is axis-aligned, so "the front" is a fact about the
 * art, not about the placement. One constant is therefore the whole of it — if
 * the pasture's model is ever re-authored facing another way, this is the line
 * that follows it.
 */
const PEN_FACE_X = 1;
const PEN_FACE_Z = 0;

/**
 * The first feeding line is set just inside the front edge, in the open strip
 * the pasture art leaves there.  Livestock belongs to the building's claimed
 * ground; putting it beyond the blocker made a full pen read as four unrelated
 * cows standing beside a house.
 */
const PEN_FRONT_INSET = 0.75;

/** Extra visual lift from the base slab to the raised stone floor in the Lv2 art. */
const PEN_LEVEL_TWO_LIVESTOCK_FLOOR_HEIGHT = 0.28;

/** Lv2's art needs a small frontward nudge so every hoof rests on the stone floor. */
const PEN_LEVEL_TWO_LIVESTOCK_FORWARD_OFFSET = 0.25;

const DEFAULT_LIVESTOCK_PRESENTATION_OFFSET = { x: 0, y: 0, z: 0 };
const LEVEL_TWO_LIVESTOCK_PRESENTATION_OFFSET = {
  x: PEN_LEVEL_TWO_LIVESTOCK_FORWARD_OFFSET,
  y: PEN_LEVEL_TWO_LIVESTOCK_FLOOR_HEIGHT,
  z: 0,
};

/** Shoulder to shoulder along the face — a cow is about a unit wide at this scale. */
const PEN_SLOT_SPACING = 1.8;

/** And how far back the next row stands, when a tier's pen outgrows one face. */
const PEN_ROW_SPACING = 2;

/** Close enough to the shepherd to start calming; the contact distance an animal is caught at. */
const CONTACT_RANGE = CAUGHT_DISTANCE;

/** How far a claimed animal may drift from the walk aimed at it before it is re-planned. */
const CHASE_SLACK = CONTACT_RANGE * 1.5;

interface ShepherdAssignment {
  readonly worker: Unit;
  readonly pasture: PastureRecord;
  readonly animalId: string;
  /**
   * The place in the line this drive is for, claimed at hiring.
   *
   * Claimed that early rather than on arrival so two shepherds can never walk
   * two animals into the same stall — the pen's capacity already bounds how many
   * drives may be running, and this is the same bound said as a position.
   */
  readonly slot: number;
  state: ShepherdState;
  /** Seconds of calming banked so far, against the species' `tameSeconds`. */
  calmedSeconds: number;
  /** The point the worker is currently walking to. */
  approach: Vector3;
}

interface PastureRecord {
  readonly structure: PlacedStructure;
  /** Which animal stands in which stall, so a gap in the row is never re-used twice. */
  readonly penned: Map<string, number>;
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
    /** Player-owned automatic staffing can be disabled without changing AI behaviour. */
    private readonly isAutomaticWorkerAssignmentEnabled: (owner: UnitOwner) => boolean = () => true,
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

  /**
   * A closed late-tier barn does not need to show the animals it contains.
   * This is presentation-only: livestock remains owned, productive and is
   * released visibly when the building is razed.
   */
  isLivestockPresentationVisible(
    animal: WildlifeAnimal,
    ageForOwner: (owner: UnitOwner) => SettlementAge,
  ): boolean {
    const pasture = [...this.pastures.values()].find((record) => record.penned.has(animal.id));
    if (!pasture) return true;
    return ageForOwner(pasture.structure.owner) === "settlement" && pasture.structure.level < 3;
  }

  /** Lv2's stone yard alignment is presentation-only; livestock simulation stays on terrain. */
  livestockPresentationOffset(animal: WildlifeAnimal): { readonly x: number; readonly y: number; readonly z: number } {
    const pasture = [...this.pastures.values()].find((record) => record.penned.has(animal.id));
    return pasture?.structure.level === 2
      ? LEVEL_TWO_LIVESTOCK_PRESENTATION_OFFSET
      : DEFAULT_LIVESTOCK_PRESENTATION_OFFSET;
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
    worker.setWorkerActivity(null);
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
      //
      // Faz 8 is what makes "where it stood" a picture rather than a phrase: the
      // bodies were parked in a row, so a burnt pasture leaves a line of animals
      // that turn back into wildlife on the spot and scatter from there. Nothing
      // here has to pass positions along — the animal already holds the only copy.
      for (const animalId of record.penned.keys()) this.wildlife.returnToWild(animalId);
      this.pastures.delete(record.structure.id);
    }
    for (const structure of this.structures.all()) {
      if (!structure.construction.complete || !structure.economy?.requiresLivestock) continue;
      if (this.pastures.has(structure.id)) continue;
      this.pastures.set(structure.id, { structure, penned: new Map(), gestation: new Map() });
    }
  }

  /** Forget animals that died or were freed, so the pen count is what is standing there. */
  private prunePen(pasture: PastureRecord): void {
    for (const animalId of [...pasture.penned.keys()]) {
      const animal = this.wildlife.animalById(animalId);
      if (animal && !animal.dead && animal.owner === pasture.structure.owner) continue;
      pasture.penned.delete(animalId);
    }
  }

  /**
   * Advance gestation and, when a species comes to term, stand a newborn in the
   * next free stall.
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
      const slot = this.freeSlot(pasture);
      // No stall, no calf: the committed count above already refuses a birth the
      // pen has no room for, and this is the same refusal said in positions — the
      // two must agree or a newborn would appear standing on its parent. Held at
      // term like the capacity gate, so the calf arrives on the tick a stall does.
      if (slot === null) {
        pasture.gestation.set(species, term);
        continue;
      }
      const stall = penStalls(pasture.structure)[slot];
      if (!stall) continue;
      pasture.gestation.set(species, 0);
      const born = this.wildlife.bear(species, pasture.structure.owner, stall);
      if (born) pasture.penned.set(born.id, slot);
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
    if (!this.isAutomaticWorkerAssignmentEnabled(pasture.structure.owner)) return;
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
      // Recomputed per hire, because the assignment written below is itself what
      // takes a stall out of circulation.
      const slot = this.freeSlot(pasture);
      if (slot === null) return;
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
      worker.setWorkerActivity("livestock");
      this.assignments.set(worker.id, {
        worker,
        pasture,
        animalId: animal.id,
        slot,
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
      assignment.approach = this.penApproach(assignment, worker);
      const path = this.navigation.plan(worker.position, assignment.approach);
      if (path) worker.setMovePath(path);
    }

    if (assignment.state === "driving") {
      // The animal follows the shepherd, at its own walking pace — see
      // `advanceLed`. He may well reach the stall first and stand there waiting;
      // that is what leading looks like, and it is also why arrival is measured
      // on the animal rather than on him.
      animal.lead = { x: worker.position.x, z: worker.position.z, follow: true };
      if (this.isHome(assignment, animal)) {
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
    const stall = penStalls(pasture.structure)[assignment.slot];
    // The last word on capacity, and the reason it is checked here as well as at
    // hiring: a birth can take the final slot while this animal is still walking.
    // Refused, it simply stays wild where it stands.
    //
    // `tame` is where the animal stops being a simulated one: from this call it
    // holds a stall and nothing else, so the drive's last act is to hand over a
    // position rather than to start any new behaviour.
    if (stall && pasture.penned.size < capacity
      && this.wildlife.tame(animal.id, owner, stall)) {
      pasture.penned.set(animal.id, assignment.slot);
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
    worker.setWorkerActivity(null);
  }

  /**
   * Home is this drive's own stall, not the building.
   *
   * Measured against the stall rather than a radius around the barn because the
   * animal is handed over here: a tolerance of `CONTACT_RANGE` is exactly the
   * `DRIVE_FOLLOW_GAP` it trails the shepherd by, so it takes over one stride
   * short of its post and walks the rest in itself ({@link advanceStalled}).
   * A wider arrival test would drop it further out and make the last steps a
   * slide; a tighter one could never fire, because the shepherd standing *on*
   * the stall is what keeps the animal a stride behind it.
   */
  private isHome(assignment: ShepherdAssignment, animal: WildlifeAnimal): boolean {
    const stall = penStalls(assignment.pasture.structure)[assignment.slot];
    if (!stall) return false;
    const gate = penGate(assignment.pasture.structure, stall);
    return Math.hypot(animal.position.x - gate.x, animal.position.z - gate.z) <= CONTACT_RANGE;
  }

  /**
   * Where the shepherd walks to end the drive: the gate immediately outside his
   * animal's place in the line, or — if nothing can path there — the nearest
   * reachable footprint edge.
   *
   * A stall is now deliberately *inside* the footprint, where RTS navigation
   * rightly refuses to route a worker.  The gate is therefore the hand-off
   * point: reaching it transfers the animal into its indoor/front-yard slot
   * without asking a navigation agent to walk through the building.
   */
  private penApproach(assignment: ShepherdAssignment, worker: Unit): Vector3 {
    const { structure } = assignment.pasture;
    const halfW = structure.stats.footprint.width / 2;
    const halfD = structure.stats.footprint.depth / 2;
    const gap = CONTACT_RANGE * 0.7;
    const stall = penStalls(structure)[assignment.slot];
    const gate = stall ? penGate(structure, stall) : null;
    const edges = [
      new Vector3(structure.x + halfW + gap, 0, structure.z),
      new Vector3(structure.x - halfW - gap, 0, structure.z),
      new Vector3(structure.x, 0, structure.z + halfD + gap),
      new Vector3(structure.x, 0, structure.z - halfD - gap),
    ].sort((a, b) => worker.position.distanceToSquared(a) - worker.position.distanceToSquared(b));
    const candidates = gate ? [new Vector3(gate.x, 0, gate.z), ...edges] : edges;
    return candidates.find((point) => this.navigation.plan(worker.position, point) !== null)
      ?? candidates[0]!;
  }

  /**
   * The lowest stall nobody stands in and nobody is walking an animal toward;
   * null when the line is full.
   *
   * Lowest rather than next, so a pen that loses its second animal fills that
   * gap before it grows a fifth place — the row stays a row.
   */
  private freeSlot(pasture: PastureRecord): number | null {
    const capacity = pasture.structure.economy?.livestockCapacity ?? 0;
    const taken = new Set<number>([
      ...pasture.penned.values(),
      ...this.crewOf(pasture).map((assignment) => assignment.slot),
    ]);
    for (let slot = 0; slot < capacity; slot += 1) {
      if (!taken.has(slot)) return slot;
    }
    return null;
  }

  private pennedOf(pasture: PastureRecord): readonly WildlifeAnimal[] {
    return [...pasture.penned.keys()]
      .map((id) => this.wildlife.animalById(id))
      .filter((animal): animal is WildlifeAnimal => animal !== null);
  }

  private crewOf(pasture: PastureRecord): readonly ShepherdAssignment[] {
    return [...this.assignments.values()].filter((assignment) => assignment.pasture === pasture);
  }
}

/**
 * Every standing place a pasture has, in slot order — the feeding line itself.
 *
 * Derived from the footprint and the tier's `livestockCapacity` rather than
 * authored, for the same reason the yard was: it is where the building
 * physically is, not a balance decision. A tier that widens the pen simply
 * returns more places, and the ones already occupied keep their coordinates, so
 * an upgrade never shuffles the animals already standing there.
 *
 * The row runs along the open front inside the footprint, shoulder to shoulder,
 * and wraps toward the building's middle once a face is full. This keeps a pen
 * of eight from becoming a line stretching off the building into the fields.
 */
export function penStalls(structure: PlacedStructure): readonly WildlifeStall[] {
  const capacity = structure.economy?.livestockCapacity ?? 0;
  const half = Math.abs(PEN_FACE_X) * structure.stats.footprint.width / 2
    + Math.abs(PEN_FACE_Z) * structure.stats.footprint.depth / 2;
  // The face's own width, which is the other footprint side: how many animals fit
  // in one row before the pen has to grow a second.
  const faceWidth = Math.abs(PEN_FACE_X) * structure.stats.footprint.depth
    + Math.abs(PEN_FACE_Z) * structure.stats.footprint.width;
  // Pairs read as a settled pen rather than a queue at the building edge. The
  // second pair steps inward onto the paved floor; larger Town pens keep the
  // same two-abreast pattern.
  const perRow = Math.min(2, Math.max(1, Math.floor(faceWidth / PEN_SLOT_SPACING) + 1));
  // Along the face, ninety degrees from its normal.
  const alongX = -PEN_FACE_Z;
  const alongZ = PEN_FACE_X;
  // Every animal looks into the pen, and all of them the same way: facings that
  // converged on the building's centre would fan the row out into a semicircle.
  const facing = Math.atan2(-PEN_FACE_X, -PEN_FACE_Z);
  const stalls: WildlifeStall[] = [];
  for (let slot = 0; slot < capacity; slot += 1) {
    const row = Math.floor(slot / perRow);
    const column = slot % perRow;
    const inThisRow = Math.min(perRow, capacity - row * perRow);
    const out = half - PEN_FRONT_INSET - row * PEN_ROW_SPACING;
    const along = (column - (inThisRow - 1) / 2) * PEN_SLOT_SPACING;
    stalls.push({
      x: structure.x + PEN_FACE_X * out + alongX * along,
      z: structure.z + PEN_FACE_Z * out + alongZ * along,
      facing,
    });
  }
  return stalls;
}

/** The walkable hand-off point immediately outside one interior feeding stall. */
function penGate(structure: PlacedStructure, stall: WildlifeStall): WildlifeStall {
  const half = Math.abs(PEN_FACE_X) * structure.stats.footprint.width / 2
    + Math.abs(PEN_FACE_Z) * structure.stats.footprint.depth / 2;
  const clearance = CONTACT_RANGE * 0.7;
  // Preserve the stall's place *along* the feeding line, but put every row's
  // hand-off on the one navigable front edge. A Town tier's second interior row
  // must not make its gate drift back into the footprint.
  const along = (stall.x - structure.x) * -PEN_FACE_Z
    + (stall.z - structure.z) * PEN_FACE_X;
  return {
    x: structure.x + PEN_FACE_X * (half + clearance) - PEN_FACE_Z * along,
    z: structure.z + PEN_FACE_Z * (half + clearance) + PEN_FACE_X * along,
    facing: stall.facing,
  };
}
