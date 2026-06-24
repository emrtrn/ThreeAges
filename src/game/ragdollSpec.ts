/**
 * Pure ragdoll spec builder (no Rapier, no DOM).
 *
 * Turns authored `physicsBodies` + `physicsConstraints` (`*.skeleton.json`) plus
 * each body's bind-pose bone world transform into a `RagdollSpec`: world-placed
 * rigid bodies and the cone-twist joints linking them, ready for a physics
 * backend (3a/3c) to instantiate. The bone world transform is injected
 * (`resolveBoneWorld`) so this stays free of Three's scene graph and is
 * deterministically testable.
 *
 * Conventions mirror the editor overlay and the runtime collider mapping
 * (`physicsSubsystem.colliderShapeDesc`) so a body simulates exactly where it was
 * authored:
 *  - `position` (offset) + `rotation` (XYZ degrees) are bone-local; the world
 *    transform is `boneWorld ∘ localOffset` at uniform scale.
 *  - `size` → shape extents: box = full extents; sphere radius = maxAxis / 2;
 *    capsule radius = max(x, z) / 2, total height = y.
 *  - mass = shape volume × {@link RAGDOLL_DENSITY}, floored so a degenerate
 *    (near-zero) body still simulates.
 *
 * Generic: no game rules. Game code decides *when* to build/activate a ragdoll.
 */
import { Quaternion, Vector3 } from "three";
import type { Vec3 } from "@engine/scene/layout";
import {
  worldAnchorToBodyLocal,
  type RagdollGroupDesc,
  type RagdollJointDesc,
} from "@engine/physics/ragdoll";
import type {
  AssetSkeletonPhysicsBodyDef,
  AssetSkeletonPhysicsConstraintDef,
  PhysicsBodyShape,
} from "@/scene/assetSkeletonLoader";

/** A quaternion as `[x, y, z, w]` (plain array; Rapier/Three both consume it). */
export type QuatXYZW = [number, number, number, number];

/** A bone/node's bind-pose world transform. Scale is intentionally dropped. */
export interface BoneWorldTransform {
  readonly position: Vec3;
  readonly quaternion: QuatXYZW;
}

/**
 * Resolves a bone/node name to its world transform, or `null` if the node is
 * absent. Injected so the builder never touches Three's scene graph: the runtime
 * passes a closure over `object.getObjectByName(...)`, tests pass a fake map.
 */
export type ResolveBoneWorld = (boneName: string) => BoneWorldTransform | null;

/** One rigid body of the ragdoll, placed in world space. */
export interface RagdollBodyState {
  readonly name: string;
  readonly shape: PhysicsBodyShape;
  /** Full local size (box extents; sphere/capsule per the collider mapping). */
  readonly size: Vec3;
  /** World-space body origin. */
  readonly position: Vec3;
  /** World-space orientation `[x, y, z, w]`. */
  readonly quaternion: QuatXYZW;
  /** Mass in kg, derived from shape volume × {@link RAGDOLL_DENSITY}. */
  readonly mass: number;
}

/** A cone-twist joint linking two ragdoll bodies (anchored at the child body). */
export interface RagdollJointSpec {
  readonly name: string;
  readonly bodyA: string;
  readonly bodyB: string;
  /** World-space anchor — the child body (`bodyB`) origin. */
  readonly anchor: Vec3;
  /** Cone swing half-angle limit in radians. */
  readonly swingRad: number;
  /** Twist (roll) limit in radians. */
  readonly twistRad: number;
}

export interface RagdollSpec {
  readonly bodies: RagdollBodyState[];
  readonly joints: RagdollJointSpec[];
}

/** Density (kg/m³) used to derive body mass from shape volume; ~water/flesh. */
export const RAGDOLL_DENSITY = 1000;
/** Mass floor (kg) so a degenerate (near-zero) body still simulates. */
const MIN_BODY_MASS = 0.1;

/**
 * Builds a {@link RagdollSpec} from authored physics bodies/constraints and a
 * bone-world resolver.
 *
 * Bodies whose bone can't be resolved are skipped (can't be placed). Joints are
 * kept only when *both* endpoints resolved to a built body, so a dangling or
 * skipped reference drops the joint rather than crashing the backend.
 */
export function buildRagdollSpec(
  bodies: readonly AssetSkeletonPhysicsBodyDef[],
  constraints: readonly AssetSkeletonPhysicsConstraintDef[],
  resolveBoneWorld: ResolveBoneWorld,
): RagdollSpec {
  const states: RagdollBodyState[] = [];
  const byName = new Map<string, RagdollBodyState>();
  for (const body of bodies) {
    const bone = resolveBoneWorld(body.bone);
    if (!bone) continue;
    const transform = bodyWorldTransform(bone, body);
    const state: RagdollBodyState = {
      name: body.name,
      shape: body.shape,
      size: [...body.size] as Vec3,
      position: transform.position,
      quaternion: transform.quaternion,
      mass: bodyMass(body.shape, body.size),
    };
    states.push(state);
    byName.set(state.name, state);
  }

  const joints: RagdollJointSpec[] = [];
  for (const constraint of constraints) {
    const a = byName.get(constraint.bodyA);
    const b = byName.get(constraint.bodyB);
    if (!a || !b) continue;
    joints.push({
      name: constraint.name,
      bodyA: constraint.bodyA,
      bodyB: constraint.bodyB,
      anchor: [...b.position] as Vec3,
      swingRad: degToRad(constraint.swingDeg),
      twistRad: degToRad(constraint.twistDeg),
    });
  }

  return { bodies: states, joints };
}

