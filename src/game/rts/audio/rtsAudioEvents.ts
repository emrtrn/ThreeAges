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

import type { RtsNotificationSeverity } from "../ui/rtsNotifications";
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
   * Something was picked. Separate from a plain click because the design gives
   * a repeated selection its own, much longer cooldown: clicking a button twice
   * is two actions, re-clicking the same squad is one player checking what they
   * have.
   */
  uiSelect: "ui.select",
  /**
   * An order was accepted — the audio twin of the command marker dropped on the
   * ground. Its own event rather than a second click, because a marching order
   * and a menu press are the two sounds most worth telling apart by ear.
   */
  uiCommand: "ui.command",
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

export function rtsAudioEventIds(): string[] {
  return [
    ...new Set([
      ...Object.values(RTS_NOTIFY_AUDIO_EVENTS),
      ...Object.values(RTS_NOTIFICATION_AUDIO_EVENTS),
      ...Object.values(RTS_AUDIO),
    ]),
  ];
}
