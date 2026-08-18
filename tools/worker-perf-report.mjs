/**
 * Worker Faz 7 (§13.1) capture: what an army of Workers costs a frame.
 *
 * The RTS quality matrix (`rts-perf-report.mjs`) sweeps *graphics profiles* on
 * one fixed match. This sweeps the opposite axis — one fixed graphics profile
 * across four Worker counts (0v0, 8v8, 16v16, 22v22) and three scenes — because
 * the question Faz 7 asks is not "is `high` affordable" but "what does the 65th
 * joint, the second material slot and the crate in a Worker's hands cost when
 * there are forty-four of them".
 *
 * The 0v0 row is the instrument, not a scenario: every per-Worker number in the
 * report is a difference against it. Without a Worker-free baseline of the same
 * map, the same camera and the same profile, a frame total says how expensive
 * the *match* is and nothing at all about the Worker.
 *
 * Honest limits, stated because the report will be pasted into a plan:
 * - Headless Chromium rasterises through SwiftShader, so the GPU side of a
 *   headless row is a software renderer's opinion. Run with
 *   `WORKER_PERF_HEADLESS=false` for a real GPU, and compare only rows captured
 *   the same way.
 * - `çizim` (the draw region) is GPU wait, not CPU work. It is reported because
 *   it moves when the scene gets heavier, not because it can be optimised.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  browserMetricDelta,
  collectFrameSamples,
  metricMap,
  numeric,
  readPositiveNumber,
  startVite,
  stopProcess,
  summarizeFrames,
  wait,
  waitForHttp,
} from "./perf/browserPerfHarness.mjs";

const PORT = 4175;
const DEFAULT_ORIGIN = `http://127.0.0.1:${PORT}`;
const DEFAULT_DURATION_MS = 10_000;
/**
 * Longer than the quality matrix's 5s: these rows start from a cold match, and
 * the opening seconds are spawn, first pathfind and shader compilation rather
 * than the steady state the report is about.
 */
const DEFAULT_WARMUP_MS = 12_000;
const READY_TIMEOUT_MS = 60_000;
const VIEWPORT = { width: 1920, height: 1080 };
const OUTPUT_DIR = resolve("test-results/worker-perf");
/** Fixed so every row loads the same map; the presets do not pin a level. */
const MATCH_SEED = 20260818;

/** The counts §13.1 names, plus the Worker-free baseline they are measured against. */
const COUNTS = [
  { id: "00", preset: "worker_perf_00", perSide: 0 },
  { id: "08", preset: "worker_perf_08", perSide: 8 },
  { id: "16", preset: "worker_perf_16", perSide: 16 },
  { id: "22", preset: "worker_perf_22", perSide: 22 },
];

/**
 * What the Workers are doing while they are counted.
 *
 * `zoom` is in wheel notches (`rtsInput`: positive deltaY zooms out), applied
 * once after the warm-up. It is not a claim about how far anything ends up —
 * that is what the runtime's own near/far census in each row answers.
 */
const SCENES = [
  { id: "yakın", label: "idle, camera pushed in to the zoom limit", zoom: -800, massMove: false },
  { id: "boşta", label: "idle (no orders, default framing)", zoom: 0, massMove: false },
  { id: "hareket", label: "mass move (select all, one ground order)", zoom: 0, massMove: true },
  { id: "uzak", label: "idle, camera pulled out to the zoom limit", zoom: 800, massMove: false },
];

/**
 * Why there is no "everyone doing a different job" row.
 *
 * A preset opens a match with units and a stockpile, not with a built-out
 * economy, and an automated Worker only takes a job once there is a producer or
 * a build site to take. With no buildings on the field these Workers stay idle
 * for as long as you watch them — measured, not assumed: 8v8 held `boşta idle`
 * for 80 seconds. Staging a real work crowd means authoring a mid-game save,
 * which is a bigger piece of work than the question deserves, because the cost
 * difference between a working Worker and an idle one is not the clip — both are
 * one mixer evaluating one action — it is the prop in their hands. That is a
 * draw-call question, and `perf:assets` answers it per prop without a crowd.
 */

function selected(list, envName, idOf) {
  const raw = process.env[envName];
  if (raw === undefined || raw.trim() === "") return list;
  const requested = new Set(raw.split(",").map((value) => value.trim()).filter(Boolean));
  const picked = list.filter((entry) => requested.has(idOf(entry)));
  const unknown = [...requested].filter((id) => !list.some((entry) => idOf(entry) === id));
  if (unknown.length > 0 || picked.length === 0) {
    throw new Error(`${envName} accepts ${list.map(idOf).join(", ")}; received ${raw}`);
  }
  return picked;
}

