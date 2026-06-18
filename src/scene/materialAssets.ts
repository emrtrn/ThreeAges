import {
  Color,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
} from "three";

import { assetPath, assetRecordById, assetType, type AssetManifest } from "@engine/assets/manifest";
import { projectFileUrl } from "@/project/ProjectSystem";

export interface ForgeMaterialDef {
  schema: 1;
  materialType: "standard";
  name?: string;
  baseColor?: string;
  baseColorTexture?: string;
  normalTexture?: string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

export async function loadForgeMaterial(
  manifest: AssetManifest,
  materialId: string,
  textureLoader = new TextureLoader(),
): Promise<MeshStandardMaterial> {
  const materialRecord = assetRecordById(manifest, materialId);
  if (!materialRecord || assetType(materialRecord) !== "material") {
    throw new Error(`Material asset not found: ${materialId}`);
  }
  const response = await fetch(projectFileUrl(assetPath(materialRecord)));
  if (!response.ok) {
    throw new Error(`Material asset failed: ${response.status} ${response.statusText}`);
  }
  const def = (await response.json()) as ForgeMaterialDef;
  const material = new MeshStandardMaterial({
    name: def.name ?? materialRecord.name,
    color: new Color(def.baseColor ?? "#ffffff"),
    roughness: clamp01(def.roughness ?? 0.8),
    metalness: clamp01(def.metalness ?? 0),
    transparent: def.opacity !== undefined && def.opacity < 1,
    opacity: clamp01(def.opacity ?? 1),
    emissive: new Color(def.emissive ?? "#000000"),
    emissiveIntensity: Math.max(0, def.emissiveIntensity ?? 0),
  });
  if (def.baseColorTexture) {
    const texture = await loadTextureByAssetId(manifest, def.baseColorTexture, textureLoader);
    texture.colorSpace = SRGBColorSpace;
    material.map = texture;
  }
  if (def.normalTexture) {
    material.normalMap = await loadTextureByAssetId(manifest, def.normalTexture, textureLoader);
  }
  material.needsUpdate = true;
  return material;
}

async function loadTextureByAssetId(
  manifest: AssetManifest,
  textureId: string,
  loader: TextureLoader,
) {
  const record = assetRecordById(manifest, textureId);
  if (!record || assetType(record) !== "texture") {
    throw new Error(`Texture asset not found: ${textureId}`);
  }
  const texture = await loader.loadAsync(projectFileUrl(assetPath(record)));
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}
