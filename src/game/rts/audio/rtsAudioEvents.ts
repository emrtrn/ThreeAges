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