function matchUrl(preset) {
  const origin = process.env.WORKER_PERF_ORIGIN ?? DEFAULT_ORIGIN;
  // `mode=free` is what skips the main menu (`urlPinsMatchSetup`); the preset
  // supplies the armies and the fog flag.
  return `${origin}/?rts&debug&preset=${preset}&mode=free&seed=${MATCH_SEED}`;
}

async function bootMatch(page, count, quality) {
  await page.addInitScript((graphics) => {
    localStorage.setItem("forge.userSettings", JSON.stringify({
      schema: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      payload: { audio: { busVolumes: {} }, locale: null, graphics },
    }));
  }, {
    // Adaptive off for every row: a controller that lowers quality when the frame
    // gets slow would silently answer the question this report is asking.
    adaptiveOptimizationEnabled: false,
    targetFrameRate: 60,
    selectedQualityLevel: quality,
    allowAdaptiveFineTuning: true,
    manuallySelected: true,
    startupCalibrated: true,
  });
  await page.goto(matchUrl(count.preset), { waitUntil: "domcontentloaded", timeout: 120_000 });
  const canvas = page.locator("#game-canvas");
  await canvas.waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(
    (expected) => document.querySelector("#game-canvas")?.getAttribute("data-rts-quality") === expected,
    quality,
    { timeout: READY_TIMEOUT_MS },
  );
  // Same two gates the quality matrix waits on, for the same reason: measuring
  // before the map art and the Actor pack are live compares loading, not a scene.
  //
  // Waited to a *settled* state rather than to "ready", and the state is then
  // reported. A tree mid-asset-migration boots with the map art in `fallback`
  // and some Actors on placeholders, and that run still produces usable
  // per-Worker deltas — every row loses the same scenery. What it must never do
  // is produce absolute numbers that silently describe a world with no trees in
  // it, so the reader is told which world was measured.
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("#game-canvas");
      const mapArt = canvas?.getAttribute("data-rts-map-art");
      const assets = canvas?.getAttribute("data-rts-content-assets");
      return (mapArt === "ready" || mapArt === "fallback")
        && (assets === "ready" || assets === "placeholder" || assets === "fallback" || assets === "disabled");
    },
    undefined,
    { timeout: READY_TIMEOUT_MS },
  );
  await page.waitForFunction(
    () => [...document.querySelectorAll(".rts-loading-screen")]
      .every((curtain) => curtain.getAttribute("data-rts-loading") === "done"),
    undefined,
    { timeout: READY_TIMEOUT_MS },
  );
  return page.evaluate(() => {
    const canvas = document.querySelector("#game-canvas");
    return {
      mapArt: canvas?.getAttribute("data-rts-map-art") ?? null,
      contentAssets: canvas?.getAttribute("data-rts-content-assets") ?? null,
      placeholders: Number(canvas?.getAttribute("data-rts-content-placeholders") ?? "0"),
    };
  });
}

/**
 * Select every player unit on screen with a rubber band over the viewport.
 *
 * A band rather than a roster click: the roster tours one unit at a time, and
 * what this scene needs is every body walking at once.
 *
 * Inset well away from the edges, and that is not caution: a band starting at 5%
 * of the viewport begins on the HUD crest, the canvas never sees the press, and
 * the row silently reports a mass move with nobody moving. Measured on the first
 * trial — `elementFromPoint` at 5%/5% is `IMG.rts-hud-crest`, at 20%/25% it is
 * the canvas.
 */
async function selectEveryone(page) {
  const box = await page.locator("#game-canvas").boundingBox();
  if (!box) throw new Error("canvas has no box to drag a selection across");
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.75, { steps: 12 });
  await page.mouse.up();
  await wait(250);
  return box;
}

/**
 * Keep the selection walking for the whole capture window.
 *
 * One order at the start is not the scene: the first trial issued exactly that
 * and the census at the end of a 6 s window read zero units moving, because they
 * had arrived. The destination alternates between two edges of the view so the
 * crowd turns around instead of piling onto one spot and stopping.
 */
