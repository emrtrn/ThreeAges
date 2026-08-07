/**
 * The GPU sweep: what each category of scene content costs the GPU, measured by
 * turning it off and re-measuring the whole frame.
 *
 * Timer queries cannot nest, so there is no way to ask the GPU what a subset of
 * a frame cost while that frame is being drawn. The only honest alternative is
 * an A/B: draw the frame as it is, then draw it again without shadows, again
 * without units, and so on, and report the differences.
 *
 * That makes this table the **opposite** of the CPU one, and the difference is
 * load-bearing:
 *
 *  - **Its rows do not add up to the frame, and are not supposed to.** Removing
 *    shadows changes overdraw, state changes and early-z for everything left
 *    behind. Two categories can each "cost" 3 ms while removing both saves 4.
 *  - **A row is a saving, not a cost.** "Gölge haritası: 4.2 ms" means turning
 *    it off gives that back — which is exactly the shape of a quality-setting
 *    decision, and exactly not the shape of a budget.
 *  - **Small rows are noise.** Browsers quantise timer results, so anything near
 *    the noise floor is reported as such rather than as a precise small number.
 *
 * ## Why every step is bracketed by its own baseline
 *
 * An A/B across time only holds while the machine stays the same, and over a
 * multi-second sweep it does not: a paused, cheap scene lets the GPU drop into a
 * lower power state, and the same frame then measures several times slower at
 * the end of the run than at the start. Measured against a single baseline taken
 * first, that drift is indistinguishable from content cost — and it shows up
 * with the wrong sign, as categories whose removal "costs" 7 ms.
 *
 * The driver's own disjoint flag does not catch it. A disjoint event says the
 * result is garbage; a clock change says nothing at all, because each individual
 * duration is still a true duration — of a frame drawn by a slower GPU.
 *
 * So the baseline is not measured once. It is measured before and after every
 * step, and a row is compared against the **mean of its own two neighbours**.
 * Any drift that is linear across a bracket cancels out, and what does not
 * cancel is visible as the gap between the two, which is reported per row: when
 * a bracket moved as much as the saving it is supposed to explain, the row is
 * published as `belirsiz` rather than as a number. This costs roughly twice the
 * frames of an unbracketed sweep, which is the right trade for a table whose
 * whole purpose is to be believed.
 *
 * Pure and DOM-free: the arithmetic and the wording are unit-tested, and the
 * modal only renders what comes out of here.
 */
import type { RtsDebugTableView } from "./rtsDebugTableView";

/** One measured configuration: the frame drawn with `id` turned off. */
export interface RtsGpuSweepStepResult {
  readonly id: string;
  /** Median GPU ms for the frame drawn without this category. */
  readonly gpuMs: number;
  /** Samples the median came from — a thin step is worth distrusting. */
  readonly samples: number;
  /** Untouched frame measured immediately *before* this step. */
  readonly baselineBeforeMs: number;
  /** Untouched frame measured immediately *after* it. */
  readonly baselineAfterMs: number;
}

export interface RtsGpuSweepInput {
  /**
   * Every baseline median, in measurement order: one before the first step, one
   * between each pair, one after the last. Their spread is the sweep's own
   * error bar.
   */
  readonly baselines: readonly number[];
  /** Samples behind all of those baselines together. */
  readonly baselineSamples: number;
  readonly steps: readonly RtsGpuSweepStepResult[];
  /** Times results were thrown away mid-sweep by a GPU disjoint event. */
  readonly disjointEvents: number;
  readonly speed: number;
  readonly matchSeconds: number;
  /** Draw calls and triangles of the untouched frame, for context. */
  readonly drawCalls: number;
  readonly triangles: number;
}

export interface RtsGpuSweepRow {
  readonly label: string;
  /** Frame time with this category off. */
  readonly withoutMs: number;
  /** bracket mean − without: what turning it off gives back. Can be negative. */
  readonly savingMs: number;
  /** Saving as a fraction of the headline baseline. */
  readonly share: number;
  readonly samples: number;
  /** True when the saving is inside the measurement's noise floor. */
  readonly negligible: boolean;
  /** How far this row's own two baselines disagreed. */
  readonly bracketDriftMs: number;
  /** The bracket moved at least as much as the saving: not a finding. */
  readonly unstable: boolean;
}

export interface RtsGpuSweep {
  /** Median across every baseline measured, not just the first. */
  readonly baselineMs: number;
  readonly baselineSamples: number;
  /** How many times the untouched frame was measured. */
  readonly baselineRuns: number;
  /** Spread across those measurements — the GPU's drift over the run. */
  readonly baselineDriftMs: number;
  /** Drift large enough that the run's absolute numbers are not comparable. */
  readonly baselineDrifted: boolean;
  readonly rows: readonly RtsGpuSweepRow[];
  readonly disjointEvents: number;
  readonly speed: number;
  readonly matchSeconds: number;
  readonly drawCalls: number;
  readonly triangles: number;
}

