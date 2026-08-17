/**
 * The load an RTS carrier is showing: whether it is there, and how it rides.
 *
 * A pack animal that walks the same way loaded and empty reads as decoration:
 * nothing on screen says which half of the round trip it is on. The fix is
 * presentation-only — the load is *shown*, never simulated — so it is authored
 * on the Actor exactly like {@link readRtsPresentationMotion}'s wheel spins: a
 * mesh component carries `rtsCargoVisibility`, and the presentation shows or
 * hides that node from the one boolean the caller already knows.
 *
 * Deliberately narrow, for the same reason the motion module is. It reads two
 * allowlisted props, it only ever writes `visible` and a local orientation, and
 * it never moves, scales or reparents anything. Nothing here may become a place
 * to hang gameplay off: the simulation's cargo is `Caravan.phase`, and this only
 * mirrors it.
 *
 * The sway lives here rather than beside the wheel spin in
 * `rtsPresentationMotion` on purpose. That module's prop is a single object the
 * editor's Details form rewrites wholesale as a `wheelSpin`, so a second kind
 * parked in the same key would be silently overwritten the first time someone
 * opened the Actor and touched the form.
 */
import { isMeshComponentKind, type ActorScriptDef } from "@engine/scene/actorScript";
import { Quaternion, Vector3, type Object3D } from "three";
import type { WorkerActivity } from "../units/unit";
import { findActorComponentNode } from "./rtsActorPresentationTree";

/**
 * Which half of the trip a cargo node belongs to.
 *
 * `empty` exists so the pair can be authored together — bare panniers on the way
 * back, full barrels on the way out — rather than forcing a "cargo means loaded"
 * convention that a second art pass would have to work around.
 */
export type RtsCargoVisibility = "loaded" | "empty";

const VISIBILITIES: readonly RtsCargoVisibility[] = ["loaded", "empty"];

/**
 * Job categories a load may be authored *for*, narrowing an otherwise
 * unconditional cargo node — the second half of the Worker plan's §10.2A
 * hand-off.
 *
 * A carrier with one kind of load needs none of this: `carrying` alone says
 * whether the crate is in his hands. A Worker has two, and they are two
 * different objects — his own crate coming back from a tree, and the producer's
 * barrel going onto a donkey — so the boolean has to be told *which*. Restricted
 * to the carrying activities on purpose: a filter naming `lumber` would be a
 * hand tool, and {@link bindRtsWorkerTools} already owns those.
 */
const CARGO_ACTIVITIES = ["carryingBox", "carryingLoad", "wheelbarrow"] as const satisfies readonly WorkerActivity[];
export type RtsCargoActivity = (typeof CARGO_ACTIVITIES)[number];

/**
 * Read the cargo prop off one component's props.
 *
 * Null for a component that authors none (nearly all of them), a problem string
 * for one that authors a broken one. As with presentation motion, a broken value
 * is never read as "no cargo": the caller turns it into a load failure, so the
 * Actor becomes a visible placeholder instead of a load that never appears.
 */
export function readRtsCargoVisibility(
  props: Readonly<Record<string, unknown>>,
): { readonly visibility: RtsCargoVisibility } | { readonly problem: string } | null {
  const raw = props.rtsCargoVisibility;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string" || !VISIBILITIES.includes(raw as RtsCargoVisibility)) {
    return { problem: `rtsCargoVisibility must be one of ${VISIBILITIES.join(", ")}` };
  }
  return { visibility: raw as RtsCargoVisibility };
}

/**
 * Read the optional activity filter off one component's props.
 *
 * Null for a node that authors none — which is every carrier with a single load,
 * and keeps them on exactly the behaviour they had before the filter existed. A
 * broken value is a problem for the same reason a broken visibility is: it is
 * the shape of a typo, and read as "no filter" it would put a Worker's barrel
 * and his crate in his arms at once.
 */
