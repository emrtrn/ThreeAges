// Bundles tools/engine-tests.ts with esbuild (already present via vite) and
// runs it on node. No test framework or extra dependency; mirrors the plain
// node style of builder/web/verify-dist.mjs. Run via: npm run test:engine
import { build } from "esbuild";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "engine-tests-"));
const outfile = join(dir, "tests.mjs");

console.log("[engine-tests] bundling tools/engine-tests.ts");
try {
  await build({
    entryPoints: ["tools/engine-tests.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "warning",
  });
  await import(pathToFileURL(outfile).href);
} catch (error) {
  console.error("[engine-tests] FAILED");
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
