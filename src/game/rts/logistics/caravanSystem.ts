/** Automatic, non-selectable logistics carriers — V4 Faz 3. */
import { Vector3 } from "three";

import type { CaravanBalance, UnitArmorClass } from "../../data/gameDataTypes";
import type { CombatTarget } from "../combat/combatTarget";
import type { RoadCell, RoadGraph } from "../roads/roadGraph";
import type { UnitOwner } from "../units/unit";
import { HealthComponent } from "../units/health";
import type { CaravanDispatch, CaravanLaneProvider } from "./caravanLane";
import { advanceCaravanRoute, startCaravanRoute, type CaravanRouteState } from "./caravanRoute";

export type { CaravanDispatch, CaravanLane, CaravanLaneProvider } from "./caravanLane";

export type CaravanPhase = "loading" | "outbound" | "unloading" | "inbound";

/**
 * Which body is showing the shipment this frame — the single read both sides of
 * the hand-off make (Worker plan §10.2A).
 *
 * It exists because "the worker holds the barrel until the donkey does" is one
 * decision, and two systems asking it separately is exactly how a frame with two
 * barrels (or none) appears. There is no third state to get wrong: the moment
 * `loading` becomes `outbound` this answer changes from `worker` to `caravan`,
 * so the prop leaves one pair of hands on the same frame it lands on the other.
 *
 * `none` is the honest answer for the empty walk home, and for a donkey standing
 * at a producer that has not made a full shipment yet — nothing is being carried
 * then, and putting a barrel in someone's hands for those minutes would show a
 * hand-off that is not happening.
 */
export type CaravanLoadBearer = "worker" | "caravan" | "none";

/**
 * Resolve the bearer from the phase plus whether the load is actually going on
 * right now ({@link Caravan.loadingActive}).
 *
 * The phase alone is not enough for the worker half: `loading` covers both the
 * transfer and the wait before it, and only the transfer is something to show.
 * The caravan half never needs the second argument, which is why
 * {@link isCaravanCarrying} can still answer from the phase alone.
 */
export function caravanLoadBearer(phase: CaravanPhase, loadingActive: boolean): CaravanLoadBearer {
  if (phase === "outbound" || phase === "unloading") return "caravan";
  return phase === "loading" && loadingActive ? "worker" : "none";
}

export interface CaravanSnapshot {
  readonly id: string;
  /** The lane this animal runs; how its arrival is routed back to a system. */
  readonly laneId: string;
  readonly owner: UnitOwner;
  readonly x: number;
  readonly z: number;
  /** Current store endpoint, published for tests and later producer UI. */
  readonly destinationX: number;
  readonly destinationZ: number;
  readonly facing: number;
  readonly speed: number;
  /** Live full-load threshold from the producer's current economy tier. */
  readonly carryCapacity: number;
  readonly phase: CaravanPhase;
}

/**
 * One actual arrival at a store endpoint; this is the sole transfer key.
 *
 * Keyed by lane rather than by producer id (supply plan §3.4): a trade site is
 * not a {@link PlacedStructure} and has no numeric id, so the thing both kinds
 * of delivery have in common is the lane they arrived on. Each receiving system
 * recognises its own prefix and ignores the rest.
 */
export interface CaravanArrival {
  readonly caravanId: string;
  readonly laneId: string;
  readonly owner: UnitOwner;
  readonly carryCapacity: number;
}

/**
 * One automatically assigned pack animal. It deliberately is not a Unit: it
 * has no orders, selection, population slot or nav occupancy in Faz 3.
 */
export class Caravan implements CombatTarget {
  readonly position = new Vector3();
  readonly health: HealthComponent;
  readonly armorClass: UnitArmorClass;
  facing = 0;
  speed = 0;
  phase: CaravanPhase = "loading";
  /** A killed donkey stays briefly so its authored Death clip can finish. */
  private deathElapsed: number | null = null;
  /**
   * True only on frames where the load timer actually ran — see
   * {@link loadingActive}. Recomputed from scratch every frame it is written, so
   * an animal that stops being updated cannot leave a stale `true` behind and a
   * worker holding a barrel forever.
   */
  private loadingActiveValue = false;
  private returningHome = false;
  private destination: RoadCell;
  private remainingLoadSeconds: number;
  private route: readonly RoadCell[];
  private routeState: CaravanRouteState;
  private carryCapacity: number;

