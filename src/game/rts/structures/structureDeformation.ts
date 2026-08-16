/**
 * Vertex-shader deformation for damaged and collapsing buildings.
 *
 * The husk animation in {@link PlacedStructureSystem} moves a building as one
 * rigid object: it shakes, then rotates about its base. That reads as a *prop
 * being knocked over* rather than as a building coming down, because nothing
 * about the shape changes — a stone keep tips at exactly the same angle, at
 * exactly the same rate, as the timber shed beside it.
 *
 * This module adds the missing half: the geometry itself squashes, splays at the
 * base, and buckles. It does so **entirely in the vertex shader**, driven by
 * uniforms, which is what makes it affordable here:
 *
 * - Building geometry is *shared*. `SkeletonUtils.clone` copies nodes but hands
 *   every instance of a type the same `BufferGeometry`, so twelve barracks have
 *   one. Writing vertices on the CPU would mean cloning ~2.5k–17k vertices per
 *   collapse and re-uploading them every frame; a uniform costs neither.
 * - Materials are *already* private by the time we deform. `beginCollapse` clones
 *   them so the husk can be charred without repainting live buildings, and the
 *   damage stages clone them so a wounded building can be tinted. Both clones are
 *   the natural place to hang a shader patch, so the deformation rides along on
 *   privacy work the system was doing anyway.
 * - Damage is reversible. Repair returns a building to full health, so heavy
 *   damage must be undoable — a uniform trivially is, an edited vertex buffer is
 *   not.
 *
 * What this deliberately cannot do is open holes, drop a roof as a separate
 * piece, or throw off real chunks: those need geometry-level authoring
 * (pre-fractured variants) rather than a displacement of the vertices that are
 * already there. See the VFX plan's backlog.
 */
import {
  Box3,
  Matrix4,
  Mesh,
  MeshDepthMaterial,
  RGBADepthPacking,
  Vector3,
  Vector4,
  type Material,
  type Object3D,
} from "three";

/**
 * How much of the shape a deformation may take, as fractions of the building's
 * own bounding box. Presentation tuning, so it lives beside the other collapse
 * constants in code rather than in `public/game-data/balance/` — nothing about
 * these numbers is a game rule, and no other system reads them.
 */
export interface StructureDeformationTuning {
  /** Fraction of total height removed at full progress. */
  readonly squash: number;
  /** Fraction of footprint radius pushed outward, strongest at the base. */
  readonly splay: number;
  /** Peak horizontal wander, in local units, strongest at the top. */
  readonly buckle: number;
}

/**
 * A live patch over one object's materials. Progress is the only thing that
 * moves; everything else was resolved when the patch was applied.
 */
export interface StructureDeformation {
  /** Drive the deformation, `0` (intact) to `1` (fully collapsed). */
  setProgress(progress: number): void;
  /** Release the depth materials this patch created. Idempotent. */
  dispose(): void;
}

/**
 * How the collapse is staggered through a building: by *height*, per vertex.
 *
 * This used to key off material names — `Wood*` gave way first and furthest,
 * `Stone*` last and least — which worked while every model was one mesh split
 * into one primitive per authored material. The pack is migrating to baked
 * single-material models (one texture, one slot, one draw call), and those carry
 * exactly one material named something like `material.007`. Every mesh landed in
 * the same group, so the stagger silently flattened into the uniform scale
 * animation this module exists to avoid.
 *
 * Height reproduces the old read without depending on authoring: the upper
 * structure — roof, frame, the parts that were the timber — gives way first and
 * furthest, and the lower mass lags and barely compresses. It also works on a
 * single mesh, because the ramp is evaluated per vertex in the shader rather
 * than per material on the CPU.
 *
 * `delay` is the fraction of the collapse a vertex waits before it starts
 * moving; `give` scales every amplitude. The endpoints are the old `timber` and
 * `masonry` responses, so a building that used to stagger still does, and the
 * midpoint of the ramp lands within a hair of the old middle group.
 *
 * Presentation tuning: retune freely, but keep `topGive` from growing without
 * checking that `squash * (2 * topGive - baseGive) < 1`. Past that the ramp
 * compresses the top harder than the height it has to travel and vertices pass
 * through each other.
 */
export const HEIGHT_RESPONSE = {
  baseDelay: 0.25,
  topDelay: 0,
  baseGive: 0.55,
  topGive: 1,
} as const;

/**
 * Largest `squash` the ramp can carry before the top of a building compresses
 * through the height beneath it. Derived rather than written down, so retuning
 * {@link HEIGHT_RESPONSE} moves the limit with it.
 */
