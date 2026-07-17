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
import type { RtsMatchEndReason, RtsMatchOutcome } from "./rtsMatchState";

export interface RtsMatchOverlayHandlers {
  readonly onStart: () => void;
  readonly onResume: () => void;
  readonly onRestart: () => void;
  readonly onSurrender: () => void;
  /** §51 "Minimal ayarlar": camera feel, changed live behind the pause card. */
  readonly onCameraSettings: (settings: RtsCameraSettings) => void;
}

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
  },
  defeat: {
    "center-destroyed": { title: "Yenilgi", detail: "Merkeziniz yıkıldı." },
    surrendered: { title: "Yenilgi", detail: "Teslim oldunuz." },
  },
};

/** Colours the card. A loss must not be announced in the victory gold. */
type OverlayTone = "neutral" | "victory" | "defeat";

export class RtsMatchOverlay {
  private readonly root = document.createElement("div");
  private readonly card = document.createElement("section");
  private readonly title = document.createElement("h1");
  private readonly detail = document.createElement("p");
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

  constructor(private readonly handlers: RtsMatchOverlayHandlers) {
    this.root.className = "rts-match-overlay ui-interactive";
    this.card.className = "rts-match-card";
    this.card.setAttribute("role", "status");
    this.card.setAttribute("aria-live", "polite");
    this.title.dataset.rtsResultTitle = "";
    this.detail.dataset.rtsResultDetail = "";
    this.actions.className = "rts-match-actions";
    this.buildSettings();
    this.card.append(this.title, this.detail, this.actions, this.settings);
    this.root.appendChild(this.card);
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
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

  /** §51: a simple start screen, deliberately not a main menu. */
  showStart(): void {
    this.render(
      "Üç Çağ: Sınır Krallıkları",
      "Ekonomini kur, yolunu bağla ve düşman merkezini yık.",
      [{ label: "Maçı Başlat", action: this.handlers.onStart, primary: true, key: "start" }],
      "neutral",
    );
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

  /** Present a decided match. `active` is not a result and never reaches here. */
  showResult(outcome: Exclude<RtsMatchOutcome, "active">, reason: RtsMatchEndReason): void {
    const text = RESULT_TEXT[outcome][reason];
    this.render(
      text.title,
      text.detail,
      [{ label: "Yeniden Başlat", action: this.handlers.onRestart, primary: true, key: "restart" }],
      outcome,
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
  ): void {
    this.settings.hidden = !showSettings;
    this.card.dataset.tone = tone;
    this.title.textContent = title;
    this.detail.textContent = detail;
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
