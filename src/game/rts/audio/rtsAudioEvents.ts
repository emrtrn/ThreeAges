/**
 * Which RTS moments have a sound, and what that sound is called — audio plan
 * Faz 0/1.
 *
 * The event *ids* live here; what each one sounds like lives in
 * `public/game-data/audio/events.json`. That split is the whole point: mix
 * levels, cooldowns and distances get retuned by ear and must not need a code
 * change, while the set of moments the game can make a sound at is a contract
 * two files have to agree on.
 *
 * Pure (no Three.js, no subsystem), so `test:engine` can check that agreement
 * without a renderer — which is the one failure this line cannot otherwise
 * report: an event id named here that no table entry answers is a sound that
 * silently never plays.
 */

import type { RtsNotificationKind, RtsNotificationSeverity } from "../ui/rtsNotifications";
import type { RtsMusicState } from "./rtsMusicState";

/**
 * Sounds triggered by an animation notify.
 *
 * These names are not invented here. They are authored on the units' clips, live
 * in the `*.skeleton.json` sidecars, and reach this module through the same
 * event stream the particle bursts ride — `rtsNotifyEffects.ts` reserved them
 * for exactly this consumer and said so:
 *
 *   "A name with no entry here is not an error and not a gap: it is a marker the
 *    asset authors for a consumer that does not exist yet."
 *
 * This is that consumer. A notify name absent from this map simply makes no
 * sound; it is not reported as a missing event, because plenty of markers exist
 * for the renderer alone.
 */
export const RTS_NOTIFY_AUDIO_EVENTS: Readonly<Record<string, string>> = {
  // The four that were authored for audio and nothing else — see
  // `RTS_NOTIFY_AUDIO_ONLY`. Every one of them must appear here, or it is a
  // marker on a clip that no longer has any consumer at all.
  footstep: "unit.footstep",
  "chop-impact": "unit.chop_impact",
  "sword-swing": "combat.sword_swing",
  "arrow-release": "combat.arrow_release",
  // Drawn *and* heard: a blow landing is the readable half of a fight, and a gun
  // coming apart is the loudest thing on the field.
  "body-impact": "combat.body_impact",
  "wreck-blast": "siege.wreck_blast",
};

/** The audio event a notify fires, or null when the marker is silent by design. */
export function rtsNotifyAudioEvent(notifyName: string): string | null {
  return RTS_NOTIFY_AUDIO_EVENTS[notifyName] ?? null;
}

/**
 * Notification sounds, keyed by severity rather than by kind.
 *
 * Three tiers, matching the design's Info / Warning / Alarm split. Per-kind
 * sounds (a cut road sounding different from a full population) are a later
 * pass: with one clip per tier the player already learns "something happened /
 * something is wrong / something is burning", which is the reading the sound has
 * to carry, and twenty near-identical stingers would only make that harder.
 *
 * What makes these safe to fire on every post is that the notification centre
 * already de-duplicates: a still-true polled condition *refreshes* its notice
 * rather than raising it again, so only a genuine new raise reaches this.
 */
export const RTS_NOTIFICATION_AUDIO_EVENTS: Readonly<
  Record<RtsNotificationSeverity, string>
> = {
  info: "notify.info",
  warning: "notify.warning",
  alert: "notify.alert",
};

/**
 * The notices that answer with their own sound instead of their tier's — audio
 * plan §48 (Paket 2), landed 2026-08-22.
 *
 * The three tiers above stay the floor: a kind absent from this map still
 * sounds, as its severity. What this adds is the handful of notices §14/§16
 * produced clips for, and the reason to give them one is the failure §82.3
 * wrote down — every selection-panel button answered through the tier map, so
 * a pressed button and a depleted quarry made the same noise.
 *
 * Two of them are not notifications in spirit at all. `command` and
 * `command-refused` are the direct answer to a click the player just made (a
 * trade, a train order, a demolish), and the interface's own confirm and error
 * are what a click is owed — which is also why they route to the `ui` bus
 * rather than to `notifications`. Reaching them through this map rather than
 * through fourteen call sites in `runSelectionAction` is the whole point: the
 * notification centre already de-duplicates, and every action already posts.
 *
 * **`age-upgraded` and `enemy-age-upgraded` are deliberately absent.** §48 lists
 * a clip for each and neither has been produced yet, so they keep falling to
 * info/warning; the age transition also has `stinger.age_up` over it, which is
 * the louder half of that moment. Adding the two ids here before the clips
 * exist would make an event no table can answer.
 */
