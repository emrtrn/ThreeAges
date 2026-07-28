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
import type { SettlementAge, UnitRoleId } from "../../data/gameDataTypes";

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
  /**
   * Keep this step cleared once it has cleared, even if its goal stops holding.
   *
   * The default (absent) behaviour is the right one for anything the player
   * still *has*: demolish the depot and "build a depot" re-opens, because it is
   * work to be done again. It is the wrong behaviour for anything the player
   * merely *did*. "Train three Guards" is achieved the moment the third one
   * walks out; three of them dying in a fight later does not un-train them, and
   * re-opening the step there would read as the game blaming the player for
   * having used the army it asked them to build.
   *
   * The rule of thumb: latch a step whose goal measures an event, leave it open
   * on a step whose goal measures a state the kingdom is supposed to maintain.
   */
  readonly latch?: boolean;
  /**
   * Which control answers this step, so the UI can point at it (Sürüm 2).
   *
   * Optional, and a step without one is not broken: the last step of the shipped
   * chain is "raze the enemy outpost", which is an army order rather than a
   * button, and inventing a control for it would be pointing at the wrong thing.
   */
  readonly guide?: MissionGuide;
}

/**
 * The control a step wants pressed — §12.4 of the plan.
 *
 * Authored rather than derived from the goal, even though most steps could be
 * derived: `producer-linked: stone` does imply the Quarry today, but only
 * because this project happens to ship one stone producer. The moment a fork
 * ships two, a derived pointer starts guessing, and the guess is invisible in
 * the data. Naming it costs one line per step and can be read.
 */
export type MissionGuideAction =
  /** A build-palette button, by building id. */
  | { readonly kind: "build"; readonly buildingId: string }
  /**
   * A button on the selection panel of a particular building — the centre's
   * level-up, a Market trade, a Barracks order. Two-stage by nature: the player
   * has to select `buildingId` before `actionId` exists on screen at all, which
   * is a fact the presentation layer handles rather than the data.
   */
  | {
    readonly kind: "structure-action";
    readonly buildingId: string;
    /**
     * A `SelectionAction` id (`rtsSelectionView.ts`) — `center-level-up`,
     * `trade-buy:wood`, `train:guard_placeholder`.
     *
     * Not reference-checked at load: the ids live in the view layer, and
     * importing that into the data validator would drag the UI into every
     * validation path. An engine test pins the shipped chain's ids against the
     * real constants instead. The cost of getting one wrong is a missing pulse,
     * not a stuck step — the objective itself never depends on it.
     */
    readonly actionId: string;
  };

export interface MissionGuide {
  readonly action: MissionGuideAction;
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
  | { readonly kind: "producer-linked"; readonly resourceId?: string; readonly count: number }
  /**
   * `count` completed outposts of the player's that are road-connected back to
   * the Command Centre — the exact condition that swaps an outpost's control
   * radius for its wider `connectedControlRadius`.
   *
   * Stated directly rather than as "the control area now covers marker X", which
   * is how the plan first framed it. Measuring the rule teaches the rule;
   * measuring one of its consequences on an authored map marker would tie the
   * lesson to level content and let a moved marker silently break the step.
   */
  | { readonly kind: "outpost-connected"; readonly count: number }
  /** Spare population capacity of at least `count` (capacity minus used). */
  | { readonly kind: "population-headroom"; readonly count: number }
  /** The kingdom's centre-led tier has reached at least this age and level. */
  | {
    readonly kind: "tier-reached";
    readonly age: SettlementAge;
    readonly level: 1 | 2 | 3;
  }
  /** At least `count` living units of one role. Pair with `latch` on a build-up step. */
  | { readonly kind: "unit-count"; readonly role: UnitRoleId; readonly count: number }
  /**
   * `count` completed Market trades this match, either direction.
   *
   * A tally like {@link MissionGoal} `enemy-structure-razed`, and for the same
   * reason: a trade is an event that leaves no trace in the world a predicate
   * could read afterwards — the resources it moved are indistinguishable from
   * resources that were mined. Inherently one-shot, so it needs no `latch`.
   */
  | { readonly kind: "market-trade"; readonly count: number }
  /**
   * `count` units of `resourceId` **bought** at the Market this match.
   *
   * The measured sibling of {@link MissionGoal} `market-trade`, and a tally for
   * the same reason: bought wood is indistinguishable from felled wood the
   * moment it lands in the wallet. What it adds is direction and amount, which
   * is what makes "buy 100 wood" a teachable objective rather than "press a
   * button once" — the player has to sell something first to afford it, and the
   * count is what states how much.
   *
   * Counts the lot, not the click: one buy at the shipped `lotSize` of 100 is
   * the whole goal, and a project that trades in smaller lots gets a step that
   * asks for several without the data changing.
   */
  | { readonly kind: "market-bought"; readonly resourceId: string; readonly count: number }
  /**
   * `count` enemy buildings of `buildingId` razed this match. A tally rather than
   * a world query — the thing it counts no longer exists — so a step using it is
   * inherently one-shot and does not need `latch`.
   */
  | { readonly kind: "enemy-structure-razed"; readonly buildingId: string; readonly count: number };

export interface MissionScript {
  readonly id: string;
  readonly label: string;
  /** Shown once when the chain opens; the story frame, not an instruction. */
  readonly intro: string;
  /** Shown when the last step clears and the director detaches. */
  readonly outro: string;
  readonly steps: readonly MissionStep[];
}