/**
 * Below this, a difference is the timer's quantisation rather than the scene's
 * content. Reporting `0.03 ms` as if it were a finding is how a table teaches
 * people to stop trusting it.
 */
export const GPU_SWEEP_NOISE_FLOOR_MS = 0.1;

/**
 * Baseline spread, as a fraction of the baseline, past which the machine changed
 * under the measurement. Bracketing still rescues the individual rows, so this
 * is a warning on the run rather than a rejection of it — but the absolute
 * `kapalıyken ms` column stops being comparable between top and bottom.
 */
export const GPU_SWEEP_DRIFT_TOLERANCE = 0.25;

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

export function buildRtsGpuSweep(input: RtsGpuSweepInput): RtsGpuSweep {
  const baselineMs = median(input.baselines);
  const baselineDriftMs = input.baselines.length > 1
    ? Math.max(...input.baselines) - Math.min(...input.baselines)
    : 0;
  const rows = input.steps.map((step) => {
    // The mean of the two neighbours, so a baseline that slid linearly across
    // the bracket contributes nothing to the difference.
    const paired = (step.baselineBeforeMs + step.baselineAfterMs) / 2;
    const savingMs = paired - step.gpuMs;
    const bracketDriftMs = Math.abs(step.baselineBeforeMs - step.baselineAfterMs);
    const negligible = Math.abs(savingMs) < GPU_SWEEP_NOISE_FLOOR_MS;
    return {
      label: step.id,
      withoutMs: step.gpuMs,
      savingMs,
      share: baselineMs > 0 ? savingMs / baselineMs : 0,
      samples: step.samples,
      negligible,
      bracketDriftMs,
      // A row whose own bracket wandered as far as its saving has not measured
      // the content; it has measured the wander.
      unstable: !negligible && bracketDriftMs >= Math.abs(savingMs),
    };
  });
  // Trustworthy rows first, each group biggest win first. Sorting an unstable
  // row into the middle by a number we have just declared meaningless would put
  // it above findings that are real.
  rows.sort((a, b) => {
    if (a.unstable !== b.unstable) return a.unstable ? 1 : -1;
    return b.savingMs - a.savingMs;
  });
  return {
    baselineMs,
    baselineSamples: input.baselineSamples,
    baselineRuns: input.baselines.length,
    baselineDriftMs,
    baselineDrifted: baselineMs > 0 && baselineDriftMs / baselineMs > GPU_SWEEP_DRIFT_TOLERANCE,
    rows,
    disjointEvents: input.disjointEvents,
    speed: input.speed,
    matchSeconds: input.matchSeconds,
    drawCalls: input.drawCalls,
    triangles: input.triangles,
  };
}

/** The `kazanç` cell: a number only when the row earned the right to show one. */
function savingCell(row: RtsGpuSweepRow): string {
  if (row.unstable) return "belirsiz";
  if (row.negligible) return "~0";
  return row.savingMs.toFixed(2);
}

function shareCell(row: RtsGpuSweepRow): string {
  if (row.unstable || row.negligible) return "—";
  return `${(row.share * 100).toFixed(1)}%`;
}

function rowKind(row: RtsGpuSweepRow): string {
  if (row.unstable) return "note";
  if (row.negligible) return "remainder";
  return "region";
}

function sweepMeta(sweep: RtsGpuSweep): string {
  return (
    `taban ${sweep.baselineMs.toFixed(2)} ms GPU ` +
    `(${sweep.baselineRuns} ölçüm · ${sweep.baselineSamples} örnek · ` +
    `sürüklenme ${sweep.baselineDriftMs.toFixed(2)} ms) · ` +
    `${sweep.drawCalls} çizim çağrısı · ${sweep.triangles} üçgen · ` +
    `${sweep.speed}X · maç ${sweep.matchSeconds.toFixed(1)} sn`
  );
}

