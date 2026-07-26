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
import type { UnitOwner } from "../units/unit";
import type { MissionGoal } from "./missionScript";

/** What a goal needs to know about one placed building. */
export interface MissionStructureFact {
  readonly owner: UnitOwner;
  readonly buildingId: string;
  readonly complete: boolean;
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
}

/** The side a mission speaks for. Goals never read the enemy's world. */
const MISSION_OWNER: UnitOwner = "player";

export function isGoalMet(goal: MissionGoal, world: MissionWorldSnapshot): boolean {
  switch (goal.kind) {
    case "structure-built":
      return world.structures.filter((structure) =>
        structure.owner === MISSION_OWNER
        && structure.buildingId === goal.buildingId
        && structure.complete).length >= goal.count;
    case "producer-linked":
      return world.producers.filter((producer) =>
        producer.owner === MISSION_OWNER
        && producer.status === "linked"
        && (goal.resourceId === undefined || producer.resourceId === goal.resourceId)).length >= goal.count;
  }
}
