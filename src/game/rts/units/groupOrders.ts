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
import { formationOffsets as legacyFormationOffsets } from "./unitMovement";
import { rtsFormationWorldSlots, type RtsGeometricFormationId } from "./formations/rtsFormationGenerator";
import { DEFAULT_RTS_FORMATION, type RtsFormationId } from "./formations/rtsFormationTypes";

/** One unit's share of a group order. A null `path` means "no route exists". */
export interface GroupDestination {
  readonly unit: Unit;
  readonly destination: Vector3;
  readonly path: Vector3[] | null;
}

/** A destination already claimed by another active player order. */
export interface DestinationReservation {
  readonly position: Vector3;
  readonly radius: number;
}

const DESTINATION_CLEARANCE = 0.2;
const DESTINATION_SEARCH_STEP = 1.5;
const DESTINATION_SEARCH_RINGS = 4;

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
  reservations: readonly DestinationReservation[] = [],
  formation: RtsFormationId = DEFAULT_RTS_FORMATION,
): GroupDestination[] {
  if (units.length === 0) return [];

  if (formation === "free") {
    return assignDestinationsToSlots(units, legacySlots(units.length, point), point, navigation, reservations);
  }

  // Formations belong only to combat units. Workers still receive their legacy
  // group-move targets, but combat destinations reserve space so workers do not
  // immediately stack into the formation.
  const combatUnits = units.filter((unit) => unit.role !== "worker");
  if (combatUnits.length < 2) {
    return assignDestinationsToSlots(units, legacySlots(units.length, point), point, navigation, reservations);
  }
  const centroid = combatUnits.reduce((total, unit) => total.add(unit.position), new Vector3())
    .multiplyScalar(1 / combatUnits.length);
  const spacing = Math.max(...combatUnits.map((unit) => unit.navRadius * 2)) + 0.6;
  const combatDestinations = formation === "line"
    ? assignRoleAwareLineDestinations(combatUnits, point, centroid, spacing, navigation, reservations)
    : formation === "square"
      ? assignRoleAwareSquareDestinations(combatUnits, point, centroid, spacing, navigation, reservations)
      : formation === "loose"
        ? assignDestinationsToSlots(
          combatUnits,
          rtsFormationWorldSlots(formation, combatUnits.length, spacing, centroid, point),
          point,
          navigation,
          reservations,
        )
        : assignRoleAwareDepthDestinations(formation, combatUnits, point, centroid, spacing, navigation, reservations);
  const workers = units.filter((unit) => unit.role === "worker");
  if (workers.length === 0) return combatDestinations;
  const workerDestinations = assignDestinationsToSlots(
    workers,
    legacySlots(workers.length, point),
    point,
    navigation,
    [
      ...reservations,
      ...combatDestinations.map((entry) => ({ position: entry.destination, radius: entry.unit.navRadius })),
    ],
  );
  const byUnit = new Map([...combatDestinations, ...workerDestinations].map((entry) => [entry.unit, entry]));
  return units.map((unit) => byUnit.get(unit) ?? { unit, destination: point.clone(), path: null });
}

function legacySlots(count: number, point: Vector3): Vector3[] {
  return legacyFormationOffsets(count)
    .map((offset) => new Vector3(point.x + offset.x, 0, point.z + offset.z));
}

/** Guard, Archer, Siege, then any future combat role: front to back priority. */
function combatRoleGroups(units: readonly Unit[]): Unit[][] {
  return [
    units.filter((unit) => unit.role === "guard"),
    units.filter((unit) => unit.role === "archer"),
    units.filter((unit) => unit.role === "siege"),
    units.filter((unit) => unit.role !== "guard" && unit.role !== "archer" && unit.role !== "siege"),
  ].filter((group) => group.length > 0);
}

function assignRoleAwareLineDestinations(
  units: readonly Unit[],
  point: Vector3,
  centroid: Vector3,
  spacing: number,
  navigation: RtsNavigation,
  reservations: readonly DestinationReservation[],
): GroupDestination[] {
  const groups = combatRoleGroups(units);
  if (groups.length <= 1) {
    return assignDestinationsToSlots(
      units,
      rtsFormationWorldSlots("line", units.length, spacing, centroid, point),
      point,
      navigation,
      reservations,
    );
  }
  const forward = point.clone().sub(centroid).setY(0).normalize();
  if (forward.lengthSq() === 0) forward.set(0, 0, 1);
  const assigned: GroupDestination[] = [];
  groups.forEach((group, index) => {
    // Centre all ranks on the requested target: guards occupy the positive
    // forward rank, archers the next, and siege the rear-centre rank.
    const rankOffset = ((groups.length - 1) / 2 - index) * spacing;
    const rankTarget = point.clone().addScaledVector(forward, rankOffset);
    const destinations = assignDestinationsToSlots(
      group,
      rtsFormationWorldSlots("line", group.length, spacing, centroid, rankTarget),
      point,
      navigation,
      [
        ...reservations,
        ...assigned.map((entry) => ({ position: entry.destination, radius: entry.unit.navRadius })),
      ],
    );
    assigned.push(...destinations);
  });
  return destinationsInSelectionOrder(units, assigned, point);
}

