/**
 * Per-slot collision spacing — Askerî AI v2 planı §5.
 *
 * A formation used to be laid out on one spacing derived from the *widest* unit
 * in the group: `max(navRadius) * 2 + padding`. A Topçu is 1.5× the radius of
 * everyone else (`unit.ts` ROLE_BODY), so a single gun stretched the whole
 * formation — twenty Guards stood a gun's width apart because one gun was
 * standing behind them.
 *
 * The fix is to stop asking "how wide is the widest unit" and start asking, per
 * neighbouring pair, "how far apart do *these two* have to stand":
 *
 *     spacing(a, b) = radius(a) + radius(b) + padding
 *
 * So the grid is laid out on the typical unit ({@link formationBaseSpacing}) and
 * the pairs that genuinely need more room take it locally
 * ({@link relaxSlotSpacing}). The siege's radius now only inflates the siege's
 * own neighbourhood.
 */
import { Vector3 } from "three";

/** Breathing room between two touching unit bodies, on top of both radii. */
export const FORMATION_SLOT_PADDING = 0.6;

/** How far apart two neighbouring slots have to sit for their units to fit. */
export function formationPairSpacing(radiusA: number, radiusB: number): number {
  return radiusA + radiusB + FORMATION_SLOT_PADDING;
}

/**
 * The spacing the formation grid is generated on: the *typical* unit rather
 * than the widest one.
 *
 * The upper median, not the mean, because a mean is still dragged by an outlier
 * and the outlier is exactly what this exists to stop. For a group of one role —
 * which is most groups — median equals max, so the geometry is bit-identical to
 * what the single-spacing version produced.
 */
export function formationBaseSpacing(radii: readonly number[]): number {
  if (radii.length === 0) return FORMATION_SLOT_PADDING;
  const sorted = [...radii].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return median * 2 + FORMATION_SLOT_PADDING;
}

/** The spacing a set of units of one role needs between its own slots. */
export function formationSpacingForRadii(radii: readonly number[]): number {
  if (radii.length === 0) return FORMATION_SLOT_PADDING;
  return Math.max(...radii) * 2 + FORMATION_SLOT_PADDING;
}

/** Six passes settle every overlap these formations can produce; the loop exits early anyway. */
const RELAX_PASSES = 6;
const RELAX_EPSILON = 1e-6;

/**
 * Push overlapping slot pairs apart until each pair clears
 * {@link formationPairSpacing}.
 *
 * `slots` and `radii` are index-aligned: entry *i* is the slot unit *i* was
 * matched to. A uniform-radius group returns untouched clones, which is what
 * keeps every single-role formation exactly where it was.
 *
 * Determinism (§17.3): the pass order is fixed, the push is symmetric, and a
 * degenerate pair sitting on the same point separates along +x rather than along
 * a normalised zero vector.
 */
export function relaxSlotSpacing(
  slots: readonly Vector3[],
  radii: readonly number[],
): Vector3[] {
  const result = slots.map((slot) => slot.clone());
  if (result.length < 2) return result;
  const first = radii[0];
  if (radii.every((radius) => radius === first)) return result;

  for (let pass = 0; pass < RELAX_PASSES; pass += 1) {
    let moved = false;
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const left = result[i];
        const right = result[j];
        if (!left || !right) continue;
        const required = formationPairSpacing(radii[i] ?? 0, radii[j] ?? 0);
        const dx = right.x - left.x;
        const dz = right.z - left.z;
        const distance = Math.hypot(dx, dz);
        if (distance >= required - RELAX_EPSILON) continue;
        const axisX = distance > RELAX_EPSILON ? dx / distance : 1;
        const axisZ = distance > RELAX_EPSILON ? dz / distance : 0;
        const push = (required - distance) / 2;
        left.x -= axisX * push;
        left.z -= axisZ * push;
        right.x += axisX * push;
        right.z += axisZ * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return result;
}
