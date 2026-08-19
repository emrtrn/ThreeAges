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
import { onLocaleChanged, t } from "../../localization/LocalizationService";
import { commandKeyLabel } from "../input/rtsInput";
import type { AgeBalance } from "../../data/gameDataTypes";
import type { ProgressionSnapshot } from "../progression/kingdomProgressionSystem";
import type { ProducerLogisticsStatus } from "../economy/productionLogisticsSystem";
import { RESOURCE_ORDER, formatInventoryAmount, resourceLabel } from "./resourceLabels";
import { resourceIconSrc } from "./rtsUiIcons";

/**
 * The §51 warning key, per failure the logistics system resolved.
 *
 * The gameplay ids stay as they are (Plan §3.4) and only the *key* is derived
 * from them, so a status can be renamed in one place without touching six
 * translations.
 */
const LOGISTICS_WARNING_KEY: Readonly<Record<Exclude<ProducerLogisticsStatus, "linked">, string>> = {
  "outside-control": "hud.warning.outside_control",
  "unlinked-road": "hud.warning.unlinked_road",
  "unlinked-depot": "hud.warning.unlinked_depot",
  "unlinked-main-network": "hud.warning.unlinked_main_network",
  "depot-occupied": "hud.warning.depot_occupied",
};

/**
 * The key a hint names, read from the binding table rather than written into the
 * sentence — inventory §7.6. A rebound command used to make eight languages lie
 * at once; now the letter is a parameter and the binding is its only source.
 */
function keyHint(command: Parameters<typeof commandKeyLabel>[0]): string {
  return commandKeyLabel(command) ?? "—";
}

interface ResourceCell {
  /**
   * Held only so a language change can rewrite it. The name is the one part of
   * a cell `RtsApp` never pushes — it is written at construction and would
   * otherwise still read "Yiyecek" after the player picked English (Plan §13).
   */
  readonly label: HTMLElement;
  readonly amount: HTMLElement;
  readonly income: HTMLElement;
}

export class RtsHudBar {
  private readonly root = document.createElement("header");
  private readonly resourceCells = new Map<string, ResourceCell>();
  private readonly population = document.createElement("span");
  private readonly idleWorkers = document.createElement("span");
  private readonly age = document.createElement("span");
  private readonly duration = document.createElement("span");
  private readonly warning = document.createElement("p");
  private readonly selectIdleWorkers = document.createElement("button");
  private readonly workerAutomation = document.createElement("button");
  private readonly status = document.createElement("div");
  private readonly utilityControls = document.createElement("div");
  private readonly identity = document.createElement("div");
  private readonly crest = document.createElement("img");
  private readonly pauseButton = document.createElement("button");
  /** Last pushed value, so a language change can re-render the button (§13). */
  private workerAutomationEnabled = true;
  private readonly stopLocaleWatch: () => void;