export const RTS_NOTIFICATION_KIND_AUDIO_EVENTS: Readonly<
  Partial<Record<RtsNotificationKind, string>>
> = {
  "population-full": "notify.population_full",
  "resource-depleted": "notify.resource_depleted",
  "outpost-under-attack": "notify.outpost_attack",
  "center-under-attack": "notify.center_attack",
  "regional-victory-warning": "notify.regional_victory_warning",
  // §48 items 16/17 said the tiers would carry these two and no asset would be
  // produced. Both were produced anyway, so they get the pair of ids they were
  // named for — the cut is still an alert and the restore still info, they just
  // no longer share a clip with every other alarm and every other good news.
  "logistics-cut": "notify.logistics_cut",
  "logistics-restored": "notify.logistics_restored",
  command: "ui.confirm",
  "command-refused": "ui.error",
};

/**
 * The sound a posted notice makes: its own when it has one, its tier's
 * otherwise.
 *
 * A caller may override both — see `RtsNotificationRequest.sound`, which is how
 * a Market trade answers with the till rather than with a generic confirm.
 */
export function rtsNotificationAudioEvent(
  kind: RtsNotificationKind,
  severity: RtsNotificationSeverity,
): string {
  return RTS_NOTIFICATION_KIND_AUDIO_EVENTS[kind] ?? RTS_NOTIFICATION_AUDIO_EVENTS[severity];
}

/**
 * The events fired from a specific place in `RtsApp` rather than from a stream.
 *
 * Named constants rather than string literals at the call sites, for two
 * reasons that happen to point the same way. The first is ordinary: an id
 * written twice drifts, and the checks that keep the code and the table in
 * agreement need one place to read the set from.
 *
 * The second is particular to this codebase. Audio event ids share a syntax with
 * localization keys — lower-case, dotted — and three of these namespaces
 * (`ui.`, `building.`, `unit.`) are *also* locale namespaces. The gate that
 * catches a mistyped translation key scans for key-shaped literals, so a literal
 * `"building.complete"` in gameplay code reads to it as a missing translation.
 * Keeping the ids behind constants means neither system has to know about the
 * other's namespace.
 */