export function readRtsCargoActivity(
  props: Readonly<Record<string, unknown>>,
): { readonly activity: RtsCargoActivity } | { readonly problem: string } | null {
  const raw = props.rtsCargoActivity;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string" || !CARGO_ACTIVITIES.includes(raw as RtsCargoActivity)) {
    return { problem: `rtsCargoActivity must be one of ${CARGO_ACTIVITIES.join(", ")}` };
  }
  return { activity: raw as RtsCargoActivity };
}

/**
 * Every authored cargo node in a def, as `[componentId, visibility]`, or the
 * first problem found.
 *
 * A cargo flag on a component with nothing to draw is itself a problem: it is
 * the shape of a typo (the prop landed on the Transform above the mesh, the mesh
 * was renamed) and it would otherwise present as a load that is toggled
 * perfectly and never seen.
 */
export function readRtsActorCargoVisuals(
  def: ActorScriptDef,
): { readonly cargo: readonly RtsCargoVisualDef[] } | { readonly problem: string } {
  const cargo: RtsCargoVisualDef[] = [];
  const childCount = new Map<string, number>();
  for (const node of def.components) {
    if (node.parent === undefined) continue;
    childCount.set(node.parent, (childCount.get(node.parent) ?? 0) + 1);
  }
  for (const node of def.components) {
    const read = readRtsCargoVisibility(node.props);
    const readActivity = readRtsCargoActivity(node.props);
    if (readActivity !== null && "problem" in readActivity) {
      return { problem: `component "${node.id}": ${readActivity.problem}` };
    }
    if (read === null) {
      // A filter with nothing to filter is the same class of typo as a flag on a
      // node with no mesh: it reads as authored and does nothing at all.
      if (readActivity !== null) {
        return { problem: `component "${node.id}": rtsCargoActivity needs rtsCargoVisibility beside it` };
      }
      continue;
    }
    if ("problem" in read) return { problem: `component "${node.id}": ${read.problem}` };
    if (!isMeshComponentKind(node.component) && (childCount.get(node.id) ?? 0) === 0) {
      return { problem: `component "${node.id}": rtsCargoVisibility needs a mesh here or under it` };
    }
    cargo.push({ componentId: node.id, visibility: read.visibility, activity: readActivity?.activity ?? null });
  }
  return { cargo };
}

/** One authored cargo node, before it is paired with the runtime tree. */
export interface RtsCargoVisualDef {
  readonly componentId: string;
  readonly visibility: RtsCargoVisibility;
  /** Null when the node belongs to every load this carrier can hold. */
  readonly activity: RtsCargoActivity | null;
}

/** An authored cargo flag bound to the runtime node it shows and hides. */
export interface RtsCargoVisualBinding {
  readonly node: Object3D;
  readonly visibility: RtsCargoVisibility;
  /** Null when this node is shown for any load; see {@link CARGO_ACTIVITIES}. */
  readonly activity: RtsCargoActivity | null;
}

/**
 * Pair each authored cargo flag with the node the tree built for it.
 *
 * Empty for a def whose cargo did not validate — that Actor is already a
 * placeholder, and repeating the load report's message once per instance would
 * bury it.
 */
export function bindRtsCargoVisuals(def: ActorScriptDef, root: Object3D): readonly RtsCargoVisualBinding[] {
  const read = readRtsActorCargoVisuals(def);
  if ("problem" in read) return [];
  const bindings: RtsCargoVisualBinding[] = [];
  for (const { componentId, visibility, activity } of read.cargo) {
    const node = findActorComponentNode(root, componentId);
    if (node) bindings.push({ node, visibility, activity });
  }
  return bindings;
}

/**
 * Show the half of the authored cargo that matches this trip, hide the other.
 *
 * `activity` narrows a carrier that authors more than one kind of load. An
 * unfiltered node ignores it entirely, so a caller that models no worker
 * assignment (the pack donkey) may leave it undefined and get the behaviour it
 * always had.
 */
export function applyRtsCargoVisibility(
  bindings: readonly RtsCargoVisualBinding[],
  carrying: boolean,
  activity?: WorkerActivity | null,
): void {
  for (const { node, visibility, activity: filter } of bindings) {
    node.visible = carrying === (visibility === "loaded")
      && (filter === null || filter === activity);
  }
}

