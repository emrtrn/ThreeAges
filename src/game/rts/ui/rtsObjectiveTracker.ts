/**
 * The §58 regional victory readout — Vertical Slice Plan v0.2 (Faz 11).
 *
 * §58's last acceptance box is "Sayaç sürpriz yenilgi yaratmıyor", and a counter
 * that can end the match is a surprise unless it is *always* on screen while it
 * runs. So this is a persistent panel, not a notification: notifications are for
 * things that happened, and the thing a player needs here is the thing that is
 * still happening.
 *
 * Both kingdoms' counters are shown, side by side. Showing only the player's
 * would leave the losing half of the condition — the half that ends the match
 * against you — invisible until it was over, which is the exact failure the box
 * names.
 *
 * §60 removed the minimap and listed "stratejik nokta isimleri" among its
 * replacements, so each point is named here rather than only marked in world
 * space: this panel is the map legend the minimap would have been.
 *
 * Presentation only. It decides nothing; `RtsApp` hands it the state.
 */
import { t } from "../../localization/LocalizationService";
import { markStaticAria, markStaticText, refreshStaticText } from "./rtsStaticText";
import { formatMatchDuration } from "../match/rtsMatchClock";
import type { RegionalVictoryProgress } from "../objectives/regionalVictorySystem";
import type { StrategicPointStatus } from "../objectives/strategicPointSystem";
import type { UnitOwner } from "../units/unit";

/** Key suffixes, resolved at render time so a language switch reaches them. */
const OWNER_KEY: Readonly<Record<UnitOwner, string>> = {
  player: "objective.owner.player",
  enemy: "objective.owner.enemy",
};

const HOLDER_KEY: Readonly<Record<UnitOwner | "neutral", string>> = {
  player: "objective.holder.player",
  enemy: "objective.holder.enemy",
  neutral: "objective.holder.neutral",
};

/**
 * §78.1's rule, said where the player is when they need it.
 *
 * The start card explains the condition once and then closes, so mid-match the
 * only word left for an unheld point was "boş" — accurate, and silent about the
 * one thing a player has to know: a point is taken by the control area of a
 * road-connected outpost, never by standing an army on it. Sending units and
 * watching nothing happen is the discoverability failure §58's "sürpriz yenilgi
 * yaratmıyor" box and §78.1's rationale both point at.
 *
 * Only on a neutral point. A point held by the enemy already gives honest
 * feedback for an army sent at it — it goes "çekişmeli" and stalls their counter,
 * which is a real and useful move — so a hint there would argue against a correct
 * action. And a point already held needs no instructions.
 */
const UNHELD_POINT_HINT_KEY = "objective.point.unheld_hint";

export interface RtsObjectiveTrackerState {
  readonly points: readonly StrategicPointStatus[];
  readonly progress: readonly RegionalVictoryProgress[];
}

export class RtsObjectiveTracker {
  private readonly root = document.createElement("section");
  private readonly toggle = document.createElement("button");
  private readonly content = document.createElement("div");
  private readonly pointList = document.createElement("ul");
  private readonly bars = document.createElement("div");
  private collapsed = false;

  constructor() {
    this.root.className = "rts-objective-tracker";
    this.root.dataset.rtsObjectives = "";
    markStaticAria(this.root, "objective.panel.aria");
    this.toggle.type = "button";
    this.toggle.className = "rts-objective-toggle ui-interactive";
    this.toggle.setAttribute("aria-expanded", "true");
    this.toggle.setAttribute("aria-controls", "rts-objective-content");
    // `textContent` per element rather than one `innerHTML`: translated text is
    // data, and a language that happens to contain "<" must not become markup.
    const toggleLabel = document.createElement("span");
    markStaticText(toggleLabel, "objective.panel.title");
    const toggleIcon = document.createElement("span");
    toggleIcon.setAttribute("aria-hidden", "true");
    toggleIcon.textContent = "⌃";
    this.toggle.append(toggleLabel, toggleIcon);
    this.toggle.addEventListener("click", () => {
      this.collapsed = !this.collapsed;
      this.syncCollapsedState();
    });
    const heading = document.createElement("strong");
    markStaticText(heading, "objective.regional_victory.title");
    this.content.id = "rts-objective-content";
    this.content.className = "rts-objective-content";
    this.pointList.className = "rts-objective-points";
    this.bars.className = "rts-objective-bars";
    this.content.append(heading, this.pointList, this.bars);
    this.root.append(this.toggle, this.content);
    this.root.hidden = true;
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
  }

