/**
 * RTS unit movement — Vertical Slice Plan v0.2 §21 ("Sağ tık hareket").
 *
 * Follows planned ground waypoints (or a legacy direct target) on the ground
 * plane, faces the heading, and clears completed orders. Global grid planning
 * lives in `rtsNavigation`; local avoidance remains a later small step.
 */
import { Vector3 } from "three";

import { combatDistance } from "../combat/combatTarget";
import type { Unit } from "./unit";
import { UNIT_RADIUS } from "./unit";

/** Distance to the target at which the unit is considered arrived. */
const ARRIVAL_RADIUS = 0.15;

const scratchDir = new Vector3();

/** Advance every moving unit one frame toward its target. */
export function updateUnitMovement(units: readonly Unit[], dt: number): void {
  for (const unit of units) {
    if (unit.health.depleted) {
      unit.stop();
      continue;
    }
    // Hold Position is exactly this: the unit keeps its weapon and gives up its
    // feet (GDD 06 §26). Everything else below is a reason to take a step.
    if (unit.stance === "hold") continue;
    const attackTarget = unit.attackTarget;
    if (attackTarget?.health.depleted) {
      unit.setAttackTarget(null);
      continue;
    }
    // An explicit attack order follows its target's live position, stopping at
    // melee range so the combat system can resolve hits without overlap.
    if (attackTarget && combatDistance(unit.position, attackTarget) <= unit.attack.range) {
      continue;
    }
    // Attack orders follow a preplanned path. Never fall back to the target
    // pivot here: that was the route that let attackers walk through the ridge.
    const target = unit.pathTarget ?? (attackTarget ? null : unit.moveTarget);
    if (!target) continue;

    const pos = unit.position;
    scratchDir.set(target.x - pos.x, 0, target.z - pos.z);
    const dist = scratchDir.length();
    if (dist <= ARRIVAL_RADIUS) {
      if (unit.pathTarget) unit.advancePath();
      else if (!unit.attackTarget) unit.moveTarget = null;
      continue;
    }

    const step = Math.min(dist, unit.speed * dt);
    scratchDir.multiplyScalar(step / dist);
    pos.x += scratchDir.x;
    pos.z += scratchDir.z;
    // Face the heading (capsule is radially symmetric, but this keeps facing
    // meaningful once directional models replace the placeholder).
    unit.object.rotation.y = Math.atan2(scratchDir.x, scratchDir.z);
  }
}

/**
 * Ground-point offsets that spread `count` units into a compact square grid so a
 * group order does not stack everyone on one spot. Centred on (0,0); the caller
 * adds the command point. Spacing leaves a small gap between unit footprints.
 */
export function formationOffsets(count: number): Array<{ x: number; z: number }> {
  const offsets: Array<{ x: number; z: number }> = [];
  if (count <= 0) return offsets;
  const spacing = UNIT_RADIUS * 2 + 0.6;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const halfW = ((cols - 1) * spacing) / 2;
  const halfH = ((rows - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    offsets.push({ x: col * spacing - halfW, z: row * spacing - halfH });
  }
  return offsets;
}
