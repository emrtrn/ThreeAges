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
import { describeSelection, type RtsSelectionView, type SelectionPanelContent } from "./rtsSelectionView";

export class RtsSelectionPanel {
  private readonly root = document.createElement("section");
  private readonly title = document.createElement("strong");
  private readonly summary = document.createElement("p");
  private readonly body = document.createElement("div");
  private readonly lines: HTMLParagraphElement[] = [];
  private readonly progress = document.createElement("div");
  private readonly progressLabel = document.createElement("span");
  private readonly progressTime = document.createElement("span");
  private readonly progressFill = document.createElement("div");
  private readonly actionRow = document.createElement("div");
  private readonly actionButtons = new Map<string, HTMLButtonElement>();
  private readonly hints = document.createElement("p");
  /**
   * Last rendered content. The sentinel matters: an empty selection's own
   * signature is "", so starting there would make the constructor's first
   * `setSelection` a no-op and leave the panel visible and blank at boot.
   */
  private signature = " ";

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
    this.summary.className = "rts-selection-summary";
    this.body.className = "rts-selection-body ui-interactive";
    this.actionRow.className = "rts-selection-actions ui-interactive";
    this.hints.className = "rts-selection-hints";
    // A labelled fill bar for a running timed job (a level-up). Assembled once
    // and shown/hidden per frame; only the label, seconds and fill width move.
    this.progress.className = "rts-selection-progress";
    const head = document.createElement("div");
    head.className = "rts-selection-progress-head";
    this.progressLabel.className = "rts-selection-progress-label";
    this.progressTime.className = "rts-selection-progress-time";
    head.append(this.progressLabel, this.progressTime);
    const track = document.createElement("div");
    track.className = "rts-selection-progress-track";
    this.progressFill.className = "rts-selection-progress-fill";
    track.appendChild(this.progressFill);
    this.progress.append(head, track);
    this.root.append(this.title, this.summary, this.body, this.progress, this.actionRow, this.hints);
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
    this.setSelection({ kind: "none" });
  }

  setSelection(view: RtsSelectionView): void {
    const content = describeSelection(view);
    // Selection is re-pushed every frame; only touch the DOM when it changed.
    const signature = content === null ? "" : JSON.stringify(content);
    if (signature === this.signature) return;
    this.signature = signature;
    if (content === null) {
      this.root.hidden = true;
      return;
    }
    this.root.hidden = false;
    this.render(content);
  }

  dispose(): void {
    this.root.remove();
  }

  private render(content: SelectionPanelContent): void {
    this.title.textContent = content.title;
    this.summary.textContent = content.summary;
    this.hints.textContent = content.hint;
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
    this.renderActions(content);
  }

  /** Show the fill bar only while a timed job is running; hide it otherwise. */
  private renderProgress(content: SelectionPanelContent): void {
    const progress = content.progress ?? null;
    this.progress.hidden = progress === null;
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
  private renderActions(content: SelectionPanelContent): void {
    const wanted = content.actions.map((action) => action.id).join("|");
    if (this.actionRow.dataset.rtsActions !== wanted) {
      this.actionRow.dataset.rtsActions = wanted;
      this.actionRow.replaceChildren();
      this.actionButtons.clear();
      for (const action of content.actions) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "rts-selection-action";
        button.dataset.rtsAction = action.id;
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
        this.actionRow.appendChild(button);
      }
    }
    this.actionRow.hidden = content.actions.length === 0;
    for (const action of content.actions) {
      const button = this.actionButtons.get(action.id);
      if (!button) continue;
      // Action ids are stable commands (for example every building upgrade is
      // `upgrade`), but their player-facing label and cost belong to the current
      // selection. Refreshing only disabled/title left an old Depot label on an
      // newly selected House whenever the action set itself did not change.
      button.setAttribute("aria-label", action.label);
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
      // A legal action carries no excuse; a refused one always names its rule.
      button.title = action.reason ?? "";
    }
  }
}