  /**
   * Hidden until the flag is on *and* the map authors points — an empty tracker
   * is a frame around nothing, and §60 was explicit that a disabled feature must
   * not leave reserved empty space on screen.
   */
  setState(state: RtsObjectiveTrackerState | null): void {
    if (!state || state.points.length === 0) {
      this.root.hidden = true;
      return;
    }
    this.root.hidden = false;
    this.renderPoints(state.points);
    this.renderBars(state.progress);
  }

  /**
   * Re-resolve the text written once — Plan §13.
   *
   * The bars and the point rows are rebuilt from the snapshot the tracker is
   * pushed, so they follow the language on their own; the panel title and the
   * regional heading are the two that do not.
   */
  retranslate(): void {
    refreshStaticText(this.root);
  }

  dispose(): void {
    this.root.remove();
  }

  private syncCollapsedState(): void {
    this.root.dataset.collapsed = String(this.collapsed);
    this.content.hidden = this.collapsed;
    this.toggle.setAttribute("aria-expanded", String(!this.collapsed));
    const icon = this.toggle.lastElementChild;
    if (icon) icon.textContent = this.collapsed ? "⌄" : "⌃";
  }

  private renderPoints(points: readonly StrategicPointStatus[]): void {
    this.pointList.replaceChildren(...points.map((status) => {
      const row = document.createElement("li");
      row.className = "rts-objective-point";
      row.dataset.holder = status.holder;
      row.dataset.contested = String(status.contested);
      const name = document.createElement("span");
      name.textContent = t(status.point.nameKey);
      const state = document.createElement("span");
      // "çekişmeli" replaces the holder rather than sitting beside it: while a
      // point is contested nobody is banking time on it, so reporting it as
      // still held would misdescribe what the counter is doing.
      state.textContent = t(status.contested ? "objective.holder.contested" : HOLDER_KEY[status.holder]);
      row.append(name, state);
      // Its own line under the pair rather than a longer status word: the
      // name/holder columns are what a player scans every few seconds, and the
      // hint is read once and then stops being news. It disappears the moment the
      // point has a holder, so a taken objective carries no leftover instruction.
      if (status.holder === "neutral") {
        const hint = document.createElement("span");
        hint.className = "rts-objective-point-hint";
        hint.dataset.rtsObjectiveHint = "";
        hint.textContent = t(UNHELD_POINT_HINT_KEY);
        row.appendChild(hint);
      }
      return row;
    }));
  }

  private renderBars(progress: readonly RegionalVictoryProgress[]): void {
    this.bars.replaceChildren(...progress.map((entry) => {
      const row = document.createElement("div");
      row.className = "rts-objective-bar";
      row.dataset.owner = entry.owner;
      row.dataset.phase = entry.phase;

      const label = document.createElement("span");
      label.className = "rts-objective-bar-label";
      label.textContent = t("objective.progress.label", {
        owner: t(OWNER_KEY[entry.owner]),
        secured: entry.secured,
        total: entry.total,
      });

      const track = document.createElement("div");
      track.className = "rts-objective-bar-track";
      const fill = document.createElement("div");
      fill.className = "rts-objective-bar-fill";
      fill.style.width = `${Math.round(entry.ratio * 100)}%`;
      track.appendChild(fill);

      // The remaining time, not the elapsed time: the question a player asks of
      // this panel is "how long have I got", and making them subtract is how a
      // counter becomes a surprise.
      const remaining = document.createElement("span");
      remaining.className = "rts-objective-bar-remaining";
      remaining.textContent = formatMatchDuration(entry.remainingSeconds);

      row.append(label, track, remaining);
      return row;
    }));
  }
}
