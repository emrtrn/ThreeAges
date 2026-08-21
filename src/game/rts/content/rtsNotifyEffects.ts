/**
 * What an animation notify is worth showing — Guard plan Faz 6.
 *
 * The notify line itself is generic: a clip's playhead crosses a marker and the
 * presentation emits its name. This module is the RTS's half of that contract —
 * which names are worth a burst of particles, where the burst sits on the body,
 * and how much of the frame they may collectively take. Pure (no Three.js, no
 * subsystem), so the rules are testable without a renderer.
 *
 * A name with no entry here is not an error and not a gap: it is a marker the
 * asset authors for a consumer that does not exist yet. The audio plan
 * (`docs/planned/THREEAGES_AUDIO_DESIGN_AND_PRODUCTION_PLAN.md`) is the one this
 * is waiting for, and it subscribes to the same event stream rather than to a
 * second one.
 */

/**
 * The authored marker that says a thrower's hand has reached full extension.
 *
 * The one notify name with a *runtime* consumer rather than a drawn one: the
 * stone's flight starts here (`RtsApp.releasePendingThrow`), which is why it has
 * no entry in the effect table below and is not a gap.
 *
 * Named rather than inline because three things have to agree on the spelling
 * and they live in different files: that consumer, the `notifies` entry in the
 * thrower's `*.skeleton.json`, and the check that holds them together. A typo on
 * any side is a stone that is never thrown, with nothing to report it.
 */
export const RTS_THROW_RELEASE_NOTIFY = "throw-release";

/** How one notify name is drawn, and what keeps it affordable. */
export interface RtsNotifyEffectBinding {
  /** Manifest effect id played at the notify. */
  readonly effectId: string;
  /** Height above the unit's feet the burst spawns at, in world units. */
  readonly heightOffset: number;
  /**
   * Camera distance past which the burst is skipped entirely.
   *
   * The cheapest of the three guards and the only one with no visual cost: a
   * puff of dust under a figure the size of a few pixels is not read, it is
   * only paid for.
   */
  readonly maxDistance: number;
  /**
   * Shortest gap between two bursts of this name *across the whole match*.
   *
   * Global rather than per-unit on purpose. A per-unit cap does not bound
   * anything — forty marching Guards are forty units each politely under their
   * own limit — and the thing being protected is one shared instance budget.
   * Zero means never throttled, which is what an event burst gets: a footstep
   * missing from a crowd is invisible, a missing flinch is the readable half of
   * a fight.
   */
  readonly minIntervalSeconds: number;
}

/**
 * The notify names authored on the units' clips that this game deliberately
 * does *not* draw.
 *
 * Every one of them is a real, measured moment with a planned consumer — the
 * audio pass subscribes to this same event stream — so the marker stays in the
 * sidecar. What is missing is only the particle burst, and for two reasons that
 * are worth keeping apart:
 *
 * - `sword-swing`, `arrow-release` and `throw-release`'s neighbours never had
 *   one: a grounded medieval swing has no particle to it, and inventing a glow
 *   to prove the line works would be art nobody asked for.
 * - `footstep` and `chop-impact` *were* drawn and were removed on 2026-08-18, on
 *   the user's call after looking at the running match. At the RTS camera's
 *   working distance the dust (8 sprites, half opacity, dust-beige on dirt)
 *   could not be made out at all, and the axe debris was not worth the channel
 *   it cost. A burst nobody can see is not a subtle effect, it is a frame cost
 *   with no reader — so the binding went and the marker stayed.
 *
 * `dig-impact` used to be here too and is gone entirely: it was authored on
 * `Farming_dig_and_plant_seeds` alone, so the only place the pickaxe-on-stone
 * clip ever played was the farm, next to seeding and harvesting. The quarry and
 * the gold mine — the two buildings a player expects that sound from — never
 * reached it: `mining` claims no clip of its own and rides the shared kneel,
 * which marks nothing. Removed 2026-08-21 on the user's call rather than moved,
 * because the Worker rig has no pickaxe swing to move it to.
 *
 * Membership here is asserted, not just documented: it is what separates "this
 * name is waiting for audio" from "somebody mistyped a name", which is the one
 * failure the notify line cannot otherwise report.
 */
