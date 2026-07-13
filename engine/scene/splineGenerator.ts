import type { LayoutSplineActor, Vec3 } from "./layout";
import { buildSplineCurveCache, evaluateSplineSegment } from "./splineCurve";
import { getSplineTransformAtDistance, type Quat } from "./splineFrame";

/** Generator data shared by editor previews and runtime rendering (Faz 7). */
export interface ForgeSplineGeneratorBase {
  id: string;
  enabled?: boolean;
  /** Show this generator in editor mode. Absent means true. */
  previewEnabled?: boolean;
  /** Generate this output when the level is played. Absent means true. */
  runtimeEnabled?: boolean;
}

export interface ForgeSplineInstanceGeneratorDef extends ForgeSplineGeneratorBase {
  type: "instances";
  /** Manifest model asset id. An empty value is an intentionally unconfigured generator. */
  meshAsset: string;
  spacing: number;
  startOffset?: number;
  endOffset?: number;
  alignToSpline?: boolean;
  applyPitch?: boolean;
  applyRoll?: boolean;
  lateralOffset?: number;
  verticalOffset?: number;
  rotationOffset?: Vec3;
  scale?: Vec3;
  seed?: number;
  random?: {
    positionJitter?: Vec3;
    rotationJitter?: Vec3;
    scaleMin?: number;
    scaleMax?: number;
  };
  placementMode?: "distance" | "point";
  includeEndPoint?: boolean;
  collision?: boolean;
}

/**
 * Repeats a rigid, +Z-authored modular mesh along the spline. Unlike the
 * instance generator this preserves a panel's straight geometry; fit modes
 * only change the final panel scale/spacing, never bend it around corners.
 */
export interface ForgeSplineRigidSegmentGeneratorDef extends ForgeSplineGeneratorBase {
  type: "rigidSegments";
  meshAsset: string;
  segmentLength: number;
  fitMode?: "fixed" | "stretchLast" | "distribute";
  alignToSpline?: boolean;
  rotationOffset?: Vec3;
  scale?: Vec3;
  gap?: number;
  placePostsAtJoints?: boolean;
  jointMeshAsset?: string;
}

/** Signed local mesh axes accepted by the deform-mesh generator. */
export type SplineMeshAxis = "x" | "y" | "z" | "-x" | "-y" | "-z";

/**
 * Bends one source mesh continuously along the owning spline. The source mesh
 * is normalized from its declared forward axis, so an authored road, pipe or
 * cable can use any conventional local orientation.
 */
export interface ForgeSplineDeformMeshGeneratorDef extends ForgeSplineGeneratorBase {
  type: "deformMesh";
  meshAsset: string;
  forwardAxis?: SplineMeshAxis;
  upAxis?: SplineMeshAxis;
  sampleSteps?: number;
  /** Segment chunks permit incremental editor rebuilds for long splines. */
  geometryMode?: "whole" | "segments";
  /** Opt-in static trimesh collision for this generated runtime mesh. */
  collisionEnabled?: boolean;
  uvMode?: "stretch" | "tileByDistance";
  uvTileLength?: number;
  lateralOffset?: number;
  verticalOffset?: number;
  /** Cross-section scale (right, up); spline point scale is applied afterwards. */
  crossSectionScale?: [number, number];
}

export type ForgeSplineGeneratorDef = ForgeSplineInstanceGeneratorDef | ForgeSplineRigidSegmentGeneratorDef | ForgeSplineDeformMeshGeneratorDef;
export type ForgeSplineGeneratorType = ForgeSplineGeneratorDef["type"];

/** Extensible registry boundary for subsequent generator types (rigid/deform/custom). */
export interface ForgeSplineGeneratorHandler {
  type: ForgeSplineGeneratorType;
  normalize: (value: unknown, usedIds: ReadonlySet<string>) => ForgeSplineGeneratorDef | null;
}

export class SplineGeneratorRegistry {
  private readonly handlers = new Map<ForgeSplineGeneratorType, ForgeSplineGeneratorHandler>();

  register(handler: ForgeSplineGeneratorHandler): void {
    this.handlers.set(handler.type, handler);
  }

