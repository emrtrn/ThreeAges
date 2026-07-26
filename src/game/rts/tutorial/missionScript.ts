/**
 * Mission script schema — Hikâye / Öğretici Tur Modu, Faz 1.
 *
 * See `docs/planned/THREEAGES_STORY_TUTORIAL_MODE_PLAN.md`. A mission script is
 * authored data (`public/game-data/missions/<id>.json`), not code: the whole
 * point of the mode is that a fork rewrites the story without touching the
 * runtime (CLAUDE.md — keep the template generic).
 *
 * What is deliberately *not* here: a scripting language. {@link MissionGoal} is
 * a closed union, and every member maps to exactly one pure predicate in
 * `missionPredicates.ts`. Adding a new kind of objective is a code change on
 * purpose — an open-ended condition expression in JSON would be a second,
 * untyped, untested simulation reader living in the content folder.
 *
 * Types only, so this module stays free of three.js and DOM and can be read by
 * the validator, the director, and `test:engine` alike.
 */

/**
 * One step of the chain.
 *
 * `title` states the goal as an instruction ("Tarlayı depoya bağla"); `why` is
 * the single sentence that actually teaches. The split matters: the game's own
 * panels already state every *rule* (`rtsSelectionView.ts` spells out each
 * logistics status in full), so what a first-time player is missing is not the
 * rule text but the reason to go looking for it. `why` is that reason, and it
 * is the one line worth writing carefully.
 */
export interface MissionStep {
  readonly id: string;
  readonly title: string;
  readonly why: string;
  readonly goal: MissionGoal;
}

/**
 * A step's success condition, evaluated against the world as it stands rather
 * than against a history of events. Every member is answerable from a snapshot
 * the HUD already builds; none of them may require the director to remember
 * anything (see {@link MissionDirector} for why that property carries the mode).
 *
 * Owner is implicit: a mission is the player's, so every predicate reads the
 * player's side. An enemy-facing goal would need its own kind and says so.
 */
export type MissionGoal =
  /**
   * `count` completed buildings of `buildingId`. Completion, not placement:
   * a foundation the player just clicked down teaches nothing, and passing the
   * step on placement would advance the card before the thing it talks about
   * exists in the world.
   */
  | { readonly kind: "structure-built"; readonly buildingId: string; readonly count: number }
  /**
   * `count` producers whose logistics status is `linked` — the four-condition
   * rule (control area + road contact + own depot on the same component + that
   * depot unoccupied) reduced to the one bit that means "this building is
   * actually paying you". `resourceId` narrows it to one resource; omitted, any
   * producer counts.
   */
  | { readonly kind: "producer-linked"; readonly resourceId?: string; readonly count: number };

export interface MissionScript {
  readonly id: string;
  readonly label: string;
  /** Shown once when the chain opens; the story frame, not an instruction. */
  readonly intro: string;
  /** Shown when the last step clears and the director detaches. */
  readonly outro: string;
  readonly steps: readonly MissionStep[];
}
