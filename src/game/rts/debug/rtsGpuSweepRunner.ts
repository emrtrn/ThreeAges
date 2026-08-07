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
 *
 * The schedule alternates — baseline, step, baseline, step, … , baseline — so
 * every measured configuration is bracketed by an untouched frame on each side.
 * {@link buildRtsGpuSweep} explains why that is worth twice the frames: it is
 * the only thing standing between this table and a GPU that quietly changes
 * clock speed halfway through the run.
 */
import { buildRtsGpuSweep, median, type RtsGpuSweep, type RtsGpuSweepStepResult } from "./rtsGpuSweep";

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

/** Row label for the untouched frame. Repeated: there is one between each step. */
export const GPU_SWEEP_BASELINE_ID = "taban";

export interface RtsGpuSweepStepPlan {
  /** Shown as the row label; also the tag the app toggles on. */
  readonly id: string;
}

/** One scheduled measurement: either an untouched frame, or one caller step. */
interface ScheduledStep {
  readonly id: string;
  /**
   * Index into the caller's configured steps, or null for a baseline frame.
   * Carried explicitly rather than derived from the schedule position, because
   * the schedule interleaves baselines and the two no longer line up.
   */
  readonly planIndex: number | null;
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
  /** Baseline, step, baseline, step, … , baseline. */
  private readonly schedule: readonly ScheduledStep[];
  private readonly samples: number[][] = [];
  private stepIndex = 0;
  private framesInStep = 0;
  private disjointEvents = 0;
  private finished: RtsGpuSweepOutcome = { kind: "running" };

  constructor(steps: readonly RtsGpuSweepStepPlan[]) {
    const schedule: ScheduledStep[] = [{ id: GPU_SWEEP_BASELINE_ID, planIndex: null }];
    for (const [index, step] of steps.entries()) {
      schedule.push({ id: step.id, planIndex: index });
      schedule.push({ id: GPU_SWEEP_BASELINE_ID, planIndex: null });
    }
    this.schedule = schedule;
    this.samples = schedule.map(() => []);
  }

  /**
   * The step the *next* drawn frame belongs to, or null once finished.
   * The returned index is also the sample tag: 0 is reserved for ordinary
   * frames, so the tag is `index + 1`.
   */
  currentStep(): {
    readonly index: number;
    readonly id: string;
    readonly tag: number;
    readonly planIndex: number | null;
  } | null {
    if (this.finished.kind !== "running") return null;
    const step = this.schedule[this.stepIndex];
    if (!step) return null;
    return { index: this.stepIndex, id: step.id, tag: this.stepIndex + 1, planIndex: step.planIndex };
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
    if (this.stepIndex < this.schedule.length) return this.finished;

    this.finished = { kind: "done", sweep: this.build(context) };
    return this.finished;
  }

  /**
   * Fold the schedule back into the caller's step order, pairing each one with
   * the baselines drawn either side of it.
   */
  private build(context: RtsGpuSweepContext): RtsGpuSweep {
    // Medians of the untouched frames, in measurement order. `null` where a
    // baseline produced nothing, so a missing one is filled in rather than
    // silently contributing a zero to its neighbour's bracket.
    const baselines: (number | null)[] = [];
    const measured: { id: string; gpuMs: number; samples: number }[] = [];
    let baselineSamples = 0;
    for (const [index, step] of this.schedule.entries()) {
      const bucket = this.samples[index] ?? [];
      if (step.planIndex === null) {
        baselines.push(bucket.length > 0 ? median(bucket) : null);
        baselineSamples += bucket.length;
        continue;
      }
      measured.push({ id: step.id, gpuMs: median(bucket), samples: bucket.length });
    }
    const present = baselines.filter((value): value is number => value !== null);
    const headline = median(present);
    // A step keeps its own bracket; where one side is missing the other stands
    // in for it, and where both are the run's median does.
    const at = (position: number, fallback: number): number =>
      baselines[position] ?? fallback;
    const steps: RtsGpuSweepStepResult[] = measured.map((step, index) => ({
      id: step.id,
      gpuMs: step.gpuMs,
      samples: step.samples,
      baselineBeforeMs: at(index, at(index + 1, headline)),
      baselineAfterMs: at(index + 1, at(index, headline)),
    }));
    return buildRtsGpuSweep({
      baselines: present,
      baselineSamples,
      steps,
      disjointEvents: this.disjointEvents,
      speed: context.speed,
      matchSeconds: context.matchSeconds,
      drawCalls: context.drawCalls,
      triangles: context.triangles,
    });
  }
}
