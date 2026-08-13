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
 * The notify names this game draws, and how.
 *
 * `sword-swing` is authored on the Guard's clips but deliberately absent here:
 * a grounded medieval swing has no particle to it, and inventing a glow to
 * prove the line works would be art nobody asked for. It stays in the asset
 * because the event is real and its consumer (audio) is planned.
 */
export const RTS_NOTIFY_EFFECTS: Readonly<Record<string, RtsNotifyEffectBinding>> = {
  footstep: {
    effectId: "rts-fx-footstep-dust",
    /*
     * Just above the ground the foot met — the unit's own origin is its feet,
     * and `syncUnitsToGround` has already written the heightfield into it.
     *
     * Not *at* it (0.05 was the first attempt): a puff that hugs the terrain
     * reads as part of the ground texture, especially in dust colours on dirt,
     * and the soldier's own legs cover what is left. A hand's height clears the
     * body and silhouettes the cloud against the ground instead of into it.
     */
    heightOffset: 0.2,
    /*
     * The cull is "don't draw what the player cannot make out", and it has to be
     * measured the way it is applied: camera-to-*unit*, not camera-to-focus. The
     * camera sits at most 40 units from its focus point, so a unit at the edge of
     * the view is already past that — a 42 here culled most of a visible army
     * while looking, from the tuning table, like it culled nothing.
     */
    maxDistance: 60,
    // 20 a second across the field. Enough that a marching company kicks up a
    // near-continuous trail, capped well under the shared instance budget.
    minIntervalSeconds: 0.05,
  },
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
