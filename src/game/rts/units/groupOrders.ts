/**
 * Group order distribution — Vertical Slice Plan v0.2 §45 ("Grup hareketi").
 *
 * A group order is one click that has to become N destinations. Handing out the
 * formation slots in selection order is what makes a marching column cross over
 * itself: the unit standing on the left of the group gets the right-hand slot and
 * walks through everyone. This module assigns slots by proximity instead, so the
 * group keeps its shape.
 *
 * The pipeline is deliberately split in two (Askerî AI v2 planı §5):
 *
 *     geometry → role bands → unit↔slot matching → per-pair spacing → pathing
 *
 * Everything up to and including the spacing pass is pure geometry over plain
 * numbers; only the last step touches navigation. That is what lets the siege's
 * radius widen its own neighbourhood without widening the whole formation, and
 * what keeps the role bands testable without a nav grid.
 */
import { Vector3 } from "three";

import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { Unit } from "./unit";
import { formationOffsets as legacyFormationOffsets } from "./unitMovement";
import { rtsFormationWorldSlots } from "./formations/rtsFormationGenerator";
import {
  formationBaseSpacing,
  formationPairSpacing,
  formationSpacingForRadii,
  relaxSlotSpacing,
} from "./formations/slotSpacing";
import { DEFAULT_RTS_FORMATION, type RtsFormationId } from "./formations/rtsFormationTypes";

/** One unit's share of a group order. A null `path` means "no route exists". */
export interface GroupDestination {
  readonly unit: Unit;
  readonly destination: Vector3;
  readonly path: Vector3[] | null;
  /** Recovery used only after the exact formation slot could not be reached. */
  readonly fallback?: "nearby" | "free";
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

