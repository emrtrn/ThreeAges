import { MeshoptDecoder } from "meshoptimizer";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  projectFileUrl,
  projectPublicFileUrl,
  type ProjectManifest,
} from "@/project/ProjectSystem";
import type { MetadataSchema } from "@engine/scene/metadataSchema";

export interface AssetRecord {
  id: string;
  file: string;
  type: "model";
  category: string;
  loadGroup: string;
  source: {
    origin: string;
    pack?: string;
    packVersion?: string;
    url?: string;
  };
  license: string;
  bytes: number;
}

export interface AssetManifest {
  version: number;
  generated: string;
  ktx2: boolean;
  assets: AssetRecord[];
}

export type PlacementSurface = "floor" | "wall" | "room" | "character";

export interface AssetCatalogRecord {
  id: string;
  name: string;
  type: "model";
  category: string;
  model: string;
  preview?: string;
  placement: {
    surface: PlacementSurface;
    snapToWall: boolean;
    allowRotation: boolean;
    allowScale: boolean;
  };
  tags?: string[];
}

export interface AssetCatalog {
  schema: 1;
  assets: AssetCatalogRecord[];
}

export interface EditableAsset extends AssetRecord {
  displayName: string;
  catalogCategory: string;
  placement: AssetCatalogRecord["placement"];
  tags: string[];
}

export class AssetLoader {
  private manifestPromise: Promise<AssetManifest> | null = null;
  private catalogPromise: Promise<AssetCatalog | null> | null = null;
  private metadataSchemaPromise: Promise<MetadataSchema | null> | null = null;
  private modelPromises = new Map<string, Promise<GLTF>>();
  private readonly gltfLoader = new GLTFLoader();

  constructor(private readonly project: ProjectManifest) {
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  }

  loadManifest(): Promise<AssetManifest> {
    this.manifestPromise ??= fetch(projectFileUrl(this.project.editor.assetManifest)).then(
      async (response) => {
        if (!response.ok) {
          throw new Error(
            `Asset manifest failed: ${response.status} ${response.statusText}`,
          );
        }
        return (await response.json()) as AssetManifest;
      },
    );
    return this.manifestPromise;
  }

  loadCatalog(): Promise<AssetCatalog | null> {
    const catalogPath = this.project.editor.assetCatalog;
    if (!catalogPath) return Promise.resolve(null);
    this.catalogPromise ??= fetch(projectFileUrl(catalogPath)).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Asset catalog failed: ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as AssetCatalog;
    });
    return this.catalogPromise;
  }

  loadMetadataSchema(): Promise<MetadataSchema | null> {
    const schemaPath = this.project.editor.metadataSchema;
    if (!schemaPath) return Promise.resolve(null);
    this.metadataSchemaPromise ??= fetch(projectFileUrl(schemaPath)).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Metadata schema failed: ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as MetadataSchema;
    });
    return this.metadataSchemaPromise;
  }

  async loadEditableAssets(): Promise<EditableAsset[]> {
    const [manifest, catalog] = await Promise.all([
      this.loadManifest(),
      this.loadCatalog().catch(() => null),
    ]);
    const catalogById = new Map(catalog?.assets.map((asset) => [asset.id, asset]));
    return manifest.assets
      .filter((asset) => asset.type === "model")
      .map((asset) => {
        const catalogAsset = catalogById.get(asset.id);
        return {
          ...asset,
          displayName: catalogAsset?.name ?? asset.id,
          catalogCategory: catalogAsset?.category ?? asset.category,
          placement:
            catalogAsset?.placement ?? defaultPlacementForCategory(asset.category),
          tags: catalogAsset?.tags ?? [],
        };
      });
  }

  async recordsForGroup(loadGroup: string): Promise<AssetRecord[]> {
    const manifest = await this.loadManifest();
    return manifest.assets.filter((asset) => asset.loadGroup === loadGroup);
  }

  async loadGroup(loadGroup: string): Promise<Map<string, GLTF>> {
    const records = await this.recordsForGroup(loadGroup);
    const entries = await Promise.all(
      records.map(async (record) => [record.id, await this.loadModel(record.id)] as const),
    );
    return new Map(entries);
  }

  async loadGroups(loadGroups: string[]): Promise<Map<string, GLTF>> {
    const groups = await Promise.all(
      loadGroups.map((loadGroup) => this.loadGroup(loadGroup)),
    );
    const models = new Map<string, GLTF>();
    for (const group of groups) {
      for (const [id, model] of group) models.set(id, model);
    }
    return models;
  }

  async loadModel(id: string): Promise<GLTF> {
    let promise = this.modelPromises.get(id);
    if (!promise) {
      promise = this.loadModelRecord(id);
      this.modelPromises.set(id, promise);
    }
    return promise;
  }

  async totalBytesForGroups(loadGroups: string[]): Promise<number> {
    const manifest = await this.loadManifest();
    const groupSet = new Set(loadGroups);
    return manifest.assets
      .filter((asset) => groupSet.has(asset.loadGroup))
      .reduce((total, asset) => total + asset.bytes, 0);
  }

  private async loadModelRecord(id: string): Promise<GLTF> {
    const manifest = await this.loadManifest();
    const record = manifest.assets.find((asset) => asset.id === id);
    if (!record) throw new Error(`Asset not found in manifest: ${id}`);
    return this.gltfLoader.loadAsync(projectPublicFileUrl(this.project, record.file));
  }
}

function defaultPlacementForCategory(category: string): AssetCatalogRecord["placement"] {
  if (category === "room-shell") {
    return {
      surface: "room",
      snapToWall: false,
      allowRotation: true,
      allowScale: false,
    };
  }
  if (category === "customer-character") {
    return {
      surface: "character",
      snapToWall: false,
      allowRotation: true,
      allowScale: true,
    };
  }
  return {
    surface: "floor",
    snapToWall: false,
    allowRotation: true,
    allowScale: true,
  };
}
