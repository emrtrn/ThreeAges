/** Automatic, non-selectable logistics carriers — V4 Faz 3. */
import { Vector3 } from "three";

import type { CaravanBalance, UnitArmorClass } from "../../data/gameDataTypes";
import type { CombatTarget } from "../combat/combatTarget";
import type { RoadCell, RoadGraph } from "../roads/roadGraph";
import { roadCellTouchingFootprint } from "../economy/depotLogisticsSystem";
import type { LogisticsOccupationSystem } from "../economy/logisticsOccupationSystem";
import type { ProductionLogisticsSystem } from "../economy/productionLogisticsSystem";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { UnitOwner } from "../units/unit";
import { HealthComponent } from "../units/health";
import { advanceCaravanRoute, startCaravanRoute, type CaravanRouteState } from "./caravanRoute";

export type CaravanPhase = "loading" | "outbound" | "unloading" | "inbound";

export interface CaravanSnapshot {
  readonly id: string;
  readonly producerStructureId: number;
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

/** One actual arrival at a store endpoint; this is the sole Faz 4 transfer key. */
export interface CaravanArrival {
  readonly caravanId: string;
  readonly producerStructureId: number;
  readonly owner: UnitOwner;
  readonly carryCapacity: number;
}

/** Whether one producer has enough buffered output to send its automatic donkey. */
export interface CaravanDispatch {
  readonly carryCapacity: number;
  readonly ready: boolean;
  /** False only when the kingdom store cannot accept this resource at all. */
  readonly canReceive: boolean;
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
  private returningHome = false;
  private destination: RoadCell;
  private remainingLoadSeconds: number;
  private route: readonly RoadCell[];
  private routeState: CaravanRouteState;
  private carryCapacity: number;

  constructor(
    readonly id: string,
    readonly producerStructureId: number,
    readonly owner: UnitOwner,
    source: RoadCell,
    destination: RoadCell,
    private readonly balance: CaravanBalance,
    private readonly roads: RoadGraph,
    carryCapacity: number,
  ) {
    const route = roads.route(source, destination);
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
    if (this.health.depleted) return null;
    this.returningHome = false;
    this.carryCapacity = dispatch.carryCapacity;
    this.destination = destination;
    if (this.phase === "loading" || this.phase === "unloading") {
      // A loading donkey waits at the producer until its building has made one
      // full minute-sized load (or production is stopped with a partial load).
      // Unloading never waits: it has already arrived with a valid shipment.
      if (this.phase === "loading" && !dispatch.ready) return null;
      this.remainingLoadSeconds -= deltaSeconds;
      if (this.remainingLoadSeconds > 0) return null;
      if (this.phase === "loading") this.beginTravel("outbound", source, destination);
      else this.beginTravel("inbound", destination, source);
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
        producerStructureId: this.producerStructureId,
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
    this.returningHome = true;
    if (this.phase === "loading") return;
    const anchor = this.route[this.routeState.waypointIndex];
    const route = anchor ? this.roads.route(anchor, source) : null;
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
      producerStructureId: this.producerStructureId,
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
    const route = this.roads.route(from, to);
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

/** Maintains the automatic caravan roster from the existing producer-link graph. */
export class CaravanSystem {
  private readonly caravans = new Map<string, Caravan>();

  constructor(
    private readonly balance: CaravanBalance,
    private readonly links: ProductionLogisticsSystem,
    private readonly roads: RoadGraph,
    private readonly structures: PlacedStructureSystem,
    private readonly centers: CommandCenterSystem,
    private readonly occupation?: LogisticsOccupationSystem,
    private readonly dispatchForProducer: (producerStructureId: number) => CaravanDispatch | null = () => null,
  ) {}

  update(deltaSeconds: number): readonly CaravanArrival[] {
    const active = new Set<string>();
    const arrivals: CaravanArrival[] = [];
    const links = this.links.snapshots();
    for (const [id, caravan] of this.caravans) {
      if (!caravan.health.depleted) continue;
      caravan.beginDeath();
      if (caravan.updateDeath(deltaSeconds)) this.caravans.delete(id);
      else active.add(id);
    }
    for (const link of links) {
      if (link.status !== "linked" || !link.roadCell) continue;
      const destination = this.destinationFor(link.owner, link.depotStructureId);
      if (!destination || !this.roads.route(link.roadCell, destination)) continue;
      const dispatch = this.dispatchForProducer(link.structureId)
        ?? { carryCapacity: 1, ready: false, canReceive: false };
      for (let index = 0; index < this.balance.spawnPerProducer; index += 1) {
        const id = `caravan:${link.structureId}:${index}`;
        active.add(id);
        let caravan = this.caravans.get(id);
        if (!caravan) {
          caravan = new Caravan(id, link.structureId, link.owner, link.roadCell, destination, this.balance, this.roads, dispatch.carryCapacity);
          this.caravans.set(id, caravan);
        }
        if (caravan.health.depleted) continue;
        if (!dispatch.canReceive && caravan.phase === "outbound") {
          caravan.beginReturnHome(link.roadCell);
          if (!caravan.updateReturnHome(deltaSeconds)) active.add(id);
          continue;
        }
        const arrival = caravan.update(deltaSeconds, link.roadCell, destination, dispatch);
        if (arrival) arrivals.push(arrival);
      }
    }
    // A changed topology leaves the producer's snapshot in an unlinked state,
    // so it never reached the loop above. Keep the old body long enough to walk
    // home (KARAR 5) instead of deleting it mid-road.
    for (const caravan of this.caravans.values()) {
      if (active.has(caravan.id)) continue;
      if (caravan.health.depleted) {
        continue;
      }
      const link = links.find((candidate) => candidate.structureId === caravan.producerStructureId);
      if (!link?.roadCell) continue;
      caravan.beginReturnHome(link.roadCell);
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

  private destinationFor(owner: UnitOwner, depotStructureId: number | null): RoadCell | null {
    if (depotStructureId !== null && (this.occupation?.isUsable(depotStructureId) ?? true)) {
      const depot = this.structures.all().find((structure) => structure.id === depotStructureId);
      if (depot) return roadCellTouchingFootprint(this.roads, depot.x, depot.z, depot.stats.footprint.width, depot.stats.footprint.depth);
    }
    const center = this.centers.get(owner);
    return center
      ? roadCellTouchingFootprint(this.roads, center.position.x, center.position.z, center.stats.footprint.width, center.stats.footprint.depth)
      : null;
  }
}
