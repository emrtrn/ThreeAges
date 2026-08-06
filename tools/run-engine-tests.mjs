// Bundles tools/engine-tests.ts with esbuild (already present via vite) and
// runs it on node. No test framework or extra dependency; mirrors the plain
// node style of builder/web/verify-dist.mjs. Run via: npm run test:engine
//
// Iteration filter (development only):
//   npm run test:engine -- --filter market
//   npm run test:engine -- --filter "market,caravan" -f road
// Case-insensitive substrings, OR'd against each check's label. A filtered run
// prints PARTIAL and is never a green build — build:verify and CI run it
// unfiltered. A filter that matches nothing exits 1 so typos are not silent.
import { build } from "esbuild";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const filters = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--filter" || arg === "-f") {
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("-")) {
      console.error(`[engine-tests] ${arg} needs a value, e.g. --filter market`);
      process.exit(1);
    }
    filters.push(value);
    i += 1;
  } else if (arg.startsWith("--filter=")) {
    filters.push(arg.slice("--filter=".length));
  } else {
    console.error(`[engine-tests] unknown argument: ${arg}`);
    process.exit(1);
  }
}

if (filters.length > 0) {
  process.env.ENGINE_TESTS_FILTER = filters.join(",");
  console.log(`[engine-tests] filter: ${process.env.ENGINE_TESTS_FILTER}`);
}

const dir = mkdtempSync(join(tmpdir(), "engine-tests-"));
const outfile = join(dir, "tests.mjs");

console.log("[engine-tests] bundling tools/engine-tests.ts");
const bundleStart = Date.now();
try {
  await build({
    entryPoints: ["tools/engine-tests.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "warning",
  });
  const runStart = Date.now();
  console.log(`[engine-tests] bundled in ${((runStart - bundleStart) / 1000).toFixed(1)}s`);
  await import(pathToFileURL(outfile).href);
  console.log(`[engine-tests] checks ran in ${((Date.now() - runStart) / 1000).toFixed(1)}s`);
} catch (error) {
  console.error("[engine-tests] FAILED");
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
