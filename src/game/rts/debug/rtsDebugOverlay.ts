/** Compact Faz 1 diagnostics, shown only by the `?debug` RTS route. */
import type { RtsMatchOutcome } from "../match/rtsMatchState";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { UnitSystem } from "../units/unitSystem";
import type { CombatHit } from "../units/unitCombat";
import type { WorkerConstructionSystem } from "../units/workerConstructionSystem";
import type { ResourceWallet } from "../economy/resourceWallet";
import type { EconomyProductionSystem } from "../economy/economyProductionSystem";
import type { PopulationSystem } from "../economy/populationSystem";

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
    wallet: ResourceWallet,
    production: EconomyProductionSystem | null,
    population: PopulationSystem,
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
    const resources = wallet.snapshot();
    const populationState = population.snapshot();
    lines.push(
      "ekonomi:",
      ...Object.entries(resources).map(([id, amount]) => `${id}: ${amount} (+${wallet.incomePerMinute(id).toFixed(1)}/dk)`),
    );
    lines.push(`nüfus: ${populationState.used}/${populationState.capacity} (mevcut ${populationState.current})`);
    for (const building of production?.snapshots() ?? []) {
      lines.push(
        `${building.structureLabel}: ${building.workingWorkers}/${building.workerCapacity} işçi · ${building.resourceId} ${building.localBuffer.toFixed(1)}/${building.localBufferCapacity} · ${building.status}`,
      );
    }
    this.root.textContent = lines.join("\n");
  }

  dispose(): void {
    this.root.remove();
  }
}
