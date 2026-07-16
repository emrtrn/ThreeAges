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
  if (bb) lines.push(`çağ: ${bb.age}${bb.ageUpgrading ? " (yükseltiliyor)" : ""}`);
  lines.push(
    `ordu görevi: ${snapshot.mission ?? "-"} · güç ${snapshot.armyPower.toFixed(1)}`
    + ` · üste kalan ${snapshot.garrisonCount}`,
  );
  if (bb) {
    // §53: the shape of the army, not just its size — a power number alone
    // cannot show whether the composition ratio is actually being followed.
    lines.push(`ordu bileşimi: ${AI_COMBAT_ROLES.map((role) => `${role} ${bb.armyComposition[role]}`).join(" · ")}`);
  }
  lines.push(snapshot.target
    ? `hedef: ${snapshot.target.candidate.kind} ${snapshot.target.score.toFixed(2)} — ${snapshot.target.reason}`
    : "hedef: -");
  lines.push(
    `darboğaz: ${snapshot.bottleneck ?? "yok"} · genişleme: ${snapshot.expansionStep}`
    + ` · üs lojistiği: ${snapshot.infrastructureStep}`,
  );
  // §82 "Aktif yapı planı": what the build slot is holding right now, which is
  // the difference between "the AI is saving up" and "the AI is stuck".
  lines.push(`aktif inşaat: ${snapshot.activeBuild ?? "-"}`);
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
