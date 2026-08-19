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
import { onLocaleChanged, t } from "../../localization/LocalizationService";
import { DEFAULT_RTS_CAMERA_SETTINGS, type RtsCameraSettings } from "../camera/rtsCameraConfig";
import { formatMatchDuration } from "./rtsMatchClock";
import type { RtsMatchEndReason, RtsMatchOutcome } from "./rtsMatchState";

/** RTS exposes the three player-facing profiles; Ultra/custom remain engine APIs. */
export type RtsGraphicsQuality = "low" | "medium" | "high";

const GRAPHICS_QUALITY_LEVELS: readonly RtsGraphicsQuality[] = ["low", "medium", "high"];

function graphicsQualityLabel(quality: RtsGraphicsQuality): string {
  return t(`match.settings.graphics.quality.${quality}`);
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
  /**
   * Leave this match for the main menu. Optional because the card cannot know
   * whether the host has a menu behind it — an `?rts` boot does, and a host that
   * does not would otherwise show a button that goes nowhere.
   */
  readonly onExitToMenu?: () => void;
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
  /** Localization key root; the label, hint and value words hang off it. */
  readonly textKey: string;
  /** Which of the three value words this position on the slider reads as. */
  readonly valueWord: (value: number) => string;
}

// Keys, not text: this table is built when the module loads, which is before a
// locale is chosen and before a language change can be heard. Every string on
// the card is resolved at render time instead (Plan §13).
const CAMERA_SETTING_ROWS: readonly SettingRow[] = [
  {
    key: "panSpeed",
    textKey: "match.settings.camera.pan_speed",
    valueWord: (value) => (value < 0.35 ? "slow" : value > 0.65 ? "fast" : "normal"),
  },
  {
    key: "smoothing",
    textKey: "match.settings.camera.smoothing",
    valueWord: (value) => (value < 0.35 ? "instant" : value > 0.65 ? "smooth" : "balanced"),
  },
];

/** The word under a camera slider, in the active language. */
function settingValueLabel(row: SettingRow, value: number): string {
  return t(`${row.textKey}.value.${row.valueWord(value)}`);
}

/**
 * §51 wants a victory *and* a defeat screen, and defeat has two causes. A
 * resigned match whose centre is still standing must not be told it was razed.
 *
 * Each outcome/reason pair owns its own detail key. A shared "the centre fell"
 * line with the side as a parameter would be shorter and wrong: the sentence
 * that reports your own defeat is not the sentence that reports the enemy's,
 * and in most languages it is not even the same construction.
 */
