/**
 * Group order distribution — Vertical Slice Plan v0.2 §45 ("Grup hareketi").
 *
 * A group order is one click that has to become N destinations. Handing out the
 * formation slots in selection order is what makes a marching column cross over
 * itself: the unit standing on the left of the group gets the right-hand slot and
 * walks through everyone. This module assigns slots by proximity instead, so the
 * group keeps its shape.
 */
import { Vector3 } from "three";

import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { Unit } from "./unit";
import { formationOffsets } from "./unitMovement";

/** One unit's share of a group order. A null `path` means "no route exists". */
export interface GroupDestination {
  readonly unit: Unit;
  readonly destination: Vector3;
  readonly path: Vector3[] | null;
}

/**
 * Spread a group order over formation slots and plan each unit onto its slot.
 *
 * Slots are matched to units greedily over every pair, closest pair first, which
 * for the small groups a player actually box-selects is both cheap and stable:
 * the same selection ordered differently produces the same assignment.
 *
 * A unit whose slot cannot be reached falls back to the raw command point before
 * being reported as unroutable — a slot pushed inside a rock by the formation
 * grid must not silently cancel that unit's order.
 */
export function assignGroupDestinations(
  units: readonly Unit[],
  point: Vector3,
  navigation: RtsNavigation,
): GroupDestination[] {
  if (units.length === 0) return [];

  const slots = formationOffsets(units.length)
    .map((offset) => new Vector3(point.x + offset.x, 0, point.z + offset.z));
  const pairs: Array<{ unit: number; slot: number; distance: number }> = [];
  units.forEach((unit, u) => {
    slots.forEach((slot, s) => {
      const distance = Math.hypot(unit.position.x - slot.x, unit.position.z - slot.z);
      pairs.push({ unit: u, slot: s, distance });
    });
  });
  // Ties are broken by index so the assignment is deterministic, which is what
  // lets a test assert an exact slot rather than "some slot".
  pairs.sort((a, b) => a.distance - b.distance || a.unit - b.unit || a.slot - b.slot);

  const slotForUnit = new Array<number>(units.length).fill(-1);
  const slotTaken = new Array<boolean>(slots.length).fill(false);
  let assigned = 0;
  for (const pair of pairs) {
    if (assigned === units.length) break;
    if (slotForUnit[pair.unit] !== -1 || slotTaken[pair.slot]) continue;
    slotForUnit[pair.unit] = pair.slot;
    slotTaken[pair.slot] = true;
    assigned += 1;
  }

  return units.map((unit, u) => {
    const slot = slots[slotForUnit[u] ?? 0] ?? point;
    const path = navigation.plan(unit.position, slot) ?? navigation.plan(unit.position, point);
    return { unit, destination: slot, path };
  });
}
