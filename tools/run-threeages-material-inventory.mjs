// Bundles the read-only ThreeAges material inventory with esbuild, then runs it.
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "threeages-material-inventory-"));
const outfile = join(dir, "inventory.mjs");

try {
  await build({
    entryPoints: ["tools/threeages-material-inventory.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "warning",
  });
  await import(pathToFileURL(outfile).href);
} catch (error) {
  console.error("[threeages-material-inventory] FAIL");
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
