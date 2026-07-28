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
  type SelectionPanelContent,
} from "./rtsSelectionView";

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
  private readonly body = document.createElement("div");
  private readonly lines: HTMLParagraphElement[] = [];
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

  constructor(private readonly onAction: (id: string) => void) {
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
    const details = document.createElement("div");
    details.className = "rts-selection-details";
    details.append(this.body);
    this.root.append(this.portrait, this.header, details, this.actionRow, this.progress, this.hints);
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