  constructor(
    readonly id: string,
    readonly laneId: string,
    readonly owner: UnitOwner,
    source: RoadCell,
    destination: RoadCell,
    private readonly balance: CaravanBalance,
    private readonly roads: RoadGraph,
    carryCapacity: number,
  ) {
    // Every route this animal ever walks is asked from its own kingdom's side:
    // a donkey travels its owner's road network, not whatever happens to be
    // paved between the two ends.
    const route = roads.route(source, destination, owner);
    if (!route) throw new Error("A linked caravan requires a committed route");
    this.route = route;
    this.routeState = startCaravanRoute(route);
    this.position.set(this.routeState.x, 0, this.routeState.z);
    this.destination = destination;
    this.remainingLoadSeconds = balance.loadSeconds;
    this.health = new HealthComponent(balance.maxHealth);
    this.armorClass = balance.armorClass;
    this.carryCapacity = carryCapacity;
  }

  get dying(): boolean {
    return this.deathElapsed !== null;
  }

  /**
   * Whether this animal is taking its shipment on *right now*, rather than
   * merely standing at the producer waiting for one.
   *
   * The distinction is the whole point: `loading` lasts as long as the building
   * needs to make a full load — minutes, on a slow producer — while the transfer
   * itself is the authored `loadSeconds` at the end of it. Only the second is a
   * moment worth showing a man carrying a barrel for.
   */
  get loadingActive(): boolean {
    return this.loadingActiveValue;
  }

  get moveSpeed(): number {
    return this.balance.moveSpeed;
  }

  get walkClipSpeed(): number {
    return this.balance.walkClipSpeed;
  }

  update(
    deltaSeconds: number,
    source: RoadCell,
    destination: RoadCell,
    dispatch: CaravanDispatch,
  ): CaravanArrival | null {
    this.speed = 0;
    // Cleared before anything can set it, so every path out of this method —
    // dead, waiting, travelling, departing — leaves the flag false unless the
    // load timer below actually ran this frame.
    this.loadingActiveValue = false;
    if (this.health.depleted) return null;
    this.returningHome = false;
    this.carryCapacity = dispatch.carryCapacity;
    this.destination = destination;
    if (this.phase === "loading" || this.phase === "unloading") {
      // A loading donkey waits at the producer until its building has made one
      // full minute-sized load (or production is stopped with a partial load).
      // Unloading never waits: it has already arrived with a valid shipment.
      if (this.phase === "loading" && !dispatch.ready) return null;
      // The transfer is under way from here down. Raised before the countdown
      // rather than after it, so the first frame of the load is already showing
      // the barrel; dropped again the frame the animal leaves, which is the
      // frame its own panniers appear.
      this.loadingActiveValue = this.phase === "loading";
      this.remainingLoadSeconds -= deltaSeconds;
      if (this.remainingLoadSeconds > 0) return null;
      if (this.phase === "loading") {
        this.loadingActiveValue = false;
        this.beginTravel("outbound", source, destination);
      } else {
        this.beginTravel("inbound", destination, source);
      }
      return null;
    }

    const advanced = advanceCaravanRoute(this.route, this.routeState, this.balance.moveSpeed, deltaSeconds);
    this.routeState = advanced.state;
    this.position.x = advanced.state.x;
    this.position.z = advanced.state.z;
    this.facing = advanced.state.facing;
    this.speed = deltaSeconds > 0 ? advanced.distance / deltaSeconds : 0;
    if (!advanced.arrived) return null;
    const arrivedAtStore = this.phase === "outbound";
    this.phase = arrivedAtStore ? "unloading" : "loading";
    this.remainingLoadSeconds = this.balance.loadSeconds;
    return arrivedAtStore
      ? {
        caravanId: this.id,
        laneId: this.laneId,
        owner: this.owner,
        carryCapacity: this.carryCapacity,
      }
      : null;
  }

