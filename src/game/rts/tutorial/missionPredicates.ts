/**
 * Mission goal predicates — Hikâye / Öğretici Tur Modu, Faz 1.
 *
 * One pure function per {@link MissionGoal} kind, evaluated against a narrow
 * view of the world. Pure and DOM-free so `test:engine` can prove the chain's
 * behaviour directly, the way `rtsNotifications.ts` established for the feed.
 *
 * The fact types below are deliberately narrower than the runtime shapes they
 * are fed from (`PlacedStructure`, `ProducerLogisticsSnapshot`), following the
 * `UpgradableStructure` precedent in `kingdomProgressionSystem.ts`: a predicate
 * should state exactly what it reads, so a test can build a world out of object
 * literals instead of standing up half the simulation. The real shapes satisfy
 * these structurally, so `RtsApp` passes its snapshots straight through.
 *
 * This table is the real deliverable of the mode. The story chain is its first
 * consumer; the free-match contextual hints of `GDD/10` §87 are meant to be its
 * second, reusing the same predicates as *triggers* rather than as objectives.
 */
import type { SettlementAge, UnitRoleId } from "../../data/gameDataTypes";
import { ageRank } from "../progression/kingdomProgressionSystem";
import type { UnitOwner } from "../units/unit";
import type { MissionGoal } from "./missionScript";

/** What a goal needs to know about one placed building. */
export interface MissionStructureFact {
  readonly owner: UnitOwner;
  readonly buildingId: string;
  readonly complete: boolean;
  /**
   * For a structure that projects control (today: the outpost), whether it is
   * road-connected back to its Command Centre. Absent on everything else, so a
   * connectivity goal can never be satisfied by a building that has no such
   * notion in the first place.
   */
  readonly roadConnected?: boolean;
}

/** One living unit, reduced to what a goal may ask about it. */
export interface MissionUnitFact {
  readonly owner: UnitOwner;
  readonly role: UnitRoleId;
}

/** The player kingdom's centre-led tier. */
export interface MissionTierFact {
  readonly age: SettlementAge;
  readonly level: 1 | 2 | 3;
}

/** What a goal needs to know about one production building's supply line. */
export interface MissionProducerFact {
  readonly owner: UnitOwner;
  readonly resourceId: string;
  /** `ProducerLogisticsStatus`; only `"linked"` counts as a working supply line. */
  readonly status: string;
}

export interface MissionWorldSnapshot {
  readonly structures: readonly MissionStructureFact[];
  readonly producers: readonly MissionProducerFact[];
  readonly units: readonly MissionUnitFact[];
  readonly tier: MissionTierFact;
  /** Population capacity still free (capacity minus used, never negative). */
  readonly populationHeadroom: number;
  /**
   * Enemy buildings razed this match, keyed by building id. A tally rather than
   * a world read, because what it counts has left the world; reset with the
   * match, so a restart cannot inherit a cleared objective.
   */
  readonly razedEnemyBuildings: Readonly<Record<string, number>>;
  /**
   * Market trades the player has completed this match. A tally for the same
   * reason as {@link razedEnemyBuildings}: what it counts is an event that
   * leaves nothing behind to read.
   */
  readonly marketTrades: number;
  /**
   * Units of each resource the player has *bought* at the Market this match,
   * keyed by resource id. Kept apart from {@link marketTrades} rather than
   * derived from it: a sale and a purchase are the same event to a counter and
   * opposite moves to a player, and only the purchase side answers "buy 100
   * wood".
   */
  readonly marketPurchases: Readonly<Record<string, number>>;
}

/**
 * How far along a goal is: how much of what it asks for the player currently
 * has, against how much it wants.
 *
 * Measured rather than merely tested, because "how many more" is the question a
 * multi-count objective ("three linked producers") raises the moment it appears,
 * and the card can only answer it if the predicate hands the number over. For a
 * goal that is not a tally — reaching a tier — `target` is 1 and `current` is 0
 * or 1, which is the honest reading: there is no half of an age.
 */
export interface MissionGoalProgress {
  readonly current: number;
  readonly target: number;
}

/** The side a mission speaks for. Goals never read the enemy's world. */
const MISSION_OWNER: UnitOwner = "player";

export function measureGoal(goal: MissionGoal, world: MissionWorldSnapshot): MissionGoalProgress {
  switch (goal.kind) {
    case "structure-built":
      return {
        current: world.structures.filter((structure) =>
          structure.owner === MISSION_OWNER
          && structure.buildingId === goal.buildingId
          && structure.complete).length,
        target: goal.count,
      };
    case "producer-linked":
      return {
        current: world.producers.filter((producer) =>
          producer.owner === MISSION_OWNER
          && producer.status === "linked"
          && (goal.resourceId === undefined || producer.resourceId === goal.resourceId)).length,
        target: goal.count,
      };
    case "outpost-connected":
      return {
        current: world.structures.filter((structure) =>
          structure.owner === MISSION_OWNER
          && structure.complete
          && structure.roadConnected === true).length,
        target: goal.count,
      };
    case "population-headroom":
      return { current: world.populationHeadroom, target: goal.count };
    case "tier-reached":
      // Age outranks level: Town Lv1 satisfies "reach Settlement Lv3", because a
      // kingdom that has moved on has plainly cleared what came before it. The
      // alternative re-opens a finished step for a player who over-achieved.
      return {
        current: ageRank(world.tier.age) > ageRank(goal.age)
          || (world.tier.age === goal.age && world.tier.level >= goal.level)
          ? 1
          : 0,
        target: 1,
      };
    case "unit-count":
      return {
        current: world.units.filter((unit) =>
          unit.owner === MISSION_OWNER && unit.role === goal.role).length,
        target: goal.count,
      };
    case "enemy-structure-razed":
      return { current: world.razedEnemyBuildings[goal.buildingId] ?? 0, target: goal.count };
    case "market-trade":
      return { current: world.marketTrades, target: goal.count };
    case "market-bought":
      return { current: world.marketPurchases[goal.resourceId] ?? 0, target: goal.count };
  }
}

export function isGoalMet(goal: MissionGoal, world: MissionWorldSnapshot): boolean {
  const progress = measureGoal(goal, world);
  return progress.current >= progress.target;
}