const RESULT_DETAIL_KEY: Readonly<Record<RtsMatchEndReason, string>> = {
  "center-destroyed": "center_destroyed",
  // Reachable only if a future rule lets the AI resign; saying "the enemy
  // centre fell" when it did not is the failure this mapping exists to avoid.
  surrendered: "surrendered",
  // §58: names the condition, because a match that ended with both centres
  // standing otherwise reads as an unexplained stop.
  "regional-control": "regional_control",
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
  /**
   * What the card is showing right now, so a language change can rebuild it —
   * Plan §13. The modal is one of the few surfaces that can be *open* while the
   * player changes the language, and a half-translated card is worse than none.
   */
  private openCard:
    | { readonly kind: "pause"; readonly missionRunning: boolean }
    | {
        readonly kind: "result";
        readonly outcome: Exclude<RtsMatchOutcome, "active">;
        readonly reason: RtsMatchEndReason;
        readonly durationSeconds: number;
      }
    | null = null;
  private readonly stopLocaleWatch: () => void;

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
    this.stopLocaleWatch = onLocaleChanged(() => this.applyLocale());
  }

  /**
   * Re-resolve every string the card owns.
   *
   * The settings panel is built once and then only mutated, so its labels are
   * marked with the key they came from (`data-rts-text`) instead of being
   * written and forgotten — that mark is what makes a language change a
   * one-pass refresh rather than a rebuild.
   */
  private applyStaticText(): void {
    for (const element of Array.from(this.settings.querySelectorAll<HTMLElement>("[data-rts-text]"))) {
      const key = element.dataset.rtsText;
      if (key) element.textContent = t(key);
    }
    for (const element of Array.from(this.settings.querySelectorAll<HTMLElement>("[data-rts-title-text]"))) {
      const key = element.dataset.rtsTitleText;
      if (key) element.title = t(key);
    }
    for (const row of CAMERA_SETTING_ROWS) {
      const output = this.settings.querySelector<HTMLOutputElement>(`[data-rts-setting-value="${row.key}"]`);
      if (output) output.textContent = settingValueLabel(row, this.cameraSettings[row.key]);
    }
    if (this.graphicsSettings) {
      const label = graphicsQualityLabel(this.graphicsSettings.quality);
      const value = this.settings.querySelector<HTMLOutputElement>("[data-rts-graphics-quality-value]");
      if (value) value.textContent = label;
      this.settings.querySelector("[data-rts-graphics-quality]")?.setAttribute("aria-valuetext", label);
    }
  }

  /** Language changed: re-text the panel, and re-render the card if it is open. */
  private applyLocale(): void {
    this.applyStaticText();
    const card = this.openCard;
    if (!card || !this.root.classList.contains("is-visible")) return;
    if (card.kind === "pause") this.showPause(card.missionRunning);
    else this.showResult(card.outcome, card.reason, card.durationSeconds);
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
    heading.dataset.rtsText = "match.settings.title";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "rts-match-settings-reset";
    reset.dataset.rtsText = "match.settings.reset";
    reset.addEventListener("click", () => {
      this.applyCameraSettings(DEFAULT_RTS_CAMERA_SETTINGS);
      this.applyGraphicsSettings({ quality: "medium", adaptiveEnabled: true });
    });
    header.append(heading, reset);
    this.settings.appendChild(header);
    for (const row of CAMERA_SETTING_ROWS) {
      const wrapper = document.createElement("label");
      wrapper.className = "rts-match-setting";
      wrapper.dataset.rtsTitleText = `${row.textKey}.hint`;
      const label = document.createElement("span");
      label.className = "rts-match-setting-label";
      label.dataset.rtsText = `${row.textKey}.label`;
      const control = document.createElement("span");
      control.className = "rts-match-setting-control";
      const value = document.createElement("output");
      value.className = "rts-match-setting-value";
      value.dataset.rtsSettingValue = row.key;
      value.textContent = settingValueLabel(row, this.cameraSettings[row.key]);
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
    this.applyStaticText();
  }

  /** Builds only when the host owns real graphics settings; no inert controls. */
  private buildGraphicsSettings(): void {
    if (!this.graphicsSettings || !this.handlers.onGraphicsQuality || !this.handlers.onGraphicsAdaptive) return;
    const quality = document.createElement("label");
    quality.className = "rts-match-setting";
    quality.dataset.rtsTitleText = "match.settings.graphics.quality.hint";
    const label = document.createElement("span");
    label.className = "rts-match-setting-label";
    label.dataset.rtsText = "match.settings.graphics.quality.label";
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
    adaptive.dataset.rtsTitleText = "match.settings.graphics.adaptive.hint";
    const adaptiveLabel = document.createElement("span");
    adaptiveLabel.className = "rts-match-setting-label";
    adaptiveLabel.dataset.rtsText = "match.settings.graphics.adaptive.label";
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
      if (output) output.textContent = settingValueLabel(row, value);
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
    this.openCard = { kind: "pause", missionRunning };
    this.render(t("match.pause.title"), t("match.pause.detail"), [
      // Enter/Escape still resume through the match input handler, but opening
      // pause must not paint this as an already selected button. Gold belongs to
      // the button the player is actively hovering or tabbing to.
      { label: t("match.action.resume"), action: this.handlers.onResume, primary: false, key: "resume" },
      // The escape hatch lives here rather than on the mission card: that card is
      // read-only by design (it must never swallow a click meant for the map),
      // and the pause menu is already the surface a player opens to stop and
      // change how they are playing. Unconfirmed, unlike surrender — leaving the
      // tur costs nothing that cannot be had back by restarting.
      ...(missionRunning && this.handlers.onAbandonMission
        ? [{ label: t("match.action.abandon_mission"), action: this.handlers.onAbandonMission, key: "abandon-mission" }]
        : []),
      { label: t("match.action.restart"), action: this.handlers.onRestart, key: "restart" },
      // Between restart and surrender because that is what it is: another way to
      // stop playing *this* match, weightier than starting it over and lighter
      // than resigning it. Unconfirmed for the same reason restart is — it costs
      // the match, not the record.
      ...(this.handlers.onExitToMenu
        ? [{ label: t("match.action.exit_to_menu"), action: this.handlers.onExitToMenu, key: "exit-to-menu" }]
        : []),
      this.surrenderArmed
        ? { label: t("match.action.surrender_confirm"), action: this.handlers.onSurrender, key: "surrender", danger: true }
        : { label: t("match.action.surrender"), action: this.armSurrender, key: "surrender" },
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
    this.openCard = { kind: "result", outcome, reason, durationSeconds };
    this.render(
      t(`match.result.${outcome}.title`),
      t(`match.result.${outcome}.${RESULT_DETAIL_KEY[reason]}`),
      [
        { label: t("match.action.restart"), action: this.handlers.onRestart, primary: true, key: "restart" },
        // A decided match cannot be paused (`togglePause` refuses once the match
        // is over), so without this the result card is the one screen with no way
        // back to the menu — the player would have to reload the page to leave a
        // match they just finished.
        ...(this.handlers.onExitToMenu
          ? [{ label: t("match.action.exit_to_menu"), action: this.handlers.onExitToMenu, key: "exit-to-menu" }]
          : []),
      ],
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
    this.stopLocaleWatch();
    this.root.remove();
  }

  private readonly armSurrender = (): void => {
    this.surrenderArmed = true;
    // Re-open the card it was armed from. Without the remembered flag this
    // second render dropped "Serbest oyuna çevir" for a player who armed
    // surrender during a live story chain, because `showPause` defaults to no
    // mission and the card had no memory of one.
    this.showPause(this.openCard?.kind === "pause" ? this.openCard.missionRunning : false);
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
    this.duration.textContent =
      durationSeconds === null
        ? ""
        // §11.3: the clock itself stays locale-independent (`12:45`); only the
        // sentence around it is translated.
        : t("match.result.duration", { time: formatMatchDuration(durationSeconds) });
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
