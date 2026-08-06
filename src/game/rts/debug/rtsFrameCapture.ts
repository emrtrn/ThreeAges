/**
 * One captured frame, decomposed into what each system cost — pure and
 * DOM-free, so the arithmetic that makes the table trustworthy is unit-tested
 * rather than eyeballed in a modal.
 *
 * Two rules give the table its credibility, and both live here:
 *
 *  1. **Every millisecond is accounted for.** Measured regions never sum to the
 *     whole frame — there is always glue between them. A table whose parts
 *     cover 60% of the frame while saying nothing about the other 40% sends you
 *     optimising the wrong thing, so the leftovers are rows too
 *     (`… (diğer)` per group, `ölçülmeyen` for the frame).
 *  2. **The captured frame is shown next to its window.** A single frame is
 *     noise: a GC pause, a shader compile, or the AI's cadence tick that only
 *     fires every few seconds. Each row carries the rolling average and the
 *     window peak beside the captured value, so "was this frame typical?" is
 *     answered in the table instead of guessed at.
 */
import type { RtsDebugTableView } from "./rtsDebugTableView";

/** A measured region, as the app recorded it. `parent` marks it as a leaf. */
export interface RtsFrameRegionSample {
  readonly id: string;
  /** The group this region sits inside; absent for a top-level region. */
  readonly parent?: string;
  /** Cost in the captured frame (ms), summed over that frame's sub-steps. */
  readonly frameMs: number;
  /** Rolling-window mean and peak (ms) for the same region. */
  readonly averageMs: number;
  readonly maxMs: number;
  /** True for work that exists only on the debug route (the hidden witness). */
  readonly debugOnly?: boolean;
}

export interface RtsFrameCaptureInput {
  /** The whole frame, as measured — the denominator for every share. */
  readonly totalMs: number;
  readonly averageTotalMs: number;
  readonly maxTotalMs: number;
  readonly regions: readonly RtsFrameRegionSample[];
  /** Simulation sub-steps that frame ran — 8X folds eight ticks into one frame. */
  readonly simulationSteps: number;
  readonly speed: number;
  /** Frames the rolling average/peak columns cover. */
  readonly windowFrames: number;
  /** Match seconds at capture, so a capture can be placed in the match. */
  readonly matchSeconds: number;
}

export type RtsFrameCaptureRowKind =
  /** A measured region with nothing measured inside it. */
  | "region"
  /** The part of a group (or of the frame) no region accounted for. */
  | "remainder"
  /** Debug-route-only work that the shipping build never pays for. */
  | "debug";

export interface RtsFrameCaptureRow {
  readonly label: string;
  /** Which group the row belongs to, or null when it is the frame's own. */
  readonly group: string | null;
  readonly frameMs: number;
  readonly averageMs: number;
  readonly maxMs: number;
  /** Fraction of the captured frame, 0–1. */
  readonly share: number;
  readonly kind: RtsFrameCaptureRowKind;
}

export interface RtsFrameCapture {
  readonly totalMs: number;
  readonly averageTotalMs: number;
  readonly maxTotalMs: number;
  /** Every row, most expensive first. */
  readonly rows: readonly RtsFrameCaptureRow[];
  readonly simulationSteps: number;
  readonly speed: number;
  readonly windowFrames: number;
  readonly matchSeconds: number;
}

/** Sub-microsecond leftovers are timer noise, not a finding. */
const REMAINDER_EPSILON_MS = 0.001;

export function buildRtsFrameCapture(input: RtsFrameCaptureInput): RtsFrameCapture {
  const children = new Map<string, RtsFrameRegionSample[]>();
  for (const region of input.regions) {
    if (region.parent === undefined) continue;
    const siblings = children.get(region.parent);
    if (siblings) siblings.push(region);
    else children.set(region.parent, [region]);
  }

  const share = (ms: number): number => (input.totalMs > 0 ? ms / input.totalMs : 0);
  const rows: RtsFrameCaptureRow[] = [];
  let topLevelMs = 0;

  for (const region of input.regions) {
    const nested = children.get(region.id);
    if (region.parent === undefined) topLevelMs += region.frameMs;
    if (nested) {
      // A decomposed group is not a row of its own — its children are the rows,
      // and whatever they leave over becomes one below. Listing both would
      // double-count the group and quietly break every percentage in the table.
      const measured = sum(nested, (child) => child.frameMs);
      const leftover = region.frameMs - measured;
      if (leftover > REMAINDER_EPSILON_MS) {
        rows.push({
          label: `${region.id} (diğer)`,
          group: region.id,
          frameMs: leftover,
          averageMs: Math.max(0, region.averageMs - sum(nested, (child) => child.averageMs)),
          // Deliberately not a peak: the group's peak frame and its children's
          // peaks are different frames, so subtracting them means nothing.
          maxMs: 0,
          share: share(leftover),
          kind: "remainder",
        });
      }
      continue;
    }
    rows.push({
      label: region.id,
      group: region.parent ?? null,
      frameMs: region.frameMs,
      averageMs: region.averageMs,
      maxMs: region.maxMs,
      share: share(region.frameMs),
      kind: region.debugOnly ? "debug" : "region",
    });
  }

  const unmeasured = input.totalMs - topLevelMs;
  if (unmeasured > REMAINDER_EPSILON_MS) {
    rows.push({
      label: "ölçülmeyen",
      group: null,
      frameMs: unmeasured,
      averageMs: Math.max(0, input.averageTotalMs - sumTopLevelAverages(input.regions)),
      maxMs: 0,
      share: share(unmeasured),
      kind: "remainder",
    });
  }

  rows.sort((a, b) => b.frameMs - a.frameMs);
  return {
    totalMs: input.totalMs,
    averageTotalMs: input.averageTotalMs,
    maxTotalMs: input.maxTotalMs,
    rows,
    simulationSteps: input.simulationSteps,
    speed: input.speed,
    windowFrames: input.windowFrames,
    matchSeconds: input.matchSeconds,
  };
}

