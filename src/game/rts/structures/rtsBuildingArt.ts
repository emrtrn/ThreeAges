/**
 * Pure gameplay-to-art mapping for RTS building models.
 *
 * Split out of {@link rtsBuildingVisuals} so the (age, building, level) -> mesh
 * path resolution has no Three.js dependency and can be unit tested directly.
 *
 * Two orthogonal progression axes decide a building's model (see
 * `docs/planned/THREEAGES_AGE_AND_LEVEL_PROGRESSION_PLAN.md`):
 * - the owner's {@link SettlementAge} picks the art *family* (First/Second Age);
 * - the structure's in-age level (1..3) picks the variant inside that family.
 *
 * The pack ships no Third Age, so only two families are wired today; adding one
 * is a data-only change here plus a `SettlementAge` member.
 */
import type { SettlementAge } from "../../data/gameDataTypes";

export const STATIC_MESH_ROOT = "/assets/ThreeAges/StaticMeshes";

/** Highest in-age level the art pack provides per aged building. */
export const MAX_BUILDING_LEVEL = 3;

/** Which asset-archive age family each gameplay age resolves to. */
const AGE_FAMILY: Record<SettlementAge, string> = {
  settlement: "FirstAge",
  town: "SecondAge",
};

/**
 * `aged` buildings vary by both age family and level; `fixed` ones (resource
 * camps) have a single mesh in the pack regardless of age or level, so they
 * keep their model while still gaining stats on a level-up.
 */
type ArtResolver =
  | { readonly kind: "aged"; readonly basename: (family: string, level: number) => string }
  | { readonly kind: "fixed"; readonly basename: string };

/**
 * Gameplay building id -> art basename. The `lumber_camp` stand-in mirrors the
 * note in {@link rtsBuildingVisuals}: it reuses a cut-tree cluster until a
 * dedicated woodcutter model lands. `quarry`/`gold_mine` share the single Mine.
 */
const BUILDING_ART: Record<string, ArtResolver> = {
  command_center: { kind: "aged", basename: (f, l) => `TownCenter_${f}_Level${l}` },
  house: { kind: "aged", basename: (f, l) => `Houses_${f}_1_Level${l}` },
  depot: { kind: "aged", basename: (f, l) => `Storage_${f}_Level${l}` },
  outpost: { kind: "aged", basename: (f, l) => `WatchTower_${f}_Level${l}` },
  barracks: { kind: "aged", basename: (f, l) => `Barracks_${f}_Level${l}` },
  farm: { kind: "aged", basename: (f, l) => `Farm_${f}_Level${l}_Wheat` },
  lumber_camp: { kind: "fixed", basename: "Resource_Tree_Group_Cut" },
  quarry: { kind: "fixed", basename: "Mine" },
  gold_mine: { kind: "fixed", basename: "Mine" },
};

function clampLevel(level: number): number {
  if (!Number.isFinite(level) || level < 1) return 1;
  return Math.min(MAX_BUILDING_LEVEL, Math.floor(level));
}

/** True when the pack has any model mapped for this gameplay building id. */
export function hasBuildingArt(buildingId: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILDING_ART, buildingId);
}

/**
 * Resolve the mesh path for a building at a given age and level, or `null` when
 * the pack has no model for it (the caller then keeps a placeholder). Level is
 * clamped to the pack's 1..{@link MAX_BUILDING_LEVEL} range; `fixed` buildings
 * ignore age and level entirely.
 */
export function buildingMeshPath(buildingId: string, age: SettlementAge, level: number): string | null {
  const art = BUILDING_ART[buildingId];
  if (!art) return null;
  const basename = art.kind === "fixed"
    ? art.basename
    : art.basename(AGE_FAMILY[age], clampLevel(level));
  return `${STATIC_MESH_ROOT}/${basename}.gltf`;
}

/**
 * Every distinct mesh path the runtime may need across both ages and all
 * levels, for an eager boot-time preload. Deduplicated so `fixed` buildings and
 * shared meshes (Mine) load once.
 */
export function allBuildingMeshPaths(): string[] {
  const paths = new Set<string>();
  const ages: readonly SettlementAge[] = ["settlement", "town"];
  for (const buildingId of Object.keys(BUILDING_ART)) {
    for (const age of ages) {
      for (let level = 1; level <= MAX_BUILDING_LEVEL; level += 1) {
        const path = buildingMeshPath(buildingId, age, level);
        if (path) paths.add(path);
      }
    }
  }
  return [...paths];
}
