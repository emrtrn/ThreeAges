/**
 * Runtime-owned index for generic Spline Actors.
 *
 * The registry deliberately stays independent from Three.js and game systems:
 * Play builds it once from the authored layout, while later query/follower
 * systems consume the cached curve without touching editor data or render
 * objects.
 */
import type { LayoutSplineActor } from "./layout";
import { buildSplineCurveCache, type SplineCurveCache } from "./splineCurve";
import { normalizeSplineActor } from "./splineActor";

export interface RuntimeSplineEntry {
  readonly id: string;
  /** Normalized, independent snapshot of the authored actor. */
  readonly actor: LayoutSplineActor;
  /** Arc-length cache reused by the Phase 6 query and path-follower APIs. */
  readonly curve: SplineCurveCache;
}

export interface SplineRegistry {
  get(id: string | null | undefined): RuntimeSplineEntry | null;
  all(): readonly RuntimeSplineEntry[];
}

/**
 * Indexes authored splines in layout order. Empty or duplicate ids are skipped
 * so a hand-edited layout cannot make Play startup fail or create ambiguous
 * runtime references.
 */
export function createSplineRegistry(
  actors?: readonly LayoutSplineActor[],
): SplineRegistry {
  const byId = new Map<string, RuntimeSplineEntry>();
  const ordered: RuntimeSplineEntry[] = [];
  for (const source of actors ?? []) {
    if (!source.id || byId.has(source.id)) continue;
    const actor = normalizeSplineActor(source);
    const entry: RuntimeSplineEntry = {
      id: actor.id,
      actor,
      curve: buildSplineCurveCache(actor.spline),
    };
    byId.set(entry.id, entry);
    ordered.push(entry);
  }
  return {
    get: (id) => (id ? byId.get(id) ?? null : null),
    all: () => ordered,
  };
}
