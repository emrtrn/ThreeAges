/**
 * Main HUD strip — Vertical Slice Plan v0.2 §51 "Ana HUD" (Faz 9).
 *
 * Carries the six readouts a player must be able to answer without leaving the
 * map: the four resources and their income, population, age, idle workers, and
 * the critical logistics warning. Until Faz 9 these lived inside the Faz 2 build
 * palette, whose own header called itself "not the final HUD" — a side panel
 * that grew every readout anyone needed. §52 asks the UI not to cover the map's
 * critical areas, so state moves to a thin top strip and the palette keeps only
 * the actions.
 *
 * Presentation only: every value is pushed in from `RtsApp`, and the strip
 * decides nothing. The one rule it owns is *when to touch the DOM* — values are
 * re-pushed every frame, so each cell diffs its own text first.
 */
import type { AgeBalance } from "../../data/gameDataTypes";
import type { AgeSnapshot } from "../progression/ageSystem";
import type { ProducerLogisticsStatus } from "../economy/productionLogisticsSystem";
import { RESOURCE_ORDER, formatInventoryAmount, resourceLabel } from "./resourceLabels";

/** The §51 warning text, keyed by the failure the logistics system resolved. */
const LOGISTICS_WARNING: Readonly<Record<Exclude<ProducerLogisticsStatus, "linked">, string>> = {
  "outside-control": "Lojistik kesildi: üretim yapısı Kontrol Dışı.",
  "unlinked-road": "Lojistik kesildi: üretim yapısını yola bağlayın.",
  "unlinked-depot": "Lojistik kesildi: aynı yol ağında Depo yok.",
  "depot-occupied": "Lojistik kesildi: Depo düşman işgali altında.",
};

interface ResourceCell {
  readonly amount: HTMLElement;
  readonly income: HTMLElement;
}

export class RtsHudBar {
  private readonly root = document.createElement("header");
  private readonly resourceCells = new Map<string, ResourceCell>();
  private readonly population = document.createElement("span");
  private readonly idleWorkers = document.createElement("span");
  private readonly age = document.createElement("span");
  private readonly warning = document.createElement("p");

  constructor() {
    this.root.className = "rts-hud-bar ui-interactive";
    this.root.setAttribute("aria-label", "Krallık durumu");

    const resources = document.createElement("div");
    resources.className = "rts-hud-resources";
    for (const resourceId of RESOURCE_ORDER) {
      const cell = document.createElement("div");
      cell.className = "rts-hud-resource";
      cell.dataset.rtsResource = resourceId;
      const label = document.createElement("span");
      label.className = "rts-hud-resource-label";
      label.textContent = resourceLabel(resourceId);
      const amount = document.createElement("span");
      amount.className = "rts-hud-resource-amount";
      amount.textContent = "0";
      const income = document.createElement("span");
      income.className = "rts-hud-resource-income";
      income.textContent = "+0.0/dk";
      cell.append(label, amount, income);
      resources.appendChild(cell);
      this.resourceCells.set(resourceId, { amount, income });
    }
    this.root.appendChild(resources);

    // The warning sits *between* the resources and the status, in the bar's one
    // row. An earlier build gave it a full-width row of its own, which turned
    // the strip into two rows the moment a road was cut — and the numbers that
    // explain the cut reflowed underneath themselves exactly when the player
    // needed to read them.
    this.warning.className = "rts-hud-warning";
    // Polite, not assertive: a contested road can resolve itself, and an
    // assertive live region would interrupt a screen reader mid-sentence for a
    // warning that may already be gone.
    this.warning.setAttribute("aria-live", "polite");
    this.warning.hidden = true;
    this.root.appendChild(this.warning);

    const status = document.createElement("div");
    status.className = "rts-hud-status";
    this.population.className = "rts-hud-population";
    this.idleWorkers.className = "rts-hud-idle-workers";
    this.age.className = "rts-hud-age";
    status.append(this.population, this.idleWorkers, this.age);
    this.root.appendChild(status);

    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
  }

  /** Stock and income share a cell: a rate is meaningless without its stock. */
  setResources(
    stock: Readonly<Record<string, number>>,
    income: Readonly<Record<string, number>>,
  ): void {
    for (const [resourceId, cell] of this.resourceCells) {
      const amount = String(formatInventoryAmount(stock[resourceId] ?? 0));
      if (cell.amount.textContent !== amount) cell.amount.textContent = amount;
      const rate = income[resourceId] ?? 0;
      const rateText = `+${rate.toFixed(1)}/dk`;
      if (cell.income.textContent !== rateText) cell.income.textContent = rateText;
      // A resource earning nothing is a decision prompt, not a cosmetic state:
      // it is the readout that explains why the Town age never arrives.
      cell.income.dataset.idle = String(rate <= 0);
    }
  }

  setPopulation(used: number, capacity: number): void {
    const text = `Nüfus: ${used}/${capacity}`;
    if (this.population.textContent !== text) this.population.textContent = text;
    this.population.dataset.full = String(used >= capacity);
  }

  setIdleWorkerCount(count: number): void {
    const text = `Boşta işçi: ${count}`;
    if (this.idleWorkers.textContent !== text) this.idleWorkers.textContent = text;
    this.idleWorkers.dataset.idle = String(count > 0);
  }

  setAge(snapshot: AgeSnapshot, balance: AgeBalance): void {
    const text = snapshot.upgrading
      ? `Çağ: ${balance.settlement.label} → ${balance.town.label} (${Math.ceil(snapshot.remainingSeconds)} sn)`
      : `Çağ: ${snapshot.age === "town" ? balance.town.label : balance.settlement.label}`;
    if (this.age.textContent !== text) this.age.textContent = text;
  }

  /**
   * Show the first unhealthy producer's reason. One line, not a list: the
   * warning's job is to point at the map, and the selected producer's panel
   * carries the per-building detail.
   */
  setLogisticsStatuses(statuses: readonly ProducerLogisticsStatus[]): void {
    const status = statuses.find((candidate) => candidate !== "linked");
    if (!status) {
      if (!this.warning.hidden) this.warning.hidden = true;
      return;
    }
    const text = LOGISTICS_WARNING[status];
    if (this.warning.textContent !== text) {
      this.warning.textContent = text;
      // The strip keeps the warning on one line; the tooltip is the escape hatch
      // if a narrow viewport ever ellipsises it.
      this.warning.title = text;
    }
    this.warning.hidden = false;
  }

  dispose(): void {
    this.root.remove();
  }
}
