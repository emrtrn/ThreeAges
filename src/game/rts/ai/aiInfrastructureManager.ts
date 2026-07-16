/**
 * AI base logistics executor — `07_ENEMY_AI_DESIGN_v0.2.md` §17, §37; plan §48
 * ("Kritik yapı yeniden kurma", "Bağlantı kesintisi onarımı").
 *
 * Faz 6 made income conditional: a producer pays into the stockpile only while a
 * road touches its footprint *and* that road island also touches one of the
 * owner's depots. AI-1 owned neither at its base, which is the "AI'ın geliri
 * yok" limit recorded against plan §38 — its farm and lumber camp filled their
 * local buffers and stopped, leaving it on its starting stock forever.
 *
 * AI-2 cannot live with that: the Town age alone costs 600 food / 350 wood /
 * 150 stone / 150 gold. So the base depot and its authored spine are built here,
 * through the same {@link RoadConstructionService} and build manager the player
 * and the expansion recipe use (§4).
 *
 * This runs as a standing concern rather than as one intent's executor: a base
 * with no route to its depot has no economy at all, so repairing the link
 * outranks whatever the director is currently committed to. §37's
 * DisconnectedProduction is a *repair* signal, and repair here is idempotent by
 * construction — road segments cost only their new cells, so re-walking an
 * intact spine is free and a cut one is mended in place.
 */
import type { RtsBuildAnchor, RtsMapPoint } from "../world/rtsMapBlockout";
import type { RoadConstructionService } from "../roads/roadConstructionService";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { UnitOwner } from "../units/unit";
import type { AiBlackboard } from "./aiBlackboard";
import type { AiBuildManager } from "./aiBuildManager";
import type { AiDecisionLog } from "./aiDecisionLog";

/** How far the base logistics recipe has run, for §82 and the plan's debug list. */
export type AiInfrastructureStep = "depot" | "route" | "linked";

/** §43: stop re-walking a route that keeps refusing to build. */
export const AI_ROUTE_FAILURE_LIMIT = 3;

export class AiInfrastructureManager {
  private step: AiInfrastructureStep = "depot";
  private routeFailures = 0;

  constructor(
    private readonly owner: UnitOwner,
    private readonly depotAnchor: RtsBuildAnchor,
    private readonly route: readonly RtsMapPoint[],
    private readonly builds: AiBuildManager,
    private readonly roads: RoadConstructionService,
    private readonly structures: PlacedStructureSystem,
    private readonly log: AiDecisionLog,
  ) {}

  get currentStep(): AiInfrastructureStep {
    return this.step;
  }

  /**
   * Bring the base link up, or put it back. Unlike the expansion recipe this
   * never reaches a terminal state: a destroyed depot drops it back to step one,
   * which is what makes "kritik yapı yeniden kurma" fall out of the same code
   * path as the opening rather than needing a rebuild branch of its own.
   */
  update(bb: AiBlackboard): AiInfrastructureStep {
    const depot = this.baseDepot();
    if (!depot?.construction.complete) {
      if (this.step !== "depot") {
        // Losing the base depot cuts every producer at once (§37).
        this.log.record({
          at: bb.now,
          kind: "emergency",
          reason: "üs deposu kayboldu, lojistik yeniden kuruluyor",
        });
        this.step = "depot";
        this.routeFailures = 0;
      }
      if (!depot) this.builds.request(this.depotAnchor.buildingId, bb.now, [this.depotAnchor]);
      return this.step;
    }

    if (this.step === "depot") this.enter("route", bb, "üs deposu hazır");
    if (this.routeFailures >= AI_ROUTE_FAILURE_LIMIT) return this.step;
    // §37: once the spine stands, leave it alone until something is actually
    // cut. `disconnectedProducers` is precisely that signal, and re-walking an
    // intact route on every tick is not free — committing a segment refreshes
    // the whole territory grid, so a finished AI would spend the rest of the
    // match re-paving a road that is already there.
    if (this.step === "linked" && bb.disconnectedProducers === 0) return this.step;

    for (let index = 0; index < this.route.length - 1; index += 1) {
      const from = this.route[index];
      const to = this.route[index + 1];
      if (!from || !to) continue;
      // A segment whose cells all exist costs nothing, so planning it first lets
      // an intact leg be skipped without a commit — and therefore without the
      // territory refresh that a commit triggers.
      const existing = this.roads.plan(from, to);
      if (existing && existing.woodCost === 0) continue;
      const result = this.roads.build(this.owner, from, to);
      if (result.built) continue;
      // §38: no wood yet is a wait, not a failure — the spine resumes next tick
      // because a committed segment charges nothing the second time.
      if (result.reason === "insufficient-resources") return this.step;
      this.routeFailures += 1;
      if (this.routeFailures >= AI_ROUTE_FAILURE_LIMIT) {
        this.log.record({
          at: bb.now,
          kind: "plan-failed",
          reason: `üs yol hattı kurulamadı: ${result.reason}`,
          failureReason: "path-blocked",
        });
      }
      return this.step;
    }
    this.routeFailures = 0;
    return this.enter("linked", bb, "üs lojistiği bağlandı");
  }

  reset(): void {
    this.step = "depot";
    this.routeFailures = 0;
  }

  private baseDepot() {
    return this.structures.ownedBy(this.owner)
      .find((structure) => structure.x === this.depotAnchor.x && structure.z === this.depotAnchor.z);
  }

  private enter(step: AiInfrastructureStep, bb: AiBlackboard, reason: string): AiInfrastructureStep {
    if (this.step === step) return step;
    this.step = step;
    this.log.record({ at: bb.now, kind: "intent-selected", intent: "economy", reason: `üs lojistiği: ${reason}` });
    return step;
  }
}
