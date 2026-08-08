/**
 * A gun's two presentation facts: the barrel's kick, and where the shell leaves.
 *
 * Both are authored on the Actor and read here, in the same narrow style as
 * {@link readRtsPresentationMotion} and the cargo props: a component carries a
 * prop, the presentation binds it to a node, and nothing in this file ever
 * writes simulation state. A gun animates identically whether or not either prop
 * is authored — an unauthored barrel simply stands at its rest angle and an
 * unauthored muzzle leaves the shell spawning from the carriage, which is what
 * every gun did before this module existed.
 *
 * It lives beside `rtsPresentationMotion` rather than inside it for the reason
 * `rtsCargoVisual` gives: that module's `rtsPresentationMotion` key is a single
 * object the editor's Details form rewrites wholesale as a `wheelSpin`, so a
 * second kind parked in the same key would be silently overwritten the first
 * time someone opened the Actor and touched the form.
 *
 * The recoil is driven by the unit's `attackCount` — the same counter that
 * retriggers a swordsman's swing clip — rather than by a clock, so a gun that is
 * not firing is a gun that is not moving, at any game speed and on a paused
 * frame alike.
 */
import { type ActorScriptDef } from "@engine/scene/actorScript";
import { Quaternion, Vector3, type Object3D } from "three";
import { findActorComponentNode } from "./rtsActorPresentationTree";

export type RtsGunRecoilAxis = "x" | "y" | "z";

/**
 * The kick a barrel gives when its gun goes off, as an offset from the pose the
 * component already authors.
 *
 * `degrees` is deliberately *additive*: the barrel's resting elevation is the
 * component's own `rotation`, so an art pass that raises the gun does not also
 * have to re-derive the recoil, and the two cannot drift apart.
 */
export interface RtsGunRecoil {
  /** Parent-space axis the barrel swings about; a gun's elevation axis is `x`. */
  readonly axis: RtsGunRecoilAxis;
  /** Peak kick off the rest pose. Negative raises a muzzle that points +Z. */
  readonly degrees: number;
  /** How long one whole kick-and-settle takes. */
  readonly recoverSeconds: number;
}

const RECOIL_AXES: readonly RtsGunRecoilAxis[] = ["x", "y", "z"];
/** Past this the barrel is not recoiling, it has come off its trunnions. */
const MAX_RECOIL_DEGREES = 45;
/** A kick still settling when the next shot is loaded stops reading as a kick. */
const MAX_RECOVER_SECONDS = 5;

/**
 * Read the recoil prop off one component's props.
 *
 * Null for a component that authors none (nearly all of them), a problem string
 * for one that authors a broken one. A broken value is never read as "no
 * recoil": the caller turns it into a load failure, so the Actor becomes a
 * visible placeholder instead of a barrel that mysteriously never moves.
 */
export function readRtsGunRecoil(
  props: Readonly<Record<string, unknown>>,
): { readonly recoil: RtsGunRecoil } | { readonly problem: string } | null {
  const raw = props.rtsGunRecoil;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { problem: "rtsGunRecoil must be an object" };
  }
  const value = raw as Record<string, unknown>;
  const axis = value.axis;
  if (typeof axis !== "string" || !RECOIL_AXES.includes(axis as RtsGunRecoilAxis)) {
    return { problem: `rtsGunRecoil.axis must be one of ${RECOIL_AXES.join(", ")}` };
  }
  const degrees = value.degrees;
  if (
    typeof degrees !== "number"
    || !Number.isFinite(degrees)
    || degrees === 0
    || Math.abs(degrees) > MAX_RECOIL_DEGREES
  ) {
    return { problem: `rtsGunRecoil.degrees must be a non-zero finite number within ±${MAX_RECOIL_DEGREES}` };
  }
  const recoverSeconds = value.recoverSeconds;
  if (
    typeof recoverSeconds !== "number"
    || !Number.isFinite(recoverSeconds)
    || recoverSeconds <= 0
    || recoverSeconds > MAX_RECOVER_SECONDS
  ) {
    return { problem: `rtsGunRecoil.recoverSeconds must be a finite number in (0, ${MAX_RECOVER_SECONDS}]` };
  }
  return { recoil: { axis: axis as RtsGunRecoilAxis, degrees, recoverSeconds } };
}

/**
 * Every authored recoil in a def, as `[componentId, recoil]`, or the first
 * problem found.
 *
 * A recoil on a component with nothing underneath it is itself a problem — the
 * shape of a typo (the prop landed on the carriage, the barrel was reparented) —
 * and it would otherwise present as a gun that fires without moving, which is
 * exactly the bug the prop was added to fix.
 */
export function readRtsActorGunRecoils(
  def: ActorScriptDef,
): { readonly recoils: readonly (readonly [string, RtsGunRecoil])[] } | { readonly problem: string } {
  const recoils: (readonly [string, RtsGunRecoil])[] = [];
  const childCount = new Map<string, number>();
  for (const node of def.components) {
    if (node.parent === undefined) continue;
    childCount.set(node.parent, (childCount.get(node.parent) ?? 0) + 1);
  }
  for (const node of def.components) {
    const read = readRtsGunRecoil(node.props);
    if (read === null) continue;
    if ("problem" in read) return { problem: `component "${node.id}": ${read.problem}` };
    if ((childCount.get(node.id) ?? 0) === 0) {
      return { problem: `component "${node.id}": rtsGunRecoil needs a barrel component parented under it` };
    }
    recoils.push([node.id, read.recoil]);
  }
  return { recoils };
}

