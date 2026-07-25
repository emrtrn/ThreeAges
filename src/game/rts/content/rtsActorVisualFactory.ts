/**
 * Actor Script -> RTS presentation adapter (assetization Faz C).
 *
 * It consumes only authored presentation components and never reads gameplay
 * values from Actor Scripts. A missing class, mesh id, or model leaves callers
 * with `null`, which keeps the legacy placeholder path playable during rollout.
 */
import { Box3, Group, Mesh, type Object3D, type WebGLRenderer } from "three";
import { isMeshComponentKind, normalizeActorScriptDef, type ActorScriptDef } from "@engine/scene/actorScript";
import { createForgeGltfLoader } from "@engine/render-three/gltfLoader";
import { projectFileUrl } from "@/project/ProjectSystem";
import type { SettlementAge } from "@/game/data/gameDataTypes";
import { rtsBuildingActorRef, rtsUnitActorRef, type RtsActorRef, type RtsContentCatalog } from "./rtsContentCatalog";
import {
  parseRtsMeshManifest,
  rtsContentCatalogRefs,
  validateRtsPresentationActor,
  type RtsMeshAsset,
} from "./rtsContentValidation";
import { buildActorPresentationTree } from "./rtsActorPresentationTree";
import type { RtsPresentationHandle, UnitOwner } from "../units/unit";

const FOUNDATION_TOP = 0.18;
const MODEL_FOOTPRINT_FILL = 0.86;

function readNumberVariable(def: ActorScriptDef, key: string, fallback: number): number {
  const value = def.variables.find((field) => field.key === key)?.default;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Builds cloned Actor Script component trees from the manifest-resolved mesh assets. */
export class RtsActorVisualFactory {
  private readonly loader;
  private readonly definitions = new Map<RtsActorRef, ActorScriptDef>();
  private readonly templates = new Map<string, Object3D>();
  private readonly manifestMeshes = new Map<string, RtsMeshAsset>();
  private ready = false;

  constructor(
    renderer: WebGLRenderer,
    private readonly catalog: RtsContentCatalog,
  ) {
    this.loader = createForgeGltfLoader(renderer);
  }

  async load(): Promise<void> {
    const manifestResponse = await fetch(projectFileUrl("assets/manifest.json"), { cache: "no-cache" });
    if (!manifestResponse.ok) {
      throw new Error(`RTS Actor manifest fetch failed: ${manifestResponse.status}`);
    }
    for (const [id, asset] of parseRtsMeshManifest(await manifestResponse.json())) {
      this.manifestMeshes.set(id, asset);
    }

    for (const ref of rtsContentCatalogRefs(this.catalog)) await this.loadActor(ref);
    this.ready = true;
  }

  /** Returns null until loaded or whenever a catalog entry intentionally does not exist. */
  createUnitPresentation(unitId: string, _owner: UnitOwner): RtsPresentationHandle | null {
    const actorRef = rtsUnitActorRef(this.catalog, unitId);
    if (!actorRef || !this.ready) return null;
    const root = this.createActorVisual(actorRef);
    const def = this.definitions.get(actorRef);
    if (!root || !def) return null;
    const pickTargets: Object3D[] = [];
    root.traverse((child) => {
      if (child instanceof Mesh) pickTargets.push(child);
    });
    if (pickTargets.length === 0) return null;
    return {
      root,
      pickTargets,
      selectionRadius: readNumberVariable(def, "selectionRadius", 0.5),
      dispose: () => root.removeFromParent(),
    };
  }

  createBuildingVisual(
    buildingId: string,
    state: "construction" | "completed",
    level: number,
    footprintWidth: number,
    footprintDepth: number,
    age: SettlementAge = "settlement",
  ): Group | null {
    if (!this.ready) return null;
    const actorRef = rtsBuildingActorRef(this.catalog, buildingId, state, level, age);
    if (!actorRef) return null;
    const visual = this.createActorVisual(actorRef);
    if (!visual) return null;
    visual.userData.rtsSharedModel = true;
    fitModelToFootprint(visual, footprintWidth, footprintDepth);
    return visual;
  }

  dispose(): void {
    for (const template of this.templates.values()) disposeTemplate(template);
    this.templates.clear();
    this.definitions.clear();
    this.manifestMeshes.clear();
    this.ready = false;
  }

  private async loadActor(ref: RtsActorRef): Promise<void> {
    const response = await fetch(projectFileUrl(ref), { cache: "no-cache" });
    if (!response.ok) throw new Error(`RTS Actor class not found: ${ref}`);
    const def = normalizeActorScriptDef(await response.json(), ref);
    // One authority for "is this Actor renderable as authored" — shared with the
    // engine coverage test, so a pack that passes CI cannot fail only in game.
    validateRtsPresentationActor(def, ref, this.manifestMeshes);
    this.definitions.set(ref, def);
    for (const node of def.components.filter((entry) => isMeshComponentKind(entry.component))) {
      const assetId = node.props.assetId as string;
      const asset = this.manifestMeshes.get(assetId)!;
      if (!this.templates.has(assetId)) {
        const gltf = await this.loader.loadAsync(projectFileUrl(asset.path));
        this.templates.set(assetId, gltf.scene);
      }
    }
  }

  private createActorVisual(ref: RtsActorRef): Group | null {
    const def = this.definitions.get(ref);
    if (!def) return null;
    return buildActorPresentationTree(def, ref, (assetId) => this.templates.get(assetId));
  }
}

function fitModelToFootprint(model: Object3D, footprintWidth: number, footprintDepth: number): void {
  const sourceBounds = new Box3().setFromObject(model);
  const sourceWidth = sourceBounds.max.x - sourceBounds.min.x;
  const sourceDepth = sourceBounds.max.z - sourceBounds.min.z;
  if (sourceWidth <= 0 || sourceDepth <= 0) return;
  const scale = Math.min(footprintWidth / sourceWidth, footprintDepth / sourceDepth) * MODEL_FOOTPRINT_FILL;
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);
  const fittedBounds = new Box3().setFromObject(model);
  model.position.y += FOUNDATION_TOP - fittedBounds.min.y;
}

function disposeTemplate(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}
