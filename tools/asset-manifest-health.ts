import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";

import { validateAssetManifest } from "../engine/assets/manifest";

interface ProjectManifestForAssets {
  publicDir?: string;
  editor?: {
    assetManifest?: string;
  };
}

const projectRoot = process.cwd();
const projectManifestPath = resolve(projectRoot, "public/project.3dgame.json");

function toPublicPath(path: string, publicDir: string): string {
  return relative(resolve(projectRoot, publicDir), path).replace(/\\/g, "/");
}

async function walkFiles(root: string, publicDir: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = resolve(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full, publicDir)));
    } else if (entry.isFile()) {
      files.push(toPublicPath(full, publicDir));
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function main(): Promise<void> {
  const project = (await readJson(projectManifestPath)) as ProjectManifestForAssets;
  const publicDir = project.publicDir ?? "public";
  const manifestPath = project.editor?.assetManifest ?? "assets/manifest.json";
  const publicRoot = resolve(projectRoot, publicDir);
  const manifestFullPath = resolve(publicRoot, manifestPath);

  const manifestStat = await stat(manifestFullPath).catch(() => null);
  if (!manifestStat?.isFile()) {
    console.error(`[asset-health] FAIL manifest not found: ${manifestPath}`);
    process.exitCode = 1;
    return;
  }

  const [manifest, publicFiles] = await Promise.all([
    readJson(manifestFullPath),
    walkFiles(resolve(publicRoot, "assets"), publicDir),
  ]);
  const report = validateAssetManifest(manifest, { publicFiles });

  console.log(
    `[asset-health] assets=${report.assetCount} placeable=${report.placeableCount} ` +
      `errors=${report.errorCount} warnings=${report.warningCount}`,
  );

  for (const issue of report.issues) {
    const target = issue.assetId ?? issue.path ?? "manifest";
    const prefix = issue.level === "error" ? "ERROR" : "WARN";
    console.log(`[asset-health] ${prefix} ${issue.code} ${target}: ${issue.message}`);
  }

  if (report.valid) {
    console.log("[asset-health] PASS manifest is valid.");
    return;
  }

  console.error("[asset-health] FAIL manifest has blocking errors.");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("[asset-health] unexpected failure");
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
