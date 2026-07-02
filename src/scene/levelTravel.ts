/**
 * Pure level-travel state machine (no Three.js / DOM).
 *
 * P2 Level Travel ends the runtime's single-layout life: a portal, menu, or
 * script can hand the runtime a new level to load. The mechanism is generic —
 * this module owns only the phase + which request is in flight, so the whole
 * cycle can be unit-tested headless. The actual scene teardown/rebuild and the
 * player respawn live in the runtime shell (`RuntimeSceneApp`), driven by these
 * transitions.
 *
 * Lifecycle: `idle → unloading → loading → idle` (per request). A second request
 * arriving mid-travel does not interrupt the one in flight; it is held as the
 * single pending slot (latest wins) and runs once the current cycle settles, so
 * a portal tapped twice ends at the last-requested level rather than aborting.
 */

/** Where a travel cycle currently is. `idle` means no travel is running. */
export type LevelTravelPhase = "idle" | "unloading" | "loading";

/** A request to travel to a target level, optionally at a tagged Player Start. */
export interface LevelTravelRequest {
  /** Public-relative path (or manifest scene name) of the target level layout. */
  readonly layoutPath: string;
  /**
   * Optional Player Start tag: the target spawn's `spawnTag` metadata. Absent
   * (or unmatched) falls back to the first Player Start marker in the level.
   */
  readonly spawnTag?: string | undefined;
}

export interface LevelTravelState {
  readonly phase: LevelTravelPhase;
  /** The request currently being processed; null only when idle. */
  readonly active: LevelTravelRequest | null;
  /**
   * A request received while another was in flight. Single slot, latest wins;
   * promoted to `active` when the current cycle finishes.
   */
  readonly pending: LevelTravelRequest | null;
}

/** A fresh, idle travel state. */
export function initialLevelTravelState(): LevelTravelState {
  return { phase: "idle", active: null, pending: null };
}

/** True while a travel cycle is running (teardown or load in progress). */
export function isTravelBusy(state: LevelTravelState): boolean {
  return state.phase !== "idle";
}

/**
 * Registers a travel request. When idle, the cycle starts immediately (the
 * caller should begin tearing the scene down) and `begin` is true. When a cycle
 * is already running, the request is held as the pending slot (latest wins) and
 * `begin` is false — the caller does nothing now; the running cycle picks it up
 * on {@link finishTravel}.
 */
export function requestTravel(
  state: LevelTravelState,
  request: LevelTravelRequest,
): { state: LevelTravelState; begin: boolean } {
  if (isTravelBusy(state)) {
    return { state: { ...state, pending: request }, begin: false };
  }
  return {
    state: { phase: "unloading", active: request, pending: null },
    begin: true,
  };
}

/**
 * Advances a cycle from teardown to loading once the old scene is disposed.
 * No-op unless the state is `unloading` (defensive: keeps the phase monotonic).
 */
export function beginLoading(state: LevelTravelState): LevelTravelState {
  if (state.phase !== "unloading") return state;
  return { ...state, phase: "loading" };
}

/**
 * Settles the current cycle. If a pending request queued up while this one ran,
 * it is promoted to `active` and a new `unloading` cycle begins; otherwise the
 * machine returns to idle. The returned `next` is the promoted request (null
 * when returning to idle) so the caller's loop can process it.
 */
export function finishTravel(
  state: LevelTravelState,
): { state: LevelTravelState; next: LevelTravelRequest | null } {
  if (state.pending) {
    return {
      state: { phase: "unloading", active: state.pending, pending: null },
      next: state.pending,
    };
  }
  return { state: initialLevelTravelState(), next: null };
}
