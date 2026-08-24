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
  /**
   * The drawing buffer actually being shaded — CSS size times the effective
   * pixel ratio, which the quality profile caps and scales.
   *
   * Here because it is the one input to per-pixel cost that no other line
   * reports, and a frame whose cost survives deleting half the scene's geometry
   * is asking about pixels, not content. Without it, "is this fill rate" can
   * only be guessed at.
   */
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly pixelRatio: number;
  };
  readonly memory: {
    readonly geometries: number;
    readonly textures: number;
    readonly programs: number;
  };
  /**
   * GPU time for the same frames, or null where the browser has no timer-query
   * extension. Null renders as "yok" rather than as zeros: a scene that costs
   * the GPU nothing and a browser that will not say are opposite findings.
   */
  readonly gpu: {
    readonly lastMs: number;
    readonly averageMs: number;
    readonly maxMs: number;
    readonly samples: number;
  } | null;
  readonly shadows: readonly RtsPerfShadowBucket[];
  /**
   * What `renderer.render` actually walks, per pass. Draw calls say how much
   * reaches the GPU; this says how much the CPU had to look at to decide that,
   * and the two come apart completely — instancing collapses a forest into one
   * draw call while leaving every one of its nodes in the graph. A shadowing
   * light walks it a second time. Counted over visible subtrees only, because an
   * invisible parent costs the renderer nothing below it.
   */
  readonly graph: {
    readonly objects: number;
    readonly meshes: number;
  };
  /** Frame regions, in the order they should be shown (not sorted by cost). */
  readonly costs: readonly RtsPerfCost[];
  readonly quality: {
    readonly level: string;
    readonly adaptiveEnabled: boolean;
    readonly reductionDepth: number;
  };
  /**
   * What the shared voice budget has cost — audio plan §61, whose targets were
   * written as "to be decided by browser testing" and had never been measured.
   *
   * Null before the audio table has loaded. Reported here rather than in a panel
   * of its own because the question it answers is a performance question: a
   * budget that is never approached is headroom nobody is using, and one that is
   * hit during every fight is silently deciding which sounds the player hears.
   */
  readonly audio: {
    readonly active: number;
    readonly peak: number;
    readonly limit: number;
    readonly budgetRefusals: number;
    readonly eventRefusals: number;
    readonly byBus: ReadonlyArray<{ readonly bus: string; readonly active: number; readonly peak: number }>;
  } | null;
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

/** Drawing-buffer line: what is being shaded, and how many pixels that is. */
function viewportLine(viewport: RtsPerfDebugSnapshot["viewport"]): string {
  const width = Math.round(viewport.width * viewport.pixelRatio);
  const height = Math.round(viewport.height * viewport.pixelRatio);
  return (
    `çözünürlük ${groupThousands(width)}×${groupThousands(height)} · ` +
    `oran ${viewport.pixelRatio.toFixed(2)} · ${compactCount(width * height)} piksel`
  );
}

export function formatRtsPerfDebug(snapshot: RtsPerfDebugSnapshot): string[] {
  const { frame, render, memory, quality, scene, graph } = snapshot;
  const fps = frame.averageMs > 0 ? 1000 / frame.averageMs : 0;
  const lines = [
    frame.sampleCount > 0
      ? `${fps.toFixed(0)} fps · kare ${frame.averageMs.toFixed(1)} ms · p95 ${frame.p95Ms.toFixed(1)} ms`
      : "fps ölçülüyor…",
    `takılma >33ms ${frame.over33ms} · >50ms ${frame.over50ms} · >100ms ${frame.over100ms}`,
    // Directly under the frame line, because the two together answer the only
    // question that decides what to optimise: CPU-bound or GPU-bound.
    gpuLine(snapshot.gpu),
    `çizim ${groupThousands(render.drawCalls)} çağrı · ${compactCount(render.triangles)} üçgen`,
    // Beside the draw line on purpose: triangles and pixels are the two things a
    // frame can be spending itself on, and the pair says which.
    viewportLine(snapshot.viewport),
    // Directly under the draw line, because the pair is the finding: a small
    // draw count beside a large node count means the frame is being walked, not
    // submitted, and no amount of further batching would touch it.
    `graf ${groupThousands(graph.objects)} düğüm · ${groupThousands(graph.meshes)} mesh (geçiş başına gezilir)`,
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

  const audio = snapshot.audio;
  if (!audio) {
    // Said rather than omitted, on the same principle as the gpu line: a mixer
    // with nothing in it and a table that never loaded look identical in a
    // silent match, and only one of them is a bug.
    lines.push("ses — olay tablosu yüklenmedi");
  } else {
    // The ceiling and the peak on one line, because either alone is unreadable:
    // "peak 19" means nothing without knowing the budget was 24.
    lines.push(
      `ses ${audio.active}/${audio.limit} · tepe ${audio.peak}` +
        ` · red bütçe ${groupThousands(audio.budgetRefusals)} · olay ${groupThousands(audio.eventRefusals)}`,
    );
    // Per channel, because §61's targets are per channel: one music bed, one to
    // three of ambience and voice, sixteen to twenty-four important effects.
    const busy = audio.byBus.filter((entry) => entry.peak > 0);
    if (busy.length > 0) {
      lines.push(`  ${busy.map((entry) => `${entry.bus} ${entry.active}/${entry.peak}`).join(" · ")}`);
    }
  }

  lines.push(
    `sahne ${scene.units} birim · ${scene.structures} yapı · ${scene.caravans} kervan · ${scene.wildlife} hayvan`,
  );
  return lines;
}

function gpuLine(gpu: RtsPerfDebugSnapshot["gpu"]): string {
  if (!gpu) return "gpu — bu tarayıcıda zamanlayıcı yok";
  if (gpu.samples === 0) return "gpu ölçülüyor…";
  return `gpu ${gpu.lastMs.toFixed(2)} ms · ort ${gpu.averageMs.toFixed(2)} · tepe ${gpu.maxMs.toFixed(2)}`;
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