function sweepNotes(sweep: RtsGpuSweep): string[] {
  const notes = [
    "Her satır, o içerik kapatılarak ölçülen tam karedir; değer kazanç (taban − kapalı) demektir.",
    "Taban her adımın önünde ve ardında yeniden ölçülür; satır kendi iki tabanının ortasıyla karşılaştırılır, böylece tarama boyunca GPU saatinin kayması satırdan düşer.",
    "Satırlar toplanmaz: bir şeyi kapatmak geri kalanın overdraw ve durum değişimini de değiştirir.",
    `Tarayıcı GPU sürelerini yuvarlar; ±${GPU_SWEEP_NOISE_FLOOR_MS.toFixed(1)} ms altı farklar gürültü sayılır.`,
    "GPU süresi vsync/present beklemesini içermez; cpu + gpu kare süresine eşit olmak zorunda değildir.",
  ];
  if (sweep.rows.some((row) => row.unstable)) {
    notes.push(
      "«belirsiz» satırlarda o adımın kendi taban çifti, ölçülen kazanç kadar oynadı — o satır bir bulgu değil, ölçümün kendi gürültüsüdür.",
    );
  }
  if (sweep.baselineDrifted) {
    notes.push(
      `Taban ölçümleri tarama boyunca ${sweep.baselineDriftMs.toFixed(2)} ms kaydı ` +
        `(tabanın %${((sweep.baselineDriftMs / sweep.baselineMs) * 100).toFixed(0)}'i): ` +
        "GPU büyük olasılıkla güç durumu değiştirdi. Eşleştirme satırları kurtarır, ama " +
        "«kapalıyken ms» sütunu üst ve alt satırlar arasında karşılaştırılamaz.",
    );
  }
  if (sweep.disjointEvents > 0) {
    notes.push(
      `${sweep.disjointEvents} kez GPU zamanlayıcısı geçersiz kılındı (güç durumu değişimi); o ölçümler atılıp tekrarlandı.`,
    );
  }
  return notes;
}

export function rtsGpuSweepTableView(sweep: RtsGpuSweep): RtsDebugTableView {
  return {
    title: "GPU dökümü (tarama)",
    meta: sweepMeta(sweep),
    columns: [
      { label: "İçerik", align: "left" },
      { label: "kapalıyken ms", align: "right" },
      { label: "kazanç ms", align: "right" },
      { label: "%", align: "right" },
      { label: "örnek", align: "right" },
    ],
    rows: sweep.rows.map((row) => ({
      cells: [
        row.label,
        row.withoutMs.toFixed(2),
        savingCell(row),
        shareCell(row),
        String(row.samples),
      ],
      share: row.unstable ? 0 : Math.max(0, row.share),
      kind: rowKind(row),
    })),
    notes: sweepNotes(sweep),
    clipboardText: formatRtsGpuSweepText(sweep),
  };
}

export function formatRtsGpuSweepText(sweep: RtsGpuSweep): string {
  const lines = [
    `GPU dökümü · taban ${sweep.baselineMs.toFixed(2)} ms ` +
      `(${sweep.baselineRuns} ölçüm · ${sweep.baselineSamples} örnek · sürüklenme ${sweep.baselineDriftMs.toFixed(2)} ms)`,
    `${sweep.drawCalls} çizim çağrısı · ${sweep.triangles} üçgen · ${sweep.speed}X · maç ${sweep.matchSeconds.toFixed(1)} sn`,
    "",
    `${"içerik".padEnd(22)}${"kapalı".padStart(10)}${"kazanç".padStart(10)}${"%".padStart(8)}${"örnek".padStart(8)}`,
  ];
  for (const row of sweep.rows) {
    lines.push(
      row.label.padEnd(22) +
        row.withoutMs.toFixed(2).padStart(10) +
        savingCell(row).padStart(10) +
        shareCell(row).padStart(8) +
        String(row.samples).padStart(8),
    );
  }
  lines.push("", "Satırlar kazançtır ve toplanmaz — bir içeriği kapatmak kalanların maliyetini de değiştirir.");
  if (sweep.rows.some((row) => row.unstable)) {
    lines.push("«belirsiz» satırlarda taban çifti kazanç kadar oynadı; o satır bir bulgu değildir.");
  }
  if (sweep.baselineDrifted) {
    lines.push(`Taban tarama boyunca ${sweep.baselineDriftMs.toFixed(2)} ms kaydı; GPU güç durumu değiştirmiş olabilir.`);
  }
  if (sweep.disjointEvents > 0) {
    lines.push(`${sweep.disjointEvents} kez zamanlayıcı geçersiz kılındı; o ölçümler tekrarlandı.`);
  }
  return lines.join("\n");
}

/**
 * The modal shown when the sweep cannot run at all — a browser without timer
 * queries, or a GPU that kept invalidating them. An empty table with zeros would
 * read as "nothing costs anything", which is worse than saying nothing.
 */
export function rtsGpuSweepUnavailableView(reason: string): RtsDebugTableView {
  return {
    title: "GPU dökümü (tarama)",
    meta: reason,
    columns: [{ label: "Durum", align: "left" }],
    rows: [{ cells: [reason], share: 0, kind: "note" }],
    notes: [
      "GPU zamanlaması EXT_disjoint_timer_query_webgl2 gerektirir: Chrome/Edge masaüstünde vardır, Firefox'ta değişkendir, Safari'de yoktur.",
      "CPU tarafı bundan bağımsızdır — «Kare maliyeti» düğmesi her tarayıcıda çalışır.",
    ],
    clipboardText: `GPU dökümü çalıştırılamadı: ${reason}`,
  };
}