  /**
   * KARAR 5: a cut link sends an in-flight donkey back toward its producer.
   * The wallet is still untouched until arrival, so its apparent load has never
   * left the producer buffer and needs no compensating credit.
   */
  beginReturnHome(source: RoadCell): void {
    if (this.returningHome || this.health.depleted) return;
    this.speed = 0;
    // This path runs *instead of* {@link update}, so the flag has to be cleared
    // here too: an interrupted lane must not leave a worker holding a barrel for
    // a shipment that is walking away from him.
    this.loadingActiveValue = false;
    this.returningHome = true;
    if (this.phase === "loading") return;
    const anchor = this.route[this.routeState.waypointIndex];
    const route = anchor ? this.roads.route(anchor, source, this.owner) : null;
    if (!route) {
      // The cut may be directly beneath the animal. It cannot cross bare ground;
      // retire this presentation and let the still-buffered producer respawn it
      // once its road is repaired.
      this.phase = "loading";
      this.remainingLoadSeconds = 0;
      return;
    }
    this.route = [{ x: this.position.x, z: this.position.z }, ...route];
    this.routeState = startCaravanRoute(this.route);
    this.phase = "inbound";
  }

  /** Advance an interrupted trip; true once the donkey is safely back at home. */
  updateReturnHome(deltaSeconds: number): boolean {
    this.speed = 0;
    if (!this.returningHome || this.health.depleted) return this.returningHome;
    if (this.phase === "loading") return true;
    const advanced = advanceCaravanRoute(this.route, this.routeState, this.balance.moveSpeed, deltaSeconds);
    this.routeState = advanced.state;
    this.position.x = advanced.state.x;
    this.position.z = advanced.state.z;
    this.facing = advanced.state.facing;
    this.speed = deltaSeconds > 0 ? advanced.distance / deltaSeconds : 0;
    if (!advanced.arrived) return false;
    this.phase = "loading";
    this.remainingLoadSeconds = 0;
    return true;
  }

  /** Start the authored death window once; true only on its first simulation frame. */
  beginDeath(): boolean {
    if (!this.health.depleted || this.deathElapsed !== null) return false;
    this.deathElapsed = 0;
    this.speed = 0;
    return true;
  }

  /** Two seconds is the safe fallback if an optional Actor has no Death clip. */
  updateDeath(deltaSeconds: number): boolean {
    if (this.deathElapsed === null) return false;
    this.deathElapsed += Math.max(0, deltaSeconds);
    return this.deathElapsed >= 2;
  }

  snapshot(): CaravanSnapshot {
    return {
      id: this.id,
      laneId: this.laneId,
      owner: this.owner,
      x: this.position.x,
      z: this.position.z,
      destinationX: this.destination.x,
      destinationZ: this.destination.z,
      facing: this.facing,
      speed: this.speed,
      carryCapacity: this.carryCapacity,
      phase: this.phase,
    };
  }

  private beginTravel(phase: Extract<CaravanPhase, "outbound" | "inbound">, from: RoadCell, to: RoadCell): void {
    const route = this.roads.route(from, to, this.owner);
    // The producer was linked when this tick began, but topology can change in
    // between snapshots. Retain the current endpoint instead of crossing bare
    // ground; Faz 5 gives this interruption its player-facing recovery rule.
    if (!route) {
      this.phase = phase === "outbound" ? "loading" : "unloading";
      this.remainingLoadSeconds = this.balance.loadSeconds;
      return;
    }
    this.phase = phase;
    this.route = route;
    this.routeState = startCaravanRoute(route);
    this.position.x = this.routeState.x;
    this.position.z = this.routeState.z;
  }
}

/**
 * Maintains the automatic caravan roster over every lane its providers offer.
 *
 * The one state machine in the game for "a pack animal on a road", and
 * deliberately the only one (supply plan §9): it knows loading, travel,
 * unloading, the death window and the walk home, and it knows nothing at all
 * about *why* a lane exists. Producers and trade sites are two providers behind
 * the same door — see {@link CaravanLaneProvider}.
 */
export class CaravanSystem {
  private readonly caravans = new Map<string, Caravan>();

  constructor(
    private readonly balance: CaravanBalance,
    private readonly roads: RoadGraph,
    private readonly providers: readonly CaravanLaneProvider[],
  ) {}