/**
 * Lowers a world-space {@link RagdollSpec} into the engine's
 * {@link RagdollGroupDesc} that `PhysicsSubsystem.spawnRagdoll` consumes: bodies
 * map 1:1, and each joint's world anchor is re-expressed in both bodies' local
 * frames (`worldAnchorToBodyLocal`). Joints whose endpoints aren't in `bodies`
 * are dropped (the spec already drops them, but this stays defensive).
 */
export function toRagdollGroupDesc(spec: RagdollSpec): RagdollGroupDesc {
  const byName = new Map(spec.bodies.map((body) => [body.name, body] as const));
  const joints: RagdollJointDesc[] = [];
  for (const joint of spec.joints) {
    const a = byName.get(joint.bodyA);
    const b = byName.get(joint.bodyB);
    if (!a || !b) continue;
    joints.push({
      name: joint.name,
      bodyA: joint.bodyA,
      bodyB: joint.bodyB,
      anchorA: worldAnchorToBodyLocal(joint.anchor, a.position, a.quaternion),
      anchorB: worldAnchorToBodyLocal(joint.anchor, b.position, b.quaternion),
      swingRad: joint.swingRad,
      twistRad: joint.twistRad,
    });
  }
  return {
    bodies: spec.bodies.map((body) => ({
      name: body.name,
      shape: body.shape,
      size: [...body.size] as Vec3,
      position: [...body.position] as Vec3,
      quaternion: [...body.quaternion] as QuatXYZW,
      mass: body.mass,
    })),
    joints,
  };
}

/** World transform of a body: `boneWorld ∘ bodyLocal` at uniform scale. */
function bodyWorldTransform(
  bone: BoneWorldTransform,
  body: AssetSkeletonPhysicsBodyDef,
): { position: Vec3; quaternion: QuatXYZW } {
  const bonePos = new Vector3(bone.position[0], bone.position[1], bone.position[2]);
  const boneQuat = new Quaternion(
    bone.quaternion[0],
    bone.quaternion[1],
    bone.quaternion[2],
    bone.quaternion[3],
  );
  const localPos = new Vector3(body.position[0], body.position[1], body.position[2]);
  const localQuat = quatFromEulerDegrees(body.rotation);
  const worldPos = localPos.applyQuaternion(boneQuat).add(bonePos);
  const worldQuat = boneQuat.multiply(localQuat);
  return {
    position: [round6(worldPos.x), round6(worldPos.y), round6(worldPos.z)],
    quaternion: [round6(worldQuat.x), round6(worldQuat.y), round6(worldQuat.z), round6(worldQuat.w)],
  };
}

/**
 * Quaternion from XYZ Euler degrees, matching Three's `Euler` "XYZ" order (and
 * `physicsSubsystem`'s `quaternionFromEulerDegrees`). Built explicitly so the
 * module stays pure trig — no `Euler` import.
 */
function quatFromEulerDegrees(rotation: Vec3): Quaternion {
  const hx = degToRad(rotation[0]) / 2;
  const hy = degToRad(rotation[1]) / 2;
  const hz = degToRad(rotation[2]) / 2;
  const cx = Math.cos(hx);
  const sx = Math.sin(hx);
  const cy = Math.cos(hy);
  const sy = Math.sin(hy);
  const cz = Math.cos(hz);
  const sz = Math.sin(hz);
  return new Quaternion(
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  );
}

function bodyMass(shape: PhysicsBodyShape, size: Vec3): number {
  return round4(Math.max(MIN_BODY_MASS, bodyVolume(shape, size) * RAGDOLL_DENSITY));
}

/** Shape volume (m³); sphere/capsule radii match the collider builder. */
function bodyVolume(shape: PhysicsBodyShape, size: Vec3): number {
  const x = size[0];
  const y = size[1];
  const z = size[2];
  if (shape === "box") return x * y * z;
  if (shape === "sphere") {
    const r = Math.max(x, y, z) / 2;
    return (4 / 3) * Math.PI * r ** 3;
  }
  // capsule: cylinder (radius r, height h) + hemispherical caps (a full sphere).
  const r = Math.max(x, z) / 2;
  const h = Math.max(0, y - 2 * r);
  return Math.PI * r ** 2 * h + (4 / 3) * Math.PI * r ** 3;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}
