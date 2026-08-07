/**
 * The modal that covers the field whenever a *running* match is interrupted —
 * Vertical Slice Plan v0.2 §51 "Maç akışı" (Faz 9).
 *
 * One component for the pause menu and the result screen, because they are one
 * thing: the same card, in the same place, blocking the same field, differing
 * only in what it says and which actions it offers. Two components would have
 * meant two copies of the modal's CSS and two chances for both to be on screen
 * at once.
 *
 * It used to carry a third card — the start screen, with match setup on it. That
 * one left with `THREEAGES_RTS_MAIN_MENU_LOADING_PLAN.md` Faz F2 and became
 * `ui/rtsMainMenu.ts`, which runs before `RtsApp` is constructed. §2.4 of the
 * plan is the reason only that one moved: pause and result belong to a match
 * that is already being played, and a menu that exists before the match cannot
 * show them.
 *
 * Presentation only. It decides nothing about the match; `RtsApp` owns the
 * transitions and tells this what to show.
 */
import { DEFAULT_RTS_CAMERA_SETTINGS, type RtsCameraSettings } from "../camera/rtsCameraConfig";
import { formatMatchDuration } from "./rtsMatchClock";
import type { RtsMatchEndReason, RtsMatchOutcome } from "./rtsMatchState";

/** RTS exposes the three player-facing profiles; Ultra/custom remain engine APIs. */
export type RtsGraphicsQuality = "low" | "medium" | "high";

const GRAPHICS_QUALITY_LEVELS: readonly RtsGraphicsQuality[] = ["low", "medium", "high"];

function graphicsQualityLabel(quality: RtsGraphicsQuality): string {
  return quality === "low" ? "Düşük" : quality === "medium" ? "Orta" : "Yüksek";
}

function graphicsQualityLevel(quality: RtsGraphicsQuality): number {
  return GRAPHICS_QUALITY_LEVELS.indexOf(quality);
}

export interface RtsGraphicsSettings {
  readonly quality: RtsGraphicsQuality;
  readonly adaptiveEnabled: boolean;
}

export interface RtsMatchOverlayHandlers {
  readonly onResume: () => void;
  readonly onRestart: () => void;
  readonly onSurrender: () => void;
  /** §51 "Minimal ayarlar": camera feel, changed live behind the pause card. */
  readonly onCameraSettings: (settings: RtsCameraSettings) => void;
  /** Current RTS graphics state, persisted and applied by the runtime. */
  readonly graphicsSettings?: RtsGraphicsSettings;
  /** Changes the player's base profile (adaptive reductions never overwrite it). */
  readonly onGraphicsQuality?: (quality: RtsGraphicsQuality) => void;
  /** Lets the player opt in/out of runtime quality reductions. */
  readonly onGraphicsAdaptive?: (enabled: boolean) => void;
  /** Faz 2 "serbest oyuna çevir": end a live chain without ending the match. */
  readonly onAbandonMission?: () => void;
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
  readonly valueLabel: (value: number) => string;
}

