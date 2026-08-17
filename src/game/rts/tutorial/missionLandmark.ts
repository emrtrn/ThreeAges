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
 *   the player's centre, so nothing recomputes into a different answer mid-step —
 *   fog included, since Faz 4 (see {@link nearestMissionLandmark}).
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
 * The feature a landmark means, or null when the map authors none of that kind.
 *
 * **Nearest to the player's own centre**, which is the only ordering that reads
 * as an answer rather than as a suggestion: on a map authored in pairs (this
 * project's convention — every deposit and every trade site has a mirrored twin
 * on the opponent's bank) the near one is the one being talked about, and the
 * far one is across the river in enemy territory.
 *
 * **Fog does not hide the marker (Faz 4).** It used to: an earlier pass applied
 * the same `isExplored` gate the Market's supply panel does, on the grounds that
 * a marker on unscouted ground hands the player a scouting result. Forcing fog
 * on for the tur is what took that argument apart. The chain's own step 5 points
 * at a trade site 33.5 units from a centre that sees 26, so the gate silenced the
 * arrow on exactly the step that needed it — the one whose lesson the player
 * cannot guess — and the player's answer was the right one: the arrow is what
 * *sends* them to scout. What it reveals is a single authored position, not the
 * ground around it: they still have to walk a unit there to see what is on it,
 * and the fog behaves in every other way as it did.
 *
 * Removing the gate also made the choice unconditional, which is worth more than
 * it sounds: the marker can no longer move to a nearer feature the moment fog
 * lifts, so what a step points at is fixed by the level, not by where the player
 * has been.
 *
 * Ties break on the candidate order the caller passed, which is the level's
 * authoring order — stable, so the marker cannot flicker between two features
 * that happen to be equidistant.
 */
export function nearestMissionLandmark(
  landmark: MissionLandmark | null | undefined,
  candidates: readonly MissionLandmarkCandidate[],
  origin: MissionLandmarkOrigin,
): MissionLandmarkCandidate | null {
  if (!landmark) return null;
  let best: MissionLandmarkCandidate | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (candidate.kind !== landmark.kind || candidate.key !== landmark.key) continue;
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