export const RTS_AUDIO = {
  // Interface: the direct answer to something the player just clicked.
  uiClick: "ui.click",
  uiError: "ui.error",
  /**
   * An action *succeeded* — §14's `SFX-UI-002`, and the other half of `uiError`.
   *
   * Not a second click sound: `uiClick` says the button was pressed, this says
   * the thing behind it happened. Almost every one of them arrives through the
   * notification map (`command` → here, `command-refused` → `uiError`), because
   * the fourteen actions on the selection panel all already answer by posting a
   * notice and none of them called an audio hook — §82.3's open item, and the
   * reason a demolish and a full granary used to sound identical.
   */
  uiConfirm: "ui.confirm",
  /**
   * A pointer crossing an interface control.
   *
   * Fired from one delegated listener on the HUD host rather than from each
   * control, so a panel built later inherits it without knowing it exists. It
   * stays under `uiClick`: a hover must not read as the press it precedes, or a
   * mouse crossing the screen becomes an instrument.
   *
   * **Split by what is under the pointer, never by repetition.** `uiHoverCard`
   * is the same sound for a different kind of target, and the pair replaced
   * three random variants on one event. That is the opposite of the rule the
   * rest of this table follows, and hover is the case that inverts it: a player
   * sweeping a row of build cards crosses six buttons in a second, and a sound
   * that changes each time is heard as six different controls rather than as
   * variety. Everywhere else a repeat is spread over seconds and one clip is
   * what sounds broken.
   */
  uiHover: "ui.hover",
  /**
   * The same crossing over a picture card rather than a control — the build
   * palette's building and road thumbnails.
   *
   * Chosen by the target carrying an image rather than by a class list, so a
   * card added later is a card without this file being told. Two events instead
   * of one because the change the player should hear is "I have moved from the
   * interface into the cards", not "I have moved again".
   */
  uiHoverCard: "ui.hover_card",
  /**
   * A panel opening and closing — §14's `SFX-UI-005`/`006`.
   *
   * The pause card and the mission panel's fold, not the selection panel: that
   * one appears as a *consequence* of a pick, and it already has the pick's own
   * sound over it. A panel sound there would double every selection.
   */
  uiPanelOpen: "ui.panel_open",
  uiPanelClose: "ui.panel_close",
  /**
   * Something was picked. Separate from a plain click because the design gives
   * a repeated selection its own, much longer cooldown: clicking a button twice
   * is two actions, re-clicking the same squad is one player checking what they
   * have.
   */
  uiSelect: "ui.select",
  /**
   * What was actually picked — §14's `SFX-UI-007`/`008`, and the first split of
   * `uiSelect` rather than a replacement for it.
   *
   * `uiSelect` stays as the answer for a pick that is neither (or both, in a
   * mixed drag), on the same fallback shape §82.4 gave the armour split: the
   * game keeps a sound for the case the project did not produce a clip for.
   * The two are worth telling apart because they are the two things a player
   * clicks between all match long, and a squad answering like a building is the
   * one confusion the interface can remove for free.
   */
  uiSelectUnit: "ui.select_unit",
  uiSelectBuilding: "ui.select_building",
  /**
   * An order was accepted — the audio twin of the command marker dropped on the
   * ground. Its own event rather than a second click, because a marching order
   * and a menu press are the two sounds most worth telling apart by ear.
   */
  uiCommand: "ui.command",
  /**
   * The order's own kind — §14's `SFX-UI-009`/`010`.
   *
   * Same relationship to `uiCommand` that the two selects have to `uiSelect`:
   * these are fired when the command system says what it issued, and the shared
   * sound answers the orders it does not name (a worker task, a structure's
   * attack, a retreat). The design's reason for the split is stated in
   * `guardMove`/`guardAttack` below and holds here too — "we are moving" and
   * "we are engaging" land on the same button and must not land on the same
   * sound.
   */
  uiCommandAttack: "ui.command_attack",
  uiCommandMove: "ui.command_move",
  /**
   * The rally flag being armed — §14's `SFX-UI-011`.
   *
   * The arming, not the placing: pressing Rally puts the game in a mode, and the
   * click that then drops the flag is an ordinary command. A player who arms it
   * and right-clicks away hears `uiCancel`, which is already wired.
   */
  uiRallyPoint: "ui.rally_point",
  /**
   * §14's `SFX-UI-012`/`013`. One toggle, two sounds, and that asymmetry is the
   * point: `uiCancel` used to answer both directions, so the sound said the key
   * had landed without saying which way it went — readable only by looking at
   * the card that just appeared, which is the thing the sound exists to make
   * unnecessary.
   */
  uiPause: "ui.pause",
  uiResume: "ui.resume",
  /** Backing out: a placement abandoned, a mode escaped, the pause menu closing. */
  uiCancel: "ui.cancel",
  buildingPlace: "building.place",
  /** A foundation withdrawn — the opposite of `buildingPlace`, and it should sound it. */
  buildingCancel: "building.cancel",
  /**
   * The hammering at a foundation actually being worked — §17's construction
   * loop, and the third of the three sounds that make a build read by ear
   * (placed, being built, done).
   *
   * A loop rather than a per-blow one-shot, and that is a decision about the
   * asset rather than about the code: the workers have no hammer clip, so there
   * is no notify to hang an impact on (see `workerConstructionSystem`'s note on
   * why the builder stands in his idle). A bed at the site says "work is
   * happening here" without claiming a swing that nothing is animating.
   *
   * Exactly one plays at a time, over the single site described in
   * `RtsApp.updateBuildLoopAudio`. Four foundations do not make four hammers:
   * they are the same sound at four places, and layering them only turns a
   * readable rhythm into a wash.
   */
  buildingBuildLoop: "building.build_loop",
  /**
   * A unit going down — §19/§20/§21's `SFX-WRK-006` / `SFX-GRD-007` /
   * `SFX-ARC-007`, as one event rather than three.
   *
   * One event because that is what §81.2 settled: the table is coarser than the
   * inventories on purpose, and producing a set per role means a library whose
   * larger half never plays. A role split is a *code* decision (the id chosen by
   * role, or the marker carrying it) and it belongs to the same Faz 5 pass that
   * splits the footstep.
   *
   * Fired on the frame the unit is defeated, not when the corpse is cleared
   * thirty seconds later — `updateUnitDeaths` keeps those two apart precisely so
   * a consumer can pick. That frame is the start of the death animation rather
   * than the moment the body lands, so the *clip* carries the beat: a stagger
   * and kit rustle first, the weight settling after. Timing a fall would need a
   * notify authored on every death clip, which is the trap §81.1 wrote down when
   * the pickaxe was cancelled.
   *
   * Both sides die audibly. The fog gate is what keeps that honest — a loss
   * behind the curtain stays behind it.
   */
  unitDeath: "unit.death",
  // World: buildings have no animation notifies, so these are their equivalent.
  buildingComplete: "building.complete",
  structureImpact: "structure.impact",
  structureCollapse: "structure.collapse",
  // The gun's report. The only combat sound with no notify behind it — the
  // shell's flight is timed from the shot, not from a marker on a clip.
  cannonFire: "siege.cannon_fire",
  /**
   * §16's economy set. Three different kinds of moment, and they route to three
   * different buses on purpose rather than by namespace:
   *
   * - a Market trade answers a button, so it rides `ui` beside the confirm it
   *   replaces;
   * - a full store is the game telling the player something is being wasted, so
   *   it rides `notifications`;
   * - work starting and a producer coming online happen *at a place on the map*,
   *   so they are spatial and ride `sfx` with the rest of the world.
   *
   * What §16 warns against is the fourth kind, and none of these is it: "saniyede
   * birçok kez kaynak artışı için ses üretilmemelidir". Nothing here fires on a
   * resource tick. The production sounds fire on a producer's *transition* into
   * producing — a building coming online, which happens a few dozen times a
   * match — and never again while it keeps producing.
   */
  economyMarketBuy: "economy.market_buy",
  economyMarketSell: "economy.market_sell",
  economyStockFull: "economy.stock_full",
  economyWorkStart: "economy.work_start",
  // The two that never stop.
  worldAmbience: "world.ambience",
  /**
   * The four gameplay music states (§28), one playlist each.
   *
   * Not triggered like the sounds around them: `MusicDirector` owns these clips
   * and fades between the lists, so what the table entry provides is the running
   * order and the level rather than a play. They are named here anyway, and by
   * the same reasoning as everything else in this map — the set of moments the
   * game can sound at is a contract, and an id no table entry answers is a
   * playlist that silently resolves to nothing.
   *
   * MENU is absent on purpose: it belongs to the shell rather than to a match,
   * and RESULT is §5.11's two stingers below.
   */
  musicSettlement: "music.settlement",
  musicExpansion: "music.expansion",
  musicTension: "music.tension",
  musicBattle: "music.battle",
  /**
   * The three stingers (§5.11): a match-state change announced musically rather
   * than reported.
   *
   * They ride the `music` bus, not `notifications`, and that is the decision
   * worth writing down. Functionally they are announcements, so the notification
   * bus is the tempting home — but a stinger *is* a piece of music (§71 produces
   * them alongside the score, from the same instrument set), and a player who
   * pulls the Music slider down has said what they want to hear. That is only
   * safe because §62's rule holds here: none of these three moments is carried
   * by sound alone. The age-up posts a notification card, and the result screen
   * is on top of the field. Silence costs the player nothing but the flourish.
   *
   * Only the age *transition* gets one, not the in-age level-up: the level-up
   * already has its info notice, and giving both the same fanfare would spend
   * the milestone sound on the thing that is not the milestone.
   */
  /**
   * Guard barks — the unit answering the player rather than the interface
   * answering the click.
   *
   * Fired alongside `uiSelect` / `uiCommand`, not instead of them: the click
   * sound is the interface confirming it heard, the bark is the squad
   * confirming it will go, and a player who selects a worker still needs the
   * first. Only the Guard has lines, so a selection without one is silent here
   * and nothing has to stand in for the others.
   *
   * Move and attack are separate events for the same reason the design keeps
   * `uiCommand` apart from `uiClick`: "we are moving" and "we are engaging"
   * are the two things a player most needs to tell apart without looking, and
   * they are the two orders that land on the same button.
   */
  guardSelect: "voice.guard_select",
  guardMove: "voice.guard_move",
  guardAttack: "voice.guard_attack",
  stingerAgeUp: "stinger.age_up",
  stingerVictory: "stinger.victory",
  stingerDefeat: "stinger.defeat",
} as const;

