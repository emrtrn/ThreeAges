/**
 * Repeatable RTS quality-matrix capture.
 *
 * Each row starts the same RTS match, applies a profile, runs a fixed camera
 * pan/zoom loop, then records rAF pacing, Chrome main-thread counters and the
 * RTS renderer witness (draw calls, triangles, GPU resources, adaptive state).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const DEFAULT_URL = "http://127.0.0.1:4174/?rts&debug";
const DEFAULT_DURATION_MS = 10_000;
const DEFAULT_WARMUP_MS = 5_000;
const READY_TIMEOUT_MS = 45_000;
const VIEWPORT = { width: 1920, height: 1080 };
const OUTPUT_DIR = resolve("test-results/rts-perf");
const SCENARIOS = [
  { id: "low", quality: "low", adaptiveEnabled: false },
  { id: "medium", quality: "medium", adaptiveEnabled: false },
  { id: "high", quality: "high", adaptiveEnabled: false },
  { id: "adaptive", quality: "medium", adaptiveEnabled: true },
];

function selectedScenarios() {
  const raw = process.env.RTS_PERF_PROFILES;
  if (raw === undefined || raw.trim() === "") return SCENARIOS;
  const requested = new Set(raw.split(",").map((value) => value.trim()).filter(Boolean));
  const selected = SCENARIOS.filter((scenario) => requested.has(scenario.id));
  const unknown = [...requested].filter((id) => !SCENARIOS.some((scenario) => scenario.id === id));
  if (unknown.length > 0 || selected.length === 0) {
    throw new Error(`RTS_PERF_PROFILES accepts ${SCENARIOS.map((scenario) => scenario.id).join(", ")}; received ${raw}`);
  }
  return selected;
}

function readPositiveNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number; received ${JSON.stringify(raw)}`);
  }
  return value;
}

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function waitForHttp(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "unknown error";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await wait(250);
  }
  throw new Error(`Local Vite server did not become ready: ${lastError}`);
}

function startVite() {
  const viteEntry = resolve("node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [viteEntry, "--host", "127.0.0.1", "--port", "4174", "--strictPort"], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  child.once("exit", (code) => {
    if (code !== 0 && code !== null) console.error(`[rts-perf] local Vite exited early (${code}):\n${output}`);
  });
  return child;
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([new Promise((resolveExit) => child.once("exit", resolveExit)), wait(5_000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

function summarizeFrames(samples) {
  const valid = samples.filter((sample) => Number.isFinite(sample) && sample > 0 && sample < 5_000);
  const averageMs = valid.reduce((sum, sample) => sum + sample, 0) / Math.max(1, valid.length);
  const over = (threshold) => valid.filter((sample) => sample > threshold).length;
  return {
    sampleCount: valid.length,
    averageMs,
    p50Ms: percentile(valid, 0.5),
    p95Ms: percentile(valid, 0.95),
    p99Ms: percentile(valid, 0.99),
    maxMs: valid.length === 0 ? 0 : Math.max(...valid),
    estimatedFps: averageMs > 0 ? 1000 / averageMs : 0,
    over33ms: over(33.3),
    over50ms: over(50),
    over100ms: over(100),
    discardedSamples: samples.length - valid.length,
  };
}

function metricMap(metrics) {
  return Object.fromEntries(metrics.map(({ name, value }) => [name, value]));
}

function browserMetricDelta(start, end, durationMs) {
  const seconds = durationMs / 1000;
  const perSecond = (name) => ((end[name] ?? 0) - (start[name] ?? 0)) / seconds;
  return {
    taskMsPerSecond: perSecond("TaskDuration") * 1000,
    scriptMsPerSecond: perSecond("ScriptDuration") * 1000,
    layoutMsPerSecond: perSecond("LayoutDuration") * 1000,
    styleMsPerSecond: perSecond("RecalcStyleDuration") * 1000,
    jsHeapUsedBytes: end.JSHeapUsedSize ?? null,
    nodes: end.Nodes ?? null,
  };
}

async function stopTracing(client) {
  let streamHandle = null;
  const completed = new Promise((resolveCompleted) => {
    client.once("Tracing.tracingComplete", (event) => {
      streamHandle = event.stream;
      resolveCompleted();
    });
  });
  await client.send("Tracing.end");
  await Promise.race([
    completed,
    wait(30_000).then(() => { throw new Error("Chrome DevTools trace did not finish within 30 seconds"); }),
  ]);
  let trace = "";
  while (streamHandle) {
    const chunk = await client.send("IO.read", { handle: streamHandle });
    trace += chunk.data;
    if (chunk.eof) break;
  }
  if (streamHandle) await client.send("IO.close", { handle: streamHandle });
  return trace;
}

async function collectScenarioSamples(page, durationMs) {
  return page.evaluate(async (duration) => {
    const canvas = document.querySelector("#game-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("RTS canvas not found");
    const frames = [];
    const snapshots = [];
    const startedAt = performance.now();
    let previous = startedAt;
    let nextSnapshotAt = startedAt;
    await new Promise((resolveFrame) => {
      const tick = (now) => {
        frames.push(now - previous);
        previous = now;
        if (now >= nextSnapshotAt) {
          nextSnapshotAt = now + 500;
          try {
            const snapshot = JSON.parse(canvas.dataset.rtsPerf ?? "null");
            if (snapshot) snapshots.push({ atMs: now - startedAt, ...snapshot });
          } catch {
            // A partial DOM update can never invalidate a performance run.
          }
        }
        if (now - startedAt >= duration) resolveFrame();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return { frames, snapshots };
  }, durationMs);
}

async function driveCameraScenario(page, durationMs) {
  const canvas = page.locator("#game-canvas");
  await canvas.hover();
  const phaseMs = Math.max(300, Math.floor(durationMs / 4));
  const pan = async (key, wheel) => {
    await page.keyboard.down(key);
    await page.mouse.wheel(0, wheel);
    await wait(phaseMs);
    await page.keyboard.up(key);
  };
  await pan("KeyD", -240);
  await pan("KeyW", 180);
  await pan("KeyA", -180);
  await pan("KeyS", 240);
}

async function configureMatch(page, scenario) {
  // Seed before every document so a Vite reload cannot make one matrix row inherit
  // the previous row's profile. The UI workflow itself has a browser smoke test;
  // this runner needs a stable measurement setup rather than menu interaction.
  await page.addInitScript((graphics) => {
    localStorage.setItem("forge.userSettings", JSON.stringify({
      schema: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      payload: { audio: { busVolumes: {} }, locale: null, graphics },
    }));
  }, {
    adaptiveOptimizationEnabled: scenario.adaptiveEnabled,
    targetFrameRate: 60,
    selectedQualityLevel: scenario.quality,
    allowAdaptiveFineTuning: true,
    manuallySelected: true,
    startupCalibrated: true,
  });
  await page.goto(process.env.RTS_PERF_URL ?? DEFAULT_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const canvas = page.locator("#game-canvas");
  await canvas.waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(({ quality, adaptiveEnabled }) => {
    const canvas = document.querySelector("#game-canvas");
    return canvas?.getAttribute("data-rts-quality") === quality
      && canvas?.getAttribute("data-rts-adaptive") === String(adaptiveEnabled);
  }, { quality: scenario.quality, adaptiveEnabled: scenario.adaptiveEnabled }, { timeout: READY_TIMEOUT_MS });
  await page.locator("[data-rts-match-action='start']").click();
  await page.locator(".rts-match-overlay").waitFor({ state: "hidden", timeout: READY_TIMEOUT_MS });
  await canvas.waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
}

function latestSnapshot(snapshots) {
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}

function numeric(value, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function formatBytes(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${(value / 1024 / 1024).toFixed(1)} MB` : "-";
}

function markdownReport(report) {
  const rows = report.results.map((result) => {
    const runtime = result.runtime;
    return `| ${result.scenario.id} | ${numeric(result.frameTime.estimatedFps, 1)} | ${numeric(result.frameTime.p95Ms)} | ${result.frameTime.over50ms} | ${runtime?.render?.drawCalls ?? "-"} | ${runtime?.render?.triangles ?? "-"} | ${runtime?.memory?.textures ?? "-"} | ${runtime?.adaptiveReductionDepth ?? "-"} |`;
  });
  return [
    "# RTS performance matrix",
    "",
    `Captured: ${report.capturedAt}`,
    `Scenario: fixed WASD pan + wheel zoom, ${report.scenario.measurementDurationMs / 1000}s per row; ${report.scenario.warmupMs / 1000}s warm-up.`,
    "",
    "| Profile | FPS | P95 ms | >50 ms frames | Draw calls | Triangles | Textures | Adaptive reductions |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
    "Headless captures are comparison evidence on this machine, not a player-GPU benchmark. Open a row's trace in Chrome DevTools Performance for a stall investigation.",
    "",
    "## Chrome main thread",
    "",
    ...report.results.map((result) => `- ${result.scenario.id}: task ${numeric(result.browserThread.taskMsPerSecond)} ms/s; script ${numeric(result.browserThread.scriptMsPerSecond)} ms/s; heap ${formatBytes(result.browserThread.jsHeapUsedBytes)}.`),
    "",
  ].join("\n");
}

async function runScenario(browser, scenario, durationMs, warmupMs, headless) {
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
    await configureMatch(page, scenario);
    await wait(warmupMs);
    await client.send("Performance.enable");
    await client.send("Tracing.start", {
      transferMode: "ReturnAsStream",
      categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "v8.execute", "toplevel"].join(","),
    });
    const startMetrics = metricMap((await client.send("Performance.getMetrics")).metrics);
    const [samples] = await Promise.all([collectScenarioSamples(page, durationMs), driveCameraScenario(page, durationMs)]);
    const endMetrics = metricMap((await client.send("Performance.getMetrics")).metrics);
    const trace = await stopTracing(client);
    return {
      scenario,
      mode: headless ? "headless" : "visible",
      frameTime: summarizeFrames(samples.frames),
      browserThread: browserMetricDelta(startMetrics, endMetrics, durationMs),
      runtime: latestSnapshot(samples.snapshots),
      runtimeSnapshots: samples.snapshots,
      errors: { consoleErrors, pageErrors },
      trace,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const durationMs = readPositiveNumber("RTS_PERF_DURATION_MS", DEFAULT_DURATION_MS);
  const warmupMs = readPositiveNumber("RTS_PERF_WARMUP_MS", DEFAULT_WARMUP_MS);
  const p95GateMs = process.env.RTS_PERF_MAX_P95_MS === undefined
    ? null
    : readPositiveNumber("RTS_PERF_MAX_P95_MS", 0);
  const headless = process.env.RTS_PERF_HEADLESS !== "false";
  const ownsServer = process.env.RTS_PERF_URL === undefined;
  const scenarios = selectedScenarios();
  let server = null;
  let browser = null;
  try {
    if (ownsServer) {
      console.log("[rts-perf] starting local Vite server (development mode)");
      server = startVite();
      await waitForHttp("http://127.0.0.1:4174");
    }
    browser = await chromium.launch({ headless });
    const results = [];
    for (const scenario of scenarios) {
      console.log(`[rts-perf] ${scenario.id}: warming and capturing ${(durationMs / 1000).toFixed(0)} s`);
      const result = await runScenario(browser, scenario, durationMs, warmupMs, headless);
      results.push(result);
      console.log(`[rts-perf] ${scenario.id}: p95 ${result.frameTime.p95Ms.toFixed(2)} ms, ${result.frameTime.estimatedFps.toFixed(1)} fps`);
    }
    const capturedAt = new Date().toISOString();
    const safeTimestamp = capturedAt.replace(/[:.]/g, "-");
    await mkdir(OUTPUT_DIR, { recursive: true });
    const base = resolve(OUTPUT_DIR, `rts-perf-${safeTimestamp}`);
    const report = {
      schemaVersion: 1,
      capturedAt,
      scenario: {
        url: process.env.RTS_PERF_URL ?? DEFAULT_URL,
        viewport: VIEWPORT,
        headless,
        warmupMs,
        measurementDurationMs: durationMs,
        input: "fixed WASD pan + wheel zoom",
      },
      results: results.map(({ trace, ...result }) => ({
        ...result,
        artifacts: { chromeDevToolsTrace: `${base}-${result.scenario.id}.trace.json` },
      })),
    };
    await Promise.all(results.map((result) => writeFile(`${base}-${result.scenario.id}.trace.json`, result.trace, "utf8")));
    await writeFile(`${base}.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(`${base}.md`, markdownReport(report), "utf8");
    console.log(`[rts-perf] report: ${base}.md`);
    console.log(`[rts-perf] data: ${base}.json`);
    if (results.some((result) => result.errors.consoleErrors.length || result.errors.pageErrors.length)) {
      console.error("[rts-perf] browser errors were captured; inspect the JSON report.");
      process.exitCode = 1;
    }
    if (p95GateMs !== null && results.some((result) => result.frameTime.p95Ms > p95GateMs)) {
      console.error(`[rts-perf] FAIL at least one profile exceeds RTS_PERF_MAX_P95_MS=${p95GateMs}`);
      process.exitCode = 1;
    }
  } finally {
    await browser?.close();
    await stopProcess(server);
  }
}

main().catch((error) => {
  console.error("[rts-perf] FAILED");
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