/** The capture as the modal renders it: formatted cells, nothing computed. */
export function rtsFrameCaptureTableView(capture: RtsFrameCapture): RtsDebugTableView {
  return {
    title: "Kare maliyeti (CPU)",
    meta:
      `${capture.totalMs.toFixed(2)} ms toplam · ort ${capture.averageTotalMs.toFixed(2)} · ` +
      `tepe ${capture.maxTotalMs.toFixed(2)} (son ${capture.windowFrames} kare) · ` +
      `${capture.speed}X, ${capture.simulationSteps} simülasyon adımı · maç ${capture.matchSeconds.toFixed(1)} sn`,
    columns: [
      { label: "İşlem", align: "left" },
      { label: "Grup", align: "left" },
      { label: "ms", align: "right" },
      { label: "%", align: "right" },
      { label: "ort", align: "right" },
      { label: "tepe", align: "right" },
    ],
    rows: capture.rows.map((row) => ({
      cells: [
        row.label,
        row.group ?? "—",
        row.frameMs.toFixed(2),
        `${(row.share * 100).toFixed(1)}%`,
        row.averageMs.toFixed(2),
        // A leftover has no meaningful peak: the group's worst frame and its
        // children's worst frames are not the same frame.
        row.maxMs > 0 ? row.maxMs.toFixed(2) : "—",
      ],
      share: row.share,
      kind: row.kind,
    })),
    notes: [
      "Satırlar bu karenin tamamını böler; toplamları kareye eşittir.",
      "çizim = karenin GPU'ya gönderilme (CPU) süresi, GPU'nun çizim süresi değil — onun için GPU taramasına bakın.",
      "tanı yalnızca debug rotasında vardır; oyun sürümünde bu maliyet yoktur.",
    ],
    clipboardText: formatRtsFrameCaptureText(capture),
  };
}

/**
 * The capture as pasteable text. A capture that cannot leave the browser is a
 * capture that gets described from memory in the bug report instead.
 */
export function formatRtsFrameCaptureText(capture: RtsFrameCapture): string {
  const head = [
    `kare maliyeti · ${capture.totalMs.toFixed(2)} ms (ort ${capture.averageTotalMs.toFixed(2)} · tepe ${capture.maxTotalMs.toFixed(2)}, son ${capture.windowFrames} kare)`,
    `hız ${capture.speed}X · ${capture.simulationSteps} simülasyon adımı · maç ${capture.matchSeconds.toFixed(1)} sn`,
    "",
    `${"işlem".padEnd(24)}${"ms".padStart(8)}${"%".padStart(7)}${"ort".padStart(9)}${"tepe".padStart(9)}`,
  ];
  const rows = capture.rows.map((row) => {
    const label = row.kind === "debug" ? `${row.label} *` : row.label;
    return (
      label.padEnd(24) +
      row.frameMs.toFixed(2).padStart(8) +
      `${(row.share * 100).toFixed(1)}%`.padStart(7) +
      row.averageMs.toFixed(2).padStart(9) +
      (row.maxMs > 0 ? row.maxMs.toFixed(2) : "—").padStart(9)
    );
  });
  return [...head, ...rows, "", "* yalnızca debug rotasında; oyun sürümünde bu maliyet yok."].join("\n");
}

function sum<T>(items: readonly T[], read: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += read(item);
  return total;
}

function sumTopLevelAverages(regions: readonly RtsFrameRegionSample[]): number {
  return sum(regions.filter((region) => region.parent === undefined), (region) => region.averageMs);
}
