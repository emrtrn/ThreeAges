/**
 * Which place on the map sounds like what — plan §82.13.
 *
 * `world.ambience` is one bed over the whole map and says "outdoors, daytime,
 * frontier". These say *where the camera is standing*: the river, a quarry face,
 * the town. They are the second half of §26, and they are the only ambience the
 * player can move toward.
 *
 * The tables here are the whole authored surface. What anchors a zone is a thing
 * the match already has — a trade site, a building the player put down, the
 * landscape's own river spline — never a hand-placed audio marker, because a
 * marker is a second map to keep in step with the first one.
 *
 * **There is no forest bed** and its absence is a decision, not a gap (§82.15).
 * The map-wide ambience already carries woodland, and this project's groves are
 * planted clusters rather than wild forest — a second layer of trees over them
 * described something that is not there.
 */
import type { RtsSpatialLayout } from "../world/rtsSpatialLayout";

export type RtsAmbienceZoneKind =
  | "river"
  | "quarry"
  | "goldmine"
  | "settlement"
  | "market"
  | "farmland";

/**
 * The bed each zone sounds as. One event per kind, one clip per event.
 *
 * `world.` rather than a prefix of their own, because these are §5.8 —
 * the same channel `world.ambience` is on — and the editor catalog groups the
 * table by id prefix. A new prefix would have been a second exception beside
 * COMBAT's, bought with nothing.
 */
export const RTS_ZONE_AMBIENCE: Readonly<Record<RtsAmbienceZoneKind, string>> = {
  river: "world.zone_river",
  quarry: "world.zone_quarry",
  goldmine: "world.zone_goldmine",
  settlement: "world.zone_settlement",
  market: "world.zone_market",
  farmland: "world.zone_farmland",
};

/**
 * Buildings that make the ground around them a place.
 *
 * `command_center` alone carries the settlement rather than `house` as well: one
 * house is not a town, and a kingdom has exactly one centre, so the town bed has
 * exactly one anchor instead of drifting to whichever hut the camera is nearest.
 */
export const RTS_ZONE_AMBIENCE_BUILDINGS: Readonly<Record<string, RtsAmbienceZoneKind>> = {
  command_center: "settlement",
  market: "market",
  quarry: "quarry",
  gold_mine: "goldmine",
  farm: "farmland",
  windmill: "farmland",
  pasture: "farmland",
};

/**
 * Trade sites that are a place before anyone builds anything (§82.13).
 *
 * `river_port` is deliberately absent: the river anchors itself along its own
 * spline now (§82.15), and the port stands on that spline — a second anchor for
 * the same event would only compete with it.
 */
export const RTS_ZONE_AMBIENCE_TRADE_SITES: Readonly<Record<string, RtsAmbienceZoneKind>> = {
  stone_pit: "quarry",
};

/**
 * How near the camera's **ground focus** must come for a bed to start, and how
 * far it may go before that bed lets go.
 *
 * Measured from the focus rather than from the eye, and that is not a detail:
 * the eye sits 20–40 units up and back (`rtsCameraConfig`), so an eye-measured
 * radius carries the zoom level inside it — the same spot would be in one zone
 * zoomed in and in another zoomed out. What the player means by "where I am" is
 * the point the camera is looking at.
 *
 * Two numbers rather than one, and the gap between them is the point: with a
 * single radius a camera parked on the boundary starts and stops the bed on
 * alternating frames. §35's music state machine keeps its states apart the same
 * way, and for the same reason.
 *
 * **Sized against the map, not picked.** The first pass at 45/62 gave every zone
 * a radius that swallowed several others, and the bed acquired first held across
 * half the map — which from outside sounded like "they play in sequence rather
 * than by place" (§82.14). A zone has to be roughly the size of a zone.
 */
export const RTS_ZONE_AMBIENCE_ENTER_RADIUS = 18;
export const RTS_ZONE_AMBIENCE_EXIT_RADIUS = 25;

/** One place that can sound, wherever the map declared it. */
export interface RtsAmbienceZoneAnchor {
  readonly kind: RtsAmbienceZoneKind;
  /** Stable across frames — this is what says "still the same place". */
  readonly id: string;
  readonly x: number;
  readonly z: number;
}

/** A river centreline in world XZ, as the landscape authored it. */
export type RtsRiverPath = readonly { readonly x: number; readonly z: number }[];

/** The one anchor id every river point shares — a river is one place, however long. */
export const RTS_RIVER_AMBIENCE_ANCHOR_ID = "river:landscape";

/**
 * The anchors that are on the map before the first building goes down.
 *
 * Resolved once at match start because none of it moves. The river is *not*
 * here: it is a path rather than a spot, so its anchor is chosen against the
 * camera every time it is asked for ({@link rtsNearestRiverPoint}).
 */
export function rtsStaticAmbienceAnchors(layout: RtsSpatialLayout): RtsAmbienceZoneAnchor[] {
  const anchors: RtsAmbienceZoneAnchor[] = [];
  for (const site of layout.tradeSites) {
    const kind = RTS_ZONE_AMBIENCE_TRADE_SITES[site.siteType];
    if (!kind) continue;
    anchors.push({ kind, id: `trade:${site.id}`, x: site.x, z: site.z });
  }
  return anchors;
}

/** The zone a completed building makes of the ground it stands on, if any. */
export function rtsBuildingAmbienceZone(buildingId: string): RtsAmbienceZoneKind | null {
  return RTS_ZONE_AMBIENCE_BUILDINGS[buildingId] ?? null;
}

/**
 * The nearest point on a river to somewhere, and how far that is.
 *
 * A river is the one zone that is not a spot. Anchoring its bed on a single
 * point — the port, or the middle of the spline — puts the water in one place on
 * a feature that crosses the whole map, so following it upstream walks away from
 * its own sound. The authored centreline is a polyline, so the honest anchor is
 * the nearest point *on* it.
 *
 * Projected onto each segment rather than snapped to the nearest authored point:
 * the shipped river is six points across ~190 units, so the nearest *vertex* can
 * be tens of units from a bank the camera is sitting on.
 *
 * Returns the point, not an anchor: what to do with it — start a bed, keep one,
 * ignore it — belongs to the caller, and the caller is the one holding the radii.
 */
export function rtsNearestRiverPoint(
  paths: readonly RtsRiverPath[],
  x: number,
  z: number,
): { readonly x: number; readonly z: number; readonly distance: number } | null {
  let bestX = 0;
  let bestZ = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const path of paths) {
    for (let i = 0; i + 1 < path.length; i += 1) {
      const a = path[i]!;
      const b = path[i + 1]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const lengthSquared = dx * dx + dz * dz;
      // A zero-length segment is a duplicated authored point, not an error: it
      // projects onto its own start, which is what clamping to 0 already does.
      const t = lengthSquared > 0
        ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSquared))
        : 0;
      const px = a.x + dx * t;
      const pz = a.z + dz * t;
      const distance = Math.hypot(x - px, z - pz);
      if (distance >= bestDistance) continue;
      bestDistance = distance;
      bestX = px;
      bestZ = pz;
    }
  }
  return bestDistance === Number.POSITIVE_INFINITY
    ? null
    : { x: bestX, z: bestZ, distance: bestDistance };
}