async function driveMassMove(page, box, durationMs) {
  const targets = [
    { x: box.x + box.width * 0.5, y: box.y + box.height * 0.18 },
    { x: box.x + box.width * 0.5, y: box.y + box.height * 0.82 },
  ];
  const deadline = Date.now() + durationMs;
  for (let i = 0; Date.now() < deadline; i += 1) {
    const target = targets[i % targets.length];
    await page.mouse.click(target.x, target.y, { button: "right" });
    await wait(Math.min(2_500, Math.max(0, deadline - Date.now())));
  }
}

/**
 * Parse the hidden simulation witness into a census of what the Workers are doing.
 *
 * The witness prints one line per unit: `#id owner/role hp a/b <order> <state>`,
 * where the order is `boşta` / `hareket` / `yol:N` / `saldırı:…` and a Worker
 * appends its job state. "Working" here means *has a job and is not walking to
 * it*, which is the only reading that separates the work scene from the idle one.
 */
async function readUnitCensus(page) {
  const witness = await page.locator(".rts-debug-sim").textContent() ?? "";
  const census = { workers: 0, moving: 0, idle: 0, working: 0 };
  for (const rawLine of witness.split("\n")) {
    const match = /^#\d+ (?:player|enemy)\/worker\b(.*)$/.exec(rawLine.trim());
    if (!match) continue;
    census.workers += 1;
    const tail = (match[1] ?? "").trim();
    if (/(?:^|\s)(?:hareket|yol:\d+|saldırı:)/.test(tail)) census.moving += 1;
    else if (/\bidle\b\s*$/.test(tail)) census.idle += 1;
    else census.working += 1;
  }
  return census;
}

function latestSnapshot(snapshots) {
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}

/** Mean of a region's rolling average across every snapshot in the window. */
function regionAverage(snapshots, id) {
  const values = snapshots
    .map((snapshot) => snapshot.regions?.find((region) => region.id === id)?.averageMs)
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const REPORTED_REGIONS = ["kare", "simülasyon", "sunum", "birim sunumu", "çizim"];

async function runRow(browser, count, scene, options) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const client = await context.newCDPSession(page);
  try {
    const assetHealth = await bootMatch(page, count, options.quality);
    await wait(options.warmupMs);
    if (scene.zoom !== 0) {
      await page.locator("#game-canvas").hover();
      await page.mouse.wheel(0, scene.zoom);
      // The controller eases toward the new target distance; measuring during the
      // ease would average two framings and belong to neither.
      await wait(1_500);
    }
    const box = scene.massMove ? await selectEveryone(page) : null;
    if (box) await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.18, { button: "right" });
    await client.send("Performance.enable");
    const startMetrics = metricMap((await client.send("Performance.getMetrics")).metrics);
    // Both censuses, because one of them is always the wrong one to trust: at the
    // start a mass move has not spread out yet, and at the end it may already
    // have arrived. A row is described by what held across the window.
    const censusAtStart = await readUnitCensus(page);
    const [samples] = await Promise.all([
      collectFrameSamples(page, options.durationMs),
      box ? driveMassMove(page, box, options.durationMs) : Promise.resolve(),
    ]);
    const endMetrics = metricMap((await client.send("Performance.getMetrics")).metrics);
    const census = await readUnitCensus(page);
    return {
      count: { id: count.id, preset: count.preset, perSide: count.perSide },
      scene: { id: scene.id, label: scene.label },
      frameTime: summarizeFrames(samples.frames),
      browserThread: browserMetricDelta(startMetrics, endMetrics, options.durationMs),
      regions: Object.fromEntries(REPORTED_REGIONS.map((id) => [id, regionAverage(samples.snapshots, id)])),
      runtime: latestSnapshot(samples.snapshots),
      census,
      censusAtStart,
      assetHealth,
      errors: { consoleErrors, pageErrors },
    };
  } finally {
    await context.close();
  }
}

/**
 * The middle of several captures of one row, not the first of them.
 *
 * Added after a single-capture sweep produced a finding that did not survive
 * being measured again: three runs of the same 22v22 row landed at 12,98 / 15,54
 * / 10,12 ms, and the ordering against the neighbouring scene flipped between
 * them. A ±3 ms run-to-run spread is invisible in one row and perfectly capable
 * of looking like a result, so the report carries the median and keeps the
 * spread beside it rather than presenting one draw from the distribution as the
 * cost.
 *
 * The median row is a real captured row — its snapshot, census and errors belong
 * together — so the representative capture is *selected* by frame time rather
 * than averaged into a row that never happened.
 */