  types(): ForgeSplineGeneratorType[] {
    return [...this.handlers.keys()];
  }

  normalize(value: unknown, usedIds: ReadonlySet<string> = new Set()): ForgeSplineGeneratorDef | null {
    if (!isRecord(value) || typeof value.type !== "string") return null;
    return this.handlers.get(value.type as ForgeSplineGeneratorType)?.normalize(value, usedIds) ?? null;
  }
}
export interface ResolvedSplineInstanceGeneratorDef extends Omit<ForgeSplineInstanceGeneratorDef, "random" | "rotationOffset" | "scale" | "startOffset" | "endOffset" | "enabled" | "previewEnabled" | "runtimeEnabled" | "alignToSpline" | "applyPitch" | "applyRoll" | "lateralOffset" | "verticalOffset" | "seed" | "placementMode" | "includeEndPoint" | "collision"> {
  enabled: boolean;
  previewEnabled: boolean;
  runtimeEnabled: boolean;
  alignToSpline: boolean;
  applyPitch: boolean;
  applyRoll: boolean;
  startOffset: number;
  endOffset: number;
  lateralOffset: number;
  verticalOffset: number;
  seed: number;
  placementMode: "distance" | "point";
  includeEndPoint: boolean;
  collision: boolean;
  rotationOffset: Vec3;
  scale: Vec3;
  random: {
    positionJitter: Vec3;
    rotationJitter: Vec3;
    scaleMin: number;
    scaleMax: number;
  };
}

export interface ResolvedSplineRigidSegmentGeneratorDef extends Omit<ForgeSplineRigidSegmentGeneratorDef, "enabled" | "previewEnabled" | "runtimeEnabled" | "fitMode" | "alignToSpline" | "rotationOffset" | "scale" | "gap" | "placePostsAtJoints"> {
  enabled: boolean;
  previewEnabled: boolean;
  runtimeEnabled: boolean;
  fitMode: "fixed" | "stretchLast" | "distribute";
  alignToSpline: boolean;
  rotationOffset: Vec3;
  scale: Vec3;
  gap: number;
  placePostsAtJoints: boolean;
}

export interface ResolvedSplineDeformMeshGeneratorDef extends Omit<ForgeSplineDeformMeshGeneratorDef, "enabled" | "previewEnabled" | "runtimeEnabled" | "forwardAxis" | "upAxis" | "sampleSteps" | "geometryMode" | "collisionEnabled" | "uvMode" | "uvTileLength" | "lateralOffset" | "verticalOffset" | "crossSectionScale"> {
  enabled: boolean;
  previewEnabled: boolean;
  runtimeEnabled: boolean;
  forwardAxis: SplineMeshAxis;
  upAxis: SplineMeshAxis;
  sampleSteps: number;
  geometryMode: "whole" | "segments";
  collisionEnabled: boolean;
  uvMode: "stretch" | "tileByDistance";
  uvTileLength: number;
  lateralOffset: number;
  verticalOffset: number;
  crossSectionScale: [number, number];
}

export interface SplineGeneratedInstance {
  generatorId: string;
  assetId: string;
  /** Arc-length distance in the owning actor's local spline space. */
  distance: number;
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
}

export const SPLINE_GENERATOR_MAX_INSTANCES = 10000;
const MIN_SPACING = 0.01;
const MAX_OFFSET = 100000;

/** Normalizes untrusted generator JSON without mutating the source layout. */
export function normalizeSplineGenerators(value: unknown): ForgeSplineGeneratorDef[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  const result: ForgeSplineGeneratorDef[] = [];
  for (const raw of value) {
    const generator = DEFAULT_SPLINE_GENERATOR_REGISTRY.normalize(raw, used);
    if (!generator) continue;
    used.add(generator.id);
    result.push(generator);
  }
  return result;
}

