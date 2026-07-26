/**
 * The modal that covers the field whenever the match is not running —
 * Vertical Slice Plan v0.2 §51 "Maç akışı" (Faz 9).
 *
 * One component for the start screen, the pause menu and the result screen,
 * because they are one thing: the same card, in the same place, blocking the
 * same field, differing only in what it says and which actions it offers. Three
 * components would have meant three copies of the modal's CSS and three chances
 * for two of them to be on screen at once.
 *
 * Presentation only. It decides nothing about the match; `RtsApp` owns the
 * transitions and tells this what to show.
 */
import { DEFAULT_RTS_CAMERA_SETTINGS, type RtsCameraSettings } from "../camera/rtsCameraConfig";
import { formatMatchDuration } from "./rtsMatchClock";
import type { RtsMatchEndReason, RtsMatchOutcome } from "./rtsMatchState";
import { DEFAULT_VICTORY_CONDITION, type VictoryConditionChoice } from "./victoryConditionChoice";

export interface RtsMatchOverlayHandlers {
  readonly onStart: () => void;
  readonly onResume: () => void;
  readonly onRestart: () => void;
  readonly onSurrender: () => void;
  /** §51 "Minimal ayarlar": camera feel, changed live behind the pause card. */
  readonly onCameraSettings: (settings: RtsCameraSettings) => void;
  /**
   * §78.1: the victory condition picked while the match is being set up. Absent
   * when the host cannot act on a choice, and then the picker is not built at
   * all — a control wired to nothing is worse than no control (see the settings
   * note below).
   */
  readonly onVictoryCondition?: (choice: VictoryConditionChoice) => void;
}

interface VictoryConditionRow {
  readonly choice: VictoryConditionChoice;
  readonly label: string;
  /** Shown only while that row is selected; §78.1 wants the rule spelled out. */
  readonly hint: string;
}

/**
 * §78.1 task 4. The regional hint is not flavour: a strategic point is taken by
 * the control area of a road-connected outpost, never by parking units on it.
 * `strategicPointSystem.ts` has always enforced that and nothing ever said it,
 * and an undiscoverable rule produces exactly the surprise defeat §58's second
 * acceptance criterion forbids.
 */
const VICTORY_CONDITION_ROWS: readonly VictoryConditionRow[] = [
  {
    choice: "military",
    label: "Askerî",
    hint: "Maç yalnızca düşman merkezi yıkıldığında biter.",
  },
  {
    choice: "military_regional",
    label: "Askerî + Bölgesel",
    hint: "Askerî zafer geçerliliğini korur. Ek olarak iki stratejik geçidi 180 saniye boyunca birlikte elinde tutan taraf kazanır. Geçitler oraya birlik göndererek değil, yola bağlı bir karakolun kontrol alanıyla alınır.",
  },
];

/**
 * §51 lists four settings; two of them are built here and two are deliberately
 * absent.
 *
 * "Ana ses seviyesi" and "Ekran sallantısı" have nothing to control: the RTS
 * plays no audio and has no screen shake — both arrive with Faz 12's "VFX ve
 * Ses" (§67). A slider wired to a system that does not exist is a control the
 * player drags while nothing happens, which is worse than an absent one and is
 * exactly the "yarım sistem" §13 forbids. They land when their systems do.
 */
interface SettingRow {
  readonly key: keyof RtsCameraSettings;
  readonly label: string;
  readonly hint: string;
}

const CAMERA_SETTING_ROWS: readonly SettingRow[] = [
  { key: "panSpeed", label: "Kamera hızı", hint: "WASD ile kaydırma hızı." },
  { key: "smoothing", label: "Kamera yumuşatma", hint: "Zoom'un hedefe yumuşama miktarı." },
];

interface ResultText {
  readonly title: string;
  readonly detail: string;
}

/**
 * §51 wants a victory *and* a defeat screen, and defeat has two causes. A
 * resigned match whose centre is still standing must not be told it was razed.
 */
const RESULT_TEXT: Readonly<Record<Exclude<RtsMatchOutcome, "active">, Readonly<Record<RtsMatchEndReason, ResultText>>>> = {
  victory: {
    "center-destroyed": { title: "Zafer", detail: "Düşman merkezi yıkıldı." },
    // Reachable only if a future rule lets the AI resign; saying "the enemy
    // centre fell" when it did not is the failure this branch exists to avoid.
    surrendered: { title: "Zafer", detail: "Düşman teslim oldu." },
    // §58: names the condition, because a match that ended with both centres
    // standing otherwise reads as an unexplained stop.
    "regional-control": { title: "Zafer", detail: "Stratejik geçitleri elinde tuttun." },
  },
  defeat: {
    "center-destroyed": { title: "Yenilgi", detail: "Merkeziniz yıkıldı." },
    surrendered: { title: "Yenilgi", detail: "Teslim oldunuz." },
    "regional-control": { title: "Yenilgi", detail: "Düşman stratejik geçitleri elinde tuttu." },
  },
};

