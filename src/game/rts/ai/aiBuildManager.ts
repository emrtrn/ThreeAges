/**
 * AI construction executor. It never chooses an economy strategy; it tries a
 * bounded site list through the same construction service the player uses.
 */
import type { RtsBuildAnchor } from "../world/rtsMapBlockout";
import type { PlacedStructure, PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { StructureConstructionService } from "../structures/structureConstructionService";
import type { UnitOwner } from "../units/unit";
import type { AiDecisionLog } from "./aiDecisionLog";
import type { AiFailureReason } from "./aiTypes";
import type { AiBuildSite, AiSiteProvider, AiSiteSource } from "./aiSiteProvider";

/** A rejected candidate is retired after three consecutive hard failures. */
export const AI_ANCHOR_FAILURE_LIMIT = 3;

export type AiBuildOutcome =
  | { readonly kind: "started"; readonly structure: PlacedStructure }
  | { readonly kind: "busy" }
  | { readonly kind: "waiting"; readonly reason: AiFailureReason }
  | { readonly kind: "failed"; readonly reason: AiFailureReason };

export interface AiBuildPlacementDebug {
  readonly key: string | null;
  readonly source: AiSiteSource | null;
  readonly failureReason: string | null;
}

/** Read-only extra gate for normal (non-expansion) base sites. */
export type AiBuildSiteFilter = (site: AiBuildSite) => string | null;
/** Optional deterministic preference within the already-safe planned ordering. */
export type AiBuildSiteRanker = (site: AiBuildSite) => number | null;

export class AiBuildManager {
  private readonly candidateFailures = new Map<string, number>();
  private active: PlacedStructure | null = null;
  private lastPlacement: AiBuildPlacementDebug = { key: null, source: null, failureReason: null };

  constructor(
    private readonly owner: UnitOwner,
    private readonly anchors: readonly RtsBuildAnchor[],
    private readonly construction: StructureConstructionService,
    private readonly structures: PlacedStructureSystem,
    private readonly log: AiDecisionLog,
    private readonly siteProvider?: AiSiteProvider,
    private readonly baseSiteFilter?: AiBuildSiteFilter,
    private readonly baseSiteRanker?: AiBuildSiteRanker,
  ) {}

  get busy(): boolean {
    return this.active !== null;
  }

  get activeStructure(): PlacedStructure | null {
    return this.active;
  }

  get placementDebug(): AiBuildPlacementDebug {
    return this.lastPlacement;
  }

  /**
   * An explicit scope is an authored expansion recipe. Base requests omit it and
   * therefore use the procedural provider before falling back to legacy anchors.
   */
  request(buildingId: string, now: number, scope?: readonly RtsBuildAnchor[]): AiBuildOutcome {
    this.syncActive();
    if (this.active) return { kind: "busy" };

    let candidates = this.availableSites(buildingId, scope);
    // P4: a dynamic blocker or a spent source can invalidate a whole bounded
    // list. Refresh once for this request only; repeated failure remains named
    // and finite instead of regenerating candidates in an AI tick loop.
    if (!scope && candidates.length === 0 && this.siteProvider?.refresh?.(buildingId)) {
      candidates = this.availableSites(buildingId);
    }
    if (candidates.length === 0) {
      this.lastPlacement = { key: null, source: null, failureReason: "no-valid-placement" };
      this.log.record({
        at: now,
        kind: "plan-failed",
        reason: `${buildingId}: geçerli aday alan kalmadı`,
        failureReason: "no-valid-placement",
      });
      return { kind: "failed", reason: "no-valid-placement" };
    }

    let lastReason: AiFailureReason = "no-valid-placement";
    for (const candidate of candidates) {
      const filterReason = scope ? null : this.baseSiteFilter?.(candidate) ?? null;
      if (filterReason) {
        this.lastPlacement = { key: candidate.key, source: candidate.source, failureReason: filterReason };
        this.retireCandidate(candidate, now, filterReason);
        lastReason = "path-blocked";
        continue;
      }
      const result = this.construction.build(this.owner, candidate.buildingId, candidate.x, candidate.z);
      if (result.built) {
        this.candidateFailures.delete(candidate.key);
        this.lastPlacement = { key: candidate.key, source: candidate.source, failureReason: null };
        this.active = result.structure;
        return { kind: "started", structure: result.structure };
      }
      if (result.reason === "insufficient-resources") {
        // A good site must not be blacklisted merely because the wallet is empty.
        return { kind: "waiting", reason: "insufficient-resources" };
      }
      lastReason = this.failureReasonFor(result.reason);
      this.lastPlacement = { key: candidate.key, source: candidate.source, failureReason: result.reason };
      this.recordCandidateFailure(candidate, now, result.reason);
    }
    return { kind: "failed", reason: lastReason };
  }

  reset(): void {
    this.candidateFailures.clear();
    this.active = null;
    this.lastPlacement = { key: null, source: null, failureReason: null };
  }

  /** Event-driven P4 hook for a razed depot or a producer that lost its source. */
  refreshSites(buildingId: string): boolean {
    return this.siteProvider?.refresh?.(buildingId) ?? false;
  }

  private availableSites(buildingId: string, scope?: readonly RtsBuildAnchor[]): readonly AiBuildSite[] {
    const sites = scope
      ? scope.filter((anchor) => anchor.buildingId === buildingId).map(toLegacySite)
      : this.siteProvider?.sitesFor(buildingId) ?? this.anchors
        .filter((anchor) => anchor.buildingId === buildingId)
        .map(toLegacySite);
    return sites
      .filter((site) => (this.candidateFailures.get(site.key) ?? 0) < AI_ANCHOR_FAILURE_LIMIT
        && !this.occupied(site))
      .map((site, index) => ({ site, index, rank: scope ? null : this.baseSiteRanker?.(site) ?? null }))
      .sort((left, right) => {
        if (left.rank === null || right.rank === null) return left.index - right.index;
        return left.rank - right.rank || left.index - right.index;
      })
      .map(({ site }) => site);
  }

  private occupied(site: Pick<AiBuildSite, "x" | "z">): boolean {
    return this.structures.ownedBy(this.owner)
      .some((structure) => structure.x === site.x && structure.z === site.z);
  }

  private recordCandidateFailure(candidate: AiBuildSite, now: number, reason: string): void {
    const failures = (this.candidateFailures.get(candidate.key) ?? 0) + 1;
    this.candidateFailures.set(candidate.key, failures);
    if (failures < AI_ANCHOR_FAILURE_LIMIT) return;
    this.log.record({
      at: now,
      kind: "plan-failed",
      reason: `${candidate.buildingId} @${candidate.x},${candidate.z} kara listeye alındı (${reason})`,
      failureReason: this.failureReasonFor(reason),
    });
  }

  /** A route preflight is deterministic for this topology, so skip it at once. */
  private retireCandidate(candidate: AiBuildSite, now: number, reason: string): void {
    this.candidateFailures.set(candidate.key, AI_ANCHOR_FAILURE_LIMIT);
    this.log.record({
      at: now,
      kind: "plan-failed",
      reason: `${candidate.buildingId} @${candidate.x},${candidate.z} road rejected (${reason})`,
      failureReason: "path-blocked",
    });
  }

  private syncActive(): void {
    if (!this.active) return;
    const live = this.structures.all().includes(this.active);
    if (!live || this.active.construction.complete) this.active = null;
  }

  private failureReasonFor(reason: string): AiFailureReason {
    switch (reason) {
      case "insufficient-resources": return "insufficient-resources";
      case "outside-control": return "territory-invalid";
      case "blocked":
      case "outside-map": return "no-valid-placement";
      default: return "no-valid-placement";
    }
  }
}

function toLegacySite(anchor: RtsBuildAnchor): AiBuildSite {
  return {
    key: `legacy:${anchor.buildingId}:${anchor.x}:${anchor.z}`,
    buildingId: anchor.buildingId,
    x: anchor.x,
    z: anchor.z,
    source: "legacy",
  };
}
