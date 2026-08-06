/**
 * The `?debug` panel's performance readout — pure, DOM-free, so the contract is
 * unit-testable without a browser (same shape as `formatVisionDebug`).
 *
 * What it answers, in order: how fast is the frame, what is it costing on the
 * GPU, and where is the CPU time going. The last block is the one that pays for
 * the panel: an RTS gets slow for two very different reasons — too much drawn,
 * or too much thought — and a draw-call count alone cannot tell them apart.
 */

/** One measured region of the frame, in milliseconds over a rolling window. */
export interface RtsPerfCost {
  readonly label: string;
  readonly averageMs: number;
  readonly lastMs: number;
  readonly maxMs: number;
  /** Nested inside the region above it (AI inside the simulation step). */
  readonly nested?: boolean;
}

export interface RtsPerfShadowBucket {
  readonly label: string;
  readonly meshes: number;
  readonly triangles: number;
}

export interface RtsPerfDebugSnapshot {
  readonly frame: {
    readonly averageMs: number;
    readonly p95Ms: number;
    readonly sampleCount: number;
    readonly over33ms: number;
    readonly over50ms: number;
    readonly over100ms: number;
  };
  readonly render: {
    readonly drawCalls: number;
    readonly triangles: number;
  };
  readonly memory: {
    readonly geometries: number;
    readonly textures: number;
    readonly programs: number;
  };
  readonly shadows: readonly RtsPerfShadowBucket[];
  /** Frame regions, in the order they should be shown (not sorted by cost). */
  readonly costs: readonly RtsPerfCost[];
  readonly quality: {
    readonly level: string;
    readonly adaptiveEnabled: boolean;
    readonly reductionDepth: number;
  };
  /** What the simulation is carrying — the load behind the CPU costs above. */
  readonly scene: {
    readonly units: number;
    readonly structures: number;
    readonly caravans: number;
    readonly wildlife: number;
  };
}

/** Longest cost label decides the column, so the ms numbers line up. */
const COST_LABEL_WIDTH = 12;

export function formatRtsPerfDebug(snapshot: RtsPerfDebugSnapshot): string[] {
  const { frame, render, memory, quality, scene } = snapshot;
  const fps = frame.averageMs > 0 ? 1000 / frame.averageMs : 0;
  const lines = [
    frame.sampleCount > 0
      ? `${fps.toFixed(0)} fps · kare ${frame.averageMs.toFixed(1)} ms · p95 ${frame.p95Ms.toFixed(1)} ms`
      : "fps ölçülüyor…",
    `takılma >33ms ${frame.over33ms} · >50ms ${frame.over50ms} · >100ms ${frame.over100ms}`,
    `çizim ${groupThousands(render.drawCalls)} çağrı · ${compactCount(render.triangles)} üçgen`,
    `bellek geo ${groupThousands(memory.geometries)} · doku ${groupThousands(memory.textures)} · shader ${groupThousands(memory.programs)}`,
  ];

  if (snapshot.shadows.length > 0) {
    lines.push("gölge dökümü");
    for (const bucket of snapshot.shadows) {
      lines.push(`  ${bucket.label.padEnd(COST_LABEL_WIDTH)} ${groupThousands(bucket.meshes)} mesh · ${compactCount(bucket.triangles)} üçgen`);
    }
  }

  const adaptive = quality.adaptiveEnabled ? "uyarlanır açık" : "uyarlanır kapalı";
  const depth = quality.reductionDepth > 0 ? ` (-${quality.reductionDepth})` : "";
  lines.push(`kalite ${quality.level} · ${adaptive}${depth}`);

  if (snapshot.costs.length > 0) {
    lines.push("maliyet (ort / son / tepe ms)");
    for (const cost of snapshot.costs) {
      const label = `${cost.nested ? "  ↳ " : "  "}${cost.label}`;
      lines.push(
        `${label.padEnd(COST_LABEL_WIDTH + 2)} ${cost.averageMs.toFixed(2)} / ${cost.lastMs.toFixed(2)} / ${cost.maxMs.toFixed(2)}`,
      );
    }
  }

  lines.push(
    `sahne ${scene.units} birim · ${scene.structures} yapı · ${scene.caravans} kervan · ${scene.wildlife} hayvan`,
  );
  return lines;
}

/** `1.24M` / `540K` / `812` — triangle counts are unreadable ungrouped. */
export function compactCount(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${Math.round(value / 1000)}K`;
  return groupThousands(value);
}

/** Deterministic thousands separators (locale-independent, like the engine's). */
export function groupThousands(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const negative = value < 0;
  const digits = Math.trunc(Math.abs(value)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return negative ? `-${grouped}` : grouped;
}
