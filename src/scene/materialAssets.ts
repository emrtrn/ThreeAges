import { NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from "three";

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
  options: { maxAnisotropy?: number; resolveUrl?: (path: string) => string } = {},
): Promise<ForgeThreeMaterial> {
  const materialRecord = assetRecordById(manifest, materialId);
  if (!materialRecord || assetType(materialRecord) !== "material") {
    throw new Error(`Material asset not found: ${materialId}`);
  }
  // Revalidate against the dev server (matches the Material Editor's loader). Without
  // this the browser can serve a stale heuristic-cached material JSON, so a layer
  // blend / mask edited and saved in the editor never reaches the scene or Play.
  const resolveUrl = options.resolveUrl ?? projectFileUrl;
  const response = await fetch(resolveUrl(assetPath(materialRecord)), { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Material asset failed: ${response.status} ${response.statusText}`);
  }
  const def = normalizeForgeMaterialDef(await response.json(), materialRecord.name);
  return createThreeMaterialFromForgeDef(
    def,
    {
      baseColorTexture: def.baseColorTexture
        ? await loadTextureByAssetId(manifest, def.baseColorTexture, textureLoader, resolveUrl)
        : null,
      normalTexture: def.normalTexture
        ? await loadTextureByAssetId(manifest, def.normalTexture, textureLoader, resolveUrl)
        : null,
      roughnessTexture: def.roughnessTexture
        ? await loadTextureByAssetId(manifest, def.roughnessTexture, textureLoader, resolveUrl)
        : null,
      metalnessTexture: def.metalnessTexture
        ? await loadTextureByAssetId(manifest, def.metalnessTexture, textureLoader, resolveUrl)
        : null,
      aoTexture: def.aoTexture
        ? await loadTextureByAssetId(manifest, def.aoTexture, textureLoader, resolveUrl)
        : null,
      opacityTexture: def.opacityTexture
        ? await loadTextureByAssetId(manifest, def.opacityTexture, textureLoader, resolveUrl)
        : null,
      emissiveTexture: def.emissiveTexture
        ? await loadTextureByAssetId(manifest, def.emissiveTexture, textureLoader, resolveUrl)
        : null,
      ormTexture: def.ormTexture
        ? await loadTextureByAssetId(manifest, def.ormTexture, textureLoader, resolveUrl)
        : null,
      layer1BaseColorTexture: def.layerBlend?.layer1.baseColorTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.layer1.baseColorTexture, textureLoader, resolveUrl)
        : null,
      layer1NormalTexture: def.layerBlend?.layer1.normalTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.layer1.normalTexture, textureLoader, resolveUrl)
        : null,
      layer1RoughnessTexture: def.layerBlend?.layer1.roughnessTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.layer1.roughnessTexture, textureLoader, resolveUrl)
        : null,
      layer1MetalnessTexture: def.layerBlend?.layer1.metalnessTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.layer1.metalnessTexture, textureLoader, resolveUrl)
        : null,
      layer1OpacityTexture: def.layerBlend?.layer1.opacityTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.layer1.opacityTexture, textureLoader, resolveUrl)
        : null,
      layer1EmissiveTexture: def.layerBlend?.layer1.emissiveTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.layer1.emissiveTexture, textureLoader, resolveUrl)
        : null,
      layer1AoTexture: def.layerBlend?.layer1.aoTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.layer1.aoTexture, textureLoader, resolveUrl)
        : null,
      layerBlendMaskTexture: def.layerBlend?.maskTexture
        ? await loadTextureByAssetId(manifest, def.layerBlend.maskTexture, textureLoader, resolveUrl)
        : null,
    },
    options,
  );
}

export interface ForgeMaterialLayer {
  /** Material base color (hex), used as the flat tint when there's no texture. */
  baseColor: string;
  /** Base-color (albedo) texture, tiling-wrapped for terrain splatting, or `null`. */
  texture: Texture | null;
  /** Tangent-space normal map. Kept linear and repeat-wrapped for terrain splatting. */
  normalTexture: Texture | null;
  /** Packed AO (R), roughness (G), metalness (B) texture; linear and repeat-wrapped. */
  ormTexture: Texture | null;
  /**
   * The material's authored UV tiling (`uvTiling.x/y`). For landscape splatting
   * this is a *multiplier* on the terrain's auto tiling base, so the default
   * `{ x: 1, y: 1 }` keeps the legacy look and larger values pack the texture
   * denser.
   */
  tiling: { x: number; y: number };
  /** Scalar PBR fallbacks/multipliers used when a layer has no ORM texture. */
  roughness: number;
  metalness: number;
  aoIntensity: number;
}

/**
 * Loads the PBR inputs a material contributes to a Landscape paint layer. The
 * resolver is shared by editor, Play and authored-world paths so a landscape
 * never silently loses its normal/ORM maps in one host. Returns `null` if the
 * id isn't a material asset or can't be read.
 */
export async function loadForgeMaterialLayer(
  manifest: AssetManifest,
  materialId: string,
  textureLoader = new TextureLoader(),
  options: { maxAnisotropy?: number } = {},
): Promise<ForgeMaterialLayer | null> {
  const materialRecord = assetRecordById(manifest, materialId);
  if (!materialRecord || assetType(materialRecord) !== "material") return null;
  try {
    const response = await fetch(projectFileUrl(assetPath(materialRecord)), { cache: "no-cache" });
    if (!response.ok) return null;
    const def = normalizeForgeMaterialDef(await response.json(), materialRecord.name);
    const loadLayerTexture = async (
      textureId: string | null,
      colorSpace: typeof SRGBColorSpace | typeof NoColorSpace,
    ): Promise<Texture | null> => {
      if (!textureId) return null;
      const texture = await loadTextureByAssetId(manifest, textureId, textureLoader);
      texture.colorSpace = colorSpace;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      // Landscape UVs are engine-generated, so this is `true` for every sane paint
      // layer — honoured anyway so one material reads the same in both consumers.
      texture.flipY = def.flipY;
      if (options.maxAnisotropy) texture.anisotropy = options.maxAnisotropy;
      texture.needsUpdate = true;
      return texture;
    };
    const [texture, normalTexture, ormTexture] = await Promise.all([
      loadLayerTexture(def.baseColorTexture, SRGBColorSpace),
      loadLayerTexture(def.normalTexture, NoColorSpace),
      loadLayerTexture(def.ormTexture, NoColorSpace),
    ]);
    return {
      baseColor: def.baseColor ?? "#ffffff",
      texture,
      normalTexture,
      ormTexture,
      tiling: { x: def.uvTiling.x, y: def.uvTiling.y },
      roughness: def.roughness,
      metalness: def.metalness,
      aoIntensity: def.aoIntensity,
    };
  } catch {
    return null;
  }
}

async function loadTextureByAssetId(
  manifest: AssetManifest,
  textureId: string,
  loader: TextureLoader,
  resolveUrl: (path: string) => string = projectFileUrl,
) {
  const record = assetRecordById(manifest, textureId);
  if (!record || assetType(record) !== "texture") {
    throw new Error(`Texture asset not found: ${textureId}`);
  }
  return loader.loadAsync(resolveUrl(assetPath(record)));
}