function medianRow(rows) {
  const ordered = [...rows].sort((a, b) => a.frameTime.averageMs - b.frameTime.averageMs);
  const chosen = ordered[Math.floor((ordered.length - 1) / 2)];
  const frames = rows.map((row) => row.frameTime.averageMs);
  return {
    ...chosen,
    repeats: {
      count: rows.length,
      frameMsMin: Math.min(...frames),
      frameMsMax: Math.max(...frames),
      frameMsAll: frames,
      // What the sweep would have had to see to trust a scene difference. Kept
      // as a number rather than a verdict: the reader compares it with the
      // difference they are about to believe in.
      spreadMs: Math.max(...frames) - Math.min(...frames),
    },
    // Every capture's errors, not only the median one's: a 404 that appeared in
    // one repeat is still a 404 that happened.
    errors: {
      consoleErrors: rows.flatMap((row) => row.errors.consoleErrors),
      pageErrors: rows.flatMap((row) => row.errors.pageErrors),
    },
  };
}

function baselineOf(results, sceneId) {
  return results.find((result) => result.count.perSide === 0 && result.scene.id === sceneId) ?? null;
}

/** A per-Worker figure, or `null` when this run has no baseline row to subtract. */
function perWorker(value, baseValue, workers) {
  if (typeof value !== "number" || typeof baseValue !== "number" || workers <= 0) return null;
  return (value - baseValue) / workers;
}

function markdownReport(report) {
  const rows = report.results.map((result) => {
    const runtime = result.runtime;
    const cadence = runtime?.animationCadence;
    return `| ${result.count.perSide}v${result.count.perSide} | ${result.scene.id} | ${numeric(result.frameTime.estimatedFps, 1)} | ${numeric(result.frameTime.averageMs)} | ±${numeric(result.repeats?.spreadMs ?? 0)} | ${numeric(result.frameTime.p95Ms)} | ${runtime?.render?.drawCalls ?? "-"} | ${runtime?.render?.triangles ?? "-"} | ${numeric(result.regions["birim sunumu"], 3)} | ${numeric(result.regions["çizim"])} | ${cadence ? `${cadence.near}/${cadence.far}` : "-"} | ${Math.max(result.census.moving, result.censusAtStart.moving)}/${result.census.workers} |`;
  });

  const deltaRows = [];
  for (const result of report.results) {
    if (result.count.perSide === 0) continue;
    const base = baselineOf(report.results, result.scene.id);
    if (!base) continue;
    const workers = result.census.workers;
    const draws = perWorker(result.runtime?.render?.drawCalls, base.runtime?.render?.drawCalls, workers);
    const triangles = perWorker(result.runtime?.render?.triangles, base.runtime?.render?.triangles, workers);
    const presentation = perWorker(result.regions["birim sunumu"], base.regions["birim sunumu"], workers);
    const frame = perWorker(result.frameTime.averageMs, base.frameTime.averageMs, workers);
    deltaRows.push(`| ${result.count.perSide}v${result.count.perSide} | ${result.scene.id} | ${workers} | ${numeric(draws)} | ${triangles === null ? "-" : Math.round(triangles)} | ${numeric(presentation, 4)} | ${numeric(frame, 3)} |`);
  }

  return [
    "# Worker performance sweep (plan §13.1)",
    "",
    `Captured: ${report.capturedAt}`,
    `Quality: ${report.setup.quality}, adaptive off. Viewport ${VIEWPORT.width}×${VIEWPORT.height}, ${report.setup.headless ? "headless (SwiftShader software raster)" : "visible (real GPU)"}.`,
    `Per row: ${report.setup.warmupMs / 1000}s warm-up, ${report.setup.durationMs / 1000}s capture, ${report.setup.repeats}× repeated (median reported).`,
    "",
    `**Read the spread before believing a difference between two rows.** Widest run-to-run spread in this sweep: ${numeric(Math.max(...report.results.map((result) => result.repeats?.spreadMs ?? 0)))} ms. A difference smaller than that is not a result.`,
    "",
    "`near/far` is the runtime's own animation-cadence census: how many live units are inside the 15 Hz far-distance ring and how many are beyond it.",
    "",
    `Asset health while capturing: map art ${[...new Set(report.results.map((result) => result.assetHealth.mapArt))].join(", ")}; Actor pack ${[...new Set(report.results.map((result) => `${result.assetHealth.contentAssets} (${result.assetHealth.placeholders} placeholder)`))].join(", ")}. Absolute frame numbers only describe the world that actually loaded; the per-Worker table below survives a missing scenery pass because every row loses the same scenery.`,
    "",
    "| Army | Scene | FPS | Frame ms | spread | P95 ms | Draw calls | Triangles | `birim sunumu` ms | `çizim` ms | near/far | moving |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
    "## Per Worker, against the 0v0 row of the same scene",
    "",
    "| Army | Scene | Workers alive | Draw calls | Triangles | `birim sunumu` ms | Frame ms |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...(deltaRows.length > 0 ? deltaRows : ["| - | - | - | - | - | - | - |"]),
    "",
    "## Chrome main thread",
    "",
    ...report.results.map((result) => `- ${result.count.perSide}v${result.count.perSide} ${result.scene.id}: task ${numeric(result.browserThread.taskMsPerSecond)} ms/s; script ${numeric(result.browserThread.scriptMsPerSecond)} ms/s.`),
    "",
  ].join("\n");
}

