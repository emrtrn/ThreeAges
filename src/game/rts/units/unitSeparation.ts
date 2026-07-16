/**
 * Crowd separation — Vertical Slice Plan v0.2 §45 ("Grup hareketi").
 *
 * Path following alone lets bodies occupy the same ground: twenty units ordered
 * onto one bridge arrive as one unit-shaped stack, and the two that meet head-on
 * inside a gap deadlock because neither has any reason to step aside. This pass
 * pushes overlapping bodies apart after movement each frame.
 *
 * It is deliberately not a full RVO/ORCA solver. The push is a bounded positional
 * nudge, capped well under a unit's own speed so it reads as jostling rather than
 * as a shove, and the navigation grid vetoes any nudge that would land a body
 * inside geometry. That keeps the guarantee that matters — a crowd unjams itself —
 * without a velocity-obstacle system the vertical slice cannot yet test.
 */
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { Unit } from "./unit";

/**
 * Fraction of its own speed a unit may be displaced by neighbours per second.
 * Below 1 by construction: separation must never outrun the order a unit was
 * given, or a dense group would drift away from its destination.
 */
const PUSH_SPEED_FACTOR = 0.55;
/**
 * Hash cell size. Bodies only interact within the sum of two radii, so a cell
 * comfortably wider than the largest such sum keeps the neighbour scan to the
 * 3x3 block around each unit instead of the whole army.
 */
const CELL_SIZE = 3;

export interface UnitSeparationOptions {
  /** Vetoes pushes into unwalkable ground; without it, geometry is not respected. */
  readonly navigation?: RtsNavigation;
}

/** Push overlapping live bodies apart, once per frame, after movement. */
export function updateUnitSeparation(
  units: readonly Unit[],
  dt: number,
  options: UnitSeparationOptions = {},
): void {
  if (dt <= 0 || units.length < 2) return;
  const active = units.filter((unit) => !unit.health.depleted && !unit.dying);
  if (active.length < 2) return;

  const buckets = new Map<string, Unit[]>();
  for (const unit of active) {
    const key = cellKey(unit.position.x, unit.position.z);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(unit);
    else buckets.set(key, [unit]);
  }

  const pushX = new Map<Unit, number>();
  const pushZ = new Map<Unit, number>();
  const seen = new Set<Unit>();
  for (const unit of active) {
    seen.add(unit);
    for (const other of neighbours(buckets, unit)) {
      // Each pair is resolved once, from whichever side reaches it first.
      if (seen.has(other)) continue;
      const dx = other.position.x - unit.position.x;
      const dz = other.position.z - unit.position.z;
      const minDistance = unit.navRadius + other.navRadius;
      const distance = Math.hypot(dx, dz);
      if (distance >= minDistance) continue;

      const overlap = minDistance - distance;
      // Exactly-stacked bodies (a spawn point, a fresh selection) have no
      // separating axis to read; give the pair a deterministic one so they part
      // instead of sharing a cell forever.
      const [axisX, axisZ] = distance > 1e-4
        ? [dx / distance, dz / distance]
        : deterministicAxis(unit, other);
      const share = overlap * 0.5;
      pushX.set(unit, (pushX.get(unit) ?? 0) - axisX * share);
      pushZ.set(unit, (pushZ.get(unit) ?? 0) - axisZ * share);
      pushX.set(other, (pushX.get(other) ?? 0) + axisX * share);
      pushZ.set(other, (pushZ.get(other) ?? 0) + axisZ * share);
    }
  }

  for (const unit of active) {
    const x = pushX.get(unit) ?? 0;
    const z = pushZ.get(unit) ?? 0;
    const magnitude = Math.hypot(x, z);
    if (magnitude <= 1e-4) continue;
    const limit = unit.speed * PUSH_SPEED_FACTOR * dt;
    const scale = Math.min(1, limit / magnitude);
    const nextX = unit.position.x + x * scale;
    const nextZ = unit.position.z + z * scale;
    if (options.navigation && !options.navigation.isWalkable(nextX, nextZ)) continue;
    unit.position.x = nextX;
    unit.position.z = nextZ;
  }
}

function cellKey(x: number, z: number): string {
  return `${Math.floor(x / CELL_SIZE)}:${Math.floor(z / CELL_SIZE)}`;
}

function* neighbours(buckets: Map<string, Unit[]>, unit: Unit): Generator<Unit> {
  const col = Math.floor(unit.position.x / CELL_SIZE);
  const row = Math.floor(unit.position.z / CELL_SIZE);
  for (let dc = -1; dc <= 1; dc += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      const bucket = buckets.get(`${col + dc}:${row + dr}`);
      if (!bucket) continue;
      for (const other of bucket) {
        if (other !== unit) yield other;
      }
    }
  }
}

/** Stable unit-length axis for a perfectly overlapping pair, from their ids. */
function deterministicAxis(unit: Unit, other: Unit): [number, number] {
  const angle = ((unit.id + other.id) % 8) * (Math.PI / 4);
  return [Math.cos(angle), Math.sin(angle)];
}