export function normalizeSplineGenerator(
  value: unknown,
  usedIds: ReadonlySet<string> = new Set(),
): ForgeSplineGeneratorDef | null {
  if (!isRecord(value) || value.type !== "instances") return null;
  const id = uniqueGeneratorId(typeof value.id === "string" ? value.id.trim() : "", usedIds);
  const output: ForgeSplineInstanceGeneratorDef = {
    id,
    type: "instances",
    meshAsset: typeof value.meshAsset === "string" ? value.meshAsset.trim() : "",
    spacing: positiveNumber(value.spacing, 1),
  };
  for (const key of ["enabled", "previewEnabled", "runtimeEnabled", "alignToSpline", "applyPitch", "applyRoll", "includeEndPoint", "collision"] as const) {
    if (typeof value[key] === "boolean") output[key] = value[key];
  }
  for (const key of ["startOffset", "endOffset", "lateralOffset", "verticalOffset"] as const) {
    if (isFiniteNumber(value[key])) output[key] = clamp(value[key], -MAX_OFFSET, MAX_OFFSET);
  }
  const rotationOffset = finiteVec3(value.rotationOffset);
  if (rotationOffset) output.rotationOffset = rotationOffset;
  const scale = positiveVec3(value.scale);
  if (scale) output.scale = scale;
  if (isFiniteNumber(value.seed)) output.seed = Math.trunc(value.seed);
  if (value.placementMode === "distance" || value.placementMode === "point") output.placementMode = value.placementMode;
  if (isRecord(value.random)) {
    const random: NonNullable<ForgeSplineInstanceGeneratorDef["random"]> = {};
    const positionJitter = finiteVec3(value.random.positionJitter);
    const rotationJitter = finiteVec3(value.random.rotationJitter);
    if (positionJitter) random.positionJitter = positionJitter;
    if (rotationJitter) random.rotationJitter = rotationJitter;
    if (isFiniteNumber(value.random.scaleMin)) random.scaleMin = clamp(value.random.scaleMin, 0.001, 1000);
    if (isFiniteNumber(value.random.scaleMax)) random.scaleMax = clamp(value.random.scaleMax, 0.001, 1000);
    if (Object.keys(random).length > 0) output.random = random;
  }
  return output;
}

export function normalizeSplineRigidSegmentGenerator(
  value: unknown,
  usedIds: ReadonlySet<string> = new Set(),
): ForgeSplineRigidSegmentGeneratorDef | null {
  if (!isRecord(value) || value.type !== "rigidSegments") return null;
  const id = uniqueGeneratorId(typeof value.id === "string" ? value.id.trim() : "", usedIds);
  const output: ForgeSplineRigidSegmentGeneratorDef = {
    id,
    type: "rigidSegments",
    meshAsset: typeof value.meshAsset === "string" ? value.meshAsset.trim() : "",
    segmentLength: positiveNumber(value.segmentLength, 1),
  };
  for (const key of ["enabled", "previewEnabled", "runtimeEnabled", "alignToSpline", "placePostsAtJoints"] as const) {
    if (typeof value[key] === "boolean") output[key] = value[key];
  }
  if (value.fitMode === "fixed" || value.fitMode === "stretchLast" || value.fitMode === "distribute") output.fitMode = value.fitMode;
  const rotationOffset = finiteVec3(value.rotationOffset);
  if (rotationOffset) output.rotationOffset = rotationOffset;
  const scale = positiveVec3(value.scale);
  if (scale) output.scale = scale;
  if (isFiniteNumber(value.gap)) output.gap = clamp(value.gap, 0, MAX_OFFSET);
  if (typeof value.jointMeshAsset === "string") output.jointMeshAsset = value.jointMeshAsset.trim();
  return output;
}

