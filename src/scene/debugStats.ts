/**
 * Tiny fps / draw-call readout for the HTML overlay (#debug-stats).
 * Enabled only with `?debug` in the URL so it never ships visible.
 * lil-gui (devDependency) is dynamically imported on demand later, when
 * scene parameters need live tweaking — keeps it out of the base bundle.
 */
import {
  DEFAULT_PERF_BUDGET,
  evaluatePerfBudget,
  formatByteSize,
  isOverBudget,
  type BudgetMetric,
} from "@engine/perf/perfBudget";
import type { SubsystemProfileSnapshot } from "@engine/core/subsystemProfiler";
import type {
  GameModeDebugSnapshot,
  PerfMemorySnapshot,
  RuntimeStatsApp,
  UiDebugSnapshot,
} from "./RuntimeSceneApp";

const UPDATE_INTERVAL_MS = 500;
/** How many of the most expensive subsystems the overlay lists. */
const TOP_SUBSYSTEMS = 3;

export function attachDebugStats(app: RuntimeStatsApp, element: HTMLElement): void {
  let accumMs = 0;
  let frames = 0;

  app.onFrame = (deltaMs) => {
    accumMs += deltaMs;
    frames += 1;
    if (accumMs < UPDATE_INTERVAL_MS) return;

    const fps = (frames * 1000) / accumMs;
    const { drawCalls, triangles } = app.getRenderStats();
    element.textContent =
      `${fps.toFixed(0)} fps\n` +
      `${drawCalls} draw calls\n` +
      `${triangles} tris` +
      subsystemTimingText(app) +
      memoryText(app) +
      budgetText(app, drawCalls, triangles) +
      gameModeDebugText(app) +
      uiDebugText(app) +
      scriptMessageDebugText(app);
    accumMs = 0;
    frames = 0;
  };
}

/** The subsystem-timing block, or "" when profiling is off / no samples yet. */
function subsystemTimingText(app: RuntimeStatsApp): string {
  const snapshot = app.getSubsystemProfileSnapshot?.();
  if (!snapshot || snapshot.subsystems.length === 0) return "";
  return `\n${formatSubsystemTiming(snapshot, TOP_SUBSYSTEMS).join("\n")}`;
}

/**
 * Formats a {@link SubsystemProfileSnapshot} into overlay lines (pure, DOM-free
 * for unit tests): a header with the total windowed tick cost, then the `topN`
 * most expensive subsystems with their average / last / peak millisecond cost.
 */
export function formatSubsystemTiming(
  snapshot: SubsystemProfileSnapshot,
  topN: number,
): string[] {
  const lines = [`perf (avg/frame ${snapshot.totalAverageMs.toFixed(2)}ms)`];
  for (const timing of snapshot.subsystems.slice(0, Math.max(0, topN))) {
    lines.push(
      `  ${timing.id} ${timing.averageMs.toFixed(2)}ms ` +
        `(last ${timing.lastMs.toFixed(2)} peak ${timing.maxMs.toFixed(2)})`,
    );
  }
  return lines;
}

/** The memory-counter block, or "" when the app exposes no memory snapshot. */
function memoryText(app: RuntimeStatsApp): string {
  if (!app.getPerfMemorySnapshot) return "";
  return `\n${formatMemory(app.getPerfMemorySnapshot()).join("\n")}`;
}

/**
 * Formats a {@link PerfMemorySnapshot} into overlay lines (pure, DOM-free): GPU
 * geometry/texture/program counts, and the JS heap when the browser reports it
 * (Chrome-only); the heap line is omitted entirely off Chrome.
 */
export function formatMemory(snapshot: PerfMemorySnapshot): string[] {
  const { geometries, textures, programs } = snapshot.render;
  const lines = ["memory", `  geo ${geometries} tex ${textures} prog ${programs}`];
  if (snapshot.jsHeapBytes !== null) {
    const used = formatByteSize(snapshot.jsHeapBytes);
    const limit = snapshot.jsHeapLimitBytes !== null ? ` / ${formatByteSize(snapshot.jsHeapLimitBytes)}` : "";
    lines.push(`  heap ${used}${limit}`);
  }
  return lines;
}

/** The budget block, or "" when the app exposes no memory snapshot (texture count). */
function budgetText(app: RuntimeStatsApp, drawCalls: number, triangles: number): string {
  const memory = app.getPerfMemorySnapshot?.();
  if (!memory) return "";
  const metrics = evaluatePerfBudget(
    { drawCalls, triangles, textures: memory.render.textures },
    DEFAULT_PERF_BUDGET,
  );
  return `\n${formatPerfBudget(metrics).join("\n")}`;
}

/**
 * Formats budget rows into overlay lines (pure, DOM-free). Over-budget rows are
 * prefixed with `!` (the overlay is single-color plain text, so a marker is the
 * only affordance); the header gains an `(OVER)` tag when anything is over.
 */
