/** Ordered AI build-site sources, kept separate from the construction executor. */
import type { RtsBuildAnchor } from "../world/rtsMapBlockout";
import type { SettlementLayoutPlan, SettlementSiteCandidate } from "./settlementLayoutPlanner";

export type AiSiteSource = "procedural" | "legacy";

export interface AiBuildSite {
  readonly key: string;
  readonly buildingId: string;
  readonly x: number;
  readonly z: number;
  readonly source: AiSiteSource;
}

export interface AiSiteProvider {
  sitesFor(buildingId: string): readonly AiBuildSite[];
}

/** Planned base sites precede the authored anchors retained as the V1 fallback. */
export class SettlementAiSiteProvider implements AiSiteProvider {
  constructor(
    private readonly plan: SettlementLayoutPlan,
    private readonly legacyAnchors: readonly RtsBuildAnchor[],
  ) {}

  sitesFor(buildingId: string): readonly AiBuildSite[] {
    const planned = this.plan.candidatesByBuilding.get(buildingId) ?? [];
    return [
      ...planned.map(toProceduralSite),
      ...this.legacyAnchors.filter((anchor) => anchor.buildingId === buildingId).map(toLegacySite),
    ];
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