export function normalizeSplineDeformMeshGenerator(
  value: unknown,
  usedIds: ReadonlySet<string> = new Set(),
): ForgeSplineDeformMeshGeneratorDef | null {
  if (!isRecord(value) || value.type !== "deformMesh") return null;
  const id = uniqueGeneratorId(typeof value.id === "string" ? value.id.trim() : "", usedIds);
  const output: ForgeSplineDeformMeshGeneratorDef = {
    id,
    type: "deformMesh",
    meshAsset: typeof value.meshAsset === "string" ? value.meshAsset.trim() : "",
  };
  for (const key of ["enabled", "previewEnabled", "runtimeEnabled", "collisionEnabled"] as const) {
    if (typeof value[key] === "boolean") output[key] = value[key];
  }
  if (isSplineMeshAxis(value.forwardAxis)) output.forwardAxis = value.forwardAxis;
  if (isSplineMeshAxis(value.upAxis)) output.upAxis = value.upAxis;
  if (isFiniteNumber(value.sampleSteps)) output.sampleSteps = Math.round(clamp(value.sampleSteps, 2, 128));
  if (value.geometryMode === "whole" || value.geometryMode === "segments") output.geometryMode = value.geometryMode;
  if (value.uvMode === "stretch" || value.uvMode === "tileByDistance") output.uvMode = value.uvMode;
  if (isFiniteNumber(value.uvTileLength)) output.uvTileLength = clamp(value.uvTileLength, MIN_SPACING, MAX_OFFSET);
  for (const key of ["lateralOffset", "verticalOffset"] as const) {
    if (isFiniteNumber(value[key])) output[key] = clamp(value[key], -MAX_OFFSET, MAX_OFFSET);
  }
  if (Array.isArray(value.crossSectionScale) && value.crossSectionScale.length === 2 && value.crossSectionScale.every(isFiniteNumber)) {
    output.crossSectionScale = [clamp(value.crossSectionScale[0]!, 0.001, 1000), clamp(value.crossSectionScale[1]!, 0.001, 1000)];
  }
  return output;
}

/** Built-in registration is deliberately small; later phases append new handlers here. */
export const DEFAULT_SPLINE_GENERATOR_REGISTRY = new SplineGeneratorRegistry();
DEFAULT_SPLINE_GENERATOR_REGISTRY.register({ type: "instances", normalize: normalizeSplineGenerator });
DEFAULT_SPLINE_GENERATOR_REGISTRY.register({ type: "rigidSegments", normalize: normalizeSplineRigidSegmentGenerator });
DEFAULT_SPLINE_GENERATOR_REGISTRY.register({ type: "deformMesh", normalize: normalizeSplineDeformMeshGenerator });

export function resolveSplineInstanceGenerator(
  value: ForgeSplineInstanceGeneratorDef,
): ResolvedSplineInstanceGeneratorDef {
  const normalized = normalizeSplineGenerator(value);
  const generator = normalized && normalized.type === "instances" ? normalized : createDefaultSplineInstanceGenerator();
  const random = generator.random ?? {};
  const scaleMin = random.scaleMin ?? 1;
  const scaleMax = random.scaleMax ?? 1;
  return {
    ...generator,
    enabled: generator.enabled ?? true,
    previewEnabled: generator.previewEnabled ?? true,
    runtimeEnabled: generator.runtimeEnabled ?? true,
    alignToSpline: generator.alignToSpline ?? true,
    applyPitch: generator.applyPitch ?? true,
    applyRoll: generator.applyRoll ?? true,
    startOffset: generator.startOffset ?? 0,
    endOffset: generator.endOffset ?? 0,
    lateralOffset: generator.lateralOffset ?? 0,
    verticalOffset: generator.verticalOffset ?? 0,
    rotationOffset: generator.rotationOffset ?? [0, 0, 0],
    scale: generator.scale ?? [1, 1, 1],
    seed: generator.seed ?? 0,
    placementMode: generator.placementMode ?? "distance",
    includeEndPoint: generator.includeEndPoint ?? false,
    collision: generator.collision ?? false,
    random: {
      positionJitter: random.positionJitter ?? [0, 0, 0],
      rotationJitter: random.rotationJitter ?? [0, 0, 0],
      scaleMin: Math.min(scaleMin, scaleMax),
      scaleMax: Math.max(scaleMin, scaleMax),
    },
  };
}

export function createDefaultSplineInstanceGenerator(
  existing: readonly ForgeSplineGeneratorDef[] = [],
): ForgeSplineInstanceGeneratorDef {
  const ids = new Set(existing.map((generator) => generator.id));
  return { id: uniqueGeneratorId("instances", ids), type: "instances", meshAsset: "", spacing: 2 };
}

