/** Presentation-only hand tools keyed by the Worker's real assignment category. */
import { isMeshComponentKind, type ActorScriptDef } from "@engine/scene/actorScript";
import type { Object3D } from "three";
import type { WorkerActivity } from "../units/unit";
import { findActorComponentNode } from "./rtsActorPresentationTree";

const TOOL_ACTIVITIES = ["lumber"] as const satisfies readonly WorkerActivity[];
type ToolActivity = (typeof TOOL_ACTIVITIES)[number];

export interface RtsWorkerToolBinding {
  readonly node: Object3D;
  readonly activity: ToolActivity;
}

/** Bind an Actor mesh marked with `rtsWorkerToolActivity` to its job category. */
export function bindRtsWorkerTools(def: ActorScriptDef, root: Object3D): readonly RtsWorkerToolBinding[] {
  const bindings: RtsWorkerToolBinding[] = [];
  for (const component of def.components) {
    const activity = component.props.rtsWorkerToolActivity;
    if (typeof activity !== "string" || !TOOL_ACTIVITIES.includes(activity as ToolActivity)) continue;
    if (!isMeshComponentKind(component.component)) continue;
    const node = findActorComponentNode(root, component.id);
    if (node) bindings.push({ node, activity: activity as ToolActivity });
  }
  return bindings;
}

/** A tool is visible only for the existing simulation assignment that owns it. */
export function applyRtsWorkerTools(bindings: readonly RtsWorkerToolBinding[], activity: WorkerActivity | null | undefined): void {
  for (const binding of bindings) binding.node.visible = activity === binding.activity;
}
