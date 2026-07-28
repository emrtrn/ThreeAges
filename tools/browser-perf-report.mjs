/**
 * Repeatable browser performance capture. Saves both DevTools timeline evidence
 * and a compact JSON summary for comparisons / CI artifacts.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const DEFAULT_URL = "http://127.0.0.1:4174/?debug";
const DEFAULT_DURATION_MS = 15_000;
const WARMUP_MS = 5_000;
const DEFAULT_READY_TIMEOUT_MS = 30_000;
const VIEWPORT = { width: 1920, height: 1080 };
const OUTPUT_DIR = resolve("test-results/browser-perf");

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
    if (code !== 0 && code !== null) console.error(`[browser-perf] local Vite exited early (${code}):\n${output}`);
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
  // Retain severe hitches: 250–1000 ms frames are exactly what this tool must
  // report. Only discard multi-second tab/background pauses, which are not a
  // useful rendering measurement.
  const valid = samples.filter((sample) => Number.isFinite(sample) && sample > 0 && sample < 5_000);
  const averageMs = valid.reduce((sum, sample) => sum + sample, 0) / Math.max(1, valid.length);
  const countOver = (threshold) => valid.filter((sample) => sample > threshold).length;
  return {
    sampleCount: valid.length,
    averageMs,
    p50Ms: percentile(valid, 0.5),
    p95Ms: percentile(valid, 0.95),
    p99Ms: percentile(valid, 0.99),
    maxMs: valid.length === 0 ? 0 : Math.max(...valid),
    estimatedFps: averageMs > 0 ? 1000 / averageMs : 0,
    over16_7ms: countOver(16.7),
    over33_3ms: countOver(33.3),
    over50ms: countOver(50),
    over100ms: countOver(100),
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
    jsHeapTotalBytes: end.JSHeapTotalSize ?? null,
    documents: end.Documents ?? null,
    nodes: end.Nodes ?? null,
    jsEventListeners: end.JSEventListeners ?? null,
  };
}

async function collectRafSamples(page, durationMs) {
  return page.evaluate(async (duration) => {
    const samples = [];
    const startedAt = performance.now();
    let previous = startedAt;
    await new Promise((resolveFrame) => {
      const tick = (now) => {
        samples.push(now - previous);
        previous = now;
        if (now - startedAt >= duration) resolveFrame();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return samples;
  }, durationMs);
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
  let timeoutId;
  try {
    await Promise.race([
      completed,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Chrome DevTools trace did not finish within 30 seconds")), 30_000);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
  let trace = "";
  while (streamHandle) {
    const chunk = await client.send("IO.read", { handle: streamHandle });
    trace += chunk.data;
    if (chunk.eof) break;
  }
  if (streamHandle) await client.send("IO.close", { handle: streamHandle });
  return trace;
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`;
}

async function main() {
  const url = process.env.PERF_URL ?? DEFAULT_URL;
  const durationMs = readPositiveNumber("PERF_DURATION_MS", DEFAULT_DURATION_MS);
  const readyTimeoutMs = readPositiveNumber("PERF_READY_TIMEOUT_MS", DEFAULT_READY_TIMEOUT_MS);
  const p95GateMs = process.env.PERF_MAX_P95_MS === undefined
    ? null
    : readPositiveNumber("PERF_MAX_P95_MS", 0);
  const headless = process.env.PERF_HEADLESS !== "false";
  const ownsServer = process.env.PERF_URL === undefined;
  let server = null;
  let browser = null;

  try {
    if (ownsServer) {
      console.log("[browser-perf] starting local Vite server (development mode)");
      server = startVite();
      await waitForHttp("http://127.0.0.1:4174");
    }
    console.log(`[browser-perf] capturing ${url} (${(durationMs / 1000).toFixed(0)} s steady state)`);
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const client = await context.newCDPSession(page);
    await client.send("Performance.enable");
    await client.send("Tracing.start", {
      transferMode: "ReturnAsStream",
      categories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "disabled-by-default-devtools.timeline.frame",
        "blink.user_timing",
        "loading",
        "v8.execute",
        "toplevel",
      ].join(","),
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("#game-canvas").waitFor({ state: "visible", timeout: 60_000 });
    console.log("[browser-perf] page booted; waiting for a stable measurement window");
    const startButton = page.locator(".rts-match-overlay button").filter({ hasText: "Başlat" }).first();
    if (await startButton.isVisible().catch(() => false)) await startButton.click();
    const loading = page.locator(".forge-loading");
    let readiness = "no-loading-overlay";
    if (await loading.count()) {
      readiness = await loading.waitFor({ state: "hidden", timeout: readyTimeoutMs })
        .then(() => "loading-overlay-hidden")
        .catch(() => "loading-overlay-still-visible");
    }
    console.log(`[browser-perf] readiness: ${readiness}`);
    await wait(WARMUP_MS);

    const startMetrics = metricMap((await client.send("Performance.getMetrics")).metrics);
    const rafSamples = await collectRafSamples(page, durationMs);
    const endMetrics = metricMap((await client.send("Performance.getMetrics")).metrics);
    console.log("[browser-perf] frame samples collected; finalizing DevTools trace");
    const pageData = await page.evaluate(() => {
      const resources = performance.getEntriesByType("resource")
        .filter((entry) => "transferSize" in entry)
        .map((entry) => ({
          name: entry.name,
          durationMs: entry.duration,
          transferBytes: entry.transferSize,
          decodedBytes: entry.decodedBodySize,
        }))
        .sort((a, b) => b.transferBytes - a.transferBytes)
        .slice(0, 15);
      const navigation = performance.getEntriesByType("navigation")[0];
      return {
        navigation: navigation && "domContentLoadedEventEnd" in navigation
          ? { domContentLoadedMs: navigation.domContentLoadedEventEnd, loadMs: navigation.loadEventEnd, transferBytes: navigation.transferSize }
          : null,
        resources,
        debugOverlay: document.querySelector("#debug-stats")?.textContent ?? null,
      };
    });
    const rawTrace = await stopTracing(client);
    console.log("[browser-perf] DevTools trace finalized");
    const frames = summarizeFrames(rafSamples);
    const browserMetrics = browserMetricDelta(startMetrics, endMetrics, durationMs);
    const capturedAt = new Date().toISOString().replace(/[:.]/g, "-");
    await mkdir(OUTPUT_DIR, { recursive: true });
    const base = resolve(OUTPUT_DIR, `browser-perf-${capturedAt}`);
    const report = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      scenario: { url, mode: ownsServer ? "Vite development server" : "external server", headless, viewport: VIEWPORT, deviceScaleFactor: 1, readiness, warmupMs: WARMUP_MS, measurementDurationMs: durationMs },
      frameTime: frames,
      browserThread: browserMetrics,
      page: pageData,
      errors: { consoleErrors, pageErrors },
      artifacts: { chromeDevToolsTrace: `${base}.trace.json`, report: `${base}.json` },
    };
    await writeFile(`${base}.trace.json`, rawTrace, "utf8");
    await writeFile(`${base}.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    console.log(`[browser-perf] frame avg ${formatMs(frames.averageMs)}, p95 ${formatMs(frames.p95Ms)}, p99 ${formatMs(frames.p99Ms)}, ${frames.estimatedFps.toFixed(1)} fps`);
    console.log(`[browser-perf] hitches >33.3ms=${frames.over33_3ms}, >50ms=${frames.over50ms}, >100ms=${frames.over100ms}`);
    console.log(`[browser-perf] main thread task ${formatMs(browserMetrics.taskMsPerSecond)}/s, script ${formatMs(browserMetrics.scriptMsPerSecond)}/s, layout ${formatMs(browserMetrics.layoutMsPerSecond)}/s`);
    console.log(`[browser-perf] report: ${base}.json`);
    console.log(`[browser-perf] DevTools trace: ${base}.trace.json`);
    if (consoleErrors.length || pageErrors.length) console.warn(`[browser-perf] browser errors: console=${consoleErrors.length}, page=${pageErrors.length}`);
    if (p95GateMs !== null && frames.p95Ms > p95GateMs) {
      console.error(`[browser-perf] FAIL p95 ${formatMs(frames.p95Ms)} exceeds PERF_MAX_P95_MS=${p95GateMs}`);
      process.exitCode = 1;
    }
  } finally {
    await browser?.close();
    await stopProcess(server);
  }
}

main().catch((error) => {
  console.error("[browser-perf] FAILED");
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