  constructor(
    onSelectIdleWorkers: () => void = () => {},
    onToggleWorkerAutomation: () => void = () => {},
    onOpenPauseMenu: () => void = () => {},
  ) {
    this.root.className = "rts-hud-bar ui-interactive";

    this.identity.className = "rts-hud-identity";
    this.crest.className = "rts-hud-crest";
    this.crest.src = "/assets/ui/arma.png";
    this.identity.appendChild(this.crest);
    this.root.appendChild(this.identity);

    const resources = document.createElement("div");
    resources.className = "rts-hud-resources";
    for (const resourceId of RESOURCE_ORDER) {
      const cell = document.createElement("div");
      cell.className = "rts-hud-resource";
      cell.dataset.rtsResource = resourceId;
      const icon = document.createElement("img");
      icon.className = "rts-hud-resource-icon";
      icon.src = resourceIconSrc(resourceId);
      icon.alt = "";
      icon.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "rts-hud-resource-label";
      const amount = document.createElement("span");
      amount.className = "rts-hud-resource-amount";
      amount.textContent = "0";
      const income = document.createElement("span");
      income.className = "rts-hud-resource-income";
      // Seeded through the pattern, not with "+0.0/dk": the literal was a
      // Turkish rate on an English HUD for the frame before the first push.
      income.textContent = t("hud.resource.income", { rate: 0 });
      const values = document.createElement("span");
      values.className = "rts-hud-resource-values";
      values.append(label, amount, income);
      cell.append(icon, values);
      resources.appendChild(cell);
      this.resourceCells.set(resourceId, { label, amount, income });
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

    const status = this.status;
    status.className = "rts-hud-status";
    this.population.className = "rts-hud-population";
    this.idleWorkers.className = "rts-hud-idle-workers";
    this.age.className = "rts-hud-age";
    this.duration.className = "rts-hud-duration";
    const matchReadouts = document.createElement("div");
    matchReadouts.className = "rts-hud-match-readouts";
    matchReadouts.append(this.age, this.duration, this.population);
    const workerCluster = document.createElement("div");
    workerCluster.className = "rts-hud-worker-cluster";
    const workerActions = document.createElement("div");
    workerActions.className = "rts-hud-worker-actions";
    this.selectIdleWorkers.type = "button";
    this.selectIdleWorkers.className = "rts-hud-worker-action";
    this.selectIdleWorkers.addEventListener("click", onSelectIdleWorkers);
    this.workerAutomation.type = "button";
    this.workerAutomation.className = "rts-hud-worker-action";
    this.workerAutomation.addEventListener("click", onToggleWorkerAutomation);
    workerActions.append(this.selectIdleWorkers, this.workerAutomation);
    workerCluster.append(this.idleWorkers, workerActions);
    status.append(matchReadouts, workerCluster);
    this.root.appendChild(status);
    this.utilityControls.className = "rts-hud-utility-controls";
    this.pauseButton.type = "button";
    this.pauseButton.className = "rts-hud-menu-button";
    this.pauseButton.textContent = "Ⅱ";
    this.pauseButton.addEventListener("click", onOpenPauseMenu);
    this.utilityControls.appendChild(this.pauseButton);
    this.root.appendChild(this.utilityControls);

    this.applyStaticText();
    this.stopLocaleWatch = onLocaleChanged(() => this.applyStaticText());
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
  }

  /**
   * Every string the bar writes once and then leaves alone.
   *
   * The readouts do not need to be here: `RtsApp` re-pushes them every frame, so
   * they follow a language change on their own. These do not — they are written
   * at construction, and a language change is the only thing that can invalidate
   * them (Plan §13).
   */
  private applyStaticText(): void {
    this.root.setAttribute("aria-label", t("hud.aria.kingdom_status"));
    for (const [resourceId, cell] of this.resourceCells) {
      cell.label.textContent = resourceLabel(resourceId);
    }
    this.identity.setAttribute("aria-label", t("hud.aria.kingdom"));
    this.crest.alt = t("hud.crest.alt");
    const selectKey = keyHint("selectIdleWorkers");
    this.selectIdleWorkers.textContent = t("hud.idle_workers.select.label", { key: selectKey });
    const selectHint = t("hud.idle_workers.select.tooltip", { key: selectKey });
    this.selectIdleWorkers.setAttribute("aria-label", selectHint);
    this.selectIdleWorkers.title = selectHint;
    const pauseHint = t("hud.pause.tooltip", { key: keyHint("pause") });
    this.pauseButton.setAttribute("aria-label", pauseHint);
    this.pauseButton.title = pauseHint;
    this.setWorkerAutomationEnabled(this.workerAutomationEnabled);
  }

  /** Stock and income share a cell: a rate is meaningless without its stock. */
  setResources(
    stock: Readonly<Record<string, number>>,
    income: Readonly<Record<string, number>>,
    capacity: Readonly<Record<string, number>> = {},
  ): void {
    for (const [resourceId, cell] of this.resourceCells) {
      const limit = capacity[resourceId];
      const amount = limit === undefined
        ? String(formatInventoryAmount(stock[resourceId] ?? 0))
        : `${formatInventoryAmount(stock[resourceId] ?? 0)}/${formatInventoryAmount(limit)}`;
      if (cell.amount.textContent !== amount) cell.amount.textContent = amount;
      const rate = income[resourceId] ?? 0;
      // `::.0` rather than `toFixed(1)`: the decimal separator belongs to the
      // locale (`0,0` in Turkish), and only Intl knows which one to write.
      const rateText = t("hud.resource.income", { rate });
      if (cell.income.textContent !== rateText) cell.income.textContent = rateText;
      // A resource earning nothing is a decision prompt, not a cosmetic state:
      // it is the readout that explains why the Town age never arrives.
      cell.income.dataset.idle = String(rate <= 0);
    }
  }

  setPopulation(used: number, capacity: number): void {
    const text = t("hud.population.value", { used, capacity });
    if (this.population.textContent !== text) this.population.textContent = text;
    this.population.dataset.full = String(used >= capacity);
  }

  setIdleWorkerCount(count: number): void {
    const text = t("hud.idle_workers.value", { count });
    if (this.idleWorkers.textContent !== text) this.idleWorkers.textContent = text;
    this.idleWorkers.title = t("hud.idle_workers.tooltip", { count });
    this.idleWorkers.dataset.idle = String(count > 0);
    this.selectIdleWorkers.disabled = count === 0;
  }

  /** Render the player-owned automatic staffing preference; the simulation stays in RtsApp. */
  setWorkerAutomationEnabled(enabled: boolean): void {
    this.workerAutomationEnabled = enabled;
    // Two whole keys rather than one sentence with an "on"/"off" word dropped
    // into it: the state word is not a noun every language can slot into the
    // same frame, and Plan §10 wants the sentence to own its own word order.
    const state = enabled ? "on" : "off";
    const key = keyHint("toggleWorkerAutomation");
    const label = t(`hud.worker_automation.${state}.label`, { key });
    if (this.workerAutomation.textContent !== label) this.workerAutomation.textContent = label;
    const hint = t(`hud.worker_automation.${state}.tooltip`, { key });
    this.workerAutomation.title = hint;
    this.workerAutomation.setAttribute("aria-label", hint);
    this.workerAutomation.dataset.enabled = String(enabled);
  }

  /**
   * The kingdom's age, and the transition when one is actually running.
   *
   * Only the `"town"` kind renames the age. Keyed on `upgrading` alone, this
   * cell claimed "Yerleşim → Kasaba" for *any* centre action, so a Kasaba
   * kingdom starting its Lv1→Lv2 upgrade was told it was still on its way to a
   * Kasaba it already had — the same confusion the palette's age lock used to
   * create at the same moment.
   */
  setAge(
    snapshot: Pick<ProgressionSnapshot, "age" | "upgrading" | "upgradeKind" | "remainingSeconds">,
    balance: AgeBalance,
  ): void {
    const text = snapshot.upgrading && snapshot.upgradeKind === "town"
      ? t("hud.age.upgrading", {
          from: t(balance.settlement.nameKey),
          to: t(balance.town.nameKey),
          seconds: Math.ceil(snapshot.remainingSeconds),
        })
      : t("hud.age.current", {
          age: t(snapshot.age === "town" ? balance.town.nameKey : balance.settlement.nameKey),
        });
    if (this.age.textContent !== text) this.age.textContent = text;
  }

  setMatchDuration(seconds: number): void {
    const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
    if (this.duration.textContent !== text) this.duration.textContent = text;
  }

  /** Places a stateful control in the HUD without making the bar own its rules. */
  mountUtilityControl(control: { mount(parent: HTMLElement): void }): void {
    control.mount(this.utilityControls);
  }

  /**
   * Places a stateful control in the status cluster, after the readouts.
   *
   * Separate from {@link mountUtilityControl} because the two ends of the bar
   * mean different things: utilities are global controls that belong to the
   * session (pause, speed), while this side answers "what state is my kingdom
   * in". The army strip is a breakdown of the population readout it lands
   * beside, not a control.
   */
  mountStatusControl(control: { mount(parent: HTMLElement): void }): void {
    control.mount(this.status);
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
    const text = t(LOGISTICS_WARNING_KEY[status]);
    if (this.warning.textContent !== text) {
      this.warning.textContent = text;
      // The strip keeps the warning on one line; the tooltip is the escape hatch
      // if a narrow viewport ever ellipsises it.
      this.warning.title = text;
    }
    this.warning.hidden = false;
  }

  dispose(): void {
    this.stopLocaleWatch();
    this.root.remove();
  }
}