  // Formations belong only to combat units. Workers still receive their legacy
  // group-move targets, but combat destinations reserve space so workers do not
  // immediately stack into the formation.
  const combatUnits = units.filter((unit) => unit.role !== "worker");
  if (combatUnits.length < 2) {
    return assignDestinationsToSlots(units, legacySlots(units.length, point), point, navigation, reservations);
  }
  const centroid = combatUnits.reduce((total, unit) => total.add(unit.position), new Vector3())
    .multiplyScalar(1 / combatUnits.length);
  // §5: the grid is laid out on the typical unit. A Topçu no longer sets the
  // spacing for twenty Guards; it takes its own room in `relaxSlotSpacing`.
  const spacing = formationBaseSpacing(combatUnits.map((unit) => unit.navRadius));
  const combatDestinations = assignFormationCombatDestinations(
    formation,
    combatUnits,
    point,
    centroid,
    spacing,
    navigation,
    reservations,
  );
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

/**
 * A blocked formation first tightens as a group. Only once all three spacings
 * fail do individual slots search nearby ground; a final free-grid fallback
 * keeps one bad slot from stopping the squad.
 */
function assignFormationCombatDestinations(
  formation: RtsFormationId,
  units: readonly Unit[],
  point: Vector3,
  centroid: Vector3,
  spacing: number,
  navigation: RtsNavigation,
  reservations: readonly DestinationReservation[],
): GroupDestination[] {
  const assign = (candidateSpacing: number, allowNearbyFallback: boolean): GroupDestination[] => {
    const desired = formationSlotsForUnits(formation, units, point, centroid, candidateSpacing);
    return planUnitDestinations(units, desired, point, navigation, reservations, allowNearbyFallback);
  };
  for (const multiplier of [1, 0.9, 0.8]) {
    const destinations = assign(spacing * multiplier, false);
    if (destinations.every((entry) => entry.path !== null && entry.fallback === undefined)) return destinations;
  }
  const nearby = assign(spacing * 0.8, true);
  if (nearby.every((entry) => entry.path !== null && entry.fallback !== "free")) return nearby;
  return assignDestinationsToSlots(units, legacySlots(units.length, point), point, navigation, reservations);
}

/**
 * The world slot each unit should stand on, index-aligned with `units`.
 *
 * Pure: geometry, role bands and per-pair spacing, no navigation. The final
 * {@link relaxSlotSpacing} pass is what implements §5 — every branch below may
 * lay its shape out on the base spacing and trust the relaxation to widen the
 * few pairs that a wide-bodied unit actually touches.
 */
export function formationSlotsForUnits(
  formation: RtsFormationId,
  units: readonly Unit[],
  point: Vector3,
  centroid: Vector3,
  spacing: number,
): Vector3[] {
  const groups = combatRoleGroups(units);
  const forward = point.clone().sub(centroid).setY(0).normalize();
  if (forward.lengthSq() === 0) forward.set(0, 0, 1);
  const raw = groups.length <= 1
    ? matchSlotsToUnits(units, rtsFormationWorldSlots(formation, units.length, spacing, centroid, point))
    : formation === "line"
      ? roleRankSlots(units, groups, point, centroid, forward)
      : formation === "wedge"
        ? wedgeWithSupportSlots(units, groups, point, centroid, forward)
        : formation === "square"
          ? roleRingSlots(units, groups, point, centroid, spacing, forward)
          : roleDepthSlots(formation, units, groups, point, centroid, spacing, forward);
  return relaxSlotSpacing(raw, units.map((unit) => unit.navRadius));
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

function groupSpacing(group: readonly Unit[]): number {
  return formationSpacingForRadii(group.map((unit) => unit.navRadius));
}

function groupRadius(group: readonly Unit[]): number {
  return Math.max(0, ...group.map((unit) => unit.navRadius));
}

/**
 * Hat: one rank per role, each rank laid out on *its own* spacing and separated
 * from its neighbour by that pair's collision distance (§5).
 *
 * Guards take the forward rank, Archers the next, Siege the rear — and the
 * gap in front of the Siege rank is the only one a gun's radius widens.
 */
function roleRankSlots(
  units: readonly Unit[],
  groups: readonly Unit[][],
  point: Vector3,
  centroid: Vector3,
  forward: Vector3,
): Vector3[] {
  const depths = rankDepths(groups);
  const mean = depths.reduce((sum, depth) => sum + depth, 0) / depths.length;
  const slotForUnit = new Map<Unit, Vector3>();
  groups.forEach((group, index) => {
    // Centre all ranks on the requested target: guards occupy the positive
    // forward rank, archers the next, and siege the rear-centre rank.
    const rankTarget = point.clone().addScaledVector(forward, mean - (depths[index] ?? 0));
    const slots = rtsFormationWorldSlots("line", group.length, groupSpacing(group), centroid, rankTarget);
    matchSlotsToUnits(group, slots).forEach((slot, member) => {
      const unit = group[member];
      if (unit) slotForUnit.set(unit, slot);
    });
  });
  return units.map((unit) => slotForUnit.get(unit)?.clone() ?? point.clone());
}

/** Cumulative depth of each role rank behind the front one, in world units. */
function rankDepths(groups: readonly Unit[][]): number[] {
  const depths = [0];
  for (let index = 1; index < groups.length; index += 1) {
    const previous = groups[index - 1] ?? [];
    const current = groups[index] ?? [];
    depths.push((depths[index - 1] ?? 0) + formationPairSpacing(groupRadius(previous), groupRadius(current)));
  }
  return depths;
}

/**
 * Kama — §4: an assault wedge with a support tail, not one geometric triangle.
 *
 * The front role forms the wedge; every role behind it forms a straight support
 * rank at the pair distance behind the wedge's own rear. A twenty-unit army with
 * two guns should not be a twenty-unit triangle with the guns forming its widest
 * row — the tip is what charges, the tail is what shoots over it.
 */
function wedgeWithSupportSlots(
  units: readonly Unit[],
  groups: readonly Unit[][],
  point: Vector3,
  centroid: Vector3,
  forward: Vector3,
): Vector3[] {
  const vanguard = groups[0] ?? [];
  const support = groups.slice(1);
  const slotForUnit = new Map<Unit, Vector3>();
  const wedgeSlots = rtsFormationWorldSlots("wedge", vanguard.length, groupSpacing(vanguard), centroid, point);
  matchSlotsToUnits(vanguard, wedgeSlots).forEach((slot, member) => {
    const unit = vanguard[member];
    if (unit) slotForUnit.set(unit, slot);
  });
  // How far the wedge's rearmost rank already sits behind the command point;
  // the first support rank starts a pair distance behind that.
  const wedgeRear = Math.max(0, ...wedgeSlots.map((slot) =>
    -((slot.x - point.x) * forward.x + (slot.z - point.z) * forward.z)));
  let depth = wedgeRear;
  let previous = vanguard;
  for (const group of support) {
    depth += formationPairSpacing(groupRadius(previous), groupRadius(group));
    const rankTarget = point.clone().addScaledVector(forward, -depth);
    const slots = rtsFormationWorldSlots("line", group.length, groupSpacing(group), centroid, rankTarget);
    matchSlotsToUnits(group, slots).forEach((slot, member) => {
      const unit = group[member];
      if (unit) slotForUnit.set(unit, slot);
    });
    previous = group;
  }
  return units.map((unit) => slotForUnit.get(unit)?.clone() ?? point.clone());
}

/**
 * Kare: fill from the outer ring inward, so Guards surround Archers and Siege.
 *
 * Higher Chebyshev radius means an outer ring slot. Filling from that ring
 * inward puts guards around vulnerable archers and siege without assigning a
 * stat bonus or requiring a rigid combat formation.
 */
function roleRingSlots(
  units: readonly Unit[],
  groups: readonly Unit[][],
  point: Vector3,
  centroid: Vector3,
  spacing: number,
  forward: Vector3,
): Vector3[] {
  const right = new Vector3(forward.z, 0, -forward.x);
  const slots = rtsFormationWorldSlots("square", units.length, spacing, centroid, point);
  const ring = (slot: Vector3): number => {
    const offset = slot.clone().sub(point);
    return Math.max(Math.abs(offset.dot(right)), Math.abs(offset.dot(forward)));
  };
  slots.sort((left, rightSlot) => ring(rightSlot) - ring(left));
  return sliceSlotsPerGroup(units, groups, slots, point);
}

/**
 * Every other shape (Kol, Hilal, Dağınık): one geometry, its slots ordered front
 * to back and handed out in role order.
 *
 * §6 is why `loose` is in here rather than skipping the role branches. Dağınık
 * used to be a bare index grid, which put Topçu wherever its index landed —
 * regularly at the front. Ordering the same jittered slots by depth and filling
 * them Guard → Archer → Siege gives the three invisible bands the plan asks for
 * (roughly front 40% / middle 35% / rear 25% at the shipped composition ratio)
 * while every slot position, including the deterministic jitter, is untouched.
 */
function roleDepthSlots(
  formation: RtsFormationId,
  units: readonly Unit[],
  groups: readonly Unit[][],
  point: Vector3,
  centroid: Vector3,
  spacing: number,
  forward: Vector3,
): Vector3[] {
  const slots = rtsFormationWorldSlots(formation, units.length, spacing, centroid, point)
    .sort((left, right) => (
      (right.x - point.x) * forward.x + (right.z - point.z) * forward.z
    ) - (
      (left.x - point.x) * forward.x + (left.z - point.z) * forward.z
    ));
  return sliceSlotsPerGroup(units, groups, slots, point);
}

/** Hand each role band its own contiguous slice of an already-ordered slot list. */
function sliceSlotsPerGroup(
  units: readonly Unit[],
  groups: readonly Unit[][],
  slots: readonly Vector3[],
  point: Vector3,
): Vector3[] {
  const slotForUnit = new Map<Unit, Vector3>();
  let slotIndex = 0;
  for (const group of groups) {
    const groupSlots = slots.slice(slotIndex, slotIndex + group.length);
    slotIndex += group.length;
    matchSlotsToUnits(group, groupSlots).forEach((slot, member) => {
      const unit = group[member];
      if (unit) slotForUnit.set(unit, slot);
    });
  }
  return units.map((unit) => slotForUnit.get(unit)?.clone() ?? point.clone());
}

/**
 * Match units to slots by proximity, closest pair first, and return the slot
 * each unit won — index-aligned with `units`.
 *
 * Ties are broken by index so the assignment is deterministic, which is what
 * lets a test assert an exact slot rather than "some slot".
 */
function matchSlotsToUnits(units: readonly Unit[], slots: readonly Vector3[]): Vector3[] {
  const pairs: Array<{ unit: number; slot: number; distance: number }> = [];
  units.forEach((unit, u) => {
    slots.forEach((slot, s) => {
      const distance = Math.hypot(unit.position.x - slot.x, unit.position.z - slot.z);
      pairs.push({ unit: u, slot: s, distance });
    });
  });
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
  const fallback = slots[0] ?? new Vector3();
  return units.map((_, u) => (slots[slotForUnit[u] ?? -1] ?? fallback).clone());
}

function assignDestinationsToSlots(
  units: readonly Unit[],
  slots: readonly Vector3[],
  point: Vector3,
  navigation: RtsNavigation,
  reservations: readonly DestinationReservation[],
  allowNearbyFallback = true,
): GroupDestination[] {
  return planUnitDestinations(
    units,
    matchSlotsToUnits(units, slots),
    point,
    navigation,
    reservations,
    allowNearbyFallback,
  );
}

/** Turn one already-chosen slot per unit into a routed destination. */
function planUnitDestinations(
  units: readonly Unit[],
  desired: readonly Vector3[],
  point: Vector3,
  navigation: RtsNavigation,
  reservations: readonly DestinationReservation[],
  allowNearbyFallback: boolean,
): GroupDestination[] {
  // The formation slots are already unique. Keep the established one-plan-per-
  // unit fast path unless another *active order* has claimed a destination.
  // The reservation search below is intentionally exceptional: its grid probes
  // are only justified when a later command would otherwise stack units.
  if (reservations.length === 0) {
    return units.map((unit, u) => {
      const slot = desired[u] ?? point;
      const path = navigation.isWalkable(slot.x, slot.z)
        ? navigation.plan(unit.position, slot)
        : null;
      if (path) return { unit, destination: slot, path };
      if (allowNearbyFallback) {
        const nearby = nearestAvailableDestination(unit, slot, navigation, []);
        if (nearby) return { unit, destination: nearby.destination, path: nearby.path, fallback: "nearby" };
      }
      const freePath = navigation.plan(unit.position, point);
      return {
        unit,
        destination: freePath?.[freePath.length - 1]?.clone() ?? point.clone(),
        path: freePath,
        fallback: "free",
      };
    });
  }

  const occupied = [...reservations];
  return units.map((unit, u) => {
    const slot = desired[u] ?? point;
    const slotAvailable = navigation.isWalkable(slot.x, slot.z) && !occupied.some((reservation) => Math.hypot(
      slot.x - reservation.position.x,
      slot.z - reservation.position.z,
    ) < unit.navRadius + reservation.radius + DESTINATION_CLEARANCE);
    const directPath = slotAvailable ? navigation.plan(unit.position, slot) : null;
    if (directPath) {
      occupied.push({ position: slot.clone(), radius: unit.navRadius });
      return { unit, destination: slot, path: directPath };
    }
    const nearby = allowNearbyFallback
      ? nearestAvailableDestination(unit, slot, navigation, occupied)
      : null;
    if (nearby) {
      occupied.push({ position: nearby.destination, radius: unit.navRadius });
      return { unit, destination: nearby.destination, path: nearby.path, fallback: "nearby" };
    }
    return { unit, destination: point.clone(), path: null, fallback: "free" };
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
