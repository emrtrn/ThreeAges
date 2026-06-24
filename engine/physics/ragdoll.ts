/**
 * Ragdoll group descriptors + the pure world→local anchor math (no Rapier, no DOM).
 *
 * {@link PhysicsSubsystem.spawnRagdoll} turns a {@link RagdollGroupDesc} into live
 * Rapier dynamic bodies linked by **spherical** impulse joints — the available
 * articulation in rapier3d-compat 0.19, whose `SphericalImpulseJoint` exposes no
 * angular cone/twist limit. So a body's authored swing/twist limits aren't hard
 * constraints yet; the spawn step keeps the ragdoll from flailing with angular
 * damping instead, and joints carry the connection. (A true cone-twist needs a
 * newer Rapier or the raw generic-joint limit API — deferred.)
 *
 * The world→local anchor conversion that the spawn step needs is pure and lives
 * here so it's deterministically testable; the Rapier wiring (WASM) stays in the
 * subsystem. Generic engine code: no game rules.
 */
import { Quaternion, Vector3 } from "three";
import type { Vec3 } from "../scene/layout";

export type RagdollShape = "capsule" | "sphere" | "box";
export type QuatXYZW = [number, number, number, number];

/** A dynamic rigid body of the ragdoll, placed in world space. */
export interface RagdollBodyDesc {
  name: string;
  shape: RagdollShape;
  /** Full local size (box extents; sphere/capsule per `colliderShapeDesc`). */
  size: Vec3;
  /** World-space body origin. */
  position: Vec3;
  /** World-space orientation `[x, y, z, w]`. */
  quaternion: QuatXYZW;
  mass: number;
}

/**
 * A spherical joint linking two ragdoll bodies, anchored in each body's local
 * frame. `swingRad`/`twistRad` are carried for a future cone-twist backend but
 * not enforced by the current spherical joint (see the module note).
 */
export interface RagdollJointDesc {
  name: string;
  bodyA: string;
  bodyB: string;
  /** Anchor expressed in `bodyA`'s local frame. */
  anchorA: Vec3;
  /** Anchor expressed in `bodyB`'s local frame. */
  anchorB: Vec3;
  swingRad: number;
  twistRad: number;
}

export interface RagdollGroupDesc {
  bodies: RagdollBodyDesc[];
  joints: RagdollJointDesc[];
}

/** A live ragdoll body's world transform, sampled each tick after the step. */
export interface RagdollPose {
  name: string;
  position: Vec3;
  quaternion: QuatXYZW;
}

/**
 * Collision groups for ragdoll colliders: membership bit 0, filtering out bit 0,
 * so ragdoll parts collide with the rest of the world (default groups) but never
 * with each other — adjacent jointed limbs would otherwise explode apart.
 */
export const RAGDOLL_COLLISION_GROUPS = 0x0001fffe;

/**
 * Expresses a world-space anchor in a body's local frame:
 * `local = inverse(q) · (anchorWorld − bodyPos)`. Pure; used by the spawn step to
 * turn a {@link RagdollJointDesc}'s implicit world anchor into the per-body local
 * anchors Rapier's `JointData.spherical` expects.
 */
export function worldAnchorToBodyLocal(
  anchorWorld: Vec3,
  bodyPos: Vec3,
  bodyQuat: QuatXYZW,
): Vec3 {
  const inverse = new Quaternion(
    bodyQuat[0],
    bodyQuat[1],
    bodyQuat[2],
    bodyQuat[3],
  ).invert();
  const local = new Vector3(
    anchorWorld[0] - bodyPos[0],
    anchorWorld[1] - bodyPos[1],
    anchorWorld[2] - bodyPos[2],
  ).applyQuaternion(inverse);
  return [round6(local.x), round6(local.y), round6(local.z)];
}

/**
 * Recovers a bone's world transform from its simulated body's pose — the inverse
 * of how the spec placed the body (`bodyWorld = boneWorld ∘ localOffset`). The
 * runtime driver calls this each tick to pose a bone from its ragdoll body:
 *
 *   boneQuat = bodyQuat · inverse(offsetQuat)
 *   bonePos  = bodyPos − boneQuat · scaledOffset
 *
 * `scaledOffset` is the body's bone-local origin already scaled to world units,
 * and `offsetQuaternion` the body's bone-local orientation. Pure.
 */
export function boneWorldFromBodyPose(
  bodyPosition: Vec3,
  bodyQuaternion: QuatXYZW,
  scaledOffset: Vec3,
  offsetQuaternion: QuatXYZW,
): { position: Vec3; quaternion: QuatXYZW } {
  const offsetInverse = new Quaternion(
    offsetQuaternion[0],
    offsetQuaternion[1],
    offsetQuaternion[2],
    offsetQuaternion[3],
  ).invert();
  const boneQuat = new Quaternion(
    bodyQuaternion[0],
    bodyQuaternion[1],
    bodyQuaternion[2],
    bodyQuaternion[3],
  ).multiply(offsetInverse);
  const offset = new Vector3(scaledOffset[0], scaledOffset[1], scaledOffset[2]).applyQuaternion(
    boneQuat,
  );
  return {
    position: [bodyPosition[0] - offset.x, bodyPosition[1] - offset.y, bodyPosition[2] - offset.z],
    quaternion: [boneQuat.x, boneQuat.y, boneQuat.z, boneQuat.w],
  };
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}
