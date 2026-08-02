/**
 * The player's fog overlay — Vertical Slice Plan v0.2 §59, GDD 08 §38–§40.
 *
 * One ground-sized surface carrying a {@link DataTexture} of one texel per vision
 * cell, not a mesh per cell. The territory overlay can afford per-cell meshes
 * because it only draws *owned* land; fog covers the whole 140×140 world, which
 * at the 2-unit grid is ~5k cells — 5k meshes rebuilt as the player scouts would
 * be exactly the cost §59's "görüş güncellemesi performans sorunu oluşturmuyor"
 * forbids. Here a refresh is a byte-array write plus one texture upload.
 *
 * The three §38 layers are drawn as alpha on a single black surface:
 *   unknown  → opaque      (a player sees nothing)
 *   explored → half        (terrain reads through; §40's remembered ground)
 *   visible  → clear
 *
 * Three things stand between that byte grid and something that looks like fog,
 * and each is a deliberate view-side choice that changes no gameplay:
 *
 *  - **The surface follows the terrain.** It used to be one flat quad at y=0.05,
 *    which any landscape taller than five centimetres simply stood through — the
 *    hill was lit while the ground around it was dark. It is now a subdivided
 *    plane built from the same ground height every other overlay uses
 *    ({@link setGroundHeightSampler}), and specifically from that terrain's
 *    *upper envelope*, so no triangle edge can pass beneath a bank it spans (see
 *    {@link sampleGroundEnvelope}). Rebuilt once when the terrain mounts rather
 *    than per frame.
 *  - **The alpha is blurred** before upload. `LinearFilter` alone interpolates a
 *    hard 0/128/255 step over one 2-unit texel, which reads as the square-edged
 *    frontier of an early-2000s RTS. A small separable gaussian over the cell
 *    values turns that into a several-metre gradient, and bilinear sampling then
 *    has something smooth to interpolate.
 *  - **The alpha eases over time.** A newly scouted cell fades in over a fraction
 *    of a second instead of popping. This is what stops a moving scout from
 *    stamping a hard-edged hole through the dark.
 *
 * All three live here on purpose. {@link VisionSystem}'s grid stays exactly
 * binary, so what the AI knows and what a unit can shoot are unchanged by how
 * soft the picture looks (`ai/aiVisionFilter.ts`, CLAUDE.md / TD-002).
 *
 * View only: it renders whatever {@link VisionSystem} resolved and never decides
 * what is visible. Units and structures are hidden by `fogVisibilityBinder.ts` —
 * a surface draped over the ground cannot occlude a 3D body, so object
 * visibility is a separate job.
 */
import {
  DataTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RGBAFormat,
  UnsignedByteType,
} from "three";

import type { UnitOwner } from "../units/unit";
import type { VisionSystem } from "./visionSystem";

/** Alpha applied to each §38 layer, as a 0–255 texel value. */
const UNKNOWN_ALPHA = 255;
const EXPLORED_ALPHA = 128;
const VISIBLE_ALPHA = 0;

/**
 * Gaussian blur radius, in cells. Two cells is four world units either side of a
 * frontier, so the transition band is about the width of a building — wide
 * enough to read as a gradient, narrow enough that ground the player can
 * actually see is not dimmed.
 */
const BLUR_RADIUS_CELLS = 2;

/**
 * Time constant of the reveal fade, in seconds. Short: this is edge softening in
 * time, not an animation. Anything slower would delay the moment a scout's find
 * becomes readable, which is information the player is owed immediately.
 */
const FADE_TIME_CONSTANT_SECONDS = 0.16;

/** World units between fog-surface vertices. */
const SURFACE_VERTEX_SPACING = 1;

/**
 * World units between terrain height samples, which is finer than the vertices
 * they feed. A Landscape is authored at sub-metre spacing (the shipped field is
 * 0.547), so a grid sampled at the vertex spacing would step straight over the
 * lip of a river bank and never know it was there.
 */
const HEIGHT_SAMPLE_SPACING = 0.5;

/**
 * Clearance above the sampled ground. Above the territory cells (0.022) and the
 * §58 objective rings (0.03), because fog has to hide the player's own control
 * overlay too — the shape of your territory would otherwise quietly map the
 * parts of the world you have never visited.
 */
const SURFACE_LIFT = 0.12;

/** The no-terrain sampler, compared by identity to keep the surface one quad. */
const FLAT_GROUND = (): number => 0;