/** Colours the card. A loss must not be announced in the victory gold. */
type OverlayTone = "neutral" | "victory" | "defeat";

export class RtsMatchOverlay {
  private readonly root = document.createElement("div");
  private readonly card = document.createElement("section");
  private readonly title = document.createElement("h1");
  private readonly detail = document.createElement("p");
  /** §53: match length, shown on the result card only. */
  private readonly duration = document.createElement("p");
  private readonly actions = document.createElement("div");
  /**
   * Surrender is one click from throwing the match away, and it sits next to
   * "Yeniden Başlat" in the same menu. The confirm is local to the overlay: it
   * is a property of the button, not of the match, and pushing it into the flow
   * would put a UI affordance into the simulation's state.
   */
  private surrenderArmed = false;
  private readonly settings = document.createElement("div");
  private cameraSettings: RtsCameraSettings = DEFAULT_RTS_CAMERA_SETTINGS;
  /** §78.1 match setup; empty and permanently hidden without a choice handler. */
  private readonly setup = document.createElement("div");
  private readonly setupHint = document.createElement("p");
  private victoryCondition: VictoryConditionChoice = DEFAULT_VICTORY_CONDITION;

  constructor(private readonly handlers: RtsMatchOverlayHandlers) {
    this.root.className = "rts-match-overlay ui-interactive";
    this.card.className = "rts-match-card";
    this.card.setAttribute("role", "status");
    this.card.setAttribute("aria-live", "polite");
    this.title.dataset.rtsResultTitle = "";
    this.detail.dataset.rtsResultDetail = "";
    this.duration.dataset.rtsResultDuration = "";
    this.duration.className = "rts-match-duration";
    this.actions.className = "rts-match-actions";
    this.buildSetup();
    this.buildSettings();
    // Setup sits above the actions: it is read *before* "Maçı Başlat", unlike the
    // pause card's settings, which are a detour taken after the card is already up.
    this.card.append(this.title, this.detail, this.duration, this.setup, this.actions, this.settings);
    this.root.appendChild(this.card);
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
  }

