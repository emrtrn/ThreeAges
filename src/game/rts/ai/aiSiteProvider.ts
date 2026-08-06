/** Ordered AI build-site sources, kept separate from the construction executor. */
import type { RtsBuildAnchor } from "../world/rtsMapBlockout";
import type { SettlementLayoutPlan, SettlementSiteCandidate, SettlementZone } from "./settlementLayoutPlanner";

export type AiSiteSource = "procedural" | "legacy";

export interface AiBuildSite {
  readonly key: string;
  readonly buildingId: string;
  readonly x: number;
  readonly z: number;
  readonly source: AiSiteSource;
}

/** Renderer-free metadata for the RTS debug overlay. */
export interface AiSettlementPlanDebug {
  readonly version: number;
  readonly seed: number;
  readonly candidates: readonly AiSettlementPlanDebugCandidate[];
}

export interface AiSettlementPlanDebugCandidate {
  readonly key: string;
  readonly buildingId: string;
  readonly x: number;
  readonly z: number;
  readonly zone: SettlementZone;
}

export interface AiSiteProvider {
  sitesFor(buildingId: string): readonly AiBuildSite[];
  /** Rebuild only the affected candidate list; returns false when unsupported. */
  refresh?(buildingId: string): boolean;
  /** Optional metadata for the debug overlay; never used to choose a site. */
  settlementPlanDebug?(): AiSettlementPlanDebug;
}

export type SettlementPlanRefresh = (buildingId: string) => SettlementLayoutPlan;

/** Planned base sites precede the authored anchors retained as the V1 fallback. */
export class SettlementAiSiteProvider implements AiSiteProvider {
  private plan: SettlementLayoutPlan;

  constructor(
    plan: SettlementLayoutPlan,
    private readonly legacyAnchors: readonly RtsBuildAnchor[],
    private readonly refreshPlan?: SettlementPlanRefresh,
  ) {
    this.plan = plan;
  }

  sitesFor(buildingId: string): readonly AiBuildSite[] {
    const planned = this.plan.candidatesByBuilding.get(buildingId) ?? [];
    return [
      ...planned.map(toProceduralSite),
      ...this.legacyAnchors.filter((anchor) => anchor.buildingId === buildingId).map(toLegacySite),
    ];
  }

  /** Planned-only view for cross-building decisions such as depot logistics. */
  plannedSites(): readonly AiBuildSite[] {
    return [...this.plan.candidatesByBuilding.values()].flatMap((candidates) => candidates.map(toProceduralSite));
  }

  settlementPlanDebug(): AiSettlementPlanDebug {
    const candidates = [...this.plan.candidatesByBuilding.values()]
      .flatMap((planned) => planned.map((candidate) => ({
        key: candidate.key,
        buildingId: candidate.buildingId,
        x: candidate.x,
        z: candidate.z,
        zone: candidate.zone,
      })));
    return { version: this.plan.version, seed: this.plan.seed, candidates };
  }

  refresh(buildingId: string): boolean {
    if (!this.refreshPlan) return false;
    const refreshed = this.refreshPlan(buildingId);
    if (!refreshed.candidatesByBuilding.has(buildingId)) return false;
    const candidates = refreshed.candidatesByBuilding.get(buildingId) ?? [];
    const candidatesByBuilding = new Map(this.plan.candidatesByBuilding);
    candidatesByBuilding.set(buildingId, candidates);
    this.plan = { ...this.plan, candidatesByBuilding };
    return true;
  }
}

function toProceduralSite(candidate: SettlementSiteCandidate): AiBuildSite {
  return { key: candidate.key, buildingId: candidate.buildingId, x: candidate.x, z: candidate.z, source: "procedural" };
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
