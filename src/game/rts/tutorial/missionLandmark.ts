/**
 * Which authored map feature a step is pointing at — Faz 3.
 *
 * **This is not the retired site solver, and the difference is the whole design.**
 * A short-lived version once proposed *where to build*: candidates run through
 * `StructureConstructionService.validate()` and ranked by nearness to the road.
 * The user play-tested it and had it removed (plan §12.9), for two reasons that
 * are still true:
 *
 * 1. "Rule-legal and near a road" is not the same as "a good spot". The rules say
 *    a place is not *forbidden*; they do not say which side of the forest, or
 *    whether the footprint blocks the stone deposit behind it.
 * 2. It jumped. Placing a building changed the candidate field, so the marker
 *    moved to the next proposal before the step had been read.
 *
 * What this points at instead is a **thing the level author put on the map** — a
 * stone deposit, a deer herd, a trade site. Both failures fall away rather than
 * being mitigated:
 *
 * - It is not advice. A Quarry is built *on* its deposit; there is exactly one
 *   legal answer and the map already decided it. Which side to approach from,
 *   which way to face, where the road runs — all still the player's. The step
 *   answers "where is the stone", which is scouting, not design.
 * - It cannot jump. The candidate set is static level content and the origin is
 *   the player's centre, so nothing recomputes into a different answer mid-step.
 *   (The one thing that can move it is fog lifting to reveal a nearer feature,
 *   which is the marker becoming *more* correct, not less.)
 *
 * The buildings whose placement genuinely *is* the lesson — House, Depot, Farm,
 * Market, Barracks, Outpost — carry no landmark, and that omission is the rule
 * rather than an oversight.
 *
 * Pure and DOM-free, so `test:engine` can state the choice directly.
 */
import type { MissionLandmark } from "./missionScript";

/**
 * One authored feature the marker could name, flattened to what choosing needs.
 *
 * `key` is matched against the landmark's own key — a resource id for a deposit
 * or a trade site, a species for a herd. Flattened by the caller rather than
 * read here, because the three live in three different systems and this module
 * has no business knowing any of them.
 */
export interface MissionLandmarkCandidate {
  readonly kind: MissionLandmark["kind"];
  readonly key: string;
  readonly x: number;
  readonly z: number;
}

export interface MissionLandmarkOrigin {
  readonly x: number;
  readonly z: number;
}

/**
 * The feature a landmark means, or null when the map has none the player may
 * know about.
 *
 * **Nearest to the player's own centre**, which is the only ordering that reads
 * as an answer rather than as a suggestion: on a map authored in pairs (this
 * project's convention — every deposit and every trade site has a mirrored twin
 * on the opponent's bank) the near one is the one being talked about, and the
 * far one is across the river in enemy territory.
 *
 * `isExplored` is the same fog gate the Market's supply panel applies, and for
 * the same reason: a marker on ground the player has never scouted would be
 * handing them a scouting result from inside their own base. Under fog the
 * marker simply does not appear until they have been there — which makes it
 * confirmation of something seen, never a reveal.
 *
 * Ties break on the candidate order the caller passed, which is the level's
 * authoring order — stable, so the marker cannot flicker between two features
 * that happen to be equidistant.
 */
export function nearestMissionLandmark(
  landmark: MissionLandmark | null | undefined,
  candidates: readonly MissionLandmarkCandidate[],
  origin: MissionLandmarkOrigin,
  isExplored: (x: number, z: number) => boolean = () => true,
): MissionLandmarkCandidate | null {
  if (!landmark) return null;
  let best: MissionLandmarkCandidate | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (candidate.kind !== landmark.kind || candidate.key !== landmark.key) continue;
    if (!isExplored(candidate.x, candidate.z)) continue;
    const dx = candidate.x - origin.x;
    const dz = candidate.z - origin.z;
    const distance = dx * dx + dz * dz;
    // Strictly nearer, so an equidistant later candidate does not displace an
    // earlier one — see the tie rule above.
    if (distance >= bestDistance) continue;
    bestDistance = distance;
    best = candidate;
  }
  return best;
}
