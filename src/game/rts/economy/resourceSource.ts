/**
 * The one contract a finite resource has to satisfy to be worked by a producer
 * building: a grove of trees, a field of deposits and — from the hunting plan —
 * a herd of game.
 *
 * `EconomyProductionSystem` used to resolve
 * `requiresForest ? forests : requiresResourceNode ? resourceNodes : null` in
 * two separate places and then run a near-identical gather loop for each branch:
 * walk out, work the source, carry the load home, unload, go again. A third kind
 * of source would have made that three copies of the same hundred lines, and the
 * copies had already started to drift. The loop is now written once against this
 * interface, so adding a source means implementing it — not editing the loop.
 */

/** The producer footprint a source must stay clear of to be workable. */
export interface ResourceSearchArea {
  readonly width: number;
  readonly depth: number;
}

/**
 * What a producer can reach: its own position, its `gatherRadius`, the resource
 * it banks and the footprint a source may not hide under.
 *
 * Bundled rather than passed as five loose arguments because every query in the
 * gather loop asks the same question about the same building, and a positional
 * list that long invites a caller to swap `x` and `z` or `radius` and `capacity`
 * without the compiler noticing.
 */
export interface ResourceReach {
  readonly resourceId: string;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly footprint?: ResourceSearchArea;
}

/** The specific source a worker was sent to, and where it stands to work it. */
export interface ReservedResourceSource {
  readonly id: string;
  readonly x: number;
  readonly z: number;
}

export interface ResourceSource {
  /**
   * Whether nearby sources of this kind are interchangeable, which decides two
   * things at once.
   *
   * A grove is many trunks of the same wood: a tree a player has built around is
   * skipped in favour of its neighbour, and a lumberjack who has just unloaded
   * may switch to whichever camp has the shortest next trip. A deposit is not —
   * each is a distinct pile bound to the extractor built beside it, so an
   * unreachable one releases the miner rather than sending him to a pile across
   * the map that his mine could never bank.
   */
  readonly sourcesAreInterchangeable: boolean;

  /**
   * Total material still reachable from this point, or null when no source of
   * this kind is in range at all.
   *
   * The null matters: "nothing in reach" and "worked out" are different
   * failures, and the producer's status line says which one it is.
   */
  remainingNear(reach: ResourceReach): number | null;

  /**
   * Squared distance to the nearest source with material left, or
   * `Number.POSITIVE_INFINITY` when none is in reach — used to pick the camp
   * with the shortest next trip, without asking a renderer.
   */
  nearestSourceDistanceSquared(reach: ResourceReach): number;

  /**
   * Claim the nearest workable source for this worker, skipping ids the caller
   * has already failed to reach.
   *
   * Sources that can only take one worker at a time (a tree) hold the claim;
   * sources several workers may share (a deposit) simply answer the query.
   */
  reserveNearest(
    workerId: number,
    reach: ResourceReach,
    rejectedSourceIds?: ReadonlySet<string>,
  ): ReservedResourceSource | null;

  /**
   * Draw up to `requested` material for a worker standing at `sourceId`,
   * returning zero once there is nothing left — the caller's cue to send the
   * worker home and look for another source.
   */
  harvest(workerId: number, sourceId: string, requested: number): number;

  /** Drop this worker's claim, if this kind of source holds one. Idempotent. */
  releaseReservation(workerId: number): void;
}
