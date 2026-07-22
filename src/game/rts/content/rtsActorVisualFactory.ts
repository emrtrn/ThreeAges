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
import { rtsBuildingActorRef, rtsUnitActorRef, type RtsActorRef, type RtsContentCatalog } from "./rtsContentCatalog";
import type { RtsPresentationHandle, UnitOwner } from "../units/unit";

const FOUNDATION_TOP = 0.18;
const MODEL_FOOTPRINT_FILL = 0.86;

interface ManifestMeshEntry {
  readonly path: string;
  readonly assetType: "staticMesh" | "skeletalMesh";
}

function readVec3(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [x, y, z] = value;
  return typeof x === "number" && typeof y === "number" && typeof z === "number"
    ? [x, y, z]
    : null;
}

function readNumberVariable(def: ActorScriptDef, key: string, fallback: number): number {
  const value = def.variables.find((field) => field.key === key)?.default;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Builds cloned Actor Script component trees from the manifest-resolved mesh assets. */
export class RtsActorVisualFactory {
  private readonly loader;
  private readonly definitions = new Map<RtsActorRef, ActorScriptDef>();
  private readonly templates = new Map<string, Object3D>();
  private readonly manifestMeshes = new Map<string, ManifestMeshEntry>();
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
    const manifest = await manifestResponse.json() as { assets?: unknown };
    if (!Array.isArray(manifest.assets)) throw new Error("RTS Actor manifest has no assets array");
    for (const value of manifest.assets) {
      if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
      const entry = value as Record<string, unknown>;
      const id = entry["id"];
      const path = entry["path"];
      const assetType = entry["assetType"];
      if (
        typeof id === "string"
        && typeof path === "string"
        && (assetType === "staticMesh" || assetType === "skeletalMesh")
      ) {
        this.manifestMeshes.set(id, { path, assetType });
      }
    }

    const refs = new Set<RtsActorRef>();
    for (const entry of Object.values(this.catalog.units)) refs.add(entry.actorRef);
    for (const entry of Object.values(this.catalog.buildings)) {
      if (entry.constructionActorRef) refs.add(entry.constructionActorRef);
      for (const ref of Object.values(entry.levels)) refs.add(ref);
    }
    for (const ref of refs) await this.loadActor(ref);
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
  ): Group | null {
    if (!this.ready) return null;
    const actorRef = rtsBuildingActorRef(this.catalog, buildingId, state, level);
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
    const meshNodes = def.components.filter((node) => isMeshComponentKind(node.component));
    if (meshNodes.length === 0) throw new Error(`RTS Actor class has no mesh component: ${ref}`);
    this.definitions.set(ref, def);
    for (const node of meshNodes) {
      const assetId = node.props.assetId;
      if (typeof assetId !== "string" || assetId.length === 0) {
        throw new Error(`RTS Actor mesh component has no assetId: ${ref}#${node.id}`);
      }
      const asset = this.manifestMeshes.get(assetId);
      if (!asset) throw new Error(`RTS Actor mesh asset is not in the manifest: ${ref}#${assetId}`);
      const expectedType = node.component === "SkeletalMeshComponent" ? "skeletalMesh" : undefined;
      if (expectedType && asset.assetType !== expectedType) {
        throw new Error(`RTS Actor mesh type mismatch: ${ref}#${assetId}`);
      }
      if (!this.templates.has(assetId)) {
        const gltf = await this.loader.loadAsync(projectFileUrl(asset.path));
        this.templates.set(assetId, gltf.scene);
      }
    }
  }

  private createActorVisual(ref: RtsActorRef): Group | null {
    const def = this.definitions.get(ref);
    if (!def) return null;
    const root = new Group();
    root.name = `rts-actor-presentation:${ref}`;
    root.userData.rtsActorPresentation = true;
    const nodes = new Map<string, Group>();
    for (const component of def.components) {
      const node = new Group();
      node.name = component.id;
      const position = readVec3(component.props.position);
      const rotation = readVec3(component.props.rotation);
      const scale = readVec3(component.props.scale);
      if (position) node.position.set(...position);
      if (rotation) {
        node.rotation.set(
          rotation[0] * Math.PI / 180,
          rotation[1] * Math.PI / 180,
          rotation[2] * Math.PI / 180,
        );
      }
      if (scale) node.scale.set(...scale);
      nodes.set(component.id, node);
    }
    for (const component of def.components) {
      const node = nodes.get(component.id);
      if (!node) continue;
      (component.parent ? nodes.get(component.parent) : root)?.add(node);
      if (!isMeshComponentKind(component.component)) continue;
      const assetId = component.props.assetId;
      const template = typeof assetId === "string" ? this.templates.get(assetId) : undefined;
      if (!template) continue;
      const model = template.clone(true);
      model.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      node.add(model);
    }
    return root;
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
