/**
 * Active mission card — Hikâye / Öğretici Tur Modu, Faz 1.
 *
 * Sits directly above the build palette rather than in a free corner, and that
 * placement is the design: for the whole of Faz 1 the answer to the card is a
 * button in the palette below it ("bir Tarla kur", "bir Depo kur", "yol çek").
 * A card in the opposite corner would make the player carry the instruction
 * across the screen every time; here the sentence and the button it names are
 * one glance apart.
 *
 * Presentation only. It decides nothing — `MissionDirector` owns the chain and
 * `RtsApp` hands the result down. Its only pointer input is the disclosure
 * button; it never changes mission or simulation state.
 */
import type { MissionDirectorState } from "../tutorial/missionDirector";

export class RtsMissionPanel {
  private readonly root = document.createElement("section");
  private readonly toggle = document.createElement("button");
  private readonly toggleLabel = document.createElement("span");
  private readonly toggleIcon = document.createElement("span");
  private readonly content = document.createElement("div");
  private readonly title = document.createElement("strong");
  private readonly why = document.createElement("p");
  private readonly guide = document.createElement("p");
  private readonly show = document.createElement("button");
  private signature = "";
  /**
   * Open by default (Sürüm 2). While `why` was a three-clause paragraph, hiding
   * it behind a disclosure was the right trade: the card sat above the palette
   * and would have pushed the buttons off the useful part of the screen. The
   * §12.2 rewrite caps `why` at one short sentence, so the explanation now costs
   * a line — and a line the player never opens teaches nothing at all.
   */
  private collapsed = false;

  /**
   * @param onShow move the camera to the step's marker. Optional: a host that
   *   passes nothing simply never shows the button, which is the right shape for
   *   a card that must survive being wired into a smaller runtime.
   */
  constructor(private readonly onShow?: () => void) {
    this.root.className = "rts-mission-panel";
    this.root.dataset.rtsMission = "";
    this.root.setAttribute("aria-label", "Görev");
    // A step change is an instruction the player has to notice without staring
    // at the panel, so it is announced. `polite` rather than `assertive`: it must
    // wait its turn behind anything urgent the match is saying.
    this.root.setAttribute("aria-live", "polite");
    this.toggle.type = "button";
    this.toggle.className = "rts-mission-heading ui-interactive";
    this.toggle.setAttribute("aria-controls", "rts-mission-content");
    this.toggleIcon.setAttribute("aria-hidden", "true");
    this.toggle.append(this.toggleLabel, this.toggleIcon);
    this.toggle.addEventListener("click", () => {
      this.collapsed = !this.collapsed;
      this.syncCollapsedState();
    });
    this.content.id = "rts-mission-content";
    this.content.className = "rts-mission-content";
    this.title.className = "rts-mission-title";
    this.title.dataset.rtsMissionTitle = "";
    this.why.className = "rts-mission-why";
    // The "0/1 odun bağlantısı" counter used to sit here, and it is gone: the
    // chain asks for one of a thing on nearly every step, so it opened as "0/1"
    // fourteen times and restated the title in the goal's own vocabulary. What
    // it measured is still on `MissionDirectorState.progress` for a caller that
    // has a use for it; the card simply is not one.
    //
    // The one instruction the pulsing button cannot give: a panel action does
    // not exist until its building is selected, so until then the pointer has
    // nothing on screen to sit on and the card has to say where to click.
    this.guide.className = "rts-mission-guide";
    this.guide.dataset.rtsMissionGuide = "";
    this.guide.hidden = true;
    // "Göster" earns its place only once there is somewhere to go: it is shown
    // exactly when the world marker exists, so it can never move the camera to
    // nothing. `ui-interactive` because, unlike the rest of the card, it takes
    // the click rather than letting it through to the map.
    this.show.type = "button";
    this.show.className = "rts-mission-show ui-interactive";
    this.show.dataset.rtsMissionShow = "";
    this.show.textContent = "Göster";
    this.show.hidden = true;
    this.show.addEventListener("click", () => this.onShow?.());
    this.content.append(this.why);
    this.root.append(this.toggle, this.title, this.guide, this.show, this.content);
    this.syncCollapsedState();
    this.root.hidden = true;
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
  }

  /**
   * Hidden whenever there is no active step — before the first evaluation and,
   * more importantly, from the moment the chain finishes. The mode ends by the
   * card disappearing and the match simply carrying on; there is no "tutorial
   * complete" screen to dismiss, because the tur *is* the match.
   */
  setState(state: MissionDirectorState | null): void {
    if (!state || !state.step) {
      this.root.hidden = true;
      this.signature = "";
      return;
    }
    this.root.hidden = false;
    // Rebuilt only on a real change: this is pushed every frame, and a card that
    // re-created its own DOM sixty times a second would restart the aria-live
    // announcement each time.
    const signature = `${state.index}/${state.total}:${state.step.id}`;
    if (signature === this.signature) return;
    this.signature = signature;
    this.toggleLabel.textContent = `Görev ${state.index + 1}/${state.total}`;
    this.title.textContent = state.step.title;
    this.why.textContent = state.step.why;
    this.syncCollapsedState();
  }

  /**
   * "Önce Merkez yapısını seç" — shown only while the step's button is behind a
   * selection the player has not made yet. Pushed every frame, so it is written
   * as a plain replace and guarded on change.
   */
  setGuidePrompt(text: string | null): void {
    if ((text ?? "") === this.guide.textContent) return;
    this.guide.textContent = text ?? "";
    this.guide.hidden = text === null;
  }

  /** Offer "Göster" only while the world actually carries a marker to go to. */
  setShowTargetAvailable(available: boolean): void {
    const hidden = !available || this.onShow === undefined;
    if (hidden === this.show.hidden) return;
    this.show.hidden = hidden;
  }

  dispose(): void {
    this.root.remove();
  }

  private syncCollapsedState(): void {
    this.root.dataset.collapsed = String(this.collapsed);
    this.content.hidden = this.collapsed;
    this.toggle.setAttribute("aria-expanded", String(!this.collapsed));
    this.toggle.setAttribute(
      "aria-label",
      `${this.collapsed ? "Görev ayrıntılarını aç" : "Görev ayrıntılarını kapat"}${this.title.textContent ? `: ${this.title.textContent}` : ""}`,
    );
    this.toggleIcon.textContent = this.collapsed ? "⌄" : "⌃";
  }
}
