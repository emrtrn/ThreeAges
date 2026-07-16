/**
 * Structure destruction — plan §37.2 (Faz 5.1 durability prerequisite).
 *
 * The mirror of `updateUnitDeaths`: it removes structures whose health ran out
 * and reports them, so the caller can refresh the world state a footprint's
 * disappearance invalidates (navigation blockers, control area).
 *
 * Deliberately the *only* place a depleted structure is removed. Most systems
 * already reconcile against `structures.all()` every tick — worker construction
 * drops assignments to a vanished site, economy production releases its
 * gatherers, the logistics graphs recompute their nodes, and the AI's build
 * manager frees its §42 slot — so destruction needs no per-system notification.
 * Territory and navigation are the exceptions: both are cached and rebuilt only
 * when something tells them to.
 */
import type { PlacedStructure, PlacedStructureSystem } from "./placedStructureSystem";

/**
 * Remove every structure whose health is depleted. Returns them newest-state
 * first for logging/presentation; `onDestroyed` fires per structure before the
 * next one is removed.
 */
export function updateStructureDestruction(
  structures: PlacedStructureSystem,
  onDestroyed?: (structure: PlacedStructure) => void,
): readonly PlacedStructure[] {
  // Snapshot first: `destroy` mutates the system's backing array.
  const destroyed = structures.all().filter((structure) => structure.health.depleted);
  for (const structure of destroyed) {
    structures.destroy(structure);
    onDestroyed?.(structure);
  }
  return destroyed;
}