export const MAX_SAFE_SQUASH = 1 / (2 * HEIGHT_RESPONSE.topGive - HEIGHT_RESPONSE.baseGive);

/** Uniform names are prefixed so a patched shader can never collide with three's own. */
const UNIFORM_PROGRESS = "rtsDeformProgress";
const UNIFORM_TO_ROOT = "rtsDeformToRoot";
const UNIFORM_FROM_ROOT = "rtsDeformFromRoot";
const UNIFORM_AMOUNT = "rtsDeformAmount";
const UNIFORM_SPAN = "rtsDeformSpan";
const UNIFORM_RESPONSE = "rtsDeformResponse";
const UNIFORM_SEED = "rtsDeformSeed";

/**
 * `customProgramCacheKey` contribution. The GLSL below is byte-identical for
 * every patched material — all the variation rides in uniforms — so one key is
 * correct and every husk in a siege shares a single compiled program.
 */
const CACHE_KEY = "rts-structure-deform";

/**
 * The vertex-shader preamble.
 *
 * Deformation happens in the *deforming root's* space, not the mesh's own: the
 * meshes sit at authored offsets under a scaled actor, so "height" and "outward
 * from the centre" are only meaningful once every vertex is expressed against
 * the same origin. The two matrices carry each mesh in and back out again.
 */
const VERTEX_PREAMBLE = /* glsl */ `
uniform float ${UNIFORM_PROGRESS};
uniform mat4 ${UNIFORM_TO_ROOT};
uniform mat4 ${UNIFORM_FROM_ROOT};
uniform vec3 ${UNIFORM_AMOUNT};
uniform vec2 ${UNIFORM_SPAN};
uniform vec4 ${UNIFORM_RESPONSE};
uniform float ${UNIFORM_SEED};

float rtsDeformHeight( vec3 rootPos ) {
	return clamp( ( rootPos.y - ${UNIFORM_SPAN}.x ) / max( ${UNIFORM_SPAN}.y, 0.0001 ), 0.0, 1.0 );
}

/**
 * Delay and give at one normalised height — base values at the ground, top
 * values at the eaves. This is the whole stagger: it is a ramp, not a lookup,
 * so it works on a building that is one mesh with one material.
 */
vec2 rtsDeformResponseAt( float h ) {
	return vec2(
		mix( ${UNIFORM_RESPONSE}.x, ${UNIFORM_RESPONSE}.y, h ),
		mix( ${UNIFORM_RESPONSE}.z, ${UNIFORM_RESPONSE}.w, h )
	);
}

float rtsDeformEased( float delay ) {
	return clamp( ( ${UNIFORM_PROGRESS} - delay ) / max( 1.0 - delay, 0.0001 ), 0.0, 1.0 );
}

/** Vertical compression and outward splay for one normalised height. */
vec2 rtsDeformScales( float p, float h, float give ) {
	float squashed = max( 1.0 - p * ${UNIFORM_AMOUNT}.x * give, 0.0001 );
	// Splay is biased low: a building folding in on itself bulges at the base,
	// where the mass ends up, rather than fanning out at the eaves.
	float splayed = 1.0 + p * ${UNIFORM_AMOUNT}.y * give * ( 0.35 + 0.65 * ( 1.0 - h ) );
	return vec2( splayed, squashed );
}

vec3 rtsDeformPosition( vec3 localPos ) {
	// Height has to be known before the ease can be, so the cheap early-out is
	// off raw progress rather than off the eased value it used to be.
	if ( ${UNIFORM_PROGRESS} <= 0.0 ) return localPos;
	vec3 rootPos = ( ${UNIFORM_TO_ROOT} * vec4( localPos, 1.0 ) ).xyz;
	float h = rtsDeformHeight( rootPos );
	vec2 response = rtsDeformResponseAt( h );
	float p = rtsDeformEased( response.x );
	if ( p <= 0.0 ) return localPos;
	vec2 scales = rtsDeformScales( p, h, response.y );
	rootPos.y = ${UNIFORM_SPAN}.x + ( rootPos.y - ${UNIFORM_SPAN}.x ) * scales.y;
	rootPos.xz *= scales.x;
	// Cheap per-vertex hash off the *undeformed* local position, so a vertex
	// wanders the same way for the whole animation instead of shimmering.
	float n1 = sin( dot( localPos, vec3( 12.9898, 78.233, 37.719 ) ) + ${UNIFORM_SEED} );
	float n2 = sin( dot( localPos, vec3( 39.346, 11.135, 83.155 ) ) + ${UNIFORM_SEED} * 1.7 );
	rootPos.xz += vec2( n1, n2 ) * ${UNIFORM_AMOUNT}.z * response.y * p * h;
	return ( ${UNIFORM_FROM_ROOT} * vec4( rootPos, 1.0 ) ).xyz;
}

/**
 * Normal for the squashed surface. Approximate on purpose: it applies the
 * inverse scale (the correct correction for the axis-aligned squash/splay) but
 * ignores the splay gradient and rotates with mat3 rather than a full
 * inverse-transpose. On a charred husk that lives under a second, the visible
 * job is only to stop flattened roof faces from lighting as if still pitched.
 */
vec3 rtsDeformNormal( vec3 localPos, vec3 localNormal ) {
	if ( ${UNIFORM_PROGRESS} <= 0.0 ) return localNormal;
	vec3 rootPos = ( ${UNIFORM_TO_ROOT} * vec4( localPos, 1.0 ) ).xyz;
	float h = rtsDeformHeight( rootPos );
	vec2 response = rtsDeformResponseAt( h );
	float p = rtsDeformEased( response.x );
	if ( p <= 0.0 ) return localNormal;
	vec2 scales = rtsDeformScales( p, h, response.y );
	vec3 rootNormal = mat3( ${UNIFORM_TO_ROOT} ) * localNormal;
	rootNormal = normalize( vec3( rootNormal.x / scales.x, rootNormal.y / scales.y, rootNormal.z / scales.x ) );
	return normalize( mat3( ${UNIFORM_FROM_ROOT} ) * rootNormal );
}
`;

