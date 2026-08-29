/**
 * HUD army strip — the visible half of {@link rtsArmyRosterView}.
 *
 * A row of one button per unit type the player owns: icon, count, and an idle
 * badge when some of them are free. Clicking one selects every unit of that
 * type. It sits beside the population readout because that is literally what it
 * breaks down — `Nüfus: 18/25` says how full the kingdom is, the strip says
 * what filled it.
 *
 * Presentation only, exactly like {@link RtsHudBar}: every value is pushed in,
 * and the one rule this owns is *when to touch the DOM*. Two levels of that,
 * because the two changes have very different costs:
 *
 * - The **roster signature** gates everything. It is pushed every frame and
 *   changes only when a rendered number does.
 * - The **layout** (which types exist, in order) gates rebuilding the buttons.
 *   Counts move constantly as units train and die; the set of types the player
 *   owns changes a handful of times a match, and only that needs new DOM.
 *
 * Types with no live units have no row (see `describeArmyRoster`), so the strip
 * never shows a zero — an empty army is an empty strip.
 */
import { t } from "../../localization/LocalizationService";
import { markStaticAria, refreshStaticText } from "./rtsStaticText";
import type { ArmyRosterEntry, ArmyRosterView } from "./rtsArmyRosterView";
import { armyRosterSignature } from "./rtsArmyRosterView";
import { attachIconFallback } from "./rtsUiIcons";
import { publicUrl } from "@engine/assets/publicUrl";

interface RosterChip {
  readonly button: HTMLButtonElement;
  readonly icon: HTMLImageElement;
  readonly count: HTMLElement;
  readonly idle: HTMLElement;
}

export class RtsArmyRosterStrip {
  private readonly root = document.createElement("div");
  private readonly chips = new Map<string, RosterChip>();
  /**
   * Sentinel, not "": an empty roster's own signature is "", so starting there
   * would make the first push a no-op — the same trap `RtsSelectionPanel`
   * documents for its own signature.
   */
  private signature = "\u0000";
  private layout = "\u0000";

  /**
   * @param onSelectType Handed the clicked type and whether the player asked to
   *   *add* to the selection (Shift). The strip does not know what selecting
   *   means; `RtsApp` owns the verb, as it does for the panel's action ids.
   */
  constructor(private readonly onSelectType: (typeId: string, additive: boolean) => void) {
    // `ui-interactive`: unlike the readouts around it, these are real buttons
    // and must take the pointer rather than pass it through to the map.
    this.root.className = "rts-hud-roster ui-interactive";
    // Faz 2's sweep looked for key-shaped literals, so a bare Turkish word with
    // no `t(...)` around it was invisible to it — the same miss as the
    // selection panel's "Formasyon". Marked rather than resolved once, so the
    // §27 picker moves it too.
    markStaticAria(this.root, "hud.roster.aria");
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  /**
   * §13: re-resolve the strip's own label. The chips need nothing — their text
   * is rewritten from the roster the next time a count moves — but the strip's
   * `aria-label` is written once and has no push to ride back in on.
   */
  retranslate(): void {
    refreshStaticText(this.root);
  }

  setRoster(view: ArmyRosterView): void {
    const signature = armyRosterSignature(view);
    if (signature === this.signature) return;
    this.signature = signature;

    const layout = view.entries.map((entry) => entry.typeId).join("|");
    if (layout !== this.layout) {
      this.rebuild(view.entries);
      this.layout = layout;
    }
    for (const entry of view.entries) this.update(entry);
  }

  dispose(): void {
    this.root.remove();
  }

  /** Rebuild the button row. Only ever called when the *set* of types changed. */
  private rebuild(entries: readonly ArmyRosterEntry[]): void {
    this.root.replaceChildren();
    this.chips.clear();
    for (const entry of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rts-hud-roster-chip";
      button.dataset.rtsUnitType = entry.typeId;
      button.addEventListener("click", (event) => this.onSelectType(entry.typeId, event.shiftKey));

      const icon = document.createElement("img");
      icon.className = "rts-hud-roster-icon";
      icon.alt = "";
      icon.setAttribute("aria-hidden", "true");
      if (entry.icon) {
        icon.src = publicUrl(entry.icon);
        attachIconFallback(icon);
      } else {
        // No artwork yet: the count is the whole button rather than a broken
        // image beside it.
        icon.hidden = true;
      }

      const count = document.createElement("span");
      count.className = "rts-hud-roster-count";
      const idle = document.createElement("span");
      idle.className = "rts-hud-roster-idle";
      idle.hidden = true;

      button.append(icon, count, idle);
      this.root.appendChild(button);
      this.chips.set(entry.typeId, { button, icon, count, idle });
    }
  }

  private update(entry: ArmyRosterEntry): void {
    const chip = this.chips.get(entry.typeId);
    if (!chip) return;

    const count = String(entry.count);
    if (chip.count.textContent !== count) chip.count.textContent = count;

    // The idle badge is the same "you owe the game a decision" signal the idle
    // worker readout carries, scoped to one type.
    if (entry.idle > 0) {
      const idle = String(entry.idle);
      if (chip.idle.textContent !== idle) chip.idle.textContent = idle;
      chip.idle.hidden = false;
    } else if (!chip.idle.hidden) {
      chip.idle.hidden = true;
    }

    // Some of this type is in the live selection — the chip reads as the
    // subgroup it is, not just as a counter.
    chip.button.dataset.selected = String(entry.selected > 0);

    // The count alone is not a name: a screen reader needs the unit it counts
    // and the fact that this is a button that will select them.
    const label = entry.idle > 0
      ? t("hud.roster.chip.aria_idle", { count: entry.count, unit: entry.label, idle: entry.idle })
      : t("hud.roster.chip.aria", { count: entry.count, unit: entry.label });
    if (chip.button.getAttribute("aria-label") !== label) {
      chip.button.setAttribute("aria-label", label);
      chip.button.title = t("hud.roster.chip.tooltip", { label });
    }
  }
}
