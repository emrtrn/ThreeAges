/**
 * RTS presentation motion -- Faz 3 of the unit owner Actor plan.
 *
 * A siege engine is not a walk cycle. It is a chassis on wheels, and the only
 * thing that has to move for it to read as travelling is the wheels. That is a
 * *presentation* fact, so it is authored on the Actor rather than computed from
 * gameplay: a Transform component carries `rtsPresentationMotion`, and the unit
 * presentation spins that node in step with the distance the unit actually
 * covered.
 *
 * Deliberately narrow. This is not a general "Actor tick script": it reads one
 * allowlisted prop, it only ever writes one local rotation axis, and it never
 * touches the unit's position, navigation, or skeletal root motion. Adding a
 * second kind of motion here should feel like a decision, not a default.
 */
import type { ActorScriptDef } from "@engine/scene/actorScript";
import type { Object3D } from "three";
import { findActorComponentNode } from "./rtsActorPresentationTree";

/** Local axis a wheel turns about, in its own pivot's space. */
export type RtsWheelSpinAxis = "x" | "y" | "z";

/** The authored, validated form of a `wheelSpin` motion. */
export interface RtsWheelSpin {
  readonly kind: "wheelSpin";
  readonly axis: RtsWheelSpinAxis;
  /**
   * Wheel radius in world units. Rolling distance divided by this is the turn
   * angle, which is what keeps the wheel from skating: a bigger wheel turns less
   * for the same ground covered.
   */
  readonly radius: number;
  /** `1` or `-1`, correcting for which way the wheel mesh was exported. */
  readonly direction: 1 | -1;
}

/** Why an authored motion was refused, phrased to be appended after a component id. */
export type RtsPresentationMotionProblem = string;

const AXES: readonly RtsWheelSpinAxis[] = ["x", "y", "z"];

/**
 * Read the motion prop off one component's props.
 *
 * Returns `null` for a component that authors none — the overwhelmingly common
 * case — and a problem string for one that authors a broken one. A broken motion
 * is never treated as "no motion": the caller turns it into a load failure so the
 * Actor becomes a visible placeholder rather than a silently static wheel.
 */
export function readRtsPresentationMotion(
  props: Readonly<Record<string, unknown>>,
): { readonly motion: RtsWheelSpin } | { readonly problem: RtsPresentationMotionProblem } | null {
  const raw = props.rtsPresentationMotion;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { problem: "rtsPresentationMotion must be an object" };
  }
  const value = raw as Record<string, unknown>;
  if (value.kind !== "wheelSpin") {
    return { problem: `rtsPresentationMotion.kind "${String(value.kind)}" is not a known motion` };
  }
  const axis = value.axis;
  if (typeof axis !== "string" || !AXES.includes(axis as RtsWheelSpinAxis)) {
    return { problem: `wheelSpin.axis must be one of ${AXES.join(", ")}` };
  }
  const radius = value.radius;
  // Zero or negative would divide the rolling distance into a spin of infinite or
  // reversed speed; both read as a glitch rather than as a wheel.
  if (typeof radius !== "number" || !Number.isFinite(radius) || radius <= 0) {
    return { problem: "wheelSpin.radius must be a finite number greater than 0" };
  }
  const direction = value.direction;
  if (direction !== 1 && direction !== -1) {
    return { problem: "wheelSpin.direction must be 1 or -1" };
  }
  return { motion: { kind: "wheelSpin", axis: axis as RtsWheelSpinAxis, radius, direction } };
}

/**
 * Every authored motion in a def, as `[componentId, motion]`, or the first
 * problem found.
 *
 * A motion on a component that carries no wheel underneath it is itself a
 * problem: it is the shape of a typo (the pivot renamed, the mesh reparented)
 * and it would otherwise present as a wheel that mysteriously never turns.
 */
export function readRtsActorMotions(
  def: ActorScriptDef,
): { readonly motions: readonly (readonly [string, RtsWheelSpin])[] } | { readonly problem: string } {
  const motions: (readonly [string, RtsWheelSpin])[] = [];
  const childCount = new Map<string, number>();
  for (const node of def.components) {
    if (node.parent === undefined) continue;
    childCount.set(node.parent, (childCount.get(node.parent) ?? 0) + 1);
  }
  for (const node of def.components) {
    const read = readRtsPresentationMotion(node.props);
    if (read === null) continue;
    if ("problem" in read) return { problem: `component "${node.id}": ${read.problem}` };
    if ((childCount.get(node.id) ?? 0) === 0) {
      return { problem: `component "${node.id}": wheelSpin needs a wheel component parented under it` };
    }
    motions.push([node.id, read.motion]);
  }
  return { motions };
}

/** A motion bound to the runtime node it turns. */
export interface RtsWheelSpinBinding {
  readonly node: Object3D;
  readonly motion: RtsWheelSpin;
}

/**
 * Pair each authored motion with the node the tree built for it.
 *
 * Returns empty for a def whose motions did not validate — the Actor is already
 * a placeholder in that case, and re-reporting the same problem per instance
 * would flood the log with what the load report said once.
 */
export function bindRtsWheelSpins(def: ActorScriptDef, root: Object3D): readonly RtsWheelSpinBinding[] {
  const read = readRtsActorMotions(def);
  if ("problem" in read) return [];
  const bindings: RtsWheelSpinBinding[] = [];
  for (const [componentId, motion] of read.motions) {
    const node = findActorComponentNode(root, componentId);
    if (node) bindings.push({ node, motion });
  }
  return bindings;
}

/**
 * Advance every bound wheel by the ground distance just covered.
 *
 * `planarSpeed` is the unit's *measured* displacement rate, not its authored
 * `moveSpeed`, so a siege engine held up by a crowd or a blocked path stands with
 * its wheels still — the same reason the walk cycle is driven by measurement.
 */
export function advanceRtsWheelSpins(
  bindings: readonly RtsWheelSpinBinding[],
  planarSpeed: number,
  deltaSeconds: number,
): void {
  if (deltaSeconds <= 0 || planarSpeed <= 0) return;
  for (const { node, motion } of bindings) {
    const radians = (planarSpeed * deltaSeconds) / motion.radius * motion.direction;
    node.rotation[motion.axis] += radians;
  }
}