/**
 * Anchors. three hands `onBeforeCompile` the shader with `#include` directives
 * still unexpanded, so we key off the raw includes rather than off text that
 * only exists after resolution — the same rule the reflection-capture patch
 * follows.
 */
const BEGIN_VERTEX_INCLUDE = "#include <begin_vertex>";
const BEGINNORMAL_VERTEX_INCLUDE = "#include <beginnormal_vertex>";
const MAIN_ANCHOR = "void main() {";

/** A `{ value }` box three reads every frame; shared per deformation, not per material. */
interface UniformRef<T> {
  value: T;
}

interface MeshPatch {
  readonly mesh: Mesh;
  /** Depth material we created for the shadow pass, or null if the mesh casts none. */
  readonly depthMaterial: MeshDepthMaterial | null;
  /** The mesh's own `customDepthMaterial` before we replaced it. */
  readonly previousDepthMaterial: Material | undefined;
}

/**
 * Patch every mesh under `root` so its vertices deform with the returned
 * handle's progress.
 *
 * **The materials under `root` must already be private to this object.** The
 * patch mutates them, and a shared GLTF material would carry the collapse of one
 * building onto every other building of its type. Both call sites clone first
 * for their own reasons; this function cannot check the precondition, so it is
 * stated here and pinned by an engine test.
 *
 * Returns `null` when there is nothing to deform (no meshes, or a degenerate
 * bounding box), so callers can treat "no deformation" as an ordinary outcome
 * rather than a failure.
 */
export function applyStructureDeformation(
  root: Object3D,
  tuning: StructureDeformationTuning,
  seed: number,
): StructureDeformation | null {
  root.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof Mesh) meshes.push(child);
  });
  if (meshes.length === 0) return null;

  const toRoot = new Matrix4().copy(root.matrixWorld).invert();
  const span = measureRootSpan(meshes, toRoot);
  if (!span) return null;

  // One box, shared by every material and depth material of this object. Two
  // husks must never end up pointing at the same box or they collapse in
  // lockstep — the classic failure of this pattern.
  const progress: UniformRef<number> = { value: 0 };
  const patches: MeshPatch[] = [];

  // Both are the same for every mesh of this building now that the stagger is a
  // height ramp the shader evaluates: only the two matrices still differ per
  // mesh, because only they depend on where the mesh sits under the root.
  const amount = new Vector3(tuning.squash, tuning.splay, tuning.buckle);
  const response = new Vector4(
    HEIGHT_RESPONSE.baseDelay,
    HEIGHT_RESPONSE.topDelay,
    HEIGHT_RESPONSE.baseGive,
    HEIGHT_RESPONSE.topGive,
  );

  for (const mesh of meshes) {
    const meshToRoot = new Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld);
    const meshFromRoot = new Matrix4().copy(meshToRoot).invert();
    for (const material of materialList(mesh.material)) {
      patchMaterial(material, progress, meshToRoot, meshFromRoot, amount, span, response, seed);
    }
    // The shadow pass renders through a separate depth material, so an unpatched
    // one leaves a collapsing building casting its original upright shadow. A
    // mesh that casts no shadow needs none of this.
    const previousDepthMaterial = mesh.customDepthMaterial;
    let depthMaterial: MeshDepthMaterial | null = null;
    if (mesh.castShadow) {
      depthMaterial = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
      patchMaterial(depthMaterial, progress, meshToRoot, meshFromRoot, amount, span, response, seed);
      mesh.customDepthMaterial = depthMaterial;
    }
    patches.push({ mesh, depthMaterial, previousDepthMaterial });
  }

  let disposed = false;
  return {
    setProgress(next: number): void {
      progress.value = Math.min(1, Math.max(0, next));
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const patch of patches) {
        if (!patch.depthMaterial) continue;
        // Restore rather than clear: another system may have installed one.
        patch.mesh.customDepthMaterial = patch.previousDepthMaterial;
        patch.depthMaterial.dispose();
      }
      patches.length = 0;
    },
  };
}

