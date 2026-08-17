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
import type { UnitStance } from "../units/unit";

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
   * The palette's road tool — the answer to any step whose work is paving.
   *
   * Carries no target, and that is the deliberate half. The road tool is armed
   * once and then drawn wherever the player decides; naming a destination here
   * would be authoring the *route*, which is the decision the tur is teaching.
   * What the card says instead ("the shelf fills from a supply site") is enough
   * to send them looking, and the site's own art is already on the map.
   *
   * Distinct from the road *fallback* in `missionGuideHighlight.ts`, which fires
   * on a build step whose building stands unconnected. That one is a correction;
   * this one is the step's actual instruction.
   */
  | { readonly kind: "road" }
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
  }
  /**
   * A unit order that lives only on the keyboard — Perde IV.
   *
   * The first action with **nothing on screen to pulse**: stances, stop and
   * attack-move are keys, and the unit panel shows the resulting stance as a fact
   * rather than as a button. So the whole of this action's hint is the card's key
   * line, which is why {@link MissionGuideCommand} is a closed union rather than a
   * free string — the letter is looked up from the binding table the input layer
   * actually reads (`rtsInput.ts`), never retyped here. Rebind the key and the
   * card follows; author a command the input layer does not have and an engine
   * test says so.
   */
  | { readonly kind: "unit-command"; readonly command: MissionGuideCommand };

/**
 * The unit orders a step may ask for, named as the input layer names them.
 *
 * Deliberately *not* every entry of `COMMAND_KEYS`: the palette toggles and the
 * category digits are UI plumbing rather than orders, and a story step pointing
 * at "open the build palette" would be pointing at a door instead of at the
 * thing behind it. What is here is the set a chain can teach as a decision.
 */
export type MissionGuideCommand =
  | "stop"
  | "attackMove"
  | "hold"
  | "aggressive"
  | "retreat"
  | "selectIdleWorkers"
  | "toggleWorkerAutomation"
  | "focusCenter";

/**
 * A feature the level author placed, which the step's work is tied to — Faz 3.
 *
 * `key` is deliberately the *kind* of thing rather than one instance's id: a
 * resource id for a deposit or a trade site, a species for a herd. Naming
 * `player_safe_stone` would weld the chain to one map, and a chain is meant to
 * be copied onto a fork's own level; naming `stone` still lands on the right
 * rock because {@link nearestMissionLandmark} picks the one nearest the player's
 * centre, and this project authors every deposit in mirrored pairs.
 *
 * Only steps whose "where" is *not* a decision carry one — see
 * `missionLandmark.ts` for why that restriction is the whole design, and why the
 * House and the Depot deliberately have none.
 */
export type MissionLandmark =
  /** A resource deposit, by the resource it holds (`stone`, `gold`). */
  | { readonly kind: "resource-node"; readonly key: string }
  /** An animal herd, by species (`deer`). */
  | { readonly kind: "herd"; readonly key: string }
  /** A trade site, by the resource its caravans carry (`wood`). */
  | { readonly kind: "trade-site"; readonly key: string };