const CAMERA_SETTING_ROWS: readonly SettingRow[] = [
  {
    key: "panSpeed",
    label: "Kamera hızı",
    hint: "WASD ile kaydırma hızı.",
    valueLabel: (value) => value < 0.35 ? "Yavaş" : value > 0.65 ? "Hızlı" : "Normal",
  },
  {
    key: "smoothing",
    label: "Yakınlaştırma yumuşaklığı",
    hint: "Yakınlaştırma hedefe ne kadar yumuşak ulaşır.",
    valueLabel: (value) => value < 0.35 ? "Anlık" : value > 0.65 ? "Yumuşak" : "Dengeli",
  },
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
  private graphicsSettings: RtsGraphicsSettings | null;

  constructor(private readonly handlers: RtsMatchOverlayHandlers) {
    this.graphicsSettings = handlers.graphicsSettings ?? null;
    this.root.className = "rts-match-overlay ui-interactive";
    this.card.className = "rts-match-card";
    this.card.setAttribute("role", "status");
    this.card.setAttribute("aria-live", "polite");
    this.title.dataset.rtsResultTitle = "";
    this.detail.dataset.rtsResultDetail = "";
    this.duration.dataset.rtsResultDuration = "";
    this.duration.className = "rts-match-duration";
    this.actions.className = "rts-match-actions";
    this.buildSettings();
    this.card.append(this.title, this.detail, this.duration, this.actions, this.settings);
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
    const header = document.createElement("div");
    header.className = "rts-match-settings-header";
    const heading = document.createElement("strong");
    heading.textContent = "Ayarlar";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "rts-match-settings-reset";
    reset.textContent = "Varsayılan";
    reset.addEventListener("click", () => {
      this.applyCameraSettings(DEFAULT_RTS_CAMERA_SETTINGS);
      this.applyGraphicsSettings({ quality: "medium", adaptiveEnabled: true });
    });
    header.append(heading, reset);
    this.settings.appendChild(header);
    for (const row of CAMERA_SETTING_ROWS) {
      const wrapper = document.createElement("label");
      wrapper.className = "rts-match-setting";
      wrapper.title = row.hint;
      const label = document.createElement("span");
      label.className = "rts-match-setting-label";
      label.textContent = row.label;
      const control = document.createElement("span");
      control.className = "rts-match-setting-control";
      const value = document.createElement("output");
      value.className = "rts-match-setting-value";
      value.dataset.rtsSettingValue = row.key;
      value.textContent = row.valueLabel(this.cameraSettings[row.key]);
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
        this.applyCameraSettings({ ...this.cameraSettings, [row.key]: Number(slider.value) });
      });
      control.append(value, slider);
      wrapper.append(label, control);
      this.settings.appendChild(wrapper);
    }
    this.buildGraphicsSettings();
  }

  /** Builds only when the host owns real graphics settings; no inert controls. */
  private buildGraphicsSettings(): void {
    if (!this.graphicsSettings || !this.handlers.onGraphicsQuality || !this.handlers.onGraphicsAdaptive) return;
    const quality = document.createElement("label");
    quality.className = "rts-match-setting";
    quality.title = "Görsel kalite; oyunun kural ve hızını değiştirmez.";
    const label = document.createElement("span");
    label.className = "rts-match-setting-label";
    label.textContent = "Grafik kalitesi";
    const control = document.createElement("span");
    control.className = "rts-match-setting-control";
    const value = document.createElement("output");
    value.className = "rts-match-setting-value";
    value.dataset.rtsGraphicsQualityValue = "";
    value.textContent = graphicsQualityLabel(this.graphicsSettings.quality);
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = String(GRAPHICS_QUALITY_LEVELS.length - 1);
    slider.step = "1";
    slider.value = String(graphicsQualityLevel(this.graphicsSettings.quality));
    slider.dataset.rtsGraphicsQuality = "";
    slider.setAttribute("aria-valuetext", graphicsQualityLabel(this.graphicsSettings.quality));
    slider.addEventListener("input", () => {
      const nextQuality = GRAPHICS_QUALITY_LEVELS[Number(slider.value)];
      if (!nextQuality) return;
      this.applyGraphicsSettings({ ...this.graphicsSettings!, quality: nextQuality });
    });
    control.append(value, slider);
    quality.append(label, control);

    const adaptive = document.createElement("label");
    adaptive.className = "rts-match-setting";
    adaptive.title = "Uzun süren performans baskısında kaliteyi geçici olarak azaltır.";
    const adaptiveLabel = document.createElement("span");
    adaptiveLabel.className = "rts-match-setting-label";
    adaptiveLabel.textContent = "Otomatik optimizasyon";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.rtsGraphicsAdaptive = "";
    checkbox.checked = this.graphicsSettings.adaptiveEnabled;
    checkbox.addEventListener("change", () => {
      this.applyGraphicsSettings({ ...this.graphicsSettings!, adaptiveEnabled: checkbox.checked });
    });
    const checkboxControl = document.createElement("span");
    checkboxControl.className = "rts-match-checkbox-control";
    const checkboxMark = document.createElement("span");
    checkboxMark.className = "rts-match-checkbox-mark";
    checkboxMark.setAttribute("aria-hidden", "true");
    checkboxControl.append(checkbox, checkboxMark);
    adaptive.append(adaptiveLabel, checkboxControl);
    this.settings.append(quality, adaptive);
  }

  /** Keep the live camera, sliders and their human-readable state in lockstep. */
  private applyCameraSettings(settings: RtsCameraSettings): void {
    this.cameraSettings = settings;
    for (const row of CAMERA_SETTING_ROWS) {
      const value = settings[row.key];
      const slider = this.settings.querySelector<HTMLInputElement>(`[data-rts-setting="${row.key}"]`);
      if (slider) slider.value = String(value);
      const output = this.settings.querySelector<HTMLOutputElement>(`[data-rts-setting-value="${row.key}"]`);
      if (output) output.textContent = row.valueLabel(value);
    }
    this.handlers.onCameraSettings(this.cameraSettings);
  }

  private applyGraphicsSettings(settings: RtsGraphicsSettings): void {
    if (!this.graphicsSettings) return;
    this.graphicsSettings = settings;
    const slider = this.settings.querySelector<HTMLInputElement>("[data-rts-graphics-quality]");
    if (slider) {
      slider.value = String(graphicsQualityLevel(settings.quality));
      slider.setAttribute("aria-valuetext", graphicsQualityLabel(settings.quality));
    }
    const value = this.settings.querySelector<HTMLOutputElement>("[data-rts-graphics-quality-value]");
    if (value) value.textContent = graphicsQualityLabel(settings.quality);
    const checkbox = this.settings.querySelector<HTMLInputElement>("[data-rts-graphics-adaptive]");
    if (checkbox) checkbox.checked = settings.adaptiveEnabled;
    this.handlers.onGraphicsQuality?.(settings.quality);
    this.handlers.onGraphicsAdaptive?.(settings.adaptiveEnabled);
  }

  /**
   * @param missionRunning whether a story chain is live, which is the only state
   *   in which the escape hatch means anything. Offering it on a free match
   *   would be a button that does nothing.
   */
  showPause(missionRunning = false): void {
    this.render("Duraklatıldı", "Maç durduruldu.", [
      // Enter/Escape still resume through the match input handler, but opening
      // pause must not paint this as an already selected button. Gold belongs to
      // the button the player is actively hovering or tabbing to.
      { label: "Devam Et", action: this.handlers.onResume, primary: false, key: "resume" },
      // The escape hatch lives here rather than on the mission card: that card is
      // read-only by design (it must never swallow a click meant for the map),
      // and the pause menu is already the surface a player opens to stop and
      // change how they are playing. Unconfirmed, unlike surrender — leaving the
      // tur costs nothing that cannot be had back by restarting.
      ...(missionRunning && this.handlers.onAbandonMission
        ? [{ label: "Serbest oyuna çevir", action: this.handlers.onAbandonMission, key: "abandon-mission" }]
        : []),
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
  ): void {
    this.settings.hidden = !showSettings;
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
    // A modal's first action is a shortcut target, not an already selected
    // choice. Focus the card itself; Tab moves into the first action and then
    // intentionally reveals its gold state. Enter/Escape stay owned by input.
    this.card.tabIndex = -1;
    this.card.focus({ preventScroll: true });
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
