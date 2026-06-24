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