  update(deltaSeconds: number): readonly CaravanArrival[] {
    const active = new Set<string>();
    const arrivals: CaravanArrival[] = [];
    const lanes = this.providers.flatMap((provider) => provider.lanes().map((lane) => ({ lane, provider })));
    for (const [id, caravan] of this.caravans) {
      if (!caravan.health.depleted) continue;
      caravan.beginDeath();
      if (caravan.updateDeath(deltaSeconds)) this.caravans.delete(id);
      else active.add(id);
    }
    for (const { lane, provider } of lanes) {
      const destination = lane.destination;
      if (!destination || !this.roads.route(lane.source, destination, lane.owner)) continue;
      // Loads already committed on this lane: an outbound animal is carrying
      // goods its source has not written off yet, so the next one to load must
      // not be told the same goods are available (see
      // {@link CaravanLaneProvider.dispatch}). Counted before the fleet runs and
      // raised again as each animal is released within this same tick.
      let claimed = this.outboundOn(lane.id);
      for (let index = 0; index < lane.caravanCount; index += 1) {
        // The owner is part of the identity, not just a field on the body. A
        // trade site changes hands when its holder's road is cut (KARAR 4-A),
        // and the animals standing on it do not change sides with it: keying on
        // the owner retires the old kingdom's fleet down the walk-home path
        // below and raises the new one's, instead of leaving a caravan whose
        // deliveries the site would then refuse forever — and whose flag an
        // enemy raider would still read as the wrong kingdom's.
        const id = `caravan:${lane.id}:${lane.owner}:${index}`;
        active.add(id);
        const dispatch = provider.dispatch(lane, claimed)
          ?? { carryCapacity: 1, ready: false, canReceive: false };
        let caravan = this.caravans.get(id);
        if (!caravan) {
          caravan = new Caravan(id, lane.id, lane.owner, lane.source, destination, this.balance, this.roads, dispatch.carryCapacity);
          this.caravans.set(id, caravan);
        }
        if (caravan.health.depleted) continue;
        if (!dispatch.canReceive && caravan.phase === "outbound") {
          caravan.beginReturnHome(lane.source);
          if (!caravan.updateReturnHome(deltaSeconds)) active.add(id);
          continue;
        }
        const loading = caravan.phase === "loading";
        const arrival = caravan.update(deltaSeconds, lane.source, destination, dispatch);
        if (loading && caravan.phase === "outbound") claimed += 1;
        if (arrival) arrivals.push(arrival);
      }
    }
    // A changed topology drops the lane out of the loop above — a producer gone
    // unlinked, or a supply road cut so the trade site is no longer claimed.
    // Keep the old body long enough to walk home (KARAR 5) instead of deleting
    // it mid-road; a lane that still knows its source is all that needs.
    for (const caravan of this.caravans.values()) {
      if (active.has(caravan.id)) continue;
      if (caravan.health.depleted) {
        continue;
      }
      const lane = lanes.find((candidate) => candidate.lane.id === caravan.laneId)?.lane;
      if (!lane) continue;
      caravan.beginReturnHome(lane.source);
      if (!caravan.updateReturnHome(deltaSeconds)) active.add(caravan.id);
    }
    for (const id of this.caravans.keys()) {
      if (!active.has(id)) this.caravans.delete(id);
    }
    return arrivals;
  }

  all(): readonly Caravan[] {
    return [...this.caravans.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  snapshots(): readonly CaravanSnapshot[] {
    return this.all().map((caravan) => caravan.snapshot());
  }

  reset(): void {
    this.caravans.clear();
  }

  /**
   * Whether any live animal on this lane is taking its load on right now.
   *
   * The producer side's whole view of the caravan fleet, and deliberately a
   * single boolean: the economy has no business knowing that a lane has animals,
   * phases or a roster at all — only whether there is a shipment being handed
   * over at its door this frame.
   */
  isLoadingOn(laneId: string): boolean {
    for (const caravan of this.caravans.values()) {
      if (caravan.laneId === laneId && !caravan.health.depleted && caravan.loadingActive) return true;
    }
    return false;
  }

  /**
   * Animals on this lane that hold an undelivered load. Only `outbound` counts:
   * `inbound` is the empty walk home, and by the tick an arrival turns
   * `unloading` its withdrawal is already in this update's arrival list.
   */
  private outboundOn(laneId: string): number {
    let count = 0;
    for (const caravan of this.caravans.values()) {
      if (caravan.laneId === laneId && caravan.phase === "outbound" && !caravan.health.depleted) count += 1;
    }
    return count;
  }
}