export function resolveSplineRigidSegmentGenerator(
  value: ForgeSplineRigidSegmentGeneratorDef,
): ResolvedSplineRigidSegmentGeneratorDef {
  const normalized = normalizeSplineRigidSegmentGenerator(value);
  const generator = normalized && normalized.type === "rigidSegments" ? normalized : createDefaultSplineRigidSegmentGenerator();
  return {
    ...generator,
    enabled: generator.enabled ?? true,
    previewEnabled: generator.previewEnabled ?? true,
    runtimeEnabled: generator.runtimeEnabled ?? true,
    fitMode: generator.fitMode ?? "fixed",
    alignToSpline: generator.alignToSpline ?? true,
    rotationOffset: generator.rotationOffset ?? [0, 0, 0],
    scale: generator.scale ?? [1, 1, 1],
    gap: generator.gap ?? 0,
    placePostsAtJoints: generator.placePostsAtJoints ?? false,
  };
}

export function createDefaultSplineRigidSegmentGenerator(
  existing: readonly ForgeSplineGeneratorDef[] = [],
): ForgeSplineRigidSegmentGeneratorDef {
  const ids = new Set(existing.map((generator) => generator.id));
  return { id: uniqueGeneratorId("rigid-segments", ids), type: "rigidSegments", meshAsset: "", segmentLength: 2 };
}

export function resolveSplineDeformMeshGenerator(
  value: ForgeSplineDeformMeshGeneratorDef,
): ResolvedSplineDeformMeshGeneratorDef {
  const normalized = normalizeSplineDeformMeshGenerator(value);
  const generator = normalized && normalized.type === "deformMesh" ? normalized : createDefaultSplineDeformMeshGenerator();
  const forwardAxis = generator.forwardAxis ?? "z";
  const upAxis = generator.upAxis && !sameMeshAxis(generator.upAxis, forwardAxis) ? generator.upAxis : "y";
  return {
    ...generator,
    enabled: generator.enabled ?? true,
    previewEnabled: generator.previewEnabled ?? true,
    runtimeEnabled: generator.runtimeEnabled ?? true,
    forwardAxis,
    upAxis,
    sampleSteps: generator.sampleSteps ?? 16,
    geometryMode: generator.geometryMode ?? "segments",
    collisionEnabled: generator.collisionEnabled ?? false,
    uvMode: generator.uvMode ?? "stretch",
    uvTileLength: generator.uvTileLength ?? 1,
    lateralOffset: generator.lateralOffset ?? 0,
    verticalOffset: generator.verticalOffset ?? 0,
    crossSectionScale: generator.crossSectionScale ?? [1, 1],
  };
}

export function createDefaultSplineDeformMeshGenerator(
  existing: readonly ForgeSplineGeneratorDef[] = [],
): ForgeSplineDeformMeshGeneratorDef {
  const ids = new Set(existing.map((generator) => generator.id));
  return { id: uniqueGeneratorId("deform-mesh", ids), type: "deformMesh", meshAsset: "" };
}

/** Presentation-only warnings; they are safe to show in editor and runtime diagnostics. */
export function splineDeformMeshWarnings(definition: ForgeSplineDeformMeshGeneratorDef): string[] {
  const generator = resolveSplineDeformMeshGenerator(definition);
  const warnings: string[] = [];
  if (definition.upAxis && sameMeshAxis(definition.forwardAxis ?? "z", definition.upAxis)) {
    warnings.push("Forward and up axes use the same dimension; +Y is used as the safe up-axis fallback.");
  }
  if (generator.sampleSteps >= 64) warnings.push("High deform sample count can make interactive rebuilds expensive.");
  return warnings;
}

/**
 * Generates deterministic world-space placements. It is renderer-independent so
 * both shells can use exactly the same preview/runtime transforms.
 */
