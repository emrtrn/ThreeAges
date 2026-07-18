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
import { formatMatchDuration } from "../match/rtsMatchClock";
import type { RegionalVictoryProgress } from "../objectives/regionalVictorySystem";
import type { StrategicPointStatus } from "../objectives/strategicPointSystem";
import type { UnitOwner } from "../units/unit";

const OWNER_LABEL: Readonly<Record<UnitOwner, string>> = {
  player: "Sen",
  enemy: "Düşman",
};

const HOLDER_LABEL: Readonly<Record<UnitOwner | "neutral", string>> = {
  player: "senin",
  enemy: "düşmanda",
  neutral: "boş",
};

export interface RtsObjectiveTrackerState {
  readonly points: readonly StrategicPointStatus[];
  readonly progress: readonly RegionalVictoryProgress[];
}

export class RtsObjectiveTracker {
  private readonly root = document.createElement("section");
  private readonly pointList = document.createElement("ul");
  private readonly bars = document.createElement("div");

  constructor() {
    this.root.className = "rts-objective-tracker";
    this.root.dataset.rtsObjectives = "";
    // Read-only, like the notification feed: the panel overlays the field and
    // must never swallow a click meant for the map.
    this.root.setAttribute("role", "status");
    this.root.setAttribute("aria-live", "polite");
    const heading = document.createElement("strong");
    heading.textContent = "Bölgesel Zafer";
    this.pointList.className = "rts-objective-points";
    this.bars.className = "rts-objective-bars";
    this.root.append(heading, this.pointList, this.bars);
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

  dispose(): void {
    this.root.remove();
  }

  private renderPoints(points: readonly StrategicPointStatus[]): void {
    this.pointList.replaceChildren(...points.map((status) => {
      const row = document.createElement("li");
      row.className = "rts-objective-point";
      row.dataset.holder = status.holder;
      row.dataset.contested = String(status.contested);
      const name = document.createElement("span");
      name.textContent = status.point.name;
      const state = document.createElement("span");
      // "çekişmeli" replaces the holder rather than sitting beside it: while a
      // point is contested nobody is banking time on it, so reporting it as
      // still held would misdescribe what the counter is doing.
      state.textContent = status.contested ? "çekişmeli" : HOLDER_LABEL[status.holder];
      row.append(name, state);
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
      label.textContent = `${OWNER_LABEL[entry.owner]} ${entry.secured}/${entry.total}`;

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
