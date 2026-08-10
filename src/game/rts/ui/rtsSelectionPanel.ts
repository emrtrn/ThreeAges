/**
 * Selection panel — Vertical Slice Plan v0.2 §51 ("Seçim panelleri").
 *
 * Renders whatever {@link describeSelection} decided; it makes no decisions of
 * its own. Faz 7 shipped this as an army-only readout that reached into `Unit`
 * and formatted inline; Faz 9 needed the same panel to answer for six kinds of
 * building too, and six more formatting branches in a DOM component is how a
 * panel stops being testable. The content moved to {@link rtsSelectionView};
 * what stayed here is the one rule a view *should* own: which node to touch when.
 *
 * The action row follows the same split. The panel knows an action has an id, a
 * label and whether it is enabled — it does not know what any of them *mean*.
 * It hands the id back and lets `RtsApp` own the verb.
 */
import {
  DEMOLISH_ACTION,
  describeSelection,
  type RtsSelectionView,
  type SelectionAction,
  type SelectionChip,
  type SelectionFormationControls,
  type SelectionPanelContent,
  type SelectionUnitCard,
  type WorkerAssignmentTarget,
} from "./rtsSelectionView";
import { isRtsFormationId, type RtsFormationId } from "../units/formations/rtsFormationTypes";

export class RtsSelectionPanel {
  private readonly root = document.createElement("section");
  private readonly portrait = document.createElement("div");
  private readonly portraitImage = document.createElement("img");
  private readonly selectionCount = document.createElement("span");
  private readonly header = document.createElement("div");
  private readonly title = document.createElement("strong");
  private readonly summary = document.createElement("p");
  private readonly health = document.createElement("div");
  private readonly healthFill = document.createElement("div");
  private readonly slots = document.createElement("div");
  /** The group-selection face: one card per unit type, in place of the frame above. */
  private readonly cards = document.createElement("div");
  private readonly formation = document.createElement("section");
  private readonly formationOptions = document.createElement("div");
  /** Direct assignment cards shown only next to a held worker group. */
  private readonly workerAssignments = document.createElement("div");
  private readonly body = document.createElement("div");
  private readonly lines: HTMLParagraphElement[] = [];
  /** The status strip under the body lines; see {@link SelectionChip}. */
  private readonly chips = document.createElement("div");
  private readonly progress = document.createElement("div");
  private readonly progressLabel = document.createElement("span");
  private readonly progressTime = document.createElement("span");
  private readonly progressFill = document.createElement("div");
  private readonly progressCancel = document.createElement("button");
  private readonly actionRow = document.createElement("div");
  private readonly actionTray = document.createElement("div");
  private readonly actionButtons = new Map<string, HTMLButtonElement>();
  private readonly hints = document.createElement("p");
  /**
   * Last rendered content. The sentinel matters: an empty selection's own
   * signature is "", so starting there would make the constructor's first
   * `setSelection` a no-op and leave the panel visible and blank at boot.
   */
  private signature = " ";
  /** The action id the story chain is pointing at, if any (Sürüm 2 §12.4). */
  private missionHighlightId: string | null = null;