export function generateSplineInstancePlacements(
  actor: LayoutSplineActor,
  definition: ForgeSplineInstanceGeneratorDef,
): SplineGeneratedInstance[] {
  const generator = resolveSplineInstanceGenerator(definition);
  if (!generator.enabled || !generator.meshAsset) return [];
  const cache = buildSplineCurveCache(actor.spline);
  if (cache.totalLength <= 1e-8 || cache.segments.length === 0) return [];
  const distances = generator.placementMode === "point"
    ? cache.segments.map((segment) => segment.startDistance)
    : distancePlacements(cache.totalLength, cache.spline.closed, generator);
  return distances.slice(0, SPLINE_GENERATOR_MAX_INSTANCES).map((distance, index) => {
    const transform = getSplineTransformAtDistance(cache, distance, "world", actor);
    const frame = transform.frame;
    const random = new SeededRandom(hashSeed(generator.seed, generator.id, index));
    const jitter = generator.random.positionJitter;
    const position: Vec3 = [
      transform.position[0] + frame.binormal[0] * (generator.lateralOffset + signed(random) * jitter[0]) + frame.normal[0] * (generator.verticalOffset + signed(random) * jitter[1]) + frame.tangent[0] * signed(random) * jitter[2],
      transform.position[1] + frame.binormal[1] * (generator.lateralOffset + signed(random) * jitter[0]) + frame.normal[1] * (generator.verticalOffset + signed(random) * jitter[1]) + frame.tangent[1] * signed(random) * jitter[2],
      transform.position[2] + frame.binormal[2] * (generator.lateralOffset + signed(random) * jitter[0]) + frame.normal[2] * (generator.verticalOffset + signed(random) * jitter[1]) + frame.tangent[2] * signed(random) * jitter[2],
    ];
    const rotationJitter = generator.random.rotationJitter;
    const offset: Vec3 = [
      generator.rotationOffset[0] + signed(random) * rotationJitter[0],
      generator.rotationOffset[1] + signed(random) * rotationJitter[1],
      generator.rotationOffset[2] + signed(random) * rotationJitter[2],
    ];
    const rotation = multiplyQuat(
      generator.alignToSpline ? filteredFrameRotation(frame.rotation, frame, generator) : [0, 0, 0, 1],
      quatFromEulerDegrees(offset),
    );
    const scaleFactor = lerp(generator.random.scaleMin, generator.random.scaleMax, random.next());
    return {
      generatorId: generator.id,
      assetId: generator.meshAsset,
      distance,
      position,
      rotation,
      scale: [generator.scale[0] * frame.scale[0] * scaleFactor, generator.scale[1] * frame.scale[1] * scaleFactor, generator.scale[2] * scaleFactor],
    };
  });
}

/**
 * Generates straight modular panel transforms. Meshes are authored along local
 * +Z; stretchLast scales only that forward axis. `distribute` retains the
 * nominal panel size and spreads the count uniformly across the available arc.
 */
export function generateSplineRigidSegmentPlacements(
  actor: LayoutSplineActor,
  definition: ForgeSplineRigidSegmentGeneratorDef,
): SplineGeneratedInstance[] {
  const generator = resolveSplineRigidSegmentGenerator(definition);
  if (!generator.enabled || !generator.meshAsset) return [];
  const cache = buildSplineCurveCache(actor.spline);
  if (cache.totalLength <= 1e-8 || cache.segments.length === 0) return [];
  const spans = rigidSegmentSpans(cache.totalLength, cache.spline.closed, generator);
  const placements = spans.map((span) => rigidPlacement(actor, cache, generator, span.distance, span.length));
  if (!generator.placePostsAtJoints || !generator.jointMeshAsset) return placements;
  const jointDistances = cache.segments.map((segment) => segment.startDistance);
  if (!cache.spline.closed) jointDistances.push(cache.totalLength);
  for (const distance of jointDistances) {
    const transform = getSplineTransformAtDistance(cache, distance, "world", actor);
    placements.push({
      generatorId: generator.id,
      assetId: generator.jointMeshAsset,
      distance,
      position: transform.position,
      rotation: multiplyQuat(generator.alignToSpline ? transform.rotation : [0, 0, 0, 1], quatFromEulerDegrees(generator.rotationOffset)),
      scale: [...generator.scale],
    });
  }
  return placements.slice(0, SPLINE_GENERATOR_MAX_INSTANCES);
}

