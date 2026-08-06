/**
 * AI debug panel text — `07_ENEMY_AI_DESIGN_v0.2.md` §82; plan §39
 * ("AI karar nedeni debug panelinde görülebiliyor").
 *
 * A pure formatter, mirroring the engine's `formatAiNavDebug`: it takes a
 * snapshot plus the decision log and returns lines. Keeping it free of DOM
 * means the §39 acceptance criterion is checked by an engine test rather than
 * by squinting at a screenshot.
 */
import type { AiBalance } from "../../data/gameDataTypes";
import { AI_COMBAT_ROLES, AI_RESOURCE_IDS } from "./aiBlackboard";
import type { AiControllerSnapshot } from "./aiController";
import type { AiDecisionEntry } from "./aiDecisionLog";
import { AI_MAX_EXPANSION_PLANS } from "./aiExpansionCoordinator";
import { RETREAT_REASON_TEXT } from "./armyManager";
import { developmentReadiness } from "./intentScorer";

/** Plan §48 debug list: "Son on karar". */
const MAX_DECISION_LINES = 10;

export function formatRtsAiDebug(
  snapshot: AiControllerSnapshot,
  decisions: readonly AiDecisionEntry[],
  economyMultiplier: number,
  /** §82: the income targets a rate is judged against, so a number reads as good or bad. */
  balance?: AiBalance,
): string[] {
  const bb = snapshot.blackboard;
  const lines = [`AI (${snapshot.owner}) — ekonomi çarpanı ${economyMultiplier.toFixed(2)}`];
  lines.push(
    `niyet: ${snapshot.intent ?? "-"}${snapshot.plan ? ` · plan ${snapshot.plan.id} (${snapshot.planSeconds.toFixed(1)}sn)` : ""}`,
  );
  // The centre level belongs next to the age: under centre-led progression the two
  // together are the kingdom's tier, and the AI now invests in the level ladder for
  // its own sake — "Town" alone cannot tell a Lv1 Town from a Lv3 one.
  if (bb) {
    lines.push(
      `çağ: ${bb.age} Lv${bb.centerLevel}${bb.ageUpgrading ? " (yükseltiliyor)" : ""}`
      + `${bb.centerLevelUpgradeCost ? "" : " · seviye tavanı"}`,
    );
  }
  lines.push(
    `ordu görevi: ${snapshot.mission ?? "-"} · güç ${snapshot.armyPower.toFixed(1)}`
    + ` · üste kalan ${snapshot.garrisonCount}`,
  );
  // §65: which of the two retreat triggers pulled the army back. "regroup" alone
  // cannot tell an army that lost the exchange from one that was ground down —
  // and those are two different balance problems.
  if (snapshot.retreatReason) lines.push(`geri çekilme: ${RETREAT_REASON_TEXT[snapshot.retreatReason]}`);
  if (bb) {
    // §53: the shape of the army, not just its size — a power number alone
    // cannot show whether the composition ratio is actually being followed.
    lines.push(`ordu bileşimi: ${AI_COMBAT_ROLES.map((role) => `${role} ${bb.armyComposition[role]}`).join(" · ")}`);
  }
  lines.push(snapshot.target
    ? `hedef: ${snapshot.target.candidate.kind} ${snapshot.target.score.toFixed(2)} — ${snapshot.target.reason}`
    : "hedef: -");
  lines.push(
    `darboğaz: ${snapshot.bottleneck ?? "yok"}`
    // §49: the step alone cannot say whether a "done" AI is finished expanding
    // or simply between its two plans.
    + ` · genişleme: ${snapshot.expansionStep} (${snapshot.expansionsCompleted}/${AI_MAX_EXPANSION_PLANS}`
    + `${snapshot.expansionPlanAvailable ? ", plan var" : ", plan yok"})`
    + ` · üs lojistiği: ${snapshot.infrastructureStep}`
    + ` · kışla II: ${snapshot.upgradeStep}`,
  );
  // §82 "Aktif yapı planı": what the build slot is holding right now, which is
  // the difference between "the AI is saving up" and "the AI is stuck".
  lines.push(`aktif inşaat: ${snapshot.activeBuild ?? "-"}`);
  // The settlement plan, because it now damps the attack as well as driving the
  // economy: without this line a suppressed Attack reads as a mystery rather than
  // as "the city is 60% built". Needs the balance the targets live in.
  if (snapshot.buildPlacement.key) {
    lines.push(
      `yer adayi: ${snapshot.buildPlacement.source ?? "-"} ${snapshot.buildPlacement.key}`
      + `${snapshot.buildPlacement.failureReason ? ` · ret ${snapshot.buildPlacement.failureReason}` : ""}`,
    );
  }
  const settlement = snapshot.buildPlacement.settlement;
  if (settlement) {
    lines.push(
      `yerleşim planı: v${settlement.version} · seed ${settlement.seed}`
      + `${settlement.selectedZone ? ` · bölge ${settlement.selectedZone}` : ""}`
      + ` · fallback ${settlement.fallbackUsed ? "kullanıldı" : "kullanılmadı"}`,
    );
    lines.push(
      `kalan prosedürel adaylar: ${settlement.remainingCandidatesByBuilding
        .map(({ buildingId, remaining }) => `${buildingId} ${remaining}`)
        .join(" · ") || "-"}`,
    );
  }
  if (bb && balance) {
    const development = developmentReadiness(bb, balance);
    lines.push(
      `şehir planı: %${Math.round(development.ratio * 100)}`
      + ` (saldırı çarpanı ${development.readiness.toFixed(2)})`
      + `${development.missing.length > 0 ? ` · eksik ${development.missing.join(", ")}` : ""}`,
    );
  }
  if (snapshot.concluded) lines.push("maç bitti: karar üretimi durdu");

  if (snapshot.scores.length > 0) {
    lines.push("niyet puanları:");
    for (const score of snapshot.scores) {
      const marker = score.intent === snapshot.intent ? "*" : " ";
      lines.push(`  ${marker}${score.intent}: ${score.score.toFixed(2)} — ${score.reason}`);
    }
  }

  if (bb) {
    const workerTarget = balance ? `/${balance.economy.workerTarget[bb.age]}` : "";
    lines.push(
      `işçi: ${bb.workerCount}${workerTarget} (boşta ${bb.idleWorkerCount})`
      + ` · nüfus ${bb.population}/${bb.populationCap}`,
    );
    // §82 "Kaynak hedefleri": every rate against the target it is judged by, for
    // all four resources — a bare rate cannot show which one is holding the AI up.
    lines.push(`gelir/dk (hedef): ${AI_RESOURCE_IDS.map((id) => {
      const rate = (bb.resourceIncomePerMinute[id] ?? 0).toFixed(1);
      const target = balance?.economy.incomeTargetsPerMinute[id];
      return `${id} ${rate}${target === undefined ? "" : `/${target}`}`;
    }).join(" · ")}`);
    if (bb.age !== "town") {
      lines.push(bb.ageMissingBuildingIds.length > 0
        ? `çağ gereksinimi: eksik ${bb.ageMissingBuildingIds.join(", ")}`
        : `çağ gereksinimi: tamam · kaynak ${bb.ageAffordable ? "yeterli" : "biriktiriliyor"}`);
      // Faz M4: while the AI is saving for the age, whether it is *also* trading
      // toward it is the difference between "slow" and "stuck".
      lines.push(`pazar: ${snapshot.tradeStep}`);
    }
    lines.push(`tehdit: üs ${bb.baseThreat.toFixed(1)} · düşman ordu ${bb.knownEnemyArmyPower.toFixed(1)}`);
    if (bb.emergencyFlags.length > 0) lines.push(`acil: ${bb.emergencyFlags.join(", ")}`);
  }

  lines.push("kararlar:");
  const recent = decisions.slice(0, MAX_DECISION_LINES);
  if (recent.length === 0) lines.push("  - yok");
  for (const entry of recent) {
    lines.push(`  [${entry.at.toFixed(1)}sn] ${entry.kind}: ${entry.reason}`);
  }
  return lines;
}
