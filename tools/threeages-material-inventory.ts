/**
 * Read-only Phase 0 inventory for the ThreeAges static-mesh material rollout.
 *
 * It deliberately reads only the 128 source glTFs and their sidecar presence:
 * this command never writes a glTF, sidecar, manifest, or report file. Pipe the
 * JSON output to a reviewed artifact only when the inventory is accepted.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

interface GltfAccessor {
  count?: number;
  min?: number[];
  max?: number[];
}

interface GltfPrimitive {
  attributes?: Record<string, number>;
  material?: number;
}

interface GltfJson {
  accessors?: GltfAccessor[];
  materials?: Array<{ name?: string }>;
  meshes?: Array<{ primitives?: GltfPrimitive[] }>;
}

interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

interface ModelInventory {
  path: string;
  primitives: number;
  materialSlots: string[];
  uvStatus: "all" | "none" | "mixed";
  bounds: Bounds | null;
  sidecars: {
    uvw: boolean;
    materials: boolean;
    vertexcolors: boolean;
  };
}

const projectRoot = process.cwd();
const staticMeshesRoot = resolve(projectRoot, "public/assets/ThreeAges/StaticMeshes");

async function walkGltfFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...(await walkGltfFiles(full)));
    else if (entry.isFile() && extname(entry.name).toLowerCase() === ".gltf") files.push(full);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function primitiveBounds(gltf: GltfJson, primitive: GltfPrimitive): Bounds | null {
  const position = primitive.attributes?.POSITION;
  const accessor = typeof position === "number" ? gltf.accessors?.[position] : undefined;
  if (!accessor?.min || !accessor.max || accessor.min.length < 3 || accessor.max.length < 3) return null;
  const min = accessor.min.slice(0, 3);
  const max = accessor.max.slice(0, 3);
  if (![...min, ...max].every(Number.isFinite)) return null;
  return { min: [min[0]!, min[1]!, min[2]!], max: [max[0]!, max[1]!, max[2]!] };
}

function mergeBounds(current: Bounds | null, next: Bounds | null): Bounds | null {
  if (!next) return current;
  if (!current) return next;
  return {
    min: [
      Math.min(current.min[0], next.min[0]),
      Math.min(current.min[1], next.min[1]),
      Math.min(current.min[2], next.min[2]),
    ],
    max: [
      Math.max(current.max[0], next.max[0]),
      Math.max(current.max[1], next.max[1]),
      Math.max(current.max[2], next.max[2]),
    ],
  };
}

async function sidecarExists(path: string): Promise<boolean> {
  return Boolean((await stat(path).catch(() => null))?.isFile());
}

async function inspectModel(path: string): Promise<ModelInventory> {
  const gltf = JSON.parse(await readFile(path, "utf8")) as GltfJson;
  const primitives = gltf.meshes?.flatMap((mesh) => mesh.primitives ?? []) ?? [];
  const materialSlots = new Set<string>();
  let uvCount = 0;
  let bounds: Bounds | null = null;
  for (const primitive of primitives) {
    if (typeof primitive.attributes?.TEXCOORD_0 === "number") uvCount += 1;
    const materialIndex = primitive.material;
    const name = typeof materialIndex === "number" ? gltf.materials?.[materialIndex]?.name : undefined;
    materialSlots.add(name?.trim() || `__unnamed_material_${materialIndex ?? "none"}`);
    bounds = mergeBounds(bounds, primitiveBounds(gltf, primitive));
  }
  const base = path.slice(0, -".gltf".length);
  return {
    path: relative(staticMeshesRoot, path).replace(/\\/g, "/"),
    primitives: primitives.length,
    materialSlots: [...materialSlots].sort((a, b) => a.localeCompare(b)),
    uvStatus: uvCount === 0 ? "none" : uvCount === primitives.length ? "all" : "mixed",
    bounds,
    sidecars: {
      uvw: await sidecarExists(`${base}.uvw.json`),
      materials: await sidecarExists(`${base}.materials.json`),
      vertexcolors: await sidecarExists(`${base}.vertexcolors.json`),
    },
  };
}

async function main(): Promise<void> {
  const files = await walkGltfFiles(staticMeshesRoot).catch(() => []);
  if (files.length === 0) throw new Error(`No .gltf files found under ${staticMeshesRoot}`);
  const models = await Promise.all(files.map(inspectModel));
  const slotCounts = new Map<string, number>();
  for (const model of models) {
    for (const slot of model.materialSlots) slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1);
  }
  const summary = {
    modelCount: models.length,
    primitiveCount: models.reduce((count, model) => count + model.primitives, 0),
    uv: {
      all: models.filter((model) => model.uvStatus === "all").length,
      none: models.filter((model) => model.uvStatus === "none").length,
      mixed: models.filter((model) => model.uvStatus === "mixed").length,
    },
    completeSidecarFamilies: models.filter((model) =>
      model.sidecars.uvw && model.sidecars.materials && model.sidecars.vertexcolors,
    ).length,
    sourceSlots: [...slotCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, modelCount]) => ({ name, modelCount })),
  };
  console.log(JSON.stringify({ schema: 1, scope: "ThreeAges/StaticMeshes", summary, models }, null, 2));
}

main().catch((error) => {
  console.error("[threeages-material-inventory] FAIL");
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