/** Warnings are presentation-only so they never change persisted generator data. */
export function splineRigidSegmentWarnings(
  actor: LayoutSplineActor,
  definition: ForgeSplineRigidSegmentGeneratorDef,
): string[] {
  const generator = resolveSplineRigidSegmentGenerator(definition);
  const cache = buildSplineCurveCache(actor.spline);
  if (cache.totalLength > 1e-8 && cache.totalLength < generator.segmentLength) {
    return ["Spline is shorter than one rigid segment; fixed fit produces no panel."];
  }
  const warnings: string[] = [];
  for (let index = 1; index < cache.segments.length; index += 1) {
    const previous = evaluateSplineSegment(cache.spline, index - 1, 1).direction;
    const next = evaluateSplineSegment(cache.spline, index, 0).direction;
    const dot = clamp(previous[0] * next[0] + previous[1] * next[1] + previous[2] * next[2], -1, 1);
    if (Math.acos(dot) * 180 / Math.PI >= 60) {
      warnings.push("Sharp spline turn detected; rigid panels may leave a visible joint gap.");
      break;
    }
  }
  return warnings;
}

/** Stable compact fingerprint for regression tests and rebuild diagnostics. */
export function splineGeneratedInstanceHash(instances: readonly SplineGeneratedInstance[]): string {
  let hash = 2166136261;
  for (const instance of instances) {
    for (const value of [...instance.position, ...instance.rotation, ...instance.scale]) {
      hash = Math.imul(hash ^ (Math.round(value * 100000) | 0), 16777619);
    }
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function distancePlacements(totalLength: number, closed: boolean, generator: ResolvedSplineInstanceGeneratorDef): number[] {
  const start = clamp(generator.startOffset, 0, totalLength);
  const end = clamp(totalLength - Math.max(0, generator.endOffset), 0, totalLength);
  if (end + 1e-8 < start) return [];
  const distances: number[] = [];
  for (let distance = start; distance <= end + 1e-8 && distances.length < SPLINE_GENERATOR_MAX_INSTANCES; distance += generator.spacing) {
    if (closed && distance >= totalLength - 1e-8) break;
    distances.push(Math.min(distance, end));
  }
  if (!closed && generator.includeEndPoint && end >= start && !distances.some((distance) => Math.abs(distance - end) <= 1e-6)) {
    distances.push(end);
  }
  return distances;
}

function rigidSegmentSpans(
  totalLength: number,
  closed: boolean,
  generator: ResolvedSplineRigidSegmentGeneratorDef,
): Array<{ distance: number; length: number }> {
  const advance = generator.segmentLength + generator.gap;
  if (advance <= 1e-8) return [];
  if (generator.fitMode === "distribute") {
    const count = Math.max(1, Math.round(totalLength / advance));
    const step = totalLength / count;
    return Array.from({ length: count }, (_, index) => ({ distance: step * (index + 0.5), length: Math.min(generator.segmentLength, step) }));
  }
  const spans: Array<{ distance: number; length: number }> = [];
  for (let start = 0; start + generator.segmentLength <= totalLength + 1e-8 && spans.length < SPLINE_GENERATOR_MAX_INSTANCES; start += advance) {
    spans.push({ distance: start + generator.segmentLength / 2, length: generator.segmentLength });
  }
  if (!closed && generator.fitMode === "stretchLast") {
    const start = spans.length === 0 ? 0 : spans.at(-1)!.distance + generator.segmentLength / 2 + generator.gap;
    const remaining = totalLength - start;
    if (remaining > 1e-6) spans.push({ distance: start + remaining / 2, length: remaining });
  }
  return spans;
}

function rigidPlacement(
  actor: LayoutSplineActor,
  cache: ReturnType<typeof buildSplineCurveCache>,
  generator: ResolvedSplineRigidSegmentGeneratorDef,
  distance: number,
  length: number,
): SplineGeneratedInstance {
  const transform = getSplineTransformAtDistance(cache, distance, "world", actor);
  return {
    generatorId: generator.id,
    assetId: generator.meshAsset,
    distance,
    position: transform.position,
    rotation: multiplyQuat(generator.alignToSpline ? transform.rotation : [0, 0, 0, 1], quatFromEulerDegrees(generator.rotationOffset)),
    scale: [generator.scale[0] * transform.frame.scale[0], generator.scale[1] * transform.frame.scale[1], generator.scale[2] * (length / generator.segmentLength)],
  };
}

function filteredFrameRotation(rotation: Quat, frame: { tangent: Vec3; normal: Vec3 }, generator: ResolvedSplineInstanceGeneratorDef): Quat {
  if (generator.applyPitch && generator.applyRoll) return rotation;
  const forward: Vec3 = generator.applyPitch ? frame.tangent : [frame.tangent[0], 0, frame.tangent[2]];
  const length = Math.hypot(...forward);
  const flatForward: Vec3 = length > 1e-8 ? [forward[0] / length, forward[1] / length, forward[2] / length] : [0, 0, 1];
  if (generator.applyPitch && !generator.applyRoll) return quatFromForwardUp(flatForward, [0, 1, 0]);
  return quatFromForwardUp(flatForward, [0, 1, 0]);
}

function quatFromForwardUp(forward: Vec3, upHint: Vec3): Quat {
  const right = normalize(cross(upHint, forward), [1, 0, 0]);
  const up = normalize(cross(forward, right), [0, 1, 0]);
  return quatFromBasis(right, up, forward);
}

function quatFromEulerDegrees(rotation: Vec3): Quat {
  const x = rotation[0] * Math.PI / 180;
  const y = rotation[1] * Math.PI / 180;
  const z = rotation[2] * Math.PI / 180;
  const cx = Math.cos(x / 2), sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2), sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2), sz = Math.sin(z / 2);
  return normalizeQuat([sx * cy * cz + cx * sy * sz, cx * sy * cz - sx * cy * sz, cx * cy * sz + sx * sy * cz, cx * cy * cz - sx * sy * sz]);
}

