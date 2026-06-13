import { cp, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templatesRoot = join(root, "templates");
const activeProjectRef = join(root, "projects", "active.project-ref.json");

const [, , command, ...args] = process.argv;

try {
  if (command === "new") {
    await createProject(args);
  } else if (command === "open") {
    await openProject(args);
  } else if (command === "preview") {
    await previewProject(args);
  } else if (command === "package") {
    await packageProject(args);
  } else {
    printHelp();
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function createProject(args) {
  const [templateName, targetPath] = args;
  if (!templateName || !targetPath) {
    throw new Error("Usage: npm run studio -- new <template> <targetPath>");
  }

  const templateDir = resolve(templatesRoot, templateName);
  if (!templateDir.startsWith(`${templatesRoot}\\`) && templateDir !== templatesRoot) {
    throw new Error(`Invalid template: ${templateName}`);
  }
  if (!existsSync(templateDir)) throw new Error(`Template not found: ${templateName}`);

  const targetDir = resolve(targetPath);
  if (existsSync(targetDir)) {
    const entries = await readdir(targetDir);
    if (entries.length > 0) throw new Error(`Target is not empty: ${targetDir}`);
  }

  await mkdir(targetDir, { recursive: true });
  await cp(templateDir, targetDir, { recursive: true, errorOnExist: false, force: true });

  const projectName = slugProjectName(basename(targetDir));
  await replaceTokens(targetDir, projectName);

  const templateManifest = join(targetDir, "project.template.json");
  const projectManifest = join(targetDir, "project.3dgame.json");
  if (existsSync(templateManifest)) await rename(templateManifest, projectManifest);

  await setActiveProject(projectManifest);

  console.log(`Created ${projectName}: ${targetDir}`);
  console.log(`Active project: ${projectName}`);
}

async function openProject(args) {
  const [projectPath] = args;
  if (!projectPath) throw new Error("Usage: npm run studio -- open <projectPath>");
  const manifestPath = await resolveManifestPath(projectPath);
  const manifest = await setActiveProject(manifestPath);
  console.log(`Active project: ${manifest.name}`);
  console.log(manifestPath);
}

async function setActiveProject(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schema !== 1 || !manifest.name) {
    throw new Error(`Invalid project manifest: ${manifestPath}`);
  }

  await mkdir(dirname(activeProjectRef), { recursive: true });
  await writeFile(
    activeProjectRef,
    `${JSON.stringify(
      {
        schema: 1,
        name: manifest.name,
        kind: "external-game-project",
        projectManifest: normalizePath(manifestPath),
        notes: "Active project reference used by the editor dev server.",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return manifest;
}

async function previewProject(args) {
  const [projectPath] = args;
  if (!projectPath) throw new Error("Usage: npm run studio -- preview <projectPath>");
  const manifestPath = await resolveManifestPath(projectPath);
  const projectRoot = dirname(manifestPath);
  await run("npm.cmd", ["run", "dev"], projectRoot);
}

async function packageProject(args) {
  const [projectPath] = args;
  const commandArgs = [join(root, "scripts", "package-project.mjs")];
  if (projectPath) commandArgs.push(projectPath);
  await run(process.execPath, commandArgs, root);
}

async function resolveManifestPath(projectPath) {
  const resolved = resolve(projectPath);
  const info = await stat(resolved).catch(() => null);
  if (!info) throw new Error(`Project path not found: ${resolved}`);
  if (info.isFile()) return resolved;
  return join(resolved, "project.3dgame.json");
}

async function replaceTokens(dir, projectName) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await replaceTokens(path, projectName);
      continue;
    }
    if (!isTextFile(path)) continue;
    const text = await readFile(path, "utf8");
    if (text.includes("__PROJECT_NAME__")) {
      await writeFile(path, text.replaceAll("__PROJECT_NAME__", projectName), "utf8");
    }
  }
}

function isTextFile(path) {
  return [".json", ".ts", ".html", ".css", ".md", ".txt"].includes(extname(path).toLowerCase());
}

function slugProjectName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "new-project";
}

function normalizePath(path) {
  return path.replace(/\\/g, "/");
}

function run(commandName, commandArgs, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(commandName, commandArgs, {
      cwd,
      stdio: "inherit",
      shell: false,
    });
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${commandName} ${commandArgs.join(" ")} failed with ${code}`));
    });
  });
}

function printHelp() {
  console.log(`Usage:
  npm run studio -- new <template> <targetPath>
  npm run studio -- open <projectPath>
  npm run studio -- preview <projectPath>
  npm run studio -- package <projectPath>

Templates:
  basic-three-project
  home-makeover-like`);
}