export const RTS_NOTIFY_AUDIO_ONLY: ReadonlySet<string> = new Set([
  "footstep",
  "chop-impact",
  "sword-swing",
  "arrow-release",
]);

/**
 * The notify names this game draws, and how.
 *
 * Short by design — see `RTS_NOTIFY_AUDIO_ONLY` for the names that are authored
 * and deliberately undrawn. What survives here is what a player actually reads
 * at the RTS camera's distance: a blow landing on a body, and a gun coming
 * apart.
 */
export const RTS_NOTIFY_EFFECTS: Readonly<Record<string, RtsNotifyEffectBinding>> = {
  "body-impact": {
    effectId: "rts-fx-body-impact",
    // Chest height on a unit whose body is about one world unit tall.
    heightOffset: 0.9,
    maxDistance: 60,
    minIntervalSeconds: 0,
  },
  /*
   * The three the artillery's wreck asks for (siege crew plan Faz 4). They come
   * through this channel rather than being played by the presentation for the
   * reason every other one does: the presentation reports that a moment has
   * arrived and holds no effect instance, so a burning wreck stops burning by
   * the timeline no longer asking rather than by anything being torn down.
   */
  "wreck-blast": {
    effectId: "rts-fx-explosion",
    // Barrel height on the carriage — where the charge actually was.
    heightOffset: 0.95,
    // Further than a footfall by a wide margin: a gun going up is the loudest
    // thing on the field, and culling it at conversational range would hide the
    // one event the player most wants to have seen.
    maxDistance: 110,
    minIntervalSeconds: 0,
  },
  "wreck-fire": {
    effectId: "rts-fx-fire-loop",
    // Low in the collapsed carriage rather than at the old barrel height: by the
    // time this catches, the thing that is burning has come down.
    heightOffset: 0.35,
    maxDistance: 70,
    // The timeline already paces itself; this is the shared budget's floor for
    // when several guns die at once.
    minIntervalSeconds: 0.2,
  },
  "wreck-smoke": {
    effectId: "rts-fx-ruin-smoke-black",
    heightOffset: 0.9,
    maxDistance: 90,
    minIntervalSeconds: 0.5,
  },
};

/**
 * Decides whether a notify becomes a burst this frame, and returns what to play.
 *
 * Stateful only in the small way it has to be: the last time each name fired, so
 * the global rate cap above can be applied. Everything else is a pure read of
 * the table. Holds no reference to the renderer — the caller does the playing —
 * which is what keeps it testable and keeps a dropped burst from ever being
 * something the simulation can notice.
 */
export class RtsNotifyEffectBudget {
  private readonly lastFiredAt = new Map<string, number>();

  /**
   * `clockSeconds` is a monotonic real-time reading, and `cameraDistance` the
   * distance from the camera to the unit. Returns the binding to play, or null
   * when the name is undrawn, too far, or inside its own rate cap.
   */
  request(name: string, clockSeconds: number, cameraDistance: number | null): RtsNotifyEffectBinding | null {
    const binding = RTS_NOTIFY_EFFECTS[name];
    if (!binding) return null;
    // Null means the caller does not know where the camera is (a headless
    // harness). Treating that as "near" keeps such a caller on the behaviour it
    // would have had before distance culling existed, exactly as the animation
    // throttle does with the same input.
    if (cameraDistance !== null && cameraDistance > binding.maxDistance) return null;
    if (binding.minIntervalSeconds > 0) {
      const last = this.lastFiredAt.get(name);
      if (last !== undefined && clockSeconds - last < binding.minIntervalSeconds) return null;
    }
    this.lastFiredAt.set(name, clockSeconds);
    return binding;
  }
}

/** Effect ids this game may play from a notify, for warming them at match start. */
export function rtsNotifyEffectIds(): string[] {
  return [...new Set(Object.values(RTS_NOTIFY_EFFECTS).map((binding) => binding.effectId))];
}
