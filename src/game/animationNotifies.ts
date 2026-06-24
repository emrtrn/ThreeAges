/**
 * Pure animation-notify firing logic (no Three.js, no DOM).
 *
 * Given a clip's notify markers and how its playhead advanced this tick, decides
 * which notifies the playhead crossed — handling a single loop wrap. The runtime
 * (a character animator / game mode) feeds it `action.time` deltas and emits the
 * fired names as an event stream; game code decides what each name does
 * (footstep audio, hit window, effect), keeping the asset generic.
 */

/** A clip-local notify marker: a name at a time (seconds from the clip start). */
export interface NotifyMarker {
  readonly name: string;
  readonly time: number;
}

/** How the playhead moved over one tick, plus the clip's loop length. */
export interface NotifyPlayhead {
  /** Playhead time at the start of the tick. */
  readonly prevTime: number;
  /** Playhead time at the end of the tick. */
  readonly currTime: number;
  /** Clip duration in seconds (the loop length). */
  readonly duration: number;
  /** Whether the clip loops (so `currTime < prevTime` means it wrapped). */
  readonly looped: boolean;
}

/**
 * Returns the notifies the playhead crossed this tick, in input order.
 *
 * Forward play, no wrap: a notify fires when `prevTime < time <= currTime`
 * (half-open so it fires exactly once as the playhead passes it). When a looped
 * clip wraps (`currTime < prevTime`), the crossed interval is the tail
 * `(prevTime, duration]` plus the head `[0, currTime]`. A single wrap per tick is
 * handled (the common case); a tick longer than a whole loop may miss markers in
 * the skipped laps.
 */
export function collectFiredNotifies(
  notifies: readonly NotifyMarker[],
  playhead: NotifyPlayhead,
): NotifyMarker[] {
  if (notifies.length === 0) return [];
  const { prevTime, currTime, looped } = playhead;
  if (currTime === prevTime) return [];
  const wrapped = looped && currTime < prevTime;
  const fired: NotifyMarker[] = [];
  for (const notify of notifies) {
    const t = notify.time;
    const hit = wrapped ? t > prevTime || t <= currTime : t > prevTime && t <= currTime;
    if (hit) fired.push(notify);
  }
  return fired;
}

/** The animator's single active clip with its playhead, sampled each tick. */
export interface ActiveClipSample {
  readonly clip: string;
  readonly time: number;
  readonly duration: number;
}

/** A flat notify list (from a `*.skeleton.json` sidecar) keyed by clip. */
export function groupNotifiesByClip(
  notifies: readonly { readonly name: string; readonly clip: string; readonly time: number }[] | undefined,
): Map<string, NotifyMarker[]> {
  const byClip = new Map<string, NotifyMarker[]>();
  for (const notify of notifies ?? []) {
    const list = byClip.get(notify.clip);
    if (list) list.push({ name: notify.name, time: notify.time });
    else byClip.set(notify.clip, [{ name: notify.name, time: notify.time }]);
  }
  return byClip;
}

/**
 * Stateful per-character notify detector. Each tick it is handed the animator's
 * single active clip + playhead (or null when stopped/blending) and the
 * character's notifies grouped by clip; it returns the markers crossed since the
 * previous tick. A clip change (or a stop) re-arms from the new playhead so a
 * switch never spurious-fires past markers.
 */
export class AnimationNotifyTracker {
  private clip: string | null = null;
  private time = 0;

  sample(
    active: ActiveClipSample | null,
    notifiesByClip: ReadonlyMap<string, readonly NotifyMarker[]>,
  ): NotifyMarker[] {
    if (!active) {
      this.clip = null;
      return [];
    }
    if (active.clip !== this.clip) {
      this.clip = active.clip;
      this.time = active.time;
      return [];
    }
    const markers = notifiesByClip.get(active.clip);
    const fired = markers
      ? collectFiredNotifies(markers, {
          prevTime: this.time,
          currTime: active.time,
          duration: active.duration,
          looped: true,
        })
      : [];
    this.time = active.time;
    return fired;
  }

  reset(): void {
    this.clip = null;
    this.time = 0;
  }
}