export class FogView {
  readonly root = new Group();
  private readonly texture: DataTexture;
  private readonly data: Uint8Array;
  private readonly material: MeshBasicMaterial;
  private geometry: PlaneGeometry;
  private readonly mesh: Mesh;
  private readonly resolution: number;
  /** What the grid says right now, per cell, in 0–255 alpha. */
  private readonly target: Float32Array;
  /** What is being drawn, easing toward {@link target}. */
  private readonly eased: Float32Array;
  /** Row pass output; the column pass reads it. Reused, never allocated per frame. */
  private readonly blurScratch: Float32Array;
  private readonly blurred: Float32Array;
  private readonly blurKernel: Float32Array;
  /** False until the first refresh, which snaps rather than fades in from black. */
  private primed = false;
  private groundHeightAt: (x: number, z: number) => number = FLAT_GROUND;

  constructor(private readonly vision: VisionSystem, private readonly observer: UnitOwner) {
    this.root.name = "rts-fog-of-war";
    this.resolution = vision.gridResolution;
    const cells = this.resolution * this.resolution;
    this.data = new Uint8Array(cells * 4);
    // Start fully unknown so the very first frame is dark rather than a flash of
    // the whole map before the first refresh lands.
    this.data.fill(UNKNOWN_ALPHA);
    this.target = new Float32Array(cells).fill(UNKNOWN_ALPHA);
    this.eased = new Float32Array(cells).fill(UNKNOWN_ALPHA);
    this.blurScratch = new Float32Array(cells);
    this.blurred = new Float32Array(cells);
    this.blurKernel = gaussianKernel(BLUR_RADIUS_CELLS);

    // RGBA rather than a single red channel, despite only one value varying:
    // three's alphaMap shader samples the **green** channel
    // (`diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g`), so a RedFormat
    // texture reads as g=0 — alpha zero everywhere, and the fog renders
    // completely invisible while every unit test still passes. The value is
    // written to all four channels so the plane does not depend on which one
    // three decides to read.
    this.texture = new DataTexture(
      this.data,
      this.resolution,
      this.resolution,
      RGBAFormat,
      UnsignedByteType,
    );
    this.texture.magFilter = LinearFilter;
    this.texture.minFilter = LinearFilter;
    // The grid is stored row 0 = world -Z, but the plane is a PlaneGeometry
    // turned by `rotateX(-PI/2)`, which sends local +Y to world -Z — so with
    // DataTexture's default `flipY = false` the fog renders mirrored along Z.
    // The symptom is subtle and easy to misread as a vision bug: the revealed
    // circle appears at (-38, -38) while the base that earned it sits at
    // (-38, +38), so the player's own town is fogged and an empty corner is
    // clear. Every unit test still passes, because the grid itself is correct.
    this.texture.flipY = true;
    this.texture.needsUpdate = true;

    this.material = new MeshBasicMaterial({
      color: 0x05070b,
      transparent: true,
      depthWrite: false,
      alphaMap: this.texture,
      // The surface is draped a hand's width over the ground it is sampled from;
      // the offset keeps that clearance from being lost to depth precision when
      // the camera is pulled far back.
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    this.geometry = this.createSurfaceGeometry();
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = "rts-fog-plane";
    // Y now comes from the vertices, so the mesh itself sits at the origin.
    this.mesh.position.set(0, 0, 0);
    this.mesh.renderOrder = 4;
    // A surface that follows the terrain is no longer a screen-aligned quad, and
    // three's bounding sphere for it is a poor fit at glancing camera angles;
    // the fog covers the whole field and is one draw call, so culling it buys
    // nothing and getting it wrong blanks the overlay at the map edge.
    this.mesh.frustumCulled = false;
    this.root.add(this.mesh);
  }

  /**
   * Drape the surface over the authored terrain.
   *
   * Called by `RtsApp` at the same point the territory overlay and the unit
   * grounding get their sampler — once, when a Level's Landscape has mounted.
   * Re-callable: the geometry is rebuilt from scratch, so a second Level does not
   * inherit the first one's hills.
   */
  setGroundHeightSampler(sample: (x: number, z: number) => number): void {
    this.groundHeightAt = sample;
    const rebuilt = this.createSurfaceGeometry();
    this.mesh.geometry = rebuilt;
    this.geometry.dispose();
    this.geometry = rebuilt;
  }

  /**
   * Re-read the vision grid into the target alpha.
   *
   * Called every simulation tick. Deliberately does no texture work: what the
   * grid says is a simulation fact, while how far the picture has caught up with
   * it is presentation, and {@link advance} owns that on the rendered delta.
   */
  refresh(): void {
    const { visible, explored } = this.vision.visibilityGrid(this.observer);
    const cells = visible.length;
    for (let cell = 0; cell < cells; cell += 1) {
      this.target[cell] = visible[cell]
        ? VISIBLE_ALPHA
        : explored[cell] ? EXPLORED_ALPHA : UNKNOWN_ALPHA;
    }
    if (!this.primed) {
      // The opening position is not a reveal. Fading the player's own base in
      // from black on the start screen would announce a discovery they did not
      // make, and would be on screen for the whole time the card is up.
      this.eased.set(this.target);
      this.primed = true;
      this.publish();
    }
  }

  /**
   * Ease the drawn alpha toward the target and upload it.
   *
   * Called once per rendered frame, on the rendered delta rather than the
   * simulation's: like a health bar, the softness of a frontier should look the
   * same at any game speed, and §38's 8x test speed must not turn the fade into
   * a pop.
   */
  advance(deltaSeconds: number): void {
    if (!this.primed) return;
    // Exponential rather than linear so the rate is frame-rate independent: the
    // same reveal takes the same wall-clock time at 30fps and at 144.
    const blend =
      Number.isFinite(deltaSeconds) && deltaSeconds > 0
        ? 1 - Math.exp(-deltaSeconds / FADE_TIME_CONSTANT_SECONDS)
        : 1;
    const cells = this.eased.length;
    for (let cell = 0; cell < cells; cell += 1) {
      const from = this.eased[cell]!;
      const to = this.target[cell]!;
      const next = from + (to - from) * blend;
      // Snap once the remainder is below a texel step, or a cell asymptotes
      // forever a fraction of a level away from clear and every frame keeps
      // re-uploading the same picture.
      this.eased[cell] = Math.abs(to - next) < 0.5 ? to : next;
    }
    this.publish();
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    this.geometry.dispose();
    this.root.clear();
  }

  /** Blur the eased alpha into the texture bytes and hand it to the GPU. */
  private publish(): void {
    this.blur();
    const cells = this.blurred.length;
    for (let cell = 0; cell < cells; cell += 1) {
      const alpha = this.blurred[cell]!;
      const texel = cell * 4;
      const value = alpha < 0 ? 0 : alpha > 255 ? 255 : alpha;
      this.data[texel] = value;
      this.data[texel + 1] = value;
      this.data[texel + 2] = value;
      this.data[texel + 3] = value;
    }
    this.texture.needsUpdate = true;
  }

  /**
   * Separable gaussian over the cell grid: a row pass into the scratch buffer,
   * then a column pass out of it. Separable because the 2D form of this kernel
   * costs (2r+1)² samples per cell and this one costs 2(2r+1) — at ~5k cells the
   * difference is the whole reason a blur is affordable per frame at all.
   *
   * Samples are clamped at the edges rather than wrapped, so the map border does
   * not bleed the far side of the world into it.
   */
  private blur(): void {
    const size = this.resolution;
    const kernel = this.blurKernel;
    const radius = BLUR_RADIUS_CELLS;
    for (let row = 0; row < size; row += 1) {
      const rowStart = row * size;
      for (let col = 0; col < size; col += 1) {
        let sum = 0;
        for (let offset = -radius; offset <= radius; offset += 1) {
          const sampleCol = clampIndex(col + offset, size);
          sum += this.eased[rowStart + sampleCol]! * kernel[offset + radius]!;
        }
        this.blurScratch[rowStart + col] = sum;
      }
    }
    for (let col = 0; col < size; col += 1) {
      for (let row = 0; row < size; row += 1) {
        let sum = 0;
        for (let offset = -radius; offset <= radius; offset += 1) {
          const sampleRow = clampIndex(row + offset, size);
          sum += this.blurScratch[sampleRow * size + col]! * kernel[offset + radius]!;
        }
        this.blurred[row * size + col] = sum;
      }
    }
  }

  /**
   * A subdivided plane spanning the grid, with each vertex dropped onto the
   * ground sampler.
   *
   * The span is `resolution * cellSize`, not `worldHalfExtent * 2`. Those differ
   * by one cell — the grid carries a cell *centred* on each extreme, so it
   * reaches half a cell past the half extent in both directions — and sizing the
   * quad to the half extent put every texel about half a cell off its own ground.
   * Small, but it is a systematic offset of the whole fog against the world.
   */
  private createSurfaceGeometry(): PlaneGeometry {
    const { cellSize } = this.vision.gridOptions;
    const span = this.resolution * cellSize;
    // Flat until a Landscape mounts: a level with no terrain — and the moment
    // before one has loaded — needs one quad's worth of geometry, not a few
    // hundred thousand samples of a function that answers zero.
    const segments = this.groundHeightAt === FLAT_GROUND
      ? 1
      : Math.max(1, Math.round(span / SURFACE_VERTEX_SPACING));
    const heights = segments === 1 ? null : this.sampleGroundEnvelope(span);
    const geometry = new PlaneGeometry(span, span, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position!;
    if (!heights) {
      for (let index = 0; index < position.count; index += 1) {
        position.setY(index, SURFACE_LIFT);
      }
      position.needsUpdate = true;
      geometry.computeBoundingSphere();
      return geometry;
    }
    // Looked up by world position rather than by vertex index: `PlaneGeometry`'s
    // ordering plus the `rotateX` is exactly the kind of reasoning that produced
    // the mirrored-fog bug the texture comment above records.
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const z = position.getZ(index);
      position.setY(index, heights.sample(x, z) + SURFACE_LIFT);
    }
    position.needsUpdate = true;
    geometry.computeBoundingSphere();
    return geometry;
  }

  /**
   * The terrain's *upper envelope* at vertex resolution — every sample raised to
   * the highest ground within one vertex spacing of it.
   *
   * Sampling the ground directly at each vertex is not enough, and the failure is
   * the one this whole surface exists to fix. A triangle edge is a straight chord
   * between two samples, and a chord passes *under* anything that rises between
   * them: along a river bank, where the Landscape drops several units inside a
   * metre, the fog sank into the slope and the bank stood through it in a bright
   * ribbon tracing the water — dark map, lit shoreline.
   *
   * Dilating by one full vertex spacing is what makes that impossible rather than
   * unlikely. Every point on an edge lies within one spacing of *both* of its
   * endpoints, so both endpoints have already seen it and neither can be below
   * it. The cost is that the surface bridges a narrow gully instead of dipping
   * into it — from an RTS camera, looking down at an opaque veil, that is not
   * something the player can see, and the alternative is terrain punching holes
   * in the fog.
   *
   * Built once per terrain mount. The sample count is high (a few hundred
   * thousand) but it is paid while the Level is still loading behind the start
   * card, and never again.
   */
  private sampleGroundEnvelope(span: number): GroundEnvelope {
    const size = Math.max(2, Math.round(span / HEIGHT_SAMPLE_SPACING) + 1);
    const step = span / (size - 1);
    const origin = -span / 2;
    const raw = new Float32Array(size * size);
    for (let row = 0; row < size; row += 1) {
      const z = origin + row * step;
      for (let col = 0; col < size; col += 1) {
        raw[row * size + col] = this.groundHeightAt(origin + col * step, z);
      }
    }
    // Separable max: rows into a scratch buffer, then columns out of it. The 2D
    // window costs (2r+1)² samples per cell and this costs 2(2r+1), which is what
    // keeps a dilation over a few hundred thousand samples a non-event.
    const radius = Math.max(1, Math.ceil(SURFACE_VERTEX_SPACING / step));
    const rows = new Float32Array(size * size);
    for (let row = 0; row < size; row += 1) {
      const rowStart = row * size;
      for (let col = 0; col < size; col += 1) {
        let peak = -Infinity;
        for (let offset = -radius; offset <= radius; offset += 1) {
          const value = raw[rowStart + clampIndex(col + offset, size)]!;
          if (value > peak) peak = value;
        }
        rows[rowStart + col] = peak;
      }
    }
    const envelope = new Float32Array(size * size);
    for (let col = 0; col < size; col += 1) {
      for (let row = 0; row < size; row += 1) {
        let peak = -Infinity;
        for (let offset = -radius; offset <= radius; offset += 1) {
          const value = rows[clampIndex(row + offset, size) * size + col]!;
          if (value > peak) peak = value;
        }
        envelope[row * size + col] = peak;
      }
    }
    return {
      sample: (x, z) => {
        const col = clampIndex(Math.round((x - origin) / step), size);
        const row = clampIndex(Math.round((z - origin) / step), size);
        return envelope[row * size + col]!;
      },
    };
  }
}

/** The dilated ground heightfield the surface geometry is built from. */
interface GroundEnvelope {
  sample(x: number, z: number): number;
}

/** Normalized 1D gaussian weights for offsets -radius..+radius. */
function gaussianKernel(radius: number): Float32Array {
  const sigma = Math.max(radius, 1) / 2;
  const weights = new Float32Array(radius * 2 + 1);
  let total = 0;
  for (let offset = -radius; offset <= radius; offset += 1) {
    const weight = Math.exp(-(offset * offset) / (2 * sigma * sigma));
    weights[offset + radius] = weight;
    total += weight;
  }
  for (let i = 0; i < weights.length; i += 1) weights[i]! /= total;
  return weights;
}

function clampIndex(value: number, size: number): number {
  return value < 0 ? 0 : value >= size ? size - 1 : value;
}
