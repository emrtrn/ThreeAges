/**
 * What the story tur lets the player build right now — Sürüm 2 (§12.5).
 *
 * The failure this exists for is not hypothetical: told "build a Lumber Camp",
 * a first-time player places three or four before the first one finishes, runs
 * the opening wood to zero, and the chain cannot continue. Every step is still
 * individually satisfiable, so the director cannot see the deadlock — which is
 * exactly why the answer is a refusal at the point of the click rather than a
 * cleverer objective.
 *
 * **Scope, deliberately narrow.** This is consulted by the *player's* palette
 * path only. It is not a simulation rule: `StructureConstructionService` never
 * hears about it, the AI never hears about it, and a free match never
 * constructs it. A story chain still cannot change how the game works — it can
 * only decline to spend the player's wood on the same building twice while they
 * are being taught what the first one does.
 *
 * Two rules, and both are about *pacing* rather than about what is legal:
 *
 * 1. **One at a time.** No second site of a building type while one is still
 *    under construction. This is the whole of the reported problem: the wood is
 *    gone before the first building has had a chance to teach anything.
 * 2. **Not past what the step asked for.** Once enough of the guided building
 *    stand to satisfy the active step, another one is not the answer — the step
 *    is open for some *other* reason (a Farm with no road on it), and buying a
 *    second Farm is the mistake, not the fix.
 *
 * Pure and DOM-free, so `test:engine` can state each rule directly.
 */
import type { MissionStep } from "./missionScript";

export type MissionBuildRefusal =
  /** One of these is already going up. */
  | "already-building"
  /** The step's quota of this building is already standing. */
  | "step-satisfied";

export interface MissionBuildRequest {
  readonly buildingId: string;
  /** The active step, or null when no chain is running (which allows everything). */
  readonly step: MissionStep | null;
  /** Completed buildings of this type the player owns. */
  readonly completed: number;
  /** Sites of this type under construction. */
  readonly pending: number;
}

export type MissionBuildVerdict =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly refusal: MissionBuildRefusal };

const ALLOWED: MissionBuildVerdict = { allowed: true };

/**
 * How many of `buildingId` the step is asking for, or null when the goal does
 * not say.
 *
 * Null is common and fine — "make room for population" needs however many
 * Houses it needs, and inventing a number for it would cap a step the player
 * could then not finish. Rule 1 still paces those; only rule 2 needs a quota.
 *
 * Exported because the *pointer* needs the same number: "the step's buildings
 * are all standing and it is still open" is exactly when another one must be
 * refused **and** when the hint should move to the road tool. Two independent
 * readings of "enough" would eventually disagree, and the shape of that
 * disagreement is a card telling the player to build what the palette refuses.
 */
export function missionBuildQuota(step: MissionStep, buildingId: string): number | null {
  const action = step.guide?.action;
  if (action?.kind !== "build" || action.buildingId !== buildingId) return null;
  switch (step.goal.kind) {
    // The goal counts the building itself, so its count *is* the quota.
    case "structure-built":
      return step.goal.buildingId === buildingId ? step.goal.count : null;
    // The goal counts working supply lines / connected outposts, one per
    // building — so the quota is the same number, and the difference between
    // "built" and "working" is a road, which is what the guide points at once
    // this refusal fires.
    case "producer-linked":
    case "outpost-connected":
      return step.goal.count;
    default:
      return null;
  }
}

export function missionBuildVerdict(request: MissionBuildRequest): MissionBuildVerdict {
  if (!request.step) return ALLOWED;
  if (request.pending > 0) return { allowed: false, refusal: "already-building" };
  const required = missionBuildQuota(request.step, request.buildingId);
  if (required !== null && request.completed >= required) {
    return { allowed: false, refusal: "step-satisfied" };
  }
  return ALLOWED;
}