export interface MissionGuide {
  readonly action: MissionGuideAction;
  /**
   * The map feature to ring while this step is open, if any.
   *
   * Optional, and absent is the common case. It is also outranked: when the
   * guide has something more urgent to point at — "your Quarry stands but has no
   * road on it" — the marker goes to that building instead, because a correction
   * beats orientation.
   */
  readonly landmark?: MissionLandmark;
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
   * `count` trade sites currently *supplying* the player's Market — the site is
   * theirs and its caravan lane is live. `resourceId` narrows it to the goods
   * one lane carries; omitted, any live lane counts.
   *
   * Narrowed by resource rather than by site type, which is a deviation from
   * this goal's first sketch and the same call `producer-linked` already makes.
   * The player is not paving to a *timber camp*; they are paving because the
   * Market has no wood to sell, and a fork that ships two sites feeding one
   * resource should have both answer the step. The site type is level content;
   * the resource is what the objective is about.
   *
   * The one goal whose fact is stated from the player's point of view rather
   * than carrying an owner: "supplying" already means *supplying me*, because a
   * site held by somebody else and a site held by nobody are different states
   * of the same lane (see `MarketSupplyState`).
   */
  | { readonly kind: "trade-site-supplying"; readonly resourceId?: string; readonly count: number }
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
   * `count` units of one role **trained this match** — a tally, like
   * {@link MissionGoal} `market-bought`.
   *
   * The distinction from `unit-count` is not academic; it is a bug this replaced.
   * A preset that opens with an army (the shipped one starts with eight Guards)
   * satisfies "have three Guards" on the first evaluation, so the step cleared
   * itself before the player had built the Barracks it was teaching. Counting
   * *living* units is the right measure for "keep a garrison"; counting units
   * that came out of a building is the right one for "learn to train".
   *
   * Inherently one-shot — losing a Guard cannot un-train it — so it needs no
   * `latch`, which is the same reason the other tallies do not.
   */
  | { readonly kind: "unit-trained"; readonly role: UnitRoleId; readonly count: number }
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
   * Counts the lot, not the click: the shipped chain asks for exactly one lot at
   * the shipped `lotSize`, so the step clears on the first successful purchase,
   * and a project that trades in smaller lots gets a step that asks for several
   * without the data changing.
   *
   * That coupling is authored, not derived, and an engine test holds it: a `count`
   * that is not a whole multiple of the lot would leave a step whose last click
   * always overshoots it, which is a story asking for a quantity the Market has no
   * way to hand over.
   */
  | { readonly kind: "market-bought"; readonly resourceId: string; readonly count: number }
  /**
   * `count` enemy buildings of `buildingId` razed this match. A tally rather than
   * a world query — the thing it counts no longer exists — so a step using it is
   * inherently one-shot and does not need `latch`.
   */
  | { readonly kind: "enemy-structure-razed"; readonly buildingId: string; readonly count: number }
  /**
   * `count` of the player's living units currently standing in `stance`, narrowed
   * to one `role` when given — Perde IV.
   *
   * A *state*, not a tally, and that is what makes it answerable at all: "pressed
   * H once" leaves nothing behind, while "three Guards are holding position" is
   * something the world can be asked about at any moment. It is the shape
   * {@link MissionGoal} `population-headroom` already has.
   *
   * Which is also why a step using it **must** carry `latch`. The director
   * re-opens any cleared step whose goal stops holding, and a player who sets the
   * stance, learns the key, and then quite correctly presses `G` to send that
   * army somewhere would be dragged back to a lesson they have already passed.
   * The stance is a state to *reach*, not a state to keep.
   */
  | {
    readonly kind: "units-in-stance";
    readonly stance: UnitStance;
    readonly role?: UnitRoleId;
    readonly count: number;
  }
  /**
   * `count` enemy units killed this match, narrowed to one `role` when given.
   *
   * A tally for the same reason as `enemy-structure-razed`, and one-shot for the
   * same reason: a corpse is not a state the world keeps. Deliberately indifferent
   * to *where* the killing happened — defending a depot and clearing the escort
   * off an outpost are the same lesson (an army is for using), and a goal that
   * insisted on defence would be unclearable against an opponent who never
   * attacks.
   */
  | { readonly kind: "enemy-units-defeated"; readonly role?: UnitRoleId; readonly count: number };

export interface MissionScript {
  readonly id: string;
  readonly label: string;
  /** Shown once when the chain opens; the story frame, not an instruction. */
  readonly intro: string;
  /**
   * A second opening line, shown only when the match is being played with fog of
   * war on — Faz 4.
   *
   * Optional and separate from {@link intro} rather than folded into it, because
   * fog is the player's choice on the menu and the tur may not overrule it: a
   * chain that explained scouting in every match would be teaching a rule half
   * its players are not playing under, and one that never explained it leaves
   * the other half wondering why the valley is dark. The condition is the one
   * flag the caller already holds; nothing here reads it.
   */
  readonly introFog?: string;
  /** Shown when the last step clears and the director detaches. */
  readonly outro: string;
  readonly steps: readonly MissionStep[];
}