  constructor(
    private readonly onAction: (id: string) => void,
    private readonly onFormationChange: (formation: RtsFormationId) => void = () => undefined,
  ) {
    // Deliberately *not* `ui-interactive`. The panel is a readout sitting in the
    // bottom-centre of a fullscreen map, and Faz 9 measured what that costs: it
    // swallowed map clicks in a 420x130 box — a Depot placed there failed
    // silently. Only the two parts that genuinely need a pointer take one: the
    // buttons, and the body that carries the reason tooltip. Everything else —
    // title, summary, hints, padding — lets the click through to the map, the
    // same rule the notification feed states for itself.
    this.root.className = "rts-selection-panel";
    this.root.setAttribute("aria-label", "Seçim");
    this.portrait.className = "rts-selection-portrait";
    this.portraitImage.className = "rts-selection-portrait-image";
    this.portraitImage.alt = "";
    this.portraitImage.hidden = true;
    this.selectionCount.className = "rts-selection-count";
    this.portrait.append(this.portraitImage, this.selectionCount);
    this.header.className = "rts-selection-header";
    this.summary.className = "rts-selection-summary";
    this.health.className = "rts-selection-health";
    this.health.setAttribute("aria-label", "Can");
    this.healthFill.className = "rts-selection-health-fill";
    this.health.appendChild(this.healthFill);
    this.slots.className = "rts-selection-slots";
    this.header.append(this.title, this.summary, this.health, this.slots);
    this.body.className = "rts-selection-body ui-interactive";
    this.actionRow.className = "rts-selection-actions ui-interactive";
    this.actionTray.className = "rts-selection-action-tray ui-interactive";
    this.actionTray.hidden = true;
    this.hints.className = "rts-selection-hints";
    // A labelled fill bar for a running timed job (a level-up, or a training
    // queue). Assembled once and shown/hidden per frame; only the label, seconds
    // and fill width move.
    //
    // It is a row of the panel grid rather than a block stacked under the body:
    // the panel is a fixed 165px, the body row is ~49px of it, and a bar queued
    // behind three lines of prose in an `overflow: hidden` column was simply
    // never drawn. The panel's last row is free in every layout that can carry a
    // bar, so the bar sits there, full width, and no longer competes with text.
    this.progress.className = "rts-selection-progress";
    this.progressLabel.className = "rts-selection-progress-label";
    this.progressTime.className = "rts-selection-progress-time";
    // The bar's own undo. Built once and shown per frame like the bar it belongs
    // to, and it carries no visible text: the glyph is the whole button, and the
    // view's label is its accessible name and tooltip.
    this.progressCancel.type = "button";
    // `ui-interactive` because the panel root deliberately is not: the overlay is
    // click-through so the map stays reachable, and only widgets that must take a
    // pointer opt in — the same rule the action buttons and body follow.
    this.progressCancel.className = "rts-selection-progress-cancel ui-interactive";
    this.progressCancel.textContent = "✕";
    this.progressCancel.hidden = true;
    this.progressCancel.addEventListener("click", () => {
      const id = this.progressCancel.dataset.rtsAction;
      if (id) this.onAction(id);
    });
    const track = document.createElement("div");
    track.className = "rts-selection-progress-track";
    this.progressFill.className = "rts-selection-progress-fill";
    track.appendChild(this.progressFill);
    this.progress.append(this.progressLabel, track, this.progressTime, this.progressCancel);
    // The chips sit inside `details`, under the body, rather than claiming the
    // panel's last row. That row is genuinely free in the demolish-only layout,
    // but it is also where `.rts-selection-progress` lives — so a Barracks with
    // a training bar and a "Kontrol Dışı" badge would have had them fighting for
    // it. Under the lines they summarise, the strip works in every layout with
    // no grid surgery, and the roster face hides it for free (`details` is
    // `display: none` there).
    this.chips.className = "rts-selection-chips ui-interactive";
    this.chips.hidden = true;
    const details = document.createElement("div");
    details.className = "rts-selection-details";
    details.append(this.body, this.chips);
    // Scrolls rather than shrinks: a project that ships eight unit types must
    // not squeeze eight portraits into unreadable slivers, and the panel's
    // height is fixed by the frame it lives in.
    this.cards.className = "rts-selection-cards ui-interactive";
    this.cards.hidden = true;
    this.formation.className = "rts-selection-formation ui-interactive";
    this.formation.hidden = true;
    const formationTitle = document.createElement("strong");
    formationTitle.className = "rts-selection-formation-title";
    formationTitle.textContent = "Formasyon";
    this.formationOptions.className = "rts-selection-formation-options";
    this.formation.append(this.formationOptions, formationTitle);
    this.workerAssignments.className = "rts-selection-worker-assignments ui-interactive";
    this.workerAssignments.hidden = true;
    this.root.append(this.portrait, this.header, details, this.cards, this.formation, this.workerAssignments, this.actionRow, this.progress, this.hints);
    const overlay = document.getElementById("ui-overlay") ?? document.body;
    overlay.append(this.root, this.actionTray);
    this.setSelection({ kind: "none" });
  }