  /**
   * §78.1: the victory condition, on the existing start card rather than a menu
   * of its own — §50 chose one modal on purpose, and a second surface would
   * reintroduce the "two cards on screen at once" it was avoiding.
   *
   * Radios, not buttons: this is one exclusive answer to one question, and the
   * native control is what a keyboard and a screen reader already understand.
   */
  private buildSetup(): void {
    this.setup.className = "rts-match-setup";
    this.setup.hidden = true;
    if (!this.handlers.onVictoryCondition) return;
    const group = document.createElement("fieldset");
    group.className = "rts-match-setup-group";
    const legend = document.createElement("legend");
    legend.textContent = "Zafer koşulu";
    group.appendChild(legend);
    for (const row of VICTORY_CONDITION_ROWS) {
      const wrapper = document.createElement("label");
      wrapper.className = "rts-match-setup-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "rts-victory-condition";
      input.value = row.choice;
      input.dataset.rtsVictoryCondition = row.choice;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        this.setVictoryCondition(row.choice);
        this.handlers.onVictoryCondition?.(row.choice);
      });
      const label = document.createElement("span");
      label.textContent = row.label;
      wrapper.append(input, label);
      group.appendChild(wrapper);
    }
    // One hint line that swaps, rather than a paragraph under each row: only the
    // selected rule is in force, and two explanations side by side would ask the
    // player to work out which one they are currently reading.
    this.setupHint.className = "rts-match-setup-hint";
    this.setupHint.dataset.rtsVictoryHint = "";
    this.setup.append(group, this.setupHint);
  }

  /** Reflect a choice in the radios and the hint. Fires no handler. */
  private setVictoryCondition(choice: VictoryConditionChoice): void {
    this.victoryCondition = choice;
    for (const input of this.setup.querySelectorAll<HTMLInputElement>("input[type='radio']")) {
      input.checked = input.value === choice;
    }
    this.setupHint.textContent =
      VICTORY_CONDITION_ROWS.find((row) => row.choice === choice)?.hint ?? "";
  }

  /**
   * Settings live in the pause menu rather than on a panel of their own: they are
   * a rare, deliberate visit, and the card is already the one surface a player
   * opens to *stop and think*. Built once and shown or hidden — a result screen
   * is not the place to be adjusting the camera.
   */
  private buildSettings(): void {
    this.settings.className = "rts-match-settings";
    const heading = document.createElement("strong");
    heading.textContent = "Ayarlar";
    this.settings.appendChild(heading);
    for (const row of CAMERA_SETTING_ROWS) {
      const wrapper = document.createElement("label");
      wrapper.className = "rts-match-setting";
      wrapper.title = row.hint;
      const label = document.createElement("span");
      label.textContent = row.label;
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "1";
      slider.step = "0.05";
      slider.value = String(this.cameraSettings[row.key]);
      slider.dataset.rtsSetting = row.key;
      // `input`, not `change`: the camera is behind the card and the player is
      // judging the change by watching it, so it has to move as they drag.
      slider.addEventListener("input", () => {
        this.cameraSettings = { ...this.cameraSettings, [row.key]: Number(slider.value) };
        this.handlers.onCameraSettings(this.cameraSettings);
      });
      wrapper.append(label, slider);
      this.settings.appendChild(wrapper);
    }
  }

  /**
   * §51: a simple start screen, deliberately not a main menu.
   *
   * `victoryCondition` is the state the match would boot with — the resolved
   * flag, not a remembered preference — so a dev URL or a §72 preset that
   * already enables the regional route opens with that row selected instead of
   * quietly contradicting the card.
   */
  showStart(victoryCondition: VictoryConditionChoice = DEFAULT_VICTORY_CONDITION): void {
    if (this.handlers.onVictoryCondition) this.setVictoryCondition(victoryCondition);
    this.render(
      "Üç Çağ: Sınır Krallıkları",
      "Ekonomini kur, yolunu bağla ve düşman merkezini yık.",
      [{ label: "Maçı Başlat", action: this.handlers.onStart, primary: true, key: "start" }],
      "neutral",
      false,
      null,
      // §78.1: the picker belongs to match setup and nowhere else. The pause and
      // result cards must not offer it — a condition that could change mid-match
      // is a rule the player cannot plan against.
      true,
    );
  }

  /** What the card currently has selected; `RtsApp` reads it on start. */
  get selectedVictoryCondition(): VictoryConditionChoice {
    return this.victoryCondition;
  }

  showPause(): void {
    this.render("Duraklatıldı", "Maç durduruldu.", [
      { label: "Devam Et", action: this.handlers.onResume, primary: true, key: "resume" },
      { label: "Yeniden Başlat", action: this.handlers.onRestart, key: "restart" },
      this.surrenderArmed
        ? { label: "Teslim olmayı onayla", action: this.handlers.onSurrender, key: "surrender", danger: true }
        : { label: "Teslim Ol", action: this.armSurrender, key: "surrender" },
    ], "neutral", true);
  }

  /**
   * Present a decided match. `active` is not a result and never reaches here.
   *
   * `durationSeconds` is simulation time, not wall time (§53) — the number Kapı
   * B's "12–25 dakika" box is read against, reported at the one moment the match
   * has a final length.
   */
  showResult(
    outcome: Exclude<RtsMatchOutcome, "active">,
    reason: RtsMatchEndReason,
    durationSeconds: number,
  ): void {
    const text = RESULT_TEXT[outcome][reason];
    this.render(
      text.title,
      text.detail,
      [{ label: "Yeniden Başlat", action: this.handlers.onRestart, primary: true, key: "restart" }],
      outcome,
      false,
      durationSeconds,
    );
  }

  hide(): void {
    this.surrenderArmed = false;
    this.root.classList.remove("is-visible");
  }

  dispose(): void {
    this.root.remove();
  }

  private readonly armSurrender = (): void => {
    this.surrenderArmed = true;
    this.showPause();
  };

  private render(
    title: string,
    detail: string,
    buttons: readonly OverlayButton[],
    tone: OverlayTone,
    showSettings = false,
    durationSeconds: number | null = null,
    showSetup = false,
  ): void {
    this.settings.hidden = !showSettings;
    // §78.1 / §60: with no choice handler the block was never populated, so it
    // stays hidden and the start card looks exactly as it did before.
    this.setup.hidden = !showSetup || !this.handlers.onVictoryCondition;
    this.card.dataset.tone = tone;
    this.title.textContent = title;
    this.detail.textContent = detail;
    // Its own line rather than a clause tacked onto the detail: the detail says
    // *how* the match ended, this says how long it took, and a reader comparing
    // fifteen matches (§53.3) should find the number in the same place each time.
    this.duration.hidden = durationSeconds === null;
    this.duration.textContent = durationSeconds === null ? "" : `Süre: ${formatMatchDuration(durationSeconds)}`;
    this.actions.replaceChildren(...buttons.map((button) => {
      const element = document.createElement("button");
      element.type = "button";
      element.textContent = button.label;
      element.dataset.rtsMatchAction = button.key;
      // The default action carries the weight; the rest are quieter, so "Teslim
      // Ol" never looks like the thing the card is asking you to do.
      element.dataset.primary = String(button.primary === true);
      if (button.danger) element.dataset.danger = "true";
      // Kept for the Faz 1 restart smoke and anything else that found the
      // button by its original hook.
      if (button.key === "restart") element.dataset.rtsRestart = "";
      element.addEventListener("click", button.action);
      return element;
    }));
    this.root.classList.add("is-visible");
    this.actions.querySelector<HTMLButtonElement>("button")?.focus();
  }
}

interface OverlayButton {
  readonly label: string;
  readonly action: () => void;
  /** Stable hook for tests and for the restart alias. */
  readonly key: string;
  readonly primary?: boolean;
  readonly danger?: boolean;
}