/**
 * A load that rocks with the carrier's gait — the second authored cargo prop.
 *
 * Why this and not a bone socket: the Donkey's Walk clip animates its legs and
 * almost nothing else. Over the whole cycle its `Body` bone travels 0.078 model
 * units vertically, which at the Actor's 0.22 scale is 1.7cm on an animal 87cm
 * tall — under a pixel at the RTS camera's 20–40 unit range. Strapping the load
 * to a bone would therefore be nearly free at runtime and nearly invisible on
 * screen. What actually reads is *differential* motion: two loads rocking out of
 * phase move against a body that does not, and there is finally something for
 * the eye to compare.
 *
 * Driven by measured travel rather than by a clock, for the same reason
 * {@link advanceRtsWheelSpins} is: a carrier standing at the depot must stand
 * still. That also keeps it in step with the walk cycle for free, since the clip's
 * playback rate is scaled by the same speed — one authored stride is one gait
 * step at *any* travel speed, with no shared timeline between the two.
 */
export interface RtsCargoSway {
  /** Parent-space axis the load rocks about; the carrier's lateral axis is `x`. */
  readonly axis: RtsCargoSwayAxis;
  /** Peak rocking angle. Past a quarter turn a load reads as falling off, not swaying. */
  readonly degrees: number;
  /** World distance covered per full rock. One gait step, not one clip cycle. */
  readonly stride: number;
  /** Cycle offset in turns (`0`–`1`); `0.5` on one flank is what makes the pair alternate. */
  readonly phase: number;
}

export type RtsCargoSwayAxis = "x" | "y" | "z";

const SWAY_AXES: readonly RtsCargoSwayAxis[] = ["x", "y", "z"];
/** Beyond this the load is not swaying, it is coming loose — refused at authoring. */
const MAX_SWAY_DEGREES = 45;

/** Read the sway prop off one component's props; same contract as the flag above. */
export function readRtsCargoSway(
  props: Readonly<Record<string, unknown>>,
): { readonly sway: RtsCargoSway } | { readonly problem: string } | null {
  const raw = props.rtsCargoSway;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { problem: "rtsCargoSway must be an object" };
  }
  const value = raw as Record<string, unknown>;
  const axis = value.axis;
  if (typeof axis !== "string" || !SWAY_AXES.includes(axis as RtsCargoSwayAxis)) {
    return { problem: `rtsCargoSway.axis must be one of ${SWAY_AXES.join(", ")}` };
  }
  const degrees = value.degrees;
  if (typeof degrees !== "number" || !Number.isFinite(degrees) || degrees <= 0 || degrees > MAX_SWAY_DEGREES) {
    return { problem: `rtsCargoSway.degrees must be a finite number in (0, ${MAX_SWAY_DEGREES}]` };
  }
  // Zero or negative stride divides the travelled distance into an infinite or
  // reversed rock — the same failure a zero wheel radius is.
  const stride = value.stride;
  if (typeof stride !== "number" || !Number.isFinite(stride) || stride <= 0) {
    return { problem: "rtsCargoSway.stride must be a finite number greater than 0" };
  }
  // Wrapping a stray 1.5 would hide the typo it almost certainly is; the pair
  // that matters (0 and 0.5) is well inside the range.
  const phase = value.phase ?? 0;
  if (typeof phase !== "number" || !Number.isFinite(phase) || phase < 0 || phase >= 1) {
    return { problem: "rtsCargoSway.phase must be a number in [0, 1)" };
  }
  return { sway: { axis: axis as RtsCargoSwayAxis, degrees, stride, phase } };
}