  setSelection(view: RtsSelectionView): void {
    const content = describeSelection(view);
    const isEmptySelection = view.kind === "none" || (view.kind === "units" && view.units.length === 0);
    // Selection is re-pushed every frame; only touch the DOM when it changed.
    const signature = JSON.stringify(content);
    if (signature === this.signature) return;
    this.signature = signature;
    this.root.hidden = isEmptySelection;
    if (this.root.hidden) this.actionTray.hidden = true;
    else this.render(content);
  }

  /**
   * Point at the button the active story step is asking for (Sürüm 2 §12.4).
   *
   * The panel half of {@link missionGuideHighlight}: the palette can point at a
   * building the player does not own yet, but a Market trade or the centre's
   * level-up only exists once that building is selected — so by the time this is
   * called with a non-null id, the button is on screen or about to be.
   *
   * Stored rather than applied once, because `renderActions` rebuilds these
   * buttons whenever the action *set* changes, which would drop a class applied
   * from outside.
   */
  setMissionHighlight(actionId: string | null): void {
    if (actionId === this.missionHighlightId) return;
    this.missionHighlightId = actionId;
    this.syncMissionHighlight();
  }

  dispose(): void {
    this.root.remove();
    this.actionTray.remove();
  }

  private syncMissionHighlight(): void {
    for (const [id, button] of this.actionButtons) {
      button.classList.toggle("is-mission-hint", id === this.missionHighlightId);
    }
  }

  private render(content: SelectionPanelContent): void {
    // Multi-command buildings keep their live facts in the compact selection
    // panel, but lift their verbs into independent cards immediately above it.
    // Demolish remains contextual to its selected structure in the panel.
    const usesFloatingActions = content.actionLayout !== undefined;
    const panelActions = usesFloatingActions
      ? content.actions.filter((action) => action.id === DEMOLISH_ACTION)
      : content.actions;
    const trayActions = usesFloatingActions
      ? content.actions.filter((action) => action.id !== DEMOLISH_ACTION)
      : [];
    this.root.dataset.rtsActionLayout = panelActions.length > 1
        ? "deck"
        : panelActions.length === 1
          ? "single"
          : "wide";
    this.actionTray.dataset.rtsActionLayout = content.actionLayout ?? "";
    // A group selection replaces the single-unit frame instead of adding to it,
    // so the mode is an attribute on the root: CSS hides the portrait, header
    // and body wholesale rather than every one of them being toggled here.
    this.root.dataset.rtsPanelMode = content.cards
      ? content.workerAssignments ? "roster-worker-assignments" : content.formation ? "roster-formation" : "roster"
      : "unit";
    this.renderCards(content.cards ?? []);
    this.renderFormation(content.formation);
    this.renderWorkerAssignments(content.workerAssignments);
    this.title.textContent = content.title;
    this.summary.textContent = content.summary;
    this.hints.textContent = content.hint;
    // The hint row and the progress bar share the panel's last row. Nothing that
    // runs a timed job also carries a hint today, but the bar wins if that ever
    // changes: it is live state with a button on it, and the hint is advice.
    this.hints.hidden = content.hint.length === 0 || (content.progress ?? null) !== null;
    this.renderSlots(content.slots ?? []);
    const portrait = content.portrait ?? null;
    this.portraitImage.hidden = portrait === null;
    if (portrait && this.portraitImage.src !== new URL(portrait, window.location.origin).href) {
      this.portraitImage.src = portrait;
    }
    const count = content.selectionCount ?? 0;
    this.selectionCount.textContent = count > 0 ? `×${count}` : "";
    const health = content.health ?? null;
    this.health.hidden = health === null;
    if (health) {
      const ratio = Math.min(1, Math.max(0, health.current / health.max));
      const percent = Math.round(ratio * 100);
      this.healthFill.style.width = `${percent}%`;
      this.health.dataset.rtsHealthTone = ratio >= 0.6 ? "healthy" : ratio >= 0.3 ? "warning" : "critical";
      this.health.title = `Can: ${Math.ceil(health.current)}/${Math.ceil(health.max)}`;
    } else delete this.health.dataset.rtsHealthTone;
    // Reuse the paragraphs rather than replaceChildren: the line count is stable
    // for a given selection, so the common re-render is a text swap.
    while (this.lines.length < content.lines.length) {
      const line = document.createElement("p");
      line.className = "rts-selection-line";
      this.lines.push(line);
      this.body.appendChild(line);
    }
    while (this.lines.length > content.lines.length) this.lines.pop()?.remove();
    for (const [index, text] of content.lines.entries()) {
      const line = this.lines[index]!;
      if (line.textContent !== text) line.textContent = text;
    }
    this.body.title = content.tooltip ?? "";
    this.renderChips(content.chips ?? []);
    this.renderProgress(content);
    this.renderActions(panelActions, trayActions);
  }