/**
 * The component id marked as this gun's muzzle, or null when none is.
 *
 * At most one: a shell leaves from one place, and two markers would mean the
 * runtime silently picked whichever the component order happened to put first.
 */
export function readRtsActorMuzzle(
  def: ActorScriptDef,
): { readonly muzzle: string | null } | { readonly problem: string } {
  let found: string | null = null;
  for (const node of def.components) {
    const raw = node.props.rtsMuzzle;
    if (raw === undefined || raw === null) continue;
    if (raw !== true) return { problem: `component "${node.id}": rtsMuzzle must be true when present` };
    if (found !== null) {
      return { problem: `component "${node.id}": an Actor may author only one rtsMuzzle (already on "${found}")` };
    }
    found = node.id;
  }
  return { muzzle: found };
}

/**
 * One authored recoil bound to its node, plus the little state it advances.
 *
 * The base orientation is captured once, at bind time, and every frame writes
 * `kick * base` rather than accumulating onto whatever is there — the same rule
 * the cargo sway follows, and for the same reason: the author is free to orient
 * the barrel however the model needs and still get a swing about a *parent-space*
 * axis, with none of Euler order's surprises.
 */
export interface RtsGunRecoilBinding {
  readonly node: Object3D;
  readonly recoil: RtsGunRecoil;
  /** The authored rest pose, which the kick is applied on top of. */
  readonly base: Quaternion;
  /** Shots seen so far, so a new one restarts the kick and a repeat does not. */
  shotsSeen: number;
  /** Seconds into the running kick, or null while the barrel is at rest. */
  elapsed: number | null;
}

/**
 * Pair each authored recoil with the node the tree built for it.
 *
 * Empty for a def whose recoil did not validate — that Actor is already a
 * placeholder, and repeating the load report's message once per instance would
 * bury it.
 */
export function bindRtsGunRecoils(def: ActorScriptDef, root: Object3D): RtsGunRecoilBinding[] {
  const read = readRtsActorGunRecoils(def);
  if ("problem" in read) return [];
  const bindings: RtsGunRecoilBinding[] = [];
  for (const [componentId, recoil] of read.recoils) {
    const node = findActorComponentNode(root, componentId);
    if (!node) continue;
    bindings.push({ node, recoil, base: node.quaternion.clone(), shotsSeen: 0, elapsed: null });
  }
  return bindings;
}

/** The node this instance fires from, or null when the Actor marks none. */
export function bindRtsMuzzle(def: ActorScriptDef, root: Object3D): Object3D | null {
  const read = readRtsActorMuzzle(def);
  if ("problem" in read || read.muzzle === null) return null;
  return findActorComponentNode(root, read.muzzle) ?? null;
}

const DEGREES_TO_RADIANS = Math.PI / 180;
/**
 * Share of the kick spent swinging out, the rest spent coming back.
 *
 * A gun going off is sudden and its recovery is not, so the two halves are not
 * equal — but the rise is not instantaneous either: a barrel that teleports to
 * its peak on one frame reads as a popping transform rather than as a shot.
 */
const RECOIL_RISE_SHARE = 0.18;

/** Reused across every binding and frame; the recoil allocates nothing per call. */
const kickQuaternion = new Quaternion();
const RECOIL_AXIS_VECTORS: Readonly<Record<RtsGunRecoilAxis, Vector3>> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

/** Smoothstep, so both ends of the swing ease instead of cornering. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Advance every bound barrel for one frame.
 *
 * `attackCount` is the unit's running blow counter: each increment is one shot
 * to show, which is the same signal the animated units retrigger their swing
 * from. A barrel at rest costs one integer comparison per frame and touches no
 * node at all.
 */
export function advanceRtsGunRecoils(
  bindings: readonly RtsGunRecoilBinding[],
  attackCount: number,
  deltaSeconds: number,
): void {
  for (const binding of bindings) {
    if (attackCount > binding.shotsSeen) {
      binding.shotsSeen = attackCount;
      binding.elapsed = 0;
    }
    if (binding.elapsed === null) continue;
    binding.elapsed += Math.max(0, deltaSeconds);
    const { axis, degrees, recoverSeconds } = binding.recoil;
    const t = binding.elapsed / recoverSeconds;
    if (t >= 1) {
      // Settled: put the barrel exactly back on its authored pose rather than
      // near it, so a thousand shots cannot accumulate a drift.
      binding.node.quaternion.copy(binding.base);
      binding.elapsed = null;
      continue;
    }
    const swing = t < RECOIL_RISE_SHARE
      ? t / RECOIL_RISE_SHARE
      : 1 - (t - RECOIL_RISE_SHARE) / (1 - RECOIL_RISE_SHARE);
    const angle = degrees * DEGREES_TO_RADIANS * smoothstep(swing);
    kickQuaternion.setFromAxisAngle(RECOIL_AXIS_VECTORS[axis], angle);
    binding.node.quaternion.copy(kickQuaternion).multiply(binding.base);
  }
}
