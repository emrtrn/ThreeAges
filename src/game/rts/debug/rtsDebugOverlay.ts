/** Compact Faz 1 diagnostics, shown only by the `?debug` RTS route. */
import type { RtsMatchOutcome } from "../match/rtsMatchState";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { UnitSystem } from "../units/unitSystem";
import type { CombatHit } from "../units/unitCombat";
import type { WorkerConstructionSystem } from "../units/workerConstructionSystem";
import type { ResourceWallet } from "../economy/resourceWallet";
import type { EconomyProductionSystem } from "../economy/economyProductionSystem";
import type { PopulationSystem } from "../economy/populationSystem";
import type { ResourceChange } from "../economy/resourceWallet";
import type { RoadGraph } from "../roads/roadGraph";
import type { DepotLogisticsSystem } from "../economy/depotLogisticsSystem";
import type { ProductionLogisticsSystem } from "../economy/productionLogisticsSystem";

const MAX_DAMAGE_LINES = 6;
const MAX_RESOURCE_LINES = 8;

export class RtsDebugOverlay {
  private readonly root = document.createElement("pre");
  private readonly damageLines: string[] = [];
  private readonly resourceLines: string[] = [];

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

  recordResourceChange(change: ResourceChange): void {
    if (change.kind === "reset") return;
    const sign = change.delta > 0 ? "+" : "";
    this.resourceLines.unshift(`${change.kind}: ${change.resourceId} ${sign}${change.delta}`);
    this.resourceLines.length = Math.min(this.resourceLines.length, MAX_RESOURCE_LINES);
  }

  update(
    units: UnitSystem,
    centers: CommandCenterSystem,
    outcome: RtsMatchOutcome,
    workers: WorkerConstructionSystem,
    wallet: ResourceWallet,
    production: EconomyProductionSystem | null,
    population: PopulationSystem,
    roads: RoadGraph,
    depots: DepotLogisticsSystem,
    productionLogistics: ProductionLogisticsSystem,
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
      const economyState = unit.role === "worker" ? production?.stateFor(unit) : undefined;
      const workerState = unit.role === "worker"
        ? ` ${economyState && economyState !== "idle" ? economyState : workers.stateFor(unit)}`
        : "";
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
        `${building.structureLabel}: ${building.assignedWorkers}/${building.workerCapacity} işçi (${building.workingWorkers} çalışıyor) · ${building.resourceId} ${building.localBuffer.toFixed(1)}/${building.localBufferCapacity} · üretim +${building.lastProductionTick.toFixed(2)} · aktarım +${building.lastTransferTick.toFixed(2)} · ${building.status}`,
      );
    }
    const roadComponents = roads.components();
    lines.push(
      `yollar: ${roads.all().length} düğüm · ${roads.edgeCount()} kenar · ${roadComponents.length} ağ`,
      ...roadComponents.map((component) => `  ağ#${component.id}: ${component.cells.length} düğüm`),
    );
    const depotNodes = depots.snapshots();
    lines.push(
      `depolar: ${depotNodes.length}`,
      ...depotNodes.map((depot) => `  depo#${depot.structureId}: ${depot.status}${depot.componentId ? ` · ağ#${depot.componentId}` : ""}`),
    );
    const producerLinks = productionLogistics.snapshots();
    lines.push(
      `üretim bağlantıları: ${producerLinks.length}`,
      ...producerLinks.map((producer) => `  yapı#${producer.structureId} (${producer.resourceId}): ${producer.status}${producer.depotStructureId ? ` · depo#${producer.depotStructureId}` : ""}`),
    );
    lines.push("kaynak hareketleri:", ...(this.resourceLines.length ? this.resourceLines : ["- yok"]));
    this.root.textContent = lines.join("\n");
  }

  dispose(): void {
    this.root.remove();
  }
}
