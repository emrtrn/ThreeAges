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
}

export interface RtsGpuSweepInput {
  /** The untouched frame every step is compared against. */
  readonly baselineMs: number;
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
  /** baseline − without: what turning it off gives back. Can be negative. */
  readonly savingMs: number;
  /** Saving as a fraction of the baseline frame. */
  readonly share: number;
  readonly samples: number;
  /** True when the saving is inside the measurement's noise floor. */
  readonly negligible: boolean;
}

export interface RtsGpuSweep {
  readonly baselineMs: number;
  readonly baselineSamples: number;
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

export function buildRtsGpuSweep(input: RtsGpuSweepInput): RtsGpuSweep {
  const rows = input.steps.map((step) => {
    const savingMs = input.baselineMs - step.gpuMs;
    return {
      label: step.id,
      withoutMs: step.gpuMs,
      savingMs,
      share: input.baselineMs > 0 ? savingMs / input.baselineMs : 0,
      samples: step.samples,
      negligible: Math.abs(savingMs) < GPU_SWEEP_NOISE_FLOOR_MS,
    };
  });
  rows.sort((a, b) => b.savingMs - a.savingMs);
  return {
    baselineMs: input.baselineMs,
    baselineSamples: input.baselineSamples,
    rows,
    disjointEvents: input.disjointEvents,
    speed: input.speed,
    matchSeconds: input.matchSeconds,
    drawCalls: input.drawCalls,
    triangles: input.triangles,
  };
}

export function rtsGpuSweepTableView(sweep: RtsGpuSweep): RtsDebugTableView {
  const notes = [
    "Her satır, o içerik kapatılarak ölçülen tam karedir; değer kazanç (taban − kapalı) demektir.",
    "Satırlar toplanmaz: bir şeyi kapatmak geri kalanın overdraw ve durum değişimini de değiştirir.",
    `Tarayıcı GPU sürelerini yuvarlar; ±${GPU_SWEEP_NOISE_FLOOR_MS.toFixed(1)} ms altı farklar gürültü sayılır.`,
    "GPU süresi vsync/present beklemesini içermez; cpu + gpu kare süresine eşit olmak zorunda değildir.",
  ];
  if (sweep.disjointEvents > 0) {
    notes.push(
      `${sweep.disjointEvents} kez GPU zamanlayıcısı geçersiz kılındı (güç durumu değişimi); o ölçümler atılıp tekrarlandı.`,
    );
  }
  return {
    title: "GPU dökümü (tarama)",
    meta:
      `taban ${sweep.baselineMs.toFixed(2)} ms GPU (${sweep.baselineSamples} örnek) · ` +
      `${sweep.drawCalls} çizim çağrısı · ${sweep.triangles} üçgen · ` +
      `${sweep.speed}X · maç ${sweep.matchSeconds.toFixed(1)} sn`,
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
        row.negligible ? "~0" : row.savingMs.toFixed(2),
        row.negligible ? "—" : `${(row.share * 100).toFixed(1)}%`,
        String(row.samples),
      ],
      share: Math.max(0, row.share),
      kind: row.negligible ? "remainder" : "region",
    })),
    notes,
    clipboardText: formatRtsGpuSweepText(sweep),
  };
}

export function formatRtsGpuSweepText(sweep: RtsGpuSweep): string {
  const lines = [
    `GPU dökümü · taban ${sweep.baselineMs.toFixed(2)} ms (${sweep.baselineSamples} örnek)`,
    `${sweep.drawCalls} çizim çağrısı · ${sweep.triangles} üçgen · ${sweep.speed}X · maç ${sweep.matchSeconds.toFixed(1)} sn`,
    "",
    `${"içerik".padEnd(22)}${"kapalı".padStart(10)}${"kazanç".padStart(10)}${"%".padStart(8)}${"örnek".padStart(8)}`,
  ];
  for (const row of sweep.rows) {
    lines.push(
      row.label.padEnd(22) +
        row.withoutMs.toFixed(2).padStart(10) +
        (row.negligible ? "~0" : row.savingMs.toFixed(2)).padStart(10) +
        (row.negligible ? "—" : `${(row.share * 100).toFixed(1)}%`).padStart(8) +
        String(row.samples).padStart(8),
    );
  }
  lines.push(
    "",
    "Satırlar kazançtır ve toplanmaz — bir içeriği kapatmak kalanların maliyetini de değiştirir.",
  );
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
