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
 * `RtsApp` hands the result down. Like the objective tracker it takes no pointer
 * input, so it can never swallow a click meant for the map.
 */
import type { MissionDirectorState } from "../tutorial/missionDirector";

export class RtsMissionPanel {
  private readonly root = document.createElement("section");
  private readonly heading = document.createElement("p");
  private readonly title = document.createElement("strong");
  private readonly why = document.createElement("p");
  private signature = "";

  constructor() {
    this.root.className = "rts-mission-panel";
    this.root.dataset.rtsMission = "";
    this.root.setAttribute("aria-label", "Görev");
    // A step change is an instruction the player has to notice without staring
    // at the panel, so it is announced. `polite` rather than `assertive`: it must
    // wait its turn behind anything urgent the match is saying.
    this.root.setAttribute("aria-live", "polite");
    this.heading.className = "rts-mission-heading";
    this.title.className = "rts-mission-title";
    this.title.dataset.rtsMissionTitle = "";
    this.why.className = "rts-mission-why";
    this.root.append(this.heading, this.title, this.why);
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
    this.heading.textContent = `Görev ${state.index + 1}/${state.total}`;
    this.title.textContent = state.step.title;
    this.why.textContent = state.step.why;
  }

  dispose(): void {
    this.root.remove();
  }
}