/**
 * The axis a shared world sound splits on — §81.2's deferred decision, taken
 * 2026-08-22 (§82.4).
 *
 * The problem it answers: the event table is coarser than §19–§23's inventories.
 * One `unit.footstep` for four rigs, one `combat.body_impact` for every blow, one
 * `structure.impact` for every building. Producing a set per *role* against that
 * would ship a library whose larger half never plays — which is the trap §81.2
 * wrote down and left open.
 *
 * The axis chosen is **not** role. It is `armorClass`, and the reasons are three:
 *
 * 1. **It is already authored.** `guard`/`siege` are `heavy`, `archer`/`worker`
 *    are `light`. No new data.
 * 2. **It is the axis the ear actually hears.** What a blow sounds like is
 *    decided by what it landed *on*, not by who swung — §20 says exactly this
 *    with `SFX-GRD-004` "sword hit armor" beside `SFX-GRD-005` "sword hit flesh".
 *    A role split would have produced three sets along the wrong axis.
 * 3. **Two sets instead of four.** §19's Worker and §21's Archer are both light;
 *    what the design names between them is the ground ("dirt"), not the body.
 *
 * The events that look shared and are not: `sword-swing` is authored on the Guard
 * rig alone, `arrow-release` on the Archer's, `chop-impact` and `throw-release` on
 * the Worker's. Those are already one role each and need no split.
 *
 * **Buildings are deliberately not here** (§82.5). They looked like the same
 * problem and are not: a house is timber in a settlement and masonry in a town,
 * so a variant derived from one authored material name is age-blind, and ten of
 * the fifteen buildings never authored one. Their sound is named outright by the
 * damage presentation table (`damage.…slots.<slot>.sound`), which is already per
 * age and already covers every building through `defaults` — so there is nothing
 * left here to derive, and leaving a second answer beside the authored one would
 * be the worst of the three options.
 */
