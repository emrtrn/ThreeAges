import type { LayoutSplineActor, Vec3 } from "./layout";
import {
  generateSplineInstancePlacements,
  type ForgeSplinePluginGeneratorDef,
  type SplineGeneratedInstance,
  type SplineGeneratorRegistry,
} from "./splineGenerator";

/** Game-module example for a plugin-owned spline generator. */
export const ROAD_DECORATIONS_GENERATOR_TYPE = "plugin:roadDecorations" as const;

export interface RoadDecorationsSettings {
  meshAsset: string;
  spacing?: number;
  lateralOffset?: number;
  seed?: number;
  scale?: Vec3;
}

/**
 * Registers only data validation. Render output stays owned by the calling game
 * module; it may add the returned instances to its own generated group and must
 * dispose that group on rebuild. The callback receives no mutable layout object.
 */
export function registerRoadDecorationsGenerator(registry: SplineGeneratorRegistry): () => void {
  return registry.register({
    type: ROAD_DECORATIONS_GENERATOR_TYPE,
    normalize(value, usedIds) {
      if (!isRecord(value) || value.type !== ROAD_DECORATIONS_GENERATOR_TYPE) return null;
      const settings = isRecord(value.settings) ? value.settings : {};
      if (typeof settings.meshAsset !== "string" || !settings.meshAsset.trim()) return null;
      const id = uniqueId(typeof value.id === "string" ? value.id.trim() : "road-decorations", usedIds);
      const normalized: ForgeSplinePluginGeneratorDef = {
        id,
        type: ROAD_DECORATIONS_GENERATOR_TYPE,
        pluginVersion: typeof value.pluginVersion === "number" && Number.isFinite(value.pluginVersion) ? Math.max(1, Math.floor(value.pluginVersion)) : 1,
        settings: {
          meshAsset: settings.meshAsset.trim(),
          ...(finitePositive(settings.spacing) === null ? {} : { spacing: finitePositive(settings.spacing)! }),
          ...(finite(settings.lateralOffset) === null ? {} : { lateralOffset: finite(settings.lateralOffset)! }),
          ...(finite(settings.seed) === null ? {} : { seed: Math.trunc(finite(settings.seed)!) }),
          ...(vec3(settings.scale) === null ? {} : { scale: vec3(settings.scale)! }),
        },
      };
      for (const key of ["enabled", "previewEnabled", "runtimeEnabled"] as const) if (typeof value[key] === "boolean") normalized[key] = value[key];
      return normalized;
    },
    build(context) {
      return buildRoadDecorationInstances(context.actor, context.definition);
    },
  });
}

/** Uses the public distance/frame query path through the stable instance helper. */
export function buildRoadDecorationInstances(actor: LayoutSplineActor, definition: ForgeSplinePluginGeneratorDef): SplineGeneratedInstance[] {
  if (definition.type !== ROAD_DECORATIONS_GENERATOR_TYPE || definition.enabled === false) return [];
  const settings = definition.settings ?? {};
  if (typeof settings.meshAsset !== "string" || !settings.meshAsset) return [];
  return generateSplineInstancePlacements(actor, {
    id: definition.id,
    type: "instances",
    meshAsset: settings.meshAsset,
    spacing: finitePositive(settings.spacing) ?? 5,
    lateralOffset: finite(settings.lateralOffset) ?? 0,
    seed: Math.trunc(finite(settings.seed) ?? 0),
    scale: vec3(settings.scale) ?? [1, 1, 1],
  });
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function finite(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function finitePositive(value: unknown): number | null { const number = finite(value); return number !== null && number > 0 ? number : null; }
function vec3(value: unknown): Vec3 | null { return Array.isArray(value) && value.length === 3 && value.every((entry) => finite(entry) !== null) ? [value[0] as number, value[1] as number, value[2] as number] : null; }
function uniqueId(requested: string, used: ReadonlySet<string>): string { const base = requested || "road-decorations"; if (!used.has(base)) return base; let index = 2; while (used.has(`${base}-${index}`)) index += 1; return `${base}-${index}`; }
