// Bundle the TypeScript validator exactly like the engine-check runner does, so
// `npm run test:locales` has no runtime TypeScript loader dependency.
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const directory = mkdtempSync(join(tmpdir(), "locale-validator-"));
const outfile = join(directory, "validate-locales.mjs");

try {
  await build({
    entryPoints: ["tools/validate-locales.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "warning",
  });
  await import(pathToFileURL(outfile).href);
} catch (error) {
  console.error("[locales] validator failed to run");
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
