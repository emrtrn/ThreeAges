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
import type { CombatTarget } from "../combat/combatTarget";
import { HealthComponent } from "../units/health";
import {
  advanceRoam,
  initialRoamState,
  makeWildlifeRng,
  randomPointInHerd,
  wildlifeSeed,
  type RoamProfile,
  type RoamState,
} from "./wildlifeRoaming";

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
}

/**
 * One wild animal.
 *
 * `armorClass` is fixed at `"light"` rather than authored: every huntable
 * species is unarmoured, and giving the balance table a knob whose only correct
 * value is one value invites a nonsensical one.
 */
export class WildlifeAnimal implements CombatTarget {
  readonly owner = "wild" as const;
  readonly armorClass: UnitArmorClass = "light";
  readonly position = new Vector3();
  readonly health: HealthComponent;

  facing = 0;
  /** Ground speed travelled last tick, republished for the clip selector. */
  speed = 0;

  private readonly roam: RoamState;
  private readonly random: () => number;

  constructor(
    readonly id: string,
    readonly herdId: string,
    readonly stats: AnimalBalanceStats,
    private readonly profile: RoamProfile,
  ) {
    this.health = new HealthComponent(stats.maxHealth);
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

  /** Graze one tick. A dead animal holds still — its carcass is Faz 5's job. */
  update(deltaSeconds: number): void {
    if (this.dead) {
      this.speed = 0;
      return;
    }
    const pose = advanceRoam(
      this.roam,
      { x: this.position.x, z: this.position.z, facing: this.facing },
      this.profile,
      deltaSeconds,
      this.random,
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
    };
  }
}

/** Shared wildlife state for presentation, the hunt (Faz 5) and the AI. */
export class WildlifeSystem {
  private readonly animals: WildlifeAnimal[] = [];

  constructor(balance: AnimalBalance, herds: readonly RtsHerdDefinition[]) {
    const seen = new Set<string>();
    for (const herd of herds) {
      if (seen.has(herd.id)) throw new Error(`Duplicate herd "${herd.id}"`);
      seen.add(herd.id);
      const stats = balance[herd.species];
      if (!stats) throw new Error(`Herd "${herd.id}" references unknown species "${herd.species}"`);
      if (!Number.isInteger(herd.count) || herd.count <= 0) {
        throw new RangeError(`Herd "${herd.id}" count must be a positive integer`);
      }
      const profile: RoamProfile = {
        homeX: herd.x,
        homeZ: herd.z,
        roamRadius: stats.roamRadius,
        walkSpeed: stats.walkClipSpeed,
      };
      for (let index = 0; index < herd.count; index += 1) {
        this.animals.push(new WildlifeAnimal(`${herd.id}:${index}`, herd.id, stats, profile));
      }
    }
  }

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("Wildlife delta must be a non-negative finite number");
    }
    for (const animal of this.animals) animal.update(deltaSeconds);
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

  snapshots(): readonly WildlifeAnimalSnapshot[] {
    return this.animals
      .map((animal) => animal.snapshot())
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private distanceSquared(animal: WildlifeAnimal, x: number, z: number): number {
    const dx = animal.position.x - x;
    const dz = animal.position.z - z;
    return dx * dx + dz * dz;
  }
}
