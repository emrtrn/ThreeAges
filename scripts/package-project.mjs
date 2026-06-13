import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildsRoot = join(root, "builds");

try {
  const manifestPath = await resolveManifestPath(process.argv[2]);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateManifest(manifest, manifestPath);

  const projectRoot = dirname(manifestPath);
  await run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], projectRoot);

  const distDir = resolve(projectRoot, manifest.output.distDir);
  if (!existsSync(distDir)) throw new Error(`Build output not found: ${distDir}`);

  const packageDir = resolve(buildsRoot, `${manifest.name}-web`);
  ensureInside(packageDir, buildsRoot);
  await mkdir(buildsRoot, { recursive: true });
  await rm(packageDir, { recursive: true, force: true });
  await cp(distDir, packageDir, { recursive: true });

  const files = await collectFiles(packageDir);
  const forbiddenHits = await findForbiddenEditorStrings(packageDir, files);
  const report = {
    schema: 1,
    project: manifest.name,
    sourceManifest: normalizePath(manifestPath),
    sourceDist: normalizePath(distDir),
    packageDir: normalizePath(packageDir),
    generatedAt: new Date().toISOString(),
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
    forbiddenEditorStringHits: forbiddenHits,
    smoke: {
      indexHtml: existsSync(join(packageDir, "index.html")),
      editorOnlyStringsFound: forbiddenHits.length > 0,
    },
  };

  if (!report.smoke.indexHtml) throw new Error("Packaged output is missing index.html");
  if (forbiddenHits.length > 0) {
    throw new Error(`Editor-only strings found in package: ${forbiddenHits.join(", ")}`);
  }

  await writeFile(
    join(packageDir, "package-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  console.log(`Packaged ${manifest.name}`);
  console.log(packageDir);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function resolveManifestPath(inputPath) {
  if (!inputPath) {
    const activeRef = JSON.parse(
      await readFile(join(root, "projects", "active.project-ref.json"), "utf8"),
    );
    if (!activeRef.projectManifest) throw new Error("Active project reference has no manifest");
    return resolve(activeRef.projectManifest);
  }

  const resolved = resolve(inputPath);
  const info = await stat(resolved).catch(() => null);
  if (!info) throw new Error(`Project path not found: ${resolved}`);
  if (info.isFile()) return resolved;
  return join(resolved, "project.3dgame.json");
}

function validateManifest(manifest, manifestPath) {
  if (manifest.schema !== 1) throw new Error(`Invalid manifest schema: ${manifestPath}`);
  if (!manifest.name) throw new Error(`Manifest missing name: ${manifestPath}`);
  if (!manifest.output?.distDir) throw new Error(`Manifest missing output.distDir: ${manifestPath}`);
}

function ensureInside(target, parent) {
  const parentWithSep = parent.endsWith("\\") ? parent : `${parent}\\`;
  if (target !== parent && !target.startsWith(parentWithSep)) {
    throw new Error(`Refusing to write outside builds folder: ${target}`);
  }
}

async function collectFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path, base)));
      continue;
    }
    const info = await stat(path);
    files.push({
      path: normalizePath(path.slice(base.length + 1)),
      bytes: info.size,
    });
  }
  return files;
}

async function findForbiddenEditorStrings(packageDir, files) {
  const forbidden = ["EditorUi", "__save-layout", "Project Browser", "launcher-shell"];
  const hits = [];
  for (const file of files) {
    if (!isTextLike(file.path)) continue;
    const text = await readFile(join(packageDir, file.path), "utf8");
    for (const marker of forbidden) {
      if (text.includes(marker)) hits.push(`${file.path}:${marker}`);
    }
  }
  return hits;
}

function isTextLike(path) {
  return [".html", ".js", ".css", ".json", ".txt", ".svg"].includes(extname(path).toLowerCase());
}

function run(commandName, commandArgs, cwd) {
  return new Promise((resolveRun, reject) => {
    const useWindowsShell = process.platform === "win32";
    const child = spawn(
      useWindowsShell ? `${commandName} ${commandArgs.join(" ")}` : commandName,
      useWindowsShell ? [] : commandArgs,
      {
      cwd,
      stdio: "inherit",
      shell: useWindowsShell,
    });
    child.on("exit", (code) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${commandName} ${commandArgs.join(" ")} failed with ${code}`));
    });
  });
}

function normalizePath(path) {
  return path.replace(/\\/g, "/");
}