function assignRoleAwareDepthDestinations(
  formation: Exclude<RtsGeometricFormationId, "line" | "square" | "loose">,
  units: readonly Unit[],
  point: Vector3,
  centroid: Vector3,
  spacing: number,
  navigation: RtsNavigation,
  reservations: readonly DestinationReservation[],
): GroupDestination[] {
  const groups = combatRoleGroups(units);
  if (groups.length <= 1) {
    return assignDestinationsToSlots(
      units,
      rtsFormationWorldSlots(formation, units.length, spacing, centroid, point),
      point,
      navigation,
      reservations,
    );
  }
  const forward = point.clone().sub(centroid).setY(0).normalize();
  if (forward.lengthSq() === 0) forward.set(0, 0, 1);
  const slots = rtsFormationWorldSlots(formation, units.length, spacing, centroid, point)
    .sort((left, right) => (
      (right.x - point.x) * forward.x + (right.z - point.z) * forward.z
    ) - (
      (left.x - point.x) * forward.x + (left.z - point.z) * forward.z
    ));
  const assigned: GroupDestination[] = [];
  let slotIndex = 0;
  for (const group of groups) {
    const groupSlots = slots.slice(slotIndex, slotIndex + group.length);
    slotIndex += group.length;
    const destinations = assignDestinationsToSlots(group, groupSlots, point, navigation, [
      ...reservations,
      ...assigned.map((entry) => ({ position: entry.destination, radius: entry.unit.navRadius })),
    ]);
    assigned.push(...destinations);
  }
  return destinationsInSelectionOrder(units, assigned, point);
}

function assignRoleAwareSquareDestinations(
  units: readonly Unit[],
  point: Vector3,
  centroid: Vector3,
  spacing: number,
  navigation: RtsNavigation,
  reservations: readonly DestinationReservation[],
): GroupDestination[] {
  const groups = combatRoleGroups(units);
  const slots = rtsFormationWorldSlots("square", units.length, spacing, centroid, point);
  if (groups.length <= 1) {
    return assignDestinationsToSlots(units, slots, point, navigation, reservations);
  }
  const forward = point.clone().sub(centroid).setY(0).normalize();
  if (forward.lengthSq() === 0) forward.set(0, 0, 1);
  const right = new Vector3(forward.z, 0, -forward.x);
  // Higher Chebyshev radius means an outer ring slot. Filling from that ring
  // inward puts guards around vulnerable archers and siege without assigning a
  // stat bonus or requiring a rigid combat formation.
  slots.sort((left, rightSlot) => {
    const leftOffset = left.clone().sub(point);
    const rightOffset = rightSlot.clone().sub(point);
    const leftRing = Math.max(Math.abs(leftOffset.dot(right)), Math.abs(leftOffset.dot(forward)));
    const rightRing = Math.max(Math.abs(rightOffset.dot(right)), Math.abs(rightOffset.dot(forward)));
    return rightRing - leftRing;
  });
  const assigned: GroupDestination[] = [];
  let slotIndex = 0;
  for (const group of groups) {
    const groupSlots = slots.slice(slotIndex, slotIndex + group.length);
    slotIndex += group.length;
    const destinations = assignDestinationsToSlots(group, groupSlots, point, navigation, [
      ...reservations,
      ...assigned.map((entry) => ({ position: entry.destination, radius: entry.unit.navRadius })),
    ]);
    assigned.push(...destinations);
  }
  return destinationsInSelectionOrder(units, assigned, point);
}

function destinationsInSelectionOrder(
  units: readonly Unit[],
  destinations: readonly GroupDestination[],
  point: Vector3,
): GroupDestination[] {
  const byUnit = new Map(destinations.map((entry) => [entry.unit, entry]));
  return units.map((unit) => byUnit.get(unit) ?? { unit, destination: point.clone(), path: null });
}

function assignDestinationsToSlots(
  units: readonly Unit[],
  slots: readonly Vector3[],
  point: Vector3,
  navigation: RtsNavigation,
  reservations: readonly DestinationReservation[],
): GroupDestination[] {
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

  // The formation slots are already unique. Keep the established one-plan-per-
  // unit fast path unless another *active order* has claimed a destination.
  // The reservation search below is intentionally exceptional: its grid probes
  // are only justified when a later command would otherwise stack units.
  if (reservations.length === 0) {
    return units.map((unit, u) => {
      const slot = slots[slotForUnit[u] ?? 0] ?? point;
      const path = navigation.plan(unit.position, slot) ?? navigation.plan(unit.position, point);
      return { unit, destination: slot, path };
    });
  }

  const occupied = [...reservations];
  return units.map((unit, u) => {
    const slot = slots[slotForUnit[u] ?? 0] ?? point;
    const assigned = nearestAvailableDestination(unit, slot, navigation, occupied)
      ?? nearestAvailableDestination(unit, point, navigation, occupied);
    if (!assigned) return { unit, destination: slot, path: null };
    occupied.push({ position: assigned.destination, radius: unit.navRadius });
    return { unit, destination: assigned.destination, path: assigned.path };
  });
}

/** Find the closest walkable, unclaimed destination around the requested slot. */
function nearestAvailableDestination(
  unit: Unit,
  desired: Vector3,
  navigation: RtsNavigation,
  occupied: readonly DestinationReservation[],
): { destination: Vector3; path: Vector3[] } | null {
  const candidates = [desired.clone()];
  for (let ring = 1; ring <= DESTINATION_SEARCH_RINGS; ring += 1) {
    const distance = ring * DESTINATION_SEARCH_STEP;
    for (let step = 0; step < 8; step += 1) {
      const angle = (step / 8) * Math.PI * 2;
      candidates.push(new Vector3(
        desired.x + Math.cos(angle) * distance,
        0,
        desired.z + Math.sin(angle) * distance,
      ));
    }
  }
  for (const candidate of candidates) {
    if (!navigation.isWalkable(candidate.x, candidate.z)) continue;
    if (occupied.some((reservation) => Math.hypot(
      candidate.x - reservation.position.x,
      candidate.z - reservation.position.z,
    ) < unit.navRadius + reservation.radius + DESTINATION_CLEARANCE)) continue;
    const path = navigation.plan(unit.position, candidate);
    if (path) return { destination: path[path.length - 1]?.clone() ?? candidate, path };
  }
  return null;
}