/**
 * Vertical extent of the whole object in root space, as `[baseY, height]`.
 *
 * Measured from geometry bounding boxes rather than `Box3.setFromObject` so a
 * shared geometry's cached box is reused instead of walking every vertex of
 * every building at the moment it dies.
 */
function measureRootSpan(meshes: readonly Mesh[], toRoot: Matrix4): { base: number; height: number } | null {
  const bounds = new Box3();
  const corner = new Vector3();
  const meshToRoot = new Matrix4();
  for (const mesh of meshes) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box) continue;
    meshToRoot.multiplyMatrices(toRoot, mesh.matrixWorld);
    for (let i = 0; i < 8; i += 1) {
      corner.set(
        (i & 1) === 0 ? box.min.x : box.max.x,
        (i & 2) === 0 ? box.min.y : box.max.y,
        (i & 4) === 0 ? box.min.z : box.max.z,
      );
      bounds.expandByPoint(corner.applyMatrix4(meshToRoot));
    }
  }
  if (bounds.isEmpty()) return null;
  const height = bounds.max.y - bounds.min.y;
  return height > 1e-4 ? { base: bounds.min.y, height } : null;
}

function materialList(material: Material | Material[]): readonly Material[] {
  return Array.isArray(material) ? material : [material];
}

function patchMaterial(
  material: Material,
  progress: UniformRef<number>,
  toRoot: Matrix4,
  fromRoot: Matrix4,
  amount: Vector3,
  span: { base: number; height: number },
  response: Vector4,
  seed: number,
): void {
  // Captured *before* reassignment, so the patch composes with anything already
  // on the material (the reflection-capture patch wraps materials the same way)
  // instead of silently replacing it.
  const previousCompile = material.onBeforeCompile.bind(material);
  const previousCacheKey = material.customProgramCacheKey.bind(material);

  material.onBeforeCompile = (shader, renderer) => {
    previousCompile(shader, renderer);
    shader.uniforms[UNIFORM_PROGRESS] = progress;
    shader.uniforms[UNIFORM_TO_ROOT] = { value: toRoot };
    shader.uniforms[UNIFORM_FROM_ROOT] = { value: fromRoot };
    shader.uniforms[UNIFORM_AMOUNT] = { value: amount };
    shader.uniforms[UNIFORM_SPAN] = { value: new Vector3(span.base, span.height, 0) };
    shader.uniforms[UNIFORM_RESPONSE] = { value: response };
    shader.uniforms[UNIFORM_SEED] = { value: seed };
    shader.vertexShader = shader.vertexShader.replace(MAIN_ANCHOR, `${VERTEX_PREAMBLE}\n${MAIN_ANCHOR}`);
    // Normals first: the depth material has no normal chunk, and patching an
    // absent include would silently do nothing anyway.
    if (shader.vertexShader.includes(BEGINNORMAL_VERTEX_INCLUDE)) {
      shader.vertexShader = shader.vertexShader.replace(
        BEGINNORMAL_VERTEX_INCLUDE,
        `${BEGINNORMAL_VERTEX_INCLUDE}\n\tobjectNormal = rtsDeformNormal( position, objectNormal );`,
      );
    }
    shader.vertexShader = shader.vertexShader.replace(
      BEGIN_VERTEX_INCLUDE,
      `${BEGIN_VERTEX_INCLUDE}\n\ttransformed = rtsDeformPosition( transformed );`,
    );
  };
  material.customProgramCacheKey = () => `${CACHE_KEY}|${previousCacheKey()}`;
  // These are fresh clones that have never been rendered, but a material that
  // *has* been keeps its compiled program until told otherwise.
  material.needsUpdate = true;
}
