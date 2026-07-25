/**
 * Visual library for the RTS building contracts.
 *
 * Gameplay continues to own footprints, navigation blockers and construction;
 * this module only decides what a structure looks like.
 *
 * Since the presentation plan's Faz 4 the authored Actor pack is the authority
 * for that, and every entry point here asks it first. The legacy
 * {@link rtsBuildingArt} glTF tables survive for exactly one job: covering the
 * seconds between the match appearing and the pack finishing its load. Once the
 * pack is ready they are never consulted again — a building the catalog cannot
 * answer for is a coverage bug, and it shows the explicit stand-in rather than a
 * plausible-looking model that hides the gap. Faz 5 deletes them.
 */
import { Box3, Group, Mesh, type Object3D, type WebGLRenderer } from "three";
import { createForgeGltfLoader } from "@engine/render-three/gltfLoader";

import type { SettlementAge } from "../../data/gameDataTypes";
import type { RtsActorVisualFactory } from "../content/rtsActorVisualFactory";
import { createRtsActorPlaceholder } from "../content/rtsActorPlaceholder";
import { fitPresentationToFootprint } from "../content/rtsActorPresentationTree";
import type { CommandCenter } from "./commandCenter";
import type { PlacedStructure } from "./placedStructureSystem";
import { allBuildingMeshPaths, buildingMeshPath } from "./rtsBuildingArt";

const FOUNDATION_TOP = 0.18;
const MODEL_FOOTPRINT_FILL = 0.86;
/** The centre is spawned by its own system, so its footprint is not in `stats` here. */
const COMMAND_CENTER_FOOTPRINT = 8;

export class RtsBuildingVisuals {
  private readonly loader;
  private readonly templates = new Map<string, Object3D>();
  private loaded = false;

  constructor(
    renderer: WebGLRenderer,
    private readonly actorVisuals: RtsActorVisualFactory | null = null,
  ) {
    this.loader = createForgeGltfLoader(renderer);
  }

  async load(): Promise<void> {
    const entries = await Promise.all(allBuildingMeshPaths()
      .map(async (path) => [path, (await this.loader.loadAsync(path)).scene] as const));
    for (const [path, scene] of entries) this.templates.set(path, scene);
    this.loaded = true;
  }

  applyToCenter(center: CommandCenter, age: SettlementAge = "settlement"): void {
    // The centre goes through the same Actor-first resolution as every other
    // building; it is only spawned differently, not presented differently.
    const visual = this.resolve(
      "command_center",
      "completed",
      center.level,
      COMMAND_CENTER_FOOTPRINT,
      COMMAND_CENTER_FOOTPRINT,
      age,
      () => buildingMeshPath("command_center", age, center.level),
    );
    if (visual) center.setVisual(visual);
  }

  /**
   * The one resolution order every call site shares: the authored Actor, then —
   * only while the pack is still loading — the legacy model, and otherwise the
   * explicit stand-in.
   *
   * A pack that is loaded and still cannot answer means the catalog is missing a
   * mapping. Showing legacy art there would make a coverage bug look like a
   * finished building, which is how the second Farm mesh stayed invisible for so
   * long; the stand-in makes it a thing someone reports instead.
   */
  private resolve(
    buildingId: string,
    state: "construction" | "completed",
    level: number,
    footprintWidth: number,
    footprintDepth: number,
    age: SettlementAge,
    legacyPath: () => string | null,
  ): Group | null {
    const actorVisual = this.actorVisuals?.createBuildingVisual(
      buildingId,
      state,
      level,
      footprintWidth,
      footprintDepth,
      age,
    );
    if (actorVisual) return actorVisual;
    if (this.actorVisuals?.isReady()) {
      const placeholder = createRtsActorPlaceholder(`${buildingId}@${age}#${level}:${state}`);
      placeholder.userData.rtsSharedModel = true;
      fitPresentationToFootprint(placeholder, footprintWidth, footprintDepth);
      return placeholder;
    }
    const path = legacyPath();
    return path ? this.create(path, footprintWidth, footprintDepth) : null;
  }

  createForStructure(structure: PlacedStructure, age: SettlementAge = "settlement"): Group | null {
    return this.resolve(
      structure.stats.id,
      "completed",
      structure.level,
      structure.stats.footprint.width,
      structure.stats.footprint.depth,
      age,
      () => visualMeshPathForStructure(structure, age),
    );
  }

  createPreviewForBuilding(
    buildingId: string,
    footprintWidth: number,
    footprintDepth: number,
    age: SettlementAge = "settlement",
    level = 1,
  ): Group | null {
    return this.resolve(
      buildingId,
      "completed",
      level,
      footprintWidth,
      footprintDepth,
      age,
      () => buildingMeshPath(buildingId, age, level),
    );
  }

  createConstructionVisual(
    structure: Pick<PlacedStructure, "stats">,
    age: SettlementAge = "settlement",
    level = 1,
  ): Group | null {
    return this.resolve(
      structure.stats.id,
      "construction",
      level,
      structure.stats.footprint.width,
      structure.stats.footprint.depth,
      age,
      () => buildingMeshPath(structure.stats.id, age, level),
    );
  }

  dispose(): void {
    for (const template of this.templates.values()) disposeModel(template);
    this.templates.clear();
    this.loaded = false;
  }

  private create(path: string, footprintWidth: number, footprintDepth: number): Group | null {
    if (!this.loaded) return null;
    const template = this.templates.get(path);
    if (!template) return null;

    const visual = new Group();
    visual.name = "rts-complete-building-model";
    visual.userData.rtsSharedModel = true;
    const model = template.clone(true);
    visual.add(model);
    fitModelToFootprint(model, footprintWidth, footprintDepth);
    model.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return visual;
  }
}

/**
 * Mesh path for a structure's current model, or `null` while its foundation is
 * still under construction (the caller keeps the construction placeholder). A
 * completed structure with no mapped art also returns `null`.
 */
export function visualMeshPathForStructure(
  structure: Pick<PlacedStructure, "stats" | "level" | "construction">,
  age: SettlementAge = "settlement",
): string | null {
  if (!structure.construction.complete) return null;
  return buildingMeshPath(structure.stats.id, age, structure.level);
}

/** Preserve each author's proportions while fitting safely inside gameplay's footprint. */
function fitModelToFootprint(model: Object3D, footprintWidth: number, footprintDepth: number): void {
  const sourceBounds = new Box3().setFromObject(model);
  const sourceWidth = sourceBounds.max.x - sourceBounds.min.x;
  const sourceDepth = sourceBounds.max.z - sourceBounds.min.z;
  if (sourceWidth <= 0 || sourceDepth <= 0) return;

  const scale = Math.min(footprintWidth / sourceWidth, footprintDepth / sourceDepth) * MODEL_FOOTPRINT_FILL;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const fittedBounds = new Box3().setFromObject(model);
  model.position.y += FOUNDATION_TOP - fittedBounds.min.y;
}

function disposeModel(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}
