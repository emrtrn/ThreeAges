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
import type { MissionModeChoice } from "../tutorial/missionModeChoice";

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
  /**
   * The story/tutorial mode row (Faz 2). Absent when the host cannot act on it,
   * and then the row is not built at all — same rule as the picker above.
   */
  readonly onMissionMode?: (choice: MissionModeChoice) => void;
  /** Faz 2 "serbest oyuna çevir": end a live chain without ending the match. */
  readonly onAbandonMission?: () => void;
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

interface MissionModeRow {
  readonly choice: MissionModeChoice;
  readonly label: string;
  readonly hint: string;
}

/**
 * The story/tutorial offer, phrased as a mode rather than as a "tutorial"
 * checkbox. The tur *is* a match — same rules, same victory, same AI — so
 * calling it training would misdescribe what the player is about to do and make
 * the honest choice ("I want to be shown the ropes") feel like the lesser one.
 *
 * "Serbest maç" states the cost of skipping in its hint rather than warning
 * about it: a player who knows RTS should be able to decline in one click
 * without being lectured, and a player who does not know this game's road and
 * depot rules should be able to read, in one line, what they are turning down.
 */
const MISSION_MODE_ROWS: readonly MissionModeRow[] = [
  {
    choice: "story",
    label: "Hikâye turu",
    hint: "Normal bir maç, sırayla verilen görevlerle. Yol, depo ve kontrol alanı kurallarını oynayarak öğrenirsin; zincir bittiğinde maç serbest devam eder.",
  },
  {
    choice: "free",
    label: "Serbest maç",
    hint: "Görev yok. Bu oyunun yol/depo lojistiği ve Merkez'den yükseltme düzeni türün alışıldık kurallarından farklı; hepsini kendin keşfedersin.",
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
  /** §78.1 match setup; empty and permanently hidden without a choice handler. */
  private readonly setup = document.createElement("div");
  private readonly setupHint = document.createElement("p");
  private victoryCondition: VictoryConditionChoice = DEFAULT_VICTORY_CONDITION;
  /** Faz 2 mission mode; empty and permanently hidden without a mode handler. */
  private readonly missionHint = document.createElement("p");
  private missionMode: MissionModeChoice = "story";

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
    // The mode row comes first: it decides what kind of match this is, and the
    // victory condition is a rule *inside* that match. Reading them the other way
    // round asks the player to pick how the game ends before knowing whether they
    // are being walked through it.
    this.buildMissionMode();
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

  /** The mode row, built on the same radio/one-swapping-hint pattern as above. */
  private buildMissionMode(): void {
    if (!this.handlers.onMissionMode) return;
    const group = document.createElement("fieldset");
    group.className = "rts-match-setup-group";
    const legend = document.createElement("legend");
    legend.textContent = "Maç türü";
    group.appendChild(legend);
    for (const row of MISSION_MODE_ROWS) {
      const wrapper = document.createElement("label");
      wrapper.className = "rts-match-setup-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "rts-mission-mode";
      input.value = row.choice;
      input.dataset.rtsMissionMode = row.choice;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        this.setMissionMode(row.choice);
        this.handlers.onMissionMode?.(row.choice);
      });
      const label = document.createElement("span");
      label.textContent = row.label;
      wrapper.append(input, label);
      group.appendChild(wrapper);
    }
    this.missionHint.className = "rts-match-setup-hint";
    this.missionHint.dataset.rtsMissionHint = "";
    this.setup.append(group, this.missionHint);
  }

  /** Reflect a choice in the radios and the hint. Fires no handler. */
  private setVictoryCondition(choice: VictoryConditionChoice): void {
    this.victoryCondition = choice;
    // Scoped by name, not by type: the card now carries two radio groups, and an
    // unscoped selector would clear the mode row every time the condition moved.
    for (const input of this.setup.querySelectorAll<HTMLInputElement>("input[name='rts-victory-condition']")) {
      input.checked = input.value === choice;
    }
    this.setupHint.textContent =
      VICTORY_CONDITION_ROWS.find((row) => row.choice === choice)?.hint ?? "";
  }

  private setMissionMode(choice: MissionModeChoice): void {
    this.missionMode = choice;
    for (const input of this.setup.querySelectorAll<HTMLInputElement>("input[name='rts-mission-mode']")) {
      input.checked = input.value === choice;
    }
    this.missionHint.textContent =
      MISSION_MODE_ROWS.find((row) => row.choice === choice)?.hint ?? "";
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
    reset.addEventListener("click", () => this.applyCameraSettings(DEFAULT_RTS_CAMERA_SETTINGS));
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

  /**
   * §51: a simple start screen, deliberately not a main menu.
   *
   * `victoryCondition` is the state the match would boot with — the resolved
   * flag, not a remembered preference — so a dev URL or a §72 preset that
   * already enables the regional route opens with that row selected instead of
   * quietly contradicting the card.
   */
  showStart(
    victoryCondition: VictoryConditionChoice = DEFAULT_VICTORY_CONDITION,
    missionMode: MissionModeChoice = "story",
  ): void {
    if (this.handlers.onVictoryCondition) this.setVictoryCondition(victoryCondition);
    if (this.handlers.onMissionMode) this.setMissionMode(missionMode);
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

  get selectedMissionMode(): MissionModeChoice {
    return this.missionMode;
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
    showSetup = false,
  ): void {
    this.settings.hidden = !showSettings;
    // §78.1 / §60: with no choice handler the block was never populated, so it
    // stays hidden and the start card looks exactly as it did before.
    // Shown when the start card is up and *something* in it exists to set. A host
    // that wires only one of the two rows still gets that row.
    this.setup.hidden = !showSetup
      || (!this.handlers.onVictoryCondition && !this.handlers.onMissionMode);
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