export function formatPerfBudget(metrics: BudgetMetric[]): string[] {
  const lines = [isOverBudget(metrics) ? "budget (OVER)" : "budget"];
  for (const metric of metrics) {
    const marker = metric.over ? "!" : " ";
    lines.push(`${marker} ${metric.label} ${groupThousands(metric.value)}/${groupThousands(metric.budget)}`);
  }
  return lines;
}

/** Inserts thousands separators (deterministic, locale-independent for tests). */
export function groupThousands(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const negative = value < 0;
  const digits = Math.trunc(Math.abs(value)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return negative ? `-${grouped}` : grouped;
}

/** The Game Mode / possessed-pawn block, or "" when the app exposes no snapshot. */
function gameModeDebugText(app: RuntimeStatsApp): string {
  if (!app.getGameModeDebugSnapshot) return "";
  return `\n${formatGameModeDebug(app.getGameModeDebugSnapshot()).join("\n")}`;
}

/**
 * Formats a {@link GameModeDebugSnapshot} into overlay lines (pure, so it is
 * unit-tested without the DOM): the active mode, the possessed pawn, and that
 * pawn's movement state. Null fields render as placeholders.
 */
export function formatGameModeDebug(snapshot: GameModeDebugSnapshot): string[] {
  const num = (value: number | null): string => (value === null ? "—" : value.toFixed(2));
  const stance =
    snapshot.grounded === null ? "" : snapshot.grounded ? " (grounded)" : " (airborne)";
  return [
    "game mode",
    `mode: ${snapshot.gameMode}`,
    `possessed: ${snapshot.possessed ?? "none"}`,
    `movement: ${snapshot.movementMode ?? "—"}${stance}`,
    `vel y:${num(snapshot.velocityY)} planar:${num(snapshot.planarSpeed)}`,
    `control yaw:${num(snapshot.controlYawDeg)} pitch:${num(snapshot.controlPitchDeg)}`,
    `camera: ${snapshot.cameraSource ?? "â€”"}`,
    `input: ${snapshot.inputMode}`,
  ];
}

/** The UI inspector block, or "" when the app exposes no snapshot (editor). */
function uiDebugText(app: RuntimeStatsApp): string {
  if (!app.getUiDebugSnapshot) return "";
  return `\n${formatUiDebug(app.getUiDebugSnapshot()).join("\n")}`;
}

/**
 * Formats a {@link UiDebugSnapshot} into overlay lines (pure, DOM-free for unit
 * tests): the mounted HUD, the active screen stack (bottom → top) and each
 * bound ViewModel field. Long string values are clipped to keep lines readable.
 */
export function formatUiDebug(snapshot: UiDebugSnapshot): string[] {
  const lines = [
    "ui",
    `hud: ${snapshot.hud ?? "none"}`,
    snapshot.screens.length > 0
      ? `screens(${snapshot.screens.length}): ${snapshot.screens.join(" > ")}`
      : "screens: none",
    `locale: ${snapshot.locale ?? "none"}`,
    `world: ${snapshot.world.visible}/${snapshot.world.count}`,
  ];
  if (snapshot.fields.length === 0) {
    lines.push("fields: none");
  } else {
    lines.push(`fields(${snapshot.fields.length}):`);
    for (const [path, value] of snapshot.fields) {
      lines.push(`  ${path} = ${formatFieldValue(value)}`);
    }
  }
  if (snapshot.audit.length > 0) {
    lines.push(`a11y(${snapshot.audit.length}):`);
    for (const issue of snapshot.audit) lines.push(`  ${issue}`);
  }
  return lines;
}

/** Renders a store value compactly; strings are quoted and clipped at 32 chars. */
function formatFieldValue(value: string | number | boolean): string {
  if (typeof value !== "string") return String(value);
  const clipped = value.length > 32 ? `${value.slice(0, 29)}...` : value;
  return `"${clipped}"`;
}

function scriptMessageDebugText(app: RuntimeStatsApp): string {
  const snapshot = app.getScriptMessageDebugSnapshot();
  const { lastFlush, recentMessages } = snapshot;
  const lines = [
    "",
    "script messages",
    `flush p:${lastFlush.processed} d:${lastFlush.delivered} w:${lastFlush.warnings.length}`,
    `subscribers: ${snapshot.subscribers.length}`,
  ];
  for (const entry of recentMessages.slice(-5)) {
    const target = entry.envelope.target ?? "*";
    const payload = JSON.stringify(entry.envelope.payload);
    const payloadText = payload.length > 44 ? `${payload.slice(0, 41)}...` : payload;
    lines.push(
      `${entry.envelope.frame} ${entry.envelope.source}->${target} ${entry.envelope.type} ${entry.status}(${entry.delivered}) ${payloadText}`,
    );
  }
  if (lastFlush.warnings.length > 0) {
    lines.push(`last warning: ${lastFlush.warnings[0]?.code ?? "unknown"}`);
  }
  return `\n${lines.join("\n")}`;
}
