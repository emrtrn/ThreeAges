/**
 * AI debug panel text — `07_ENEMY_AI_DESIGN_v0.2.md` §82; plan §39
 * ("AI karar nedeni debug panelinde görülebiliyor").
 *
 * A pure formatter, mirroring the engine's `formatAiNavDebug`: it takes a
 * snapshot plus the decision log and returns lines. Keeping it free of DOM
 * means the §39 acceptance criterion is checked by an engine test rather than
 * by squinting at a screenshot.
 */
import type { AiControllerSnapshot } from "./aiController";
import type { AiDecisionEntry } from "./aiDecisionLog";

const MAX_DECISION_LINES = 5;

export function formatRtsAiDebug(
  snapshot: AiControllerSnapshot,
  decisions: readonly AiDecisionEntry[],
  economyMultiplier: number,
): string[] {
  const bb = snapshot.blackboard;
  const lines = [`AI (${snapshot.owner}) — ekonomi çarpanı ${economyMultiplier.toFixed(2)}`];
  lines.push(
    `niyet: ${snapshot.intent ?? "-"}${snapshot.plan ? ` · plan ${snapshot.plan.id} (${snapshot.planSeconds.toFixed(1)}sn)` : ""}`,
  );
  lines.push(`ordu görevi: ${snapshot.mission ?? "-"} · güç ${snapshot.armyPower.toFixed(1)}`);
  lines.push(`darboğaz: ${snapshot.bottleneck ?? "yok"}`);

  if (snapshot.scores.length > 0) {
    lines.push("niyet puanları:");
    for (const score of snapshot.scores) {
      const marker = score.intent === snapshot.intent ? "*" : " ";
      lines.push(`  ${marker}${score.intent}: ${score.score.toFixed(2)} — ${score.reason}`);
    }
  }

  if (bb) {
    lines.push(
      `işçi: ${bb.workerCount} (boşta ${bb.idleWorkerCount}) · nüfus ${bb.population}/${bb.populationCap}`,
      `gelir: yiyecek +${(bb.resourceIncomePerMinute["food"] ?? 0).toFixed(1)}/dk · odun +${(bb.resourceIncomePerMinute["wood"] ?? 0).toFixed(1)}/dk`,
      `tehdit: üs ${bb.baseThreat.toFixed(1)} · düşman ordu ${bb.knownEnemyArmyPower.toFixed(1)}`,
    );
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
