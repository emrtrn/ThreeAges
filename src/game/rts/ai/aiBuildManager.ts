/**
 * AI build executor — `07_ENEMY_AI_DESIGN_v0.2.md` §17 (BuildManager),
 * §40–§43; plan §38 ("Yapı kuyruğu").
 *
 * §17 is clear that this is an *executing* service, not a decision layer: it
 * never picks a strategy, it turns "I want a farm" into a construction site
 * through the same {@link StructureConstructionService} the player's palette
 * uses (§4).
 *
 * The rules that matter here:
 *  - §40: candidates come from authored map anchors, not a free search.
 *  - §42: exactly one active construction at a time.
 *  - §43: an invalid spot tries the next candidate, then fails with a named
 *    error code. An anchor that keeps failing is blacklisted, which is what
 *    makes plan §39 "AI geçersiz yapı konumunda sonsuz döngüye girmiyor" hold.
 */
import type { RtsBuildAnchor } from "../world/rtsMapBlockout";
import type { PlacedStructure, PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { StructureConstructionService } from "../structures/structureConstructionService";
import type { UnitOwner } from "../units/unit";
import type { AiDecisionLog } from "./aiDecisionLog";
import type { AiFailureReason } from "./aiTypes";

/** §43: an anchor is dropped after this many consecutive rejections. */
export const AI_ANCHOR_FAILURE_LIMIT = 3;

export type AiBuildOutcome =
  | { readonly kind: "started"; readonly structure: PlacedStructure }
  | { readonly kind: "busy" }
  | { readonly kind: "waiting"; readonly reason: AiFailureReason }
  | { readonly kind: "failed"; readonly reason: AiFailureReason };

export class AiBuildManager {
  /** Anchor key → consecutive failures, for the §43 blacklist. */
  private readonly anchorFailures = new Map<string, number>();
  private active: PlacedStructure | null = null;

  constructor(
    private readonly owner: UnitOwner,
    private readonly anchors: readonly RtsBuildAnchor[],
    private readonly construction: StructureConstructionService,
    private readonly structures: PlacedStructureSystem,
    private readonly log: AiDecisionLog,
  ) {}

  /** §42: true while a site is still under construction. */
  get busy(): boolean {
    return this.active !== null;
  }

  get activeStructure(): PlacedStructure | null {
    return this.active;
  }

  /**
   * Try to start one building. Returns `busy` when §42's single-slot rule
   * blocks it, `waiting` for a recoverable condition (no resources yet), and
   * `failed` when every authored anchor has been exhausted.
   *
   * `scope` narrows the candidate slots — the expansion recipe passes its own
   * region anchors so it shares this manager's single build slot and blacklist
   * (§42/§43) without the base build order ever placing a farm out at the
   * expansion, or vice versa.
   */
  request(buildingId: string, now: number, scope: readonly RtsBuildAnchor[] = this.anchors): AiBuildOutcome {
    this.syncActive();
    if (this.active) return { kind: "busy" };

    const candidates = this.availableAnchors(buildingId, scope);
    if (candidates.length === 0) {
      this.log.record({
        at: now,
        kind: "plan-failed",
        reason: `${buildingId}: geçerli aday alan kalmadı`,
        failureReason: "no-valid-placement",
      });
      return { kind: "failed", reason: "no-valid-placement" };
    }

    let lastReason: AiFailureReason = "no-valid-placement";
    for (const anchor of candidates) {
      const result = this.construction.build(this.owner, anchor.buildingId, anchor.x, anchor.z);
      if (result.built) {
        this.anchorFailures.delete(this.key(anchor));
        this.active = result.structure;
        return { kind: "started", structure: result.structure };
      }
      if (result.reason === "insufficient-resources") {
        // §38/§43: not the anchor's fault — wait and re-evaluate rather than
        // burning through candidates and blacklisting perfectly good slots.
        return { kind: "waiting", reason: "insufficient-resources" };
      }
      lastReason = this.failureReasonFor(result.reason);
      this.recordAnchorFailure(anchor, now, result.reason);
    }
    return { kind: "failed", reason: lastReason };
  }

  reset(): void {
    this.anchorFailures.clear();
    this.active = null;
  }

  /** Anchors for a building that are neither taken nor blacklisted. */
  private availableAnchors(buildingId: string, scope: readonly RtsBuildAnchor[]): readonly RtsBuildAnchor[] {
    return scope.filter((anchor) => anchor.buildingId === buildingId
      && (this.anchorFailures.get(this.key(anchor)) ?? 0) < AI_ANCHOR_FAILURE_LIMIT
      && !this.occupied(anchor));
  }

  /** An anchor already carrying one of our structures is not a candidate. */
  private occupied(anchor: RtsBuildAnchor): boolean {
    return this.structures.ownedBy(this.owner)
      .some((structure) => structure.x === anchor.x && structure.z === anchor.z);
  }

  private recordAnchorFailure(anchor: RtsBuildAnchor, now: number, reason: string): void {
    const key = this.key(anchor);
    const failures = (this.anchorFailures.get(key) ?? 0) + 1;
    this.anchorFailures.set(key, failures);
    if (failures < AI_ANCHOR_FAILURE_LIMIT) return;
    this.log.record({
      at: now,
      kind: "plan-failed",
      reason: `${anchor.buildingId} @${anchor.x},${anchor.z} kara listeye alındı (${reason})`,
      failureReason: this.failureReasonFor(reason),
    });
  }

  /** Drop the active slot once its site completes or is destroyed. */
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

  private key(anchor: RtsBuildAnchor): string {
    return `${anchor.buildingId}:${anchor.x}:${anchor.z}`;
  }
}