function quatFromBasis(right: Vec3, up: Vec3, forward: Vec3): Quat {
  const m00 = right[0], m01 = up[0], m02 = forward[0];
  const m10 = right[1], m11 = up[1], m12 = forward[1];
  const m20 = right[2], m21 = up[2], m22 = forward[2];
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return normalizeQuat([(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s]);
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return normalizeQuat([0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]);
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return normalizeQuat([(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]);
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return normalizeQuat([(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]);
}

function multiplyQuat(a: Quat, b: Quat): Quat {
  return normalizeQuat([
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]);
}

function normalizeQuat(value: Quat): Quat {
  const length = Math.hypot(...value);
  return length > 1e-8 ? [value[0] / length, value[1] / length, value[2] / length, value[3] / length] : [0, 0, 0, 1];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(value: Vec3, fallback: Vec3): Vec3 {
  const length = Math.hypot(...value);
  return length > 1e-8 ? [value[0] / length, value[1] / length, value[2] / length] : fallback;
}

function signed(random: SeededRandom): number {
  return random.next() * 2 - 1;
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function hashSeed(seed: number, id: string, index: number): number {
  let hash = (seed | 0) ^ index;
  for (let offset = 0; offset < id.length; offset += 1) hash = Math.imul(hash ^ id.charCodeAt(offset), 16777619);
  return hash >>> 0;
}

class SeededRandom {
  constructor(private state: number) {}
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
}

function uniqueGeneratorId(requested: string, usedIds: ReadonlySet<string>): string {
  const base = requested || "instances";
  if (!usedIds.has(base)) return base;
  let index = 2;
  while (usedIds.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function positiveNumber(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? clamp(value, MIN_SPACING, MAX_OFFSET) : fallback;
}

function positiveVec3(value: unknown): Vec3 | null {
  const vector = finiteVec3(value);
  return vector && vector.every((entry) => entry > 0) ? vector : null;
}

function isSplineMeshAxis(value: unknown): value is SplineMeshAxis {
  return value === "x" || value === "y" || value === "z" || value === "-x" || value === "-y" || value === "-z";
}

function sameMeshAxis(a: SplineMeshAxis, b: SplineMeshAxis): boolean {
  return a.replace("-", "") === b.replace("-", "");
}

function finiteVec3(value: unknown): Vec3 | null {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber)
    ? [value[0]!, value[1]!, value[2]!]
    : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
