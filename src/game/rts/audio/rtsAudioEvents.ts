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
  // The five that were authored for audio and nothing else — see
  // `RTS_NOTIFY_AUDIO_ONLY`. Every one of them must appear here, or it is a
  // marker on a clip that no longer has any consumer at all.
  footstep: "unit.footstep",
  "chop-impact": "unit.chop_impact",
  "dig-impact": "unit.dig_impact",
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

/** Every audio event id this game triggers by name. The table must answer all of them. */
export function rtsAudioEventIds(): string[] {
  return [
    ...new Set([
      ...Object.values(RTS_NOTIFY_AUDIO_EVENTS),
      ...Object.values(RTS_NOTIFICATION_AUDIO_EVENTS),
    ]),
  ];
}
