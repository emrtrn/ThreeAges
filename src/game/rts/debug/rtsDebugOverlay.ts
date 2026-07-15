/** Compact Faz 1 diagnostics, shown only by the `?debug` RTS route. */
import type { RtsMatchOutcome } from "../match/rtsMatchState";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { UnitSystem } from "../units/unitSystem";
import type { CombatHit } from "../units/unitCombat";
import type { WorkerConstructionSystem } from "../units/workerConstructionSystem";

const MAX_DAMAGE_LINES = 6;

export class RtsDebugOverlay {
  private readonly root = document.createElement("pre");
  private readonly damageLines: string[] = [];

  constructor() {
    this.root.className = "rts-debug-overlay";
    const host = document.getElementById("ui-overlay") ?? document.body;
    host.appendChild(this.root);
  }

  recordHit(hit: CombatHit): void {
    const target = "id" in hit.target ? `birim#${hit.target.id}` : `${hit.target.owner} merkez`;
    this.damageLines.unshift(`-${hit.change.applied}  birim#${hit.attacker.id} -> ${target}`);
    this.damageLines.length = Math.min(this.damageLines.length, MAX_DAMAGE_LINES);
  }

  update(
    units: UnitSystem,
    centers: CommandCenterSystem,
    outcome: RtsMatchOutcome,
    workers: WorkerConstructionSystem,
  ): void {
    const lines = [`maç: ${outcome}`];
    for (const center of centers.all()) {
      lines.push(`merkez ${center.owner}: ${center.health.current}/${center.health.max}`);
    }
    lines.push("birimler:");
    for (const unit of units.all()) {
      const order = unit.attackTarget
        ? `saldırı:${unit.attackTarget.owner}`
        : unit.pathWaypointCount > 0
          ? `yol:${unit.pathWaypointCount}`
          : unit.moveTarget
            ? "hareket"
            : "boşta";
      const workerState = unit.role === "worker" ? ` ${workers.stateFor(unit)}` : "";
      lines.push(
        `#${unit.id} ${unit.owner}/${unit.role} hp ${unit.health.current}/${unit.health.max} ${order}${workerState}`,
      );
    }
    lines.push("hasar:", ...(this.damageLines.length ? this.damageLines : ["- yok"]));
    this.root.textContent = lines.join("\n");
  }

  dispose(): void {
    this.root.remove();
  }
}