  private renderSlots(slots: readonly import("./rtsSelectionView").SelectionSlot[]): void {
    const signature = slots.map((slot) => `${slot.icon ?? ""}|${slot.label}|${slot.count}`).join(";");
    if (this.slots.dataset.rtsSlots === signature) return;
    this.slots.dataset.rtsSlots = signature;
    this.slots.replaceChildren(...slots.map((slot) => {
      const entry = document.createElement("span");
      entry.className = "rts-selection-slot";
      entry.title = `${slot.count} ${slot.label}`;
      if (slot.icon) {
        const icon = document.createElement("img");
        icon.src = slot.icon;
        icon.alt = "";
        entry.appendChild(icon);
      }
      const count = document.createElement("b");
      count.textContent = `×${slot.count}`;
      entry.appendChild(count);
      return entry;
    }));
  }

  /**
   * Draw the group-selection cards: a portrait per unit type, its count pinned
   * to the portrait's corner, its name underneath.
   *
   * Rebuilt whole rather than diffed per card. The signature guard makes that
   * cheap — a group's composition only changes when the selection or a unit's
   * life does — and the alternative is a reconcile loop for a row that is
   * usually one to four elements long.
   */
  private renderCards(cards: readonly SelectionUnitCard[]): void {
    // Every group keeps the same portrait language. Three and four types widen
    // the panel through its roster-count attribute instead of becoming a dense
    // text-only summary.
    const rosterLayout = "portraits";
    const signature = `${rosterLayout}|${cards.map((card) => `${card.typeId}|${card.count}`).join(";")}`;
    this.root.dataset.rtsRosterCount = String(cards.length);
    if (this.cards.dataset.rtsCards === signature) return;
    this.cards.dataset.rtsCards = signature;
    this.cards.dataset.rtsRosterLayout = rosterLayout;
    this.cards.hidden = cards.length === 0;
    this.cards.replaceChildren(...cards.map((card) => {
      const entry = document.createElement("div");
      entry.className = "rts-selection-card";
      entry.title = `${card.count} ${card.label}`;

      const count = document.createElement("span");
      count.className = "rts-selection-card-count";
      count.textContent = `×${card.count}`;

      const label = document.createElement("span");
      label.className = "rts-selection-card-label";
      label.textContent = card.label;

      const frame = document.createElement("div");
      frame.className = "rts-selection-card-portrait";
      if (card.icon) {
        const icon = document.createElement("img");
        icon.className = "rts-selection-card-image";
        icon.src = card.icon;
        // The name sits right below in its own element, so the artwork is
        // decoration here and a repeated alt would double every card.
        icon.alt = "";
        frame.appendChild(icon);
      }
      frame.appendChild(count);
      entry.append(frame, label);
      return entry;
    }));
  }

  private renderFormation(formation: SelectionFormationControls | undefined): void {
    this.formation.hidden = formation === undefined;
    if (!formation) return;
    const signature = `${formation.active}|${formation.combatUnitCount}|${formation.options.map((option) => `${option.id}:${option.enabled}`).join(";")}`;
    if (this.formation.dataset.rtsFormation !== signature) {
      this.formation.dataset.rtsFormation = signature;
      this.formationOptions.replaceChildren(...formation.options.map((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "rts-selection-formation-option";
        button.dataset.rtsFormation = option.id;
        button.disabled = !option.enabled;
        button.title = option.tooltip;
        button.setAttribute("aria-label", option.tooltip);
        const diagram = document.createElement("span");
        diagram.className = "rts-selection-formation-diagram";
        diagram.setAttribute("aria-hidden", "true");
        for (const [x, y] of option.iconDots) {
          const dot = document.createElement("i");
          dot.style.left = `${x}%`;
          dot.style.top = `${y}%`;
          diagram.appendChild(dot);
        }
        const label = document.createElement("span");
        label.className = "rts-selection-formation-label";
        label.textContent = option.label;
        button.append(diagram, label);
        button.addEventListener("click", () => {
          const id = button.dataset.rtsFormation;
          if (id && isRtsFormationId(id)) this.onFormationChange(id);
        });
        return button;
      }));
    }
    for (const button of this.formationOptions.querySelectorAll<HTMLButtonElement>(".rts-selection-formation-option")) {
      button.dataset.rtsActive = button.dataset.rtsFormation === formation.active ? "true" : "false";
    }
  }

