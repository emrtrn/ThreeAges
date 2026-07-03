/**
 * Pure per-subsystem tick-timing aggregator (Performance Infrastructure, P5.1).
 *
 * Side-effect free: no DOM, no three.js, no clock of its own. The engine update
 * loop times each subsystem's `update()` and feeds the elapsed milliseconds here
 * via {@link SubsystemProfiler.record}; this class keeps a rolling window per
 * subsystem and derives a sorted {@link SubsystemProfileSnapshot} the `?debug`
 * overlay reads. Because it only takes already-measured numbers, it is fully
 * deterministic and unit-tested without a real clock.
 *
 * The profiler is only instantiated under `?debug` (see {@link EngineApp}), so it
 * adds no cost to the production frame loop — the registry keeps its plain,
 * un-timed update path when no recorder is attached.
 */

/** Minimal surface the {@link SubsystemRegistry} needs — keeps it decoupled. */
export interface SubsystemTimingRecorder {
  record(id: string, ms: number): void;
  endFrame(): void;
}

export interface SubsystemTiming {
  readonly id: string;
  /** Milliseconds spent in this subsystem's most recent `update()`. */
  readonly lastMs: number;
  /** Mean `update()` cost across the rolling window. */
  readonly averageMs: number;
  /** Worst `update()` cost within the rolling window (spike visibility). */
  readonly maxMs: number;
  /** Samples currently in the window (ramps up to the window size). */
  readonly samples: number;
}

export interface SubsystemProfileSnapshot {
  /** Per-subsystem timings, sorted by `averageMs` descending (worst first). */
  readonly subsystems: readonly SubsystemTiming[];
  /** Sum of every subsystem's `averageMs` — the windowed engine tick cost. */
  readonly totalAverageMs: number;
  /** Frames observed since the profiler was created / last cleared. */
  readonly frames: number;
}

/** Fixed-size rolling window of the last `size` numeric samples. */
class RollingWindow {
  private readonly buf: number[] = [];
  private sum = 0;
  private head = 0;
  private lastValue = 0;

  constructor(private readonly size: number) {}

  push(value: number): void {
    this.lastValue = value;
    if (this.buf.length < this.size) {
      this.buf.push(value);
      this.sum += value;
      return;
    }
    this.sum -= this.buf[this.head]!;
    this.buf[this.head] = value;
    this.sum += value;
    this.head = (this.head + 1) % this.size;
  }

  get last(): number {
    return this.lastValue;
  }

  get count(): number {
    return this.buf.length;
  }

  get average(): number {
    return this.buf.length === 0 ? 0 : this.sum / this.buf.length;
  }

  get max(): number {
    let peak = 0;
    for (const value of this.buf) if (value > peak) peak = value;
    return peak;
  }
}

const DEFAULT_WINDOW_FRAMES = 60;

export class SubsystemProfiler implements SubsystemTimingRecorder {
  /** Insertion-ordered so subsystems with identical averages keep a stable order. */
  private readonly windows = new Map<string, RollingWindow>();
  private frameCount = 0;

  constructor(private readonly windowFrames: number = DEFAULT_WINDOW_FRAMES) {}

  /** Records one subsystem's `update()` cost in milliseconds for this frame. */
  record(id: string, ms: number): void {
    // Clamp negatives (clock skew) to zero so a bad sample can't corrupt the mean.
    const sample = ms > 0 ? ms : 0;
    let window = this.windows.get(id);
    if (!window) {
      window = new RollingWindow(this.windowFrames);
      this.windows.set(id, window);
    }
    window.push(sample);
  }

  /** Marks the end of a frame (advances the frame counter). */
  endFrame(): void {
    this.frameCount += 1;
  }

  snapshot(): SubsystemProfileSnapshot {
    const subsystems: SubsystemTiming[] = [];
    let totalAverageMs = 0;
    for (const [id, window] of this.windows) {
      const averageMs = window.average;
      totalAverageMs += averageMs;
      subsystems.push({
        id,
        lastMs: window.last,
        averageMs,
        maxMs: window.max,
        samples: window.count,
      });
    }
    // Stable descending sort by average cost (ties keep insertion order).
    subsystems.sort((a, b) => b.averageMs - a.averageMs);
    return { subsystems, totalAverageMs, frames: this.frameCount };
  }

  /** The `n` most expensive subsystems by rolling average (worst first). */
  top(n: number): SubsystemTiming[] {
    return this.snapshot().subsystems.slice(0, Math.max(0, n));
  }

  /** Resets all windows and the frame counter (e.g. after a level teardown). */
  clear(): void {
    this.windows.clear();
    this.frameCount = 0;
  }
}
