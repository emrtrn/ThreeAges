/**
 * Where the active step's building should go — Hikâye / Öğretici Tur Modu,
 * Sürüm 2 (§12.4).
 *
 * The plan expected this to need a per-step strategy in the data ("near forest",
 * "on a stone node", "at the control edge"). Reading the placement rules made
 * that unnecessary, and the version without it is the honest one:
 *
 * > **The rules already know.** `StructureConstructionService.validate()` is the
 * > single authority on whether a building may stand somewhere — control area,
 * > footprint clearance, a Lumber Camp's nearby trees, a Quarry's deposit, an
 * > Outpost's expansion gap. A solver that re-encoded any of that would be a
 * > second opinion that can disagree with the one the click is judged by, and a
 * > marker pointing at ground the game then refuses is worse than no marker.
 *
 * So the search is: ask the real validator about a field of candidates, and rank
 * the ones it accepts by the thing the tur is actually teaching — *touch the
 * centre's road network*. Nothing here is building-specific, and a fork adding a
 * building with new placement rules gets correct hints for free.
 *
 * Pure: no three.js, no DOM. The caller supplies the world as three small
 * readings, which is what lets `test:engine` drive it with object literals.
 */

export interface MissionSiteCandidateWorld {
  /** Where the search is centred — the player's command centre. */
  readonly origin: { readonly x: number; readonly z: number };
  /**
   * Road cells on the centre's own network. Empty when the centre has lost its
   * road, which is a real state: the solver then ranks by distance to the centre
   * alone, which is still the right answer (build near home, then connect).
   */
  readonly mainRoadCells: readonly { readonly x: number; readonly z: number }[];
  /** Half-extents of the building being placed, for edge-to-road distance. */
  readonly footprint: { readonly width: number; readonly depth: number };
  /** The real placement verdict. Returns null when the building id is unknown. */
  readonly validate: (x: number, z: number) => { readonly x: number; readonly z: number; readonly valid: boolean } | null;
}

export interface MissionSite {
  readonly x: number;
  readonly z: number;
}

/**
 * How far out to look, in world units. Wider than the Settlement centre's
 * control radius (28) because the Outpost step is deliberately asking for ground
 * *outside* it; past this the answer stops being "over there" and starts being a
 * map tour the player did not ask for.
 */
const SEARCH_RADIUS = 56;
/**
 * Sampling step. The placement grid is finer, but a hint is a "roughly here"
 * gesture — the player still places the building themselves, and a finer sweep
 * would multiply the validator calls for a marker nobody can aim to that
 * precision anyway.
 */
const SEARCH_STEP = 4;

/**
 * Best legal spot for this building, or null when the search found none.
 *
 * Null is a real answer and the caller must treat it as one: no valid ground
 * inside the search radius means the honest hint is silence, not a marker on
 * ground the game will refuse.
 */
export function solveMissionSite(world: MissionSiteCandidateWorld): MissionSite | null {
  const halfWidth = world.footprint.width / 2;
  const halfDepth = world.footprint.depth / 2;
  const candidates: { x: number; z: number; roadDistance: number; originDistance: number }[] = [];

  for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx += SEARCH_STEP) {
    for (let dz = -SEARCH_RADIUS; dz <= SEARCH_RADIUS; dz += SEARCH_STEP) {
      const originDistance = Math.hypot(dx, dz);
      if (originDistance > SEARCH_RADIUS) continue;
      const x = world.origin.x + dx;
      const z = world.origin.z + dz;
      // Edge-to-cell rather than centre-to-cell: what decides whether a building
      // joins the network is its *footprint* touching a road, which is the same
      // measure `roadCellTouchingFootprint` uses on the other side.
      let roadDistance = Number.POSITIVE_INFINITY;
      for (const cell of world.mainRoadCells) {
        const distance = Math.hypot(
          Math.max(0, Math.abs(cell.x - x) - halfWidth),
          Math.max(0, Math.abs(cell.z - z) - halfDepth),
        );
        if (distance < roadDistance) roadDistance = distance;
      }
      candidates.push({ x, z, roadDistance, originDistance });
    }
  }

  // Rank *before* validating, and stop at the first candidate the rules accept.
  //
  // The ranking reads only geometry — where the roads are, where home is —
  // which is knowable without asking the validator anything, so the expensive
  // question ("may I build here?") gets asked of the best candidate first and
  // usually only a handful of times. The result is identical to validating the
  // whole field and picking the best of what came back, because the first valid
  // entry of a sorted list *is* the best valid entry.
  //
  // Nearest to the network wins; distance from home breaks ties, so among spots
  // that all touch the same road the hint stays close rather than wandering off
  // down it. The final tie-break on coordinates keeps the sweep deterministic:
  // two equally good spots must not alternate frame to frame.
  candidates.sort((a, b) =>
    a.roadDistance - b.roadDistance
    || a.originDistance - b.originDistance
    || a.x - b.x
    || a.z - b.z);

  for (const candidate of candidates) {
    const result = world.validate(candidate.x, candidate.z);
    // The returned position is the validator's own snap, not the sample: the
    // marker has to sit where the building would actually land.
    if (result?.valid) return { x: result.x, z: result.z };
  }
  return null;
}