/** Every authored sway in a def, as `[componentId, sway]`, or the first problem. */
export function readRtsActorCargoSways(
  def: ActorScriptDef,
): { readonly sways: readonly (readonly [string, RtsCargoSway])[] } | { readonly problem: string } {
  const sways: (readonly [string, RtsCargoSway])[] = [];
  const childCount = new Map<string, number>();
  for (const node of def.components) {
    if (node.parent === undefined) continue;
    childCount.set(node.parent, (childCount.get(node.parent) ?? 0) + 1);
  }
  for (const node of def.components) {
    const read = readRtsCargoSway(node.props);
    if (read === null) continue;
    if ("problem" in read) return { problem: `component "${node.id}": ${read.problem}` };
    if (!isMeshComponentKind(node.component) && (childCount.get(node.id) ?? 0) === 0) {
      return { problem: `component "${node.id}": rtsCargoSway needs a mesh here or under it` };
    }
    sways.push([node.id, read.sway]);
  }
  return { sways };
}

/**
 * One authored sway bound to its node, plus the little state it advances.
 *
 * The base orientation is captured once, at bind time, and every frame writes
 * `swing * base` rather than accumulating onto whatever is there. That is what
 * lets an author rotate the load however the model needs (the panniers lie on
 * their sides) and still get a rock about a *parent-space* axis, with none of
 * Euler order's surprises.
 */
export interface RtsCargoSwayBinding {
  readonly node: Object3D;
  readonly sway: RtsCargoSway;
  /** The authored orientation, which the rock is applied on top of. */
  readonly base: Quaternion;
  /** Gait position in radians, advanced by distance travelled. */
  phase: number;
  /** Eased 0–1 strength, so a carrier that stops settles instead of freezing tilted. */
  strength: number;
}

/** Pair each authored sway with its node, capturing the authored orientation. */
export function bindRtsCargoSways(def: ActorScriptDef, root: Object3D): RtsCargoSwayBinding[] {
  const read = readRtsActorCargoSways(def);
  if ("problem" in read) return [];
  const bindings: RtsCargoSwayBinding[] = [];
  for (const [componentId, sway] of read.sways) {
    const node = findActorComponentNode(root, componentId);
    if (!node) continue;
    bindings.push({ node, sway, base: node.quaternion.clone(), phase: 0, strength: 0 });
  }
  return bindings;
}

const TAU = Math.PI * 2;
const DEGREES_TO_RADIANS = Math.PI / 180;
/**
 * How quickly the rock fades in and out, as an exponential time constant.
 *
 * It exists because the loaded legs include `unloading`, where the animal stands
 * at the depot for seconds: distance-driven phase alone would leave both barrels
 * frozen mid-swing at whatever angle the last step ended on, which reads as a
 * broken transform rather than as a resting load.
 */
const SWAY_SETTLE_SECONDS = 0.22;
/** Below this the carrier is standing, not walking — jitter must not start a rock. */
const SWAY_MOVING_SPEED = 0.05;

/** Reused across every binding and frame; the sway allocates nothing per call. */
const swingQuaternion = new Quaternion();
const SWAY_AXIS_VECTORS: Readonly<Record<RtsCargoSwayAxis, Vector3>> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

/**
 * Rock every bound load by the ground distance just covered.
 *
 * `planarSpeed` is measured displacement, exactly as the wheels use: a caravan
 * held up by a crowd or waiting out its load stands with its barrels still.
 */
export function advanceRtsCargoSway(
  bindings: readonly RtsCargoSwayBinding[],
  planarSpeed: number,
  deltaSeconds: number,
): void {
  if (deltaSeconds <= 0 || bindings.length === 0) return;
  const target = planarSpeed > SWAY_MOVING_SPEED ? 1 : 0;
  const blend = 1 - Math.exp(-deltaSeconds / SWAY_SETTLE_SECONDS);
  const travelled = planarSpeed * deltaSeconds;
  for (const binding of bindings) {
    binding.strength += (target - binding.strength) * blend;
    binding.phase = (binding.phase + (travelled / binding.sway.stride) * TAU) % TAU;
    const angle = binding.sway.degrees * DEGREES_TO_RADIANS
      * binding.strength
      * Math.sin(binding.phase + binding.sway.phase * TAU);
    binding.node.quaternion
      .copy(binding.base)
      .premultiply(swingQuaternion.setFromAxisAngle(SWAY_AXIS_VECTORS[binding.sway.axis], angle));
  }
}
