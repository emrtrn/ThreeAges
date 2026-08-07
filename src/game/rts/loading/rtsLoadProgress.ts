/**
 * Boot-load progress accounting for the RTS route
 * (`docs/planned/THREEAGES_RTS_MAIN_MENU_LOADING_PLAN.md` Faz F1).
 *
 * Deliberately free of DOM: the arithmetic that decides what a loading bar shows
 * is the part worth pinning in an engine test, and a headless check cannot build
 * a `<div>`. {@link ../ui/rtsLoadingScreen} is the view over this.
 *
 * The plan's KARAR 6 is the whole design constraint — **the bar is never
 * invented**. Every track here has a denominator that the loader itself reports
 * (how many Actor refs, how many world models), so a filled bar means work
 * finished rather than time passed. Two consequences fall out of that honesty
 * and are handled below rather than papered over:
 *
 * - A denominator is not known until the loader has fetched its manifest, so the
 *   tracker reports {@link RtsLoadProgressSnapshot.determinate} `false` for the
 *   first moment and the view shows an indeterminate bar instead of a confident
 *   0%.
 * - Loaders run their work through `Promise.all`, so progress arrives in bursts.
 *   That is left visible. A smoothing animation would be the same lie as a timed
 *   fake, one step removed.
 */

/**
 * One independently-loading thing the boot waits on.
 *
 * `firstFrame` is not an asset load: it is the plan's T2 trap, the gap between
 * "every promise resolved" and "a frame with those assets in it has actually
 * been drawn". GPU upload and shader compilation live in that gap, so a bar that
 * ended at the last promise would sit at 100% through the exact freeze it was
 * supposed to be covering. Modelling it as a track is what reserves the final
 * slice for it.
 */
export type RtsLoadTrackId = "actors" | "world" | "mapArt" | "firstFrame";

export interface RtsLoadTrackDef {
  readonly id: RtsLoadTrackId;
  /**
   * Relative share of the bar. Only ratios matter — the tracker renormalises
   * over whatever tracks were actually declared, so a match booting without an
   * authored world does not leave a permanent gap where its track would be.
   */
  readonly weight: number;
}

export interface RtsLoadProgressSnapshot {
  /** 0..1, weighted across declared tracks. Never decreases (see §monotonic). */
  readonly fraction: number;
  /** False while any unsettled track still has no denominator. */
  readonly determinate: boolean;
  /** Every track settled: the boot is done and the curtain may lift. */
  readonly complete: boolean;
}

interface TrackState {
  readonly weight: number;
  loaded: number;
  /** Null until the loader reports it — the plan's T1. */
  total: number | null;
  settled: boolean;
}

/**
 * Default shares. The two model loads dominate a cold boot by roughly an order
 * of magnitude over the map art, and the first frame is a beat rather than a
 * phase — these are proportions of *attention*, not measured milliseconds, and
 * they do not need to be exact for the bar to read as honest.
 */
export const RTS_LOAD_TRACK_WEIGHTS: Readonly<Record<RtsLoadTrackId, number>> = {
  actors: 0.45,
  world: 0.45,
  mapArt: 0.05,
  firstFrame: 0.05,
};

/**
 * Aggregates several concurrent loads into one 0..1 reading.
 *
 * Tracks are declared up front because *which* loads a boot waits on is known
 * synchronously (is there a content catalog, does the Level author a world)
 * even though their sizes are not. Declaring them late would make the bar jump
 * backwards as new work appeared.
 */
export class RtsLoadTracker {
  private readonly tracks = new Map<RtsLoadTrackId, TrackState>();
  private readonly totalWeight: number;
  /**
   * Monotonic guard. `setTotal` arriving after some items already ticked can
   * legitimately lower the computed ratio, and a bar that slides backwards reads
   * as a bug to the person watching it. Clamping here keeps the *reading*
   * monotonic without falsifying any track's own counts.
   */
  private highWater = 0;

  constructor(
    tracks: readonly RtsLoadTrackDef[],
    private readonly onChange?: (snapshot: RtsLoadProgressSnapshot) => void,
  ) {
    for (const track of tracks) {
      this.tracks.set(track.id, { weight: track.weight, loaded: 0, total: null, settled: false });
    }
    this.totalWeight = tracks.reduce((sum, track) => sum + track.weight, 0);
  }

  /**
   * A loader reporting where it is. `total` may arrive on the first call or a
   * later one; both are normal, because some loaders only learn their own size
   * after a manifest fetch.
   */
  report(id: RtsLoadTrackId, loaded: number, total: number): void {
    const track = this.tracks.get(id);
    if (!track || track.settled) return;
    track.loaded = loaded;
    track.total = total;
    this.emit();
  }

  /**
   * This track will produce no further reports — finished, empty, or failed.
   *
   * Failure settles exactly like success on purpose (the plan's T3): a bar that
   * stalled at 80% because one fetch 404'd would trap the player behind a
   * curtain over a game that is, thanks to the fallbacks, perfectly playable.
   */
  settle(id: RtsLoadTrackId): void {
    const track = this.tracks.get(id);
    if (!track || track.settled) return;
    track.settled = true;
    this.emit();
  }

  /** The timeout escape hatch: give up waiting and let the boot through. */
  settleAll(): void {
    let changed = false;
    for (const track of this.tracks.values()) {
      if (track.settled) continue;
      track.settled = true;
      changed = true;
    }
    if (changed) this.emit();
  }

  snapshot(): RtsLoadProgressSnapshot {
    let weighted = 0;
    let determinate = true;
    let complete = true;
    for (const track of this.tracks.values()) {
      weighted += track.weight * trackFraction(track);
      if (!track.settled) {
        complete = false;
        if (track.total === null) determinate = false;
      }
    }
    const raw = this.totalWeight > 0 ? weighted / this.totalWeight : 1;
    this.highWater = Math.max(this.highWater, clamp01(raw));
    return {
      // Completion is the one thing allowed to override the high-water mark, so
      // a finished boot always reads exactly 1 rather than 0.999.
      fraction: complete ? 1 : this.highWater,
      determinate,
      complete,
    };
  }

  private emit(): void {
    this.onChange?.(this.snapshot());
  }
}

function trackFraction(track: TrackState): number {
  if (track.settled) return 1;
  if (track.total === null) return 0;
  // A zero-length track is already done rather than a division by zero: a Level
  // that authors no models is an ordinary Level, not a broken one.
  if (track.total <= 0) return 1;
  return clamp01(track.loaded / track.total);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
