/**
 * Drives the GPU sweep across frames: which configuration to draw next, when a
 * step has enough samples, and when the whole thing is done.
 *
 * Pure scheduling — it never touches the scene or the GL context. The app asks
 * `currentStep()` before drawing, feeds back whatever samples the GPU returned,
 * and gets a finished sweep out the other end. Keeping it that way is what makes
 * the awkward parts testable: results lag by frames and arrive tagged, a step
 * can be invalidated halfway through, and both of those are logic bugs waiting
 * to happen if they only exist inside a render loop.
 */
import { buildRtsGpuSweep, type RtsGpuSweep, type RtsGpuSweepStepResult } from "./rtsGpuSweep";

/** Samples a step needs before the sweep moves on. Median, so an odd count. */
const SAMPLES_PER_STEP = 5;
/**
 * Frames a step may take to produce them before it is written off. Results lag,
 * and the query pool can come up empty, so this is generous — but finite, so a
 * driver that never resolves a query cannot leave the match paused forever.
 */
const MAX_FRAMES_PER_STEP = 40;
/** Disjoint events tolerated before the sweep gives up rather than looping. */
const MAX_DISJOINT_RETRIES = 3;

export interface RtsGpuSweepStepPlan {
  /** Shown as the row label; also the tag the app toggles on. */
  readonly id: string;
}

export type RtsGpuSweepOutcome =
  | { readonly kind: "running" }
  | { readonly kind: "done"; readonly sweep: RtsGpuSweep }
  | { readonly kind: "failed"; readonly reason: string };

export interface RtsGpuSweepContext {
  readonly speed: number;
  readonly matchSeconds: number;
  readonly drawCalls: number;
  readonly triangles: number;
}

export class RtsGpuSweepRunner {
  /** Index 0 is the untouched baseline; the rest each disable one category. */
  private readonly plan: readonly RtsGpuSweepStepPlan[];
  private readonly samples: number[][] = [];
  private stepIndex = 0;
  private framesInStep = 0;
  private disjointEvents = 0;
  private finished: RtsGpuSweepOutcome = { kind: "running" };

  constructor(steps: readonly RtsGpuSweepStepPlan[]) {
    this.plan = [{ id: "taban" }, ...steps];
    this.samples = this.plan.map(() => []);
  }

  /**
   * The step the *next* drawn frame belongs to, or null once finished.
   * The returned index is also the sample tag: 0 is reserved for ordinary
   * frames, so the tag is `index + 1`.
   */
  currentStep(): { readonly index: number; readonly id: string; readonly tag: number } | null {
    if (this.finished.kind !== "running") return null;
    const step = this.plan[this.stepIndex];
    if (!step) return null;
    return { index: this.stepIndex, id: step.id, tag: this.stepIndex + 1 };
  }

  /** Count a drawn frame, whether or not it produced a sample. */
  noteFrame(): void {
    if (this.finished.kind !== "running") return;
    this.framesInStep += 1;
  }

  /** A GPU result came back tagged for one of our steps. */
  acceptSample(tag: number, ms: number): void {
    if (this.finished.kind !== "running") return;
    const index = tag - 1;
    // A sample tagged for a step we have already left is a late arrival from a
    // configuration that is no longer on screen — it still measured that
    // configuration, so it still counts toward it.
    const bucket = this.samples[index];
    if (bucket && bucket.length < SAMPLES_PER_STEP) bucket.push(ms);
  }

  /**
   * A disjoint event invalidated everything in flight. The current step's
   * samples are dropped and it is measured again — the alternative is a table
   * built partly from durations that are not durations.
   */
  noteDisjoint(): void {
    if (this.finished.kind !== "running") return;
    this.disjointEvents += 1;
    if (this.disjointEvents > MAX_DISJOINT_RETRIES) {
      this.finished = {
        kind: "failed",
        reason: "GPU zamanlayıcısı ölçüm boyunca tekrar tekrar geçersiz kılındı.",
      };
      return;
    }
    const bucket = this.samples[this.stepIndex];
    if (bucket) bucket.length = 0;
    this.framesInStep = 0;
  }

  /** Advance the schedule after a drawn frame; returns the sweep when complete. */
  advance(context: RtsGpuSweepContext): RtsGpuSweepOutcome {
    if (this.finished.kind !== "running") return this.finished;
    const bucket = this.samples[this.stepIndex] ?? [];
    const settled = bucket.length >= SAMPLES_PER_STEP;
    const exhausted = this.framesInStep >= MAX_FRAMES_PER_STEP;
    if (!settled && !exhausted) return this.finished;
    if (exhausted && bucket.length === 0 && this.stepIndex === 0) {
      // Nothing measurable at all: the extension is present but produced no
      // result for the untouched frame, so every later step would be a
      // difference against nothing.
      this.finished = {
        kind: "failed",
        reason: "GPU zamanlayıcısı sonuç döndürmedi.",
      };
      return this.finished;
    }
    this.stepIndex += 1;
    this.framesInStep = 0;
    if (this.stepIndex < this.plan.length) return this.finished;

    const steps: RtsGpuSweepStepResult[] = [];
    for (const [index, step] of this.plan.entries()) {
      if (index === 0) continue;
      steps.push({
        id: step.id,
        gpuMs: median(this.samples[index] ?? []),
        samples: (this.samples[index] ?? []).length,
      });
    }
    this.finished = {
      kind: "done",
      sweep: buildRtsGpuSweep({
        baselineMs: median(this.samples[0] ?? []),
        baselineSamples: (this.samples[0] ?? []).length,
        steps,
        disjointEvents: this.disjointEvents,
        speed: context.speed,
        matchSeconds: context.matchSeconds,
        drawCalls: context.drawCalls,
        triangles: context.triangles,
      }),
    };
    return this.finished;
  }
}

/**
 * Median, not mean: the first frame of a configuration pays for pipeline warm-up
 * and shader state that the steady state does not, and one such frame drags a
 * five-sample average far enough to invent a difference.
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