export type RtsAudioVariant = "light" | "heavy";

const ARMOR_VARIANTS = ["light", "heavy"] as const satisfies readonly RtsAudioVariant[];

/** Which shared events may carry a variant, and which variants each admits. */
export const RTS_AUDIO_SPLIT: Readonly<Record<string, readonly RtsAudioVariant[]>> = {
  [RTS_NOTIFY_AUDIO_EVENTS.footstep!]: ARMOR_VARIANTS,
  [RTS_NOTIFY_AUDIO_EVENTS["body-impact"]!]: ARMOR_VARIANTS,
  [RTS_AUDIO.unitDeath]: ARMOR_VARIANTS,
};

/** `combat.body_impact` + `heavy` → `combat.body_impact_heavy`. */
export function rtsAudioVariantEvent(baseEventId: string, variant: RtsAudioVariant): string {
  return `${baseEventId}_${variant}`;
}

/**
 * The event to actually fire: the variant when the project ships one, the shared
 * sound when it does not.
 *
 * The fallback is what makes the split safe to land *before* the clips exist,
 * and it is deliberately the same shape as the music state machine's ("a state
 * whose playlist the project does not ship keeps the one already playing"). Two
 * things follow from it that are worth being explicit about:
 *
 * - Production can arrive one class at a time. The heavy footstep set can ship
 *   months before the light one without a silent frame in between.
 * - A fork that produces one set per event never has to know this exists.
 *
 * Pure, with the table's answer passed in, so `test:engine` drives both branches
 * without a scene — and so this module keeps knowing nothing about the runtime.
 */
