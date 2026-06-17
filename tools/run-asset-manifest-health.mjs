// Bundles tools/asset-manifest-health.ts with esbuild (already present via vite)
// and runs it on node. Mirrors tools/run-engine-tests.mjs.
import { build } from "esbuild";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "asset-health-"));
const outfile = join(dir, "asset-health.mjs");

console.log("[asset-health] bundling tools/asset-manifest-health.ts");
try {
  await build({
    entryPoints: ["tools/asset-manifest-health.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "warning",
  });
  await import(pathToFileURL(outfile).href);
} catch (error) {
  console.error("[asset-health] FAILED");
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
