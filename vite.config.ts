import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { execFile } from "node:child_process";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath, URL } from "node:url";

const PROJECT_REF_PATH = resolve("projects/active.project-ref.json");

interface ProjectManifest {
  schema: 1;
  name: string;
  type: string;
  version: string;
  entry: string;
  publicDir: string;
  editor: {
    defaultScene: string;
    assetCatalog?: string;
    assetManifest: string;
    gridSize?: number;
    snapRotationDeg?: number;
  };
  scripts: Record<string, string | undefined>;
  output: {
    distDir: string;
  };
}

interface ActiveProject {
  manifest: ProjectManifest;
  manifestPath: string;
  rootName: string;
  rootPath: string;
}

async function loadActiveProject(): Promise<ActiveProject> {
  const ref = JSON.parse(await readFile(PROJECT_REF_PATH, "utf8")) as {
    projectManifest?: string;
  };
  if (!ref.projectManifest) throw new Error("project reference missing projectManifest");
  const manifestPath = resolve(ref.projectManifest);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as ProjectManifest;
  validateProjectManifest(manifest);
  const rootPath = dirname(manifestPath);
  return {
    manifest,
    manifestPath,
    rootName: rootPath.split(/[\\/]/).at(-1) ?? rootPath,
    rootPath,
  };
}

function validateProjectManifest(manifest: ProjectManifest): void {
  if (manifest.schema !== 1) throw new Error("project manifest schema must be 1");
  if (!manifest.name) throw new Error("project manifest name is required");
  if (!manifest.publicDir) throw new Error("project manifest publicDir is required");
  if (!manifest.editor?.defaultScene) throw new Error("editor.defaultScene is required");
  if (!manifest.editor.assetManifest) throw new Error("editor.assetManifest is required");
}

function resolveProjectPath(project: ActiveProject, projectRelativePath: string): string {
  const normalized = projectRelativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const resolved = resolve(project.rootPath, normalized);
  const rootWithSep = project.rootPath.endsWith(sep) ? project.rootPath : `${project.rootPath}${sep}`;
  if (resolved !== project.rootPath && !resolved.startsWith(rootWithSep)) {
    throw new Error(`project path escapes root: ${projectRelativePath}`);
  }
  return resolved;
}

function contentTypeFor(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".glb") return "model/gltf-binary";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function isNumberTuple(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => Number.isFinite(item))
  );
}

function validatePlacement(value: unknown): {
  position: [number, number, number];
  rotationYDeg?: number;
  scale?: number;
} {
  if (!value || typeof value !== "object") {
    throw new Error("placement must be an object");
  }
  const entry = value as Record<string, unknown>;
  if (!isNumberTuple(entry.position)) throw new Error("invalid placement position");

  const placement: {
    position: [number, number, number];
    rotationYDeg?: number;
    scale?: number;
  } = {
    position: entry.position.map((item) => Number(item.toFixed(3))) as [
      number,
      number,
      number,
    ],
  };

  if (entry.rotationYDeg !== undefined) {
    const rotationYDeg = Number(entry.rotationYDeg);
    if (!Number.isFinite(rotationYDeg) || rotationYDeg < -360 || rotationYDeg > 360) {
      throw new Error(`invalid rotationYDeg: ${entry.rotationYDeg}`);
    }
    placement.rotationYDeg = Number(rotationYDeg.toFixed(1));
  }

  if (entry.scale !== undefined) {
    const scale = Number(entry.scale);
    if (!Number.isFinite(scale) || scale <= 0 || scale > 8) {
      throw new Error(`invalid scale: ${entry.scale}`);
    }
    placement.scale = Number(scale.toFixed(3));
  }

  return placement;
}