async function main() {
  const durationMs = readPositiveNumber("WORKER_PERF_DURATION_MS", DEFAULT_DURATION_MS);
  const warmupMs = readPositiveNumber("WORKER_PERF_WARMUP_MS", DEFAULT_WARMUP_MS);
  const headless = process.env.WORKER_PERF_HEADLESS !== "false";
  const quality = process.env.WORKER_PERF_QUALITY ?? "high";
  // Three by default rather than one: one capture per row is what let a ±3 ms
  // run-to-run spread be read as a scene difference (see `medianRow`).
  const repeats = Math.round(readPositiveNumber("WORKER_PERF_REPEATS", 3));
  const counts = selected(COUNTS, "WORKER_PERF_COUNTS", (entry) => entry.id);
  const scenes = selected(SCENES, "WORKER_PERF_SCENES", (entry) => entry.id);
  const ownsServer = process.env.WORKER_PERF_ORIGIN === undefined;
  let server = null;
  let browser = null;
  try {
    if (ownsServer) {
      console.log("[worker-perf] starting local Vite server (development mode)");
      server = startVite(PORT, "worker-perf");
      await waitForHttp(DEFAULT_ORIGIN);
    }
    browser = await chromium.launch({
      headless,
      // Without these a visible Chromium paces every row at the display's refresh
      // rate, and every row reports 60 fps whatever it cost — the ceiling, not the
      // frame. The CPU region timings would still be honest, but the frame
      // distribution the report leads with would be a measurement of the monitor.
      args: ["--disable-gpu-vsync", "--disable-frame-rate-limit"],
    });
    const results = [];
    for (const scene of scenes) {
      for (const count of counts) {
        const label = `${count.perSide}v${count.perSide} · ${scene.id}`;
        console.log(`[worker-perf] ${label}: ${repeats}× (warming ${(warmupMs / 1000).toFixed(0)}s, capturing ${(durationMs / 1000).toFixed(0)}s)`);
        const captures = [];
        for (let attempt = 0; attempt < repeats; attempt += 1) {
          captures.push(await runRow(browser, count, scene, { durationMs, warmupMs, quality }));
        }
        const result = medianRow(captures);
        results.push(result);
        const spread = repeats > 1 ? `, spread ${result.repeats.spreadMs.toFixed(2)} ms over ${repeats}` : "";
        console.log(`[worker-perf] ${label}: ${result.frameTime.estimatedFps.toFixed(1)} fps, ${result.runtime?.render?.drawCalls ?? "?"} draws, ${result.census.workers} workers (${result.census.moving} moving)${spread}`);
      }
    }
    const capturedAt = new Date().toISOString();
    const base = resolve(OUTPUT_DIR, `worker-perf-${capturedAt.replace(/[:.]/g, "-")}`);
    const report = {
      schemaVersion: 1,
      capturedAt,
      setup: { quality, headless, warmupMs, durationMs, repeats, viewport: VIEWPORT, seed: MATCH_SEED },
      results,
    };
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(`${base}.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(`${base}.md`, markdownReport(report), "utf8");
    console.log(`[worker-perf] report: ${base}.md`);
    console.log(`[worker-perf] data: ${base}.json`);
    if (results.some((result) => result.errors.consoleErrors.length || result.errors.pageErrors.length)) {
      console.error("[worker-perf] browser errors were captured; inspect the JSON report.");
      process.exitCode = 1;
    }
  } finally {
    await browser?.close();
    await stopProcess(server);
  }
}

main().catch((error) => {
  console.error("[worker-perf] FAILED");
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