  /**
   * Render target-building cards as buttons because, unlike roster portraits,
   * they issue a complete order without a second world click.
   */
  private renderWorkerAssignments(targets: readonly WorkerAssignmentTarget[] | undefined): void {
    if (!targets) {
      this.workerAssignments.hidden = true;
      delete this.workerAssignments.dataset.rtsWorkerAssignments;
      return;
    }
    const signature = targets.map((target) => (
      `${target.structureId}|${target.assignedWorkers}|${target.workerCapacity}`
    )).join(";");
    if (this.workerAssignments.dataset.rtsWorkerAssignments === signature) return;
    this.workerAssignments.dataset.rtsWorkerAssignments = signature;
    this.workerAssignments.hidden = false;
    if (targets.length === 0) {
      const empty = document.createElement("p");
      empty.className = "rts-selection-worker-assignment-empty";
      empty.textContent = "Uygun iş noktası yok · Oto ile otomatik atamayı aç";
      this.workerAssignments.replaceChildren(empty);
      return;
    }
    this.workerAssignments.replaceChildren(...targets.map((target) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "rts-selection-worker-assignment";
      card.dataset.rtsAction = target.actionId;
      const openSlots = target.workerCapacity - target.assignedWorkers;
      card.title = `${target.label}: ${openSlots} işçi yeri boş. Seçili işçileri ata.`;
      card.setAttribute("aria-label", card.title);
      if (target.icon) {
        const image = document.createElement("img");
        image.className = "rts-selection-worker-assignment-image";
        image.src = target.icon;
        image.alt = "";
        card.appendChild(image);
      }
      const label = document.createElement("span");
      label.className = "rts-selection-worker-assignment-label";
      label.textContent = target.label;
      const capacity = document.createElement("b");
      capacity.className = "rts-selection-worker-assignment-capacity";
      capacity.textContent = `${target.assignedWorkers}/${target.workerCapacity}`;
      card.append(label, capacity);
      card.addEventListener("click", () => this.onAction(target.actionId));
      return card;
    }));
  }

  /**
   * Draw the status strip: one badge per finite state the selection reports.
   *
   * Rebuilt whole rather than diffed, on the same reasoning as
   * {@link renderCards}: the signature guard keeps it to the frames where a chip
   * actually changed, and the strip is one to five elements — a reconcile loop
   * would cost more to read than it saves to run.
   *
   * The tooltip is the sentence the chip stands in for, and it is also the
   * accessible name: a screen reader must not be handed "🔗 Bağlı".
   */
  private renderChips(chips: readonly SelectionChip[]): void {
    const signature = chips.map((chip) => `${chip.id}|${chip.value}|${chip.tone}`).join(";");
    if (this.chips.dataset.rtsChips === signature) return;
    this.chips.dataset.rtsChips = signature;
    this.chips.hidden = chips.length === 0;
    this.chips.replaceChildren(...chips.map((chip) => {
      const entry = document.createElement("span");
      entry.className = "rts-selection-chip";
      entry.dataset.rtsChip = chip.id;
      entry.dataset.rtsTone = chip.tone;
      entry.title = chip.tooltip;
      entry.setAttribute("aria-label", chip.tooltip);

      const icon = document.createElement("span");
      icon.className = "rts-selection-chip-icon";
      // The glyph repeats what the value and the label already say, so it is
      // decoration; the accessible name lives on the chip itself.
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = chip.icon;

      const value = document.createElement("b");
      value.className = "rts-selection-chip-value";
      value.textContent = chip.value;

      entry.append(icon, value);
      return entry;
    }));
  }

  /** Show the fill bar only while a timed job is running; hide it otherwise. */
  private renderProgress(content: SelectionPanelContent): void {
    const progress = content.progress ?? null;
    this.progress.hidden = progress === null;
    const cancel = progress?.cancel ?? null;
    this.progressCancel.hidden = cancel === null;
    if (cancel) {
      this.progressCancel.dataset.rtsAction = cancel.id;
      this.progressCancel.disabled = !cancel.enabled;
      this.progressCancel.setAttribute("aria-label", cancel.label);
      this.progressCancel.title = cancel.reason ?? cancel.hint ?? cancel.label;
    } else delete this.progressCancel.dataset.rtsAction;
    if (!progress) return;
    this.progressLabel.textContent = progress.label;
    this.progressTime.textContent = `${Math.ceil(progress.remainingSeconds)} sn`;
    const percent = Math.round(Math.min(1, Math.max(0, progress.value)) * 100);
    this.progressFill.style.width = `${percent}%`;
    this.progress.setAttribute("aria-label", `${progress.label} %${percent}`);
  }

  /**
   * Rebuild the row only when the *set* of actions changes; a button's enabled
   * state and reason are refreshed in place. Replacing the nodes every frame
   * would cancel the press the player is in the middle of making.
   */
  private renderActions(
    panelActions: readonly SelectionAction[],
    trayActions: readonly SelectionAction[],
  ): void {
    const rendered = [
      ...panelActions.map((action) => ({ action, parent: this.actionRow })),
      ...trayActions.map((action) => ({ action, parent: this.actionTray })),
    ];
    const wanted = rendered.map(({ action, parent }) => `${parent === this.actionTray ? "tray" : "panel"}:${action.id}`).join("|");
    if (this.actionRow.dataset.rtsActions !== wanted) {
      this.actionRow.dataset.rtsActions = wanted;
      this.actionRow.replaceChildren();
      this.actionTray.replaceChildren();
      this.actionButtons.clear();
      for (const { action, parent } of rendered) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "rts-selection-action";
        button.dataset.rtsAction = action.id;
        button.dataset.rtsActive = action.active ? "true" : "false";
        button.setAttribute("aria-label", action.label);
        const label = document.createElement("span");
        label.className = "rts-selection-action-label";
        label.textContent = action.label;
        button.appendChild(label);
        if (action.cost !== null) {
          const cost = document.createElement("span");
          cost.className = "rts-selection-action-cost";
          cost.textContent = action.cost;
          button.appendChild(cost);
        }
        button.addEventListener("click", () => this.onAction(action.id));
        this.actionButtons.set(action.id, button);
        parent.appendChild(button);
      }
    }
    this.actionRow.hidden = panelActions.length === 0;
    this.actionTray.hidden = trayActions.length === 0;
    for (const { action } of rendered) {
      const button = this.actionButtons.get(action.id);
      if (!button) continue;
      // Action ids are stable commands (for example every building upgrade is
      // `upgrade`), but their player-facing label and cost belong to the current
      // selection. Refreshing only disabled/title left an old Depot label on an
      // newly selected House whenever the action set itself did not change.
      button.setAttribute("aria-label", action.label);
      button.dataset.rtsActive = action.active ? "true" : "false";
      const label = button.querySelector<HTMLElement>(".rts-selection-action-label");
      if (label) label.textContent = action.label;
      const existingCost = button.querySelector<HTMLElement>(".rts-selection-action-cost");
      if (action.cost === null) {
        existingCost?.remove();
      } else if (existingCost) {
        existingCost.textContent = action.cost;
      } else {
        const cost = document.createElement("span");
        cost.className = "rts-selection-action-cost";
        cost.textContent = action.cost;
        button.appendChild(cost);
      }
      button.disabled = !action.enabled;
      // A refused action always names its rule. A legal one carries no excuse,
      // but may still have something to say about its price — which is the only
      // place the player can read it before committing to the click.
      button.title = action.reason ?? action.hint ?? "";
    }
    // After the rebuild branch above, which drops every class the buttons carried.
    this.syncMissionHighlight();
  }
}