function validateLayout(value: unknown): unknown {
  if (!value || typeof value !== "object") throw new Error("layout must be an object");
  const layout = value as Record<string, unknown>;

  if (layout.schema !== 1) throw new Error("layout schema must be 1");
  if (typeof layout.name !== "string") throw new Error("layout name must be a string");
  if (
    !Array.isArray(layout.loadGroups) ||
    !layout.loadGroups.every((item) => typeof item === "string")
  ) {
    throw new Error("loadGroups must be string[]");
  }
  if (!Array.isArray(layout.instances)) throw new Error("instances must be an array");
  if (!Array.isArray(layout.characters)) throw new Error("characters must be an array");

  const instances = layout.instances.map((instance) => {
    if (!instance || typeof instance !== "object") {
      throw new Error("instance must be an object");
    }
    const item = instance as Record<string, unknown>;
    if (typeof item.assetId !== "string" || item.assetId.length === 0) {
      throw new Error("instance assetId must be a string");
    }
    if (!Array.isArray(item.placements)) {
      throw new Error(`placements missing for ${item.assetId}`);
    }
    return {
      assetId: item.assetId,
      placements: item.placements.map(validatePlacement),
    };
  });

  const characters = layout.characters.map((character) => {
    if (!character || typeof character !== "object") {
      throw new Error("character must be an object");
    }
    const item = character as Record<string, unknown>;
    if (typeof item.assetId !== "string" || item.assetId.length === 0) {
      throw new Error("character assetId must be a string");
    }
    if (!isNumberTuple(item.position)) throw new Error("invalid character position");
    const entry: Record<string, unknown> = {
      assetId: item.assetId,
      position: item.position.map((number) => Number(number.toFixed(3))),
    };
    if (typeof item.name === "string") entry.name = item.name;
    if (typeof item.animation === "string") entry.animation = item.animation;
    if (item.rotationYDeg !== undefined) {
      const rotationYDeg = Number(item.rotationYDeg);
      if (!Number.isFinite(rotationYDeg) || rotationYDeg < -360 || rotationYDeg > 360) {
        throw new Error(`invalid character rotationYDeg: ${item.rotationYDeg}`);
      }
      entry.rotationYDeg = Number(rotationYDeg.toFixed(1));
    }
    if (item.scale !== undefined) {
      const scale = Number(item.scale);
      if (!Number.isFinite(scale) || scale <= 0 || scale > 8) {
        throw new Error(`invalid character scale: ${item.scale}`);
      }
      entry.scale = Number(scale.toFixed(3));
    }
    return entry;
  });

  return {
    schema: 1,
    name: layout.name,
    loadGroups: layout.loadGroups,
    instances,
    characters,
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 256 * 1024) throw new Error("request body too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function layoutEditorPlugin(): Plugin {
  return {
    name: "3dgamedev-layout-editor",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === "/__project") {
          try {
            const project = await loadActiveProject();
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                manifest: project.manifest,
                manifestPath: project.manifestPath,
                rootName: project.rootName,
              }),
            );
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          }
          return;
        }

        if (req.url === "/__recent-projects") {
          try {
            const entries = await readdir(resolve("projects"), { withFileTypes: true });
            const projects = [];
            for (const entry of entries) {
              if (!entry.isFile() || !entry.name.endsWith(".project-ref.json")) continue;
              const refPath = resolve("projects", entry.name);
              const ref = JSON.parse(await readFile(refPath, "utf8")) as {
                name?: string;
                projectManifest?: string;
              };
              if (ref.name && ref.projectManifest) {
                projects.push({
                  name: ref.name,
                  projectManifest: ref.projectManifest,
                });
              }
            }
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ projects }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          }
          return;
        }

        if (req.url === "/__studio/new" || req.url === "/__studio/open" || req.url === "/__studio/package") {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method not allowed");
            return;
          }
          try {
            const body = (await readJsonBody(req)) as Record<string, unknown>;
            const output =
              req.url === "/__studio/new"
                ? await runStudio(["new", stringField(body, "template"), stringField(body, "targetPath")])
                : req.url === "/__studio/open"
                  ? await runStudio(["open", stringField(body, "projectPath")])
                  : await runStudio(
                      stringField(body, "projectPath", true)
                        ? ["package", stringField(body, "projectPath", true)]
                        : ["package"],
                    );
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: true, output }));
          } catch (error) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              }),
            );
          }
          return;
        }

        if (req.url === "/__select-directory") {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method not allowed");
            return;
          }
          try {
            const body = (await readJsonBody(req)) as Record<string, unknown>;
            const title =
              typeof body.title === "string" && body.title.trim()
                ? body.title.trim()
                : "Choose folder";
            const selectedPath = await selectDirectory(title);
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            if (!selectedPath) {
              res.end(JSON.stringify({ ok: false, cancelled: true }));
              return;
            }
            res.end(JSON.stringify({ ok: true, path: selectedPath }));
          } catch (error) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              }),
            );
          }
          return;
        }

        if (req.url?.startsWith("/__project-file/")) {
          try {
            const project = await loadActiveProject();
            const encodedPath = req.url.slice("/__project-file/".length).split("?")[0] ?? "";
            const projectPath = decodeURIComponent(encodedPath);
            const filePath = resolveProjectPath(project, projectPath);
            const fileStat = await stat(filePath);
            if (!fileStat.isFile()) throw new Error(`not a file: ${projectPath}`);
            res.setHeader("Content-Type", contentTypeFor(filePath));
            res.end(await readFile(filePath));
          } catch (error) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          }
          return;
        }

        if (req.url !== "/__save-layout") {
          next();
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        try {
          const payload = validateLayout(await readJsonBody(req));
          const project = await loadActiveProject();
          const layoutPath = resolveProjectPath(project, project.manifest.editor.defaultScene);
          const previous = await readFile(layoutPath, "utf8").catch(() => null);
          await writeFile(layoutPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              ok: true,
              path: layoutPath,
              changed: previous !== `${JSON.stringify(payload, null, 2)}\n`,
            }),
          );
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      });
    },
  };
}

function stringField(body: Record<string, unknown>, field: string, optional = false): string {
  const value = body[field];
  if ((value === undefined || value === "") && optional) return "";
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function runStudio(args: string[]): Promise<string> {
  return new Promise((resolveRun, reject) => {
    execFile(
      process.execPath,
      [resolve("scripts/studio.mjs"), ...args],
      { cwd: process.cwd(), windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || stdout.trim() || error.message));
          return;
        }
        resolveRun(stdout);
      },
    );
  });
}

function selectDirectory(title: string): Promise<string> {
  if (process.platform !== "win32") {
    return Promise.reject(new Error("Folder picker is currently implemented for Windows only."));
  }
  const escapedTitle = title.replace(/'/g, "''");
  const command = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '${escapedTitle}'
$dialog.ShowNewFolderButton = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output $dialog.SelectedPath
}
`;
  return new Promise((resolveSelect, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-STA", "-Command", command],
      { cwd: process.cwd(), windowsHide: false },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        resolveSelect(stdout.trim());
      },
    );
  });
}

export default defineConfig({
  plugins: [layoutEditorPlugin()],
  resolve: {
    alias: {
      // Keep in sync with tsconfig.json "paths"
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // Mobile target: WebGL2-capable browsers all support ES2022 baseline features we use.
    target: "es2022",
    // Perf budget guard: warn early if a chunk creeps past ~250 KB (pre-gzip).
    chunkSizeWarningLimit: 800,
  },
  server: {
    // Expose on LAN for real-device (Android/Chrome) testing.
    host: true,
  },
});
