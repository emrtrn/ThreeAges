// Bundles tools/asset-perf-report.ts with esbuild (already present via vite) and
// runs it on node. Mirrors tools/run-asset-manifest-health.mjs.
import { build } from "esbuild";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "asset-perf-"));
const outfile = join(dir, "asset-perf.mjs");

console.log("[asset-perf] bundling tools/asset-perf-report.ts");
try {
  await build({
    entryPoints: ["tools/asset-perf-report.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "warning",
  });
  await import(pathToFileURL(outfile).href);
} catch (error) {
  console.error("[asset-perf] FAILED");
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
