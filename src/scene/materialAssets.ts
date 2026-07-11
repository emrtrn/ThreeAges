import { TextureLoader } from "three";

import { assetPath, assetRecordById, assetType, type AssetManifest } from "@engine/assets/manifest";
import { normalizeForgeMaterialDef } from "@engine/assets/material";
import {
  createThreeMaterialFromForgeDef,
  type ForgeThreeMaterial,
} from "@engine/render-three/materials";
import { projectFileUrl } from "@/project/ProjectSystem";

export async function loadForgeMaterial(
  manifest: AssetManifest,
  materialId: string,
  textureLoader = new TextureLoader(),
  options: { maxAnisotropy?: number } = {},
): Promise<ForgeThreeMaterial> {
  const materialRecord = assetRecordById(manifest, materialId);
  if (!materialRecord || assetType(materialRecord) !== "material") {
    throw new Error(`Material asset not found: ${materialId}`);
  }
  // Revalidate against the dev server (matches the Material Editor's loader). Without
  // this the browser can serve a stale heuristic-cached material JSON, so a layer
  // blend / mask edited and saved in the editor never reaches the scene or Play.
  const response = await fetch(projectFileUrl(assetPath(materialRecord)), { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Material asset failed: ${response.status} ${response.statusText}`);
  }
  const def = normalizeForgeMaterialDef(await response.json(), materialRecord.name);
  return createThreeMaterialFromForgeDef(
    def,
    {
      baseColorTexture: def.baseColorTexture
        ? await loadTextureByAssetId(manifest, def.baseColorTexture, textureLoader)
        : null,
      normalTexture: def.normalTexture
        ? await loadTextureByAssetId(manifest, def.normalTexture, textureLoader)
        : null,
      roughnessTexture: def.roughnessTexture
        ? await loadTextureByAssetId(manifest, def.roughnessTexture, textureLoader)
        : null,
      metalnessTexture: def.metalnessTexture
        ? await loadTextureByAssetId(manifest, def.metalnessTexture, textureLoader)
        : null,
      aoTexture: def.aoTexture
        ? await loadTextureByAssetId(manifest, def.aoTexture, textureLoader)
        : null,
      opacityTexture: def.opacityTexture
        ? await loadTextureByAssetId(manifest, def.opacityTexture, textureLoader)
        : null,
      emissiveTexture: def.emissiveTexture
        ? await loadTextureByAssetId(manifest, def.emissiveTexture, textureLoader)
        : null,
      ormTexture: def.ormTexture
        ? await loadTextureByAssetId(manifest, def.ormTexture, textureLoader)
        : null,
      layer1BaseColorTexture: def.layerBlend?.layer1.baseColorTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.layer1.baseColorTexture, textureLoader)
        : null,
      layer1NormalTexture: def.layerBlend?.layer1.normalTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.layer1.normalTexture, textureLoader)
        : null,
      layer1RoughnessTexture: def.layerBlend?.layer1.roughnessTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.layer1.roughnessTexture, textureLoader)
        : null,
      layer1MetalnessTexture: def.layerBlend?.layer1.metalnessTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.layer1.metalnessTexture, textureLoader)
        : null,
      layer1OpacityTexture: def.layerBlend?.layer1.opacityTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.layer1.opacityTexture, textureLoader)
        : null,
      layer1EmissiveTexture: def.layerBlend?.layer1.emissiveTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.layer1.emissiveTexture, textureLoader)
        : null,
      layer1AoTexture: def.layerBlend?.layer1.aoTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.layer1.aoTexture, textureLoader)
        : null,
      layerBlendMaskTexture: def.layerBlend?.maskTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.maskTexture, textureLoader)
        : null,
    },
    options,
  );
}

/**
 * Resolves a material asset's base color (hex string), without loading any of
 * its textures. Used by the Landscape paint layers to tint the terrain with an
 * assigned material's color cheaply — full texture splatting is a later phase.
 * Returns `null` if the id isn't a material asset or can't be read.
 */
export async function loadForgeMaterialBaseColor(
  manifest: AssetManifest,
  materialId: string,
): Promise<string | null> {
  const materialRecord = assetRecordById(manifest, materialId);
  if (!materialRecord || assetType(materialRecord) !== "material") return null;
  try {
    const response = await fetch(projectFileUrl(assetPath(materialRecord)), { cache: "no-cache" });
    if (!response.ok) return null;
    const def = normalizeForgeMaterialDef(await response.json(), materialRecord.name);
    return def.baseColor ?? null;
  } catch {
    return null;
  }
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
  return loader.loadAsync(projectFileUrl(assetPath(record)));
}