export function resolveRtsAudioVariant(
  baseEventId: string,
  variant: RtsAudioVariant | null,
  answers: (eventId: string) => boolean,
): string {
  if (variant === null) return baseEventId;
  // A variant nobody declared for this event is a caller bug, not a fallback
  // case: it would resolve to an id no table will ever answer and go silent.
  if (!RTS_AUDIO_SPLIT[baseEventId]?.includes(variant)) return baseEventId;
  const variantId = rtsAudioVariantEvent(baseEventId, variant);
  return answers(variantId) ? variantId : baseEventId;
}

/**
 * Every variant id the table is *allowed* to carry.
 *
 * Kept apart from {@link rtsAudioEventIds}: that set is what the table **must**
 * answer, and a variant is optional by construction. This is what stops an
 * added `combat.body_impact_heavy` from reading as an entry nothing triggers.
 */
export function rtsAudioVariantEventIds(): string[] {
  return Object.entries(RTS_AUDIO_SPLIT).flatMap(([baseId, variants]) =>
    variants.map((variant) => rtsAudioVariantEvent(baseId, variant)),
  );
}

/** Every audio event id this game triggers by name. The table must answer all of them. */
/**
 * The menu's playlist (§28.1) — a table entry no *match* ever triggers.
 *
 * Kept here with the rest so this file remains the single answer to "which
 * moments have a sound", but deliberately outside {@link RTS_AUDIO} and
 * {@link rtsAudioEventIds}: those are what `RtsApp` can fire, and the menu runs
 * before `RtsApp` exists. `rtsMenuMusic.ts` is the owner.
 */
export const RTS_MENU_MUSIC_EVENT = "music.menu";

/**
 * §28's four gameplay states mapped to the table entry that holds each playlist.
 *
 * Keyed by the state name so the state machine can stay ignorant of event ids
 * and this file stays the one place a moment is bound to a sound.
 */
export const RTS_MUSIC_STATE_EVENTS = {
  settlement: RTS_AUDIO.musicSettlement,
  expansion: RTS_AUDIO.musicExpansion,
  tension: RTS_AUDIO.musicTension,
  battle: RTS_AUDIO.musicBattle,
} as const satisfies Readonly<Record<RtsMusicState, string>>;

/**
 * One production sound per resource — §16's `SFX-ECO-003`…`006`.
 *
 * Keyed by the balance table's resource id rather than named as four constants,
 * because the caller has a `resourceId` in hand and nothing else: a producer
 * reports what it makes, and the sound follows from that. A resource with no
 * entry is silent, which is what a fork that adds a fifth resource should get
 * until it produces a clip for it.
 *
 * Fired on the frame a producer starts producing, not on the resource arriving:
 * §16 is explicit that a per-tick income sound is the wrong shape, and a
 * building coming online is the state change worth hearing.
 */
export const RTS_RESOURCE_PRODUCTION_AUDIO_EVENTS: Readonly<Record<string, string>> = {
  food: "economy.food_production",
  wood: "economy.wood_production",
  stone: "economy.stone_production",
  gold: "economy.gold_production",
};

/** The production sound for one resource, or null when the project ships none. */
export function rtsResourceProductionAudioEvent(resourceId: string): string | null {
  return RTS_RESOURCE_PRODUCTION_AUDIO_EVENTS[resourceId] ?? null;
}

export function rtsAudioEventIds(): string[] {
  return [
    ...new Set([
      ...Object.values(RTS_NOTIFY_AUDIO_EVENTS),
      ...Object.values(RTS_NOTIFICATION_AUDIO_EVENTS),
      ...Object.values(RTS_NOTIFICATION_KIND_AUDIO_EVENTS),
      ...Object.values(RTS_RESOURCE_PRODUCTION_AUDIO_EVENTS),
      ...Object.values(RTS_AUDIO),
    ]),
  ];
}
