/**
 * Subtitle overlay — a minimal DOM subtitle line shown at the bottom of the
 * `#ui-overlay` layer, driven by the {@link DialogueSubsystem}'s subtitle events.
 *
 * Deliberately tiny (one speaker chip + one text line): the dialogue subsystem
 * owns timing, so this only reflects show/hide. It stays click-through (no
 * `.ui-interactive`) so it never steals input from the 3D scene beneath it.
 */

export interface SubtitleView {
  lineId: string;
  text: string;
  speakerName?: string;
}

export class SubtitleOverlay {
  private readonly root: HTMLDivElement;
  private readonly speakerEl: HTMLSpanElement;
  private readonly textEl: HTMLSpanElement;
  /** The line whose subtitle is on screen; guards overlapping bark hide events. */
  private currentLineId: string | null = null;

  constructor(host: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "forge-subtitle";
    // Announce changes to assistive tech without stealing focus.
    this.root.setAttribute("aria-live", "polite");
    this.root.hidden = true;

    this.speakerEl = document.createElement("span");
    this.speakerEl.className = "forge-subtitle-speaker";
    this.speakerEl.hidden = true;

    this.textEl = document.createElement("span");
    this.textEl.className = "forge-subtitle-text";

    this.root.append(this.speakerEl, this.textEl);
    host.appendChild(this.root);
  }

  show(view: SubtitleView): void {
    this.currentLineId = view.lineId;
    if (view.speakerName) {
      this.speakerEl.textContent = view.speakerName;
      this.speakerEl.hidden = false;
    } else {
      this.speakerEl.textContent = "";
      this.speakerEl.hidden = true;
    }
    this.textEl.textContent = view.text;
    this.root.hidden = false;
  }

  /**
   * Hides the subtitle. When `lineId` is given, only clears if it matches the
   * line currently shown — so a stale end event from an overlapping bark can't
   * wipe a newer line.
   */
  hide(lineId?: string): void {
    if (lineId && this.currentLineId && lineId !== this.currentLineId) return;
    this.currentLineId = null;
    this.root.hidden = true;
    this.textEl.textContent = "";
    this.speakerEl.textContent = "";
    this.speakerEl.hidden = true;
  }

  dispose(): void {
    this.root.remove();
    this.currentLineId = null;
  }
}
