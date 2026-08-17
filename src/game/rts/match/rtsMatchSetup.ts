/**
 * Match setup — the rows that decide what kind of match is about to be played
 * (Vertical Slice Plan v0.2 §78.1, §59, §72; Hikâye/Öğretici Faz 2).
 *
 * Lifted out of `rtsMatchOverlay.ts` by
 * `docs/planned/THREEAGES_RTS_MAIN_MENU_LOADING_PLAN.md` Faz F2. The overlay used
 * to carry three cards — start, pause, result — and only the first one asked
 * these questions. Now that the start card has become the main menu
 * (`ui/rtsMainMenu.ts`), which runs *before* `RtsApp` exists, the setup rows have
 * to live somewhere neither the overlay nor the app owns. This is that place.
 *
 * What the move deleted is the more interesting half. Every row used to be
 * conditional on the host being able to *act* on it, because the host was a
 * running `RtsApp` that had already resolved its flags (§13 keeps them read-only
 * once resolved) and could only honour a change by storing it and reloading the
 * page. The menu has no such problem: nothing has been constructed yet, so every
 * row is always answerable and the four `location.reload()` calls that used to
 * back them are gone. See the plan's §2.3.
 *
 * Presentation only — it renders controls and reports what they say. Which flags
 * a choice implies is `victoryConditionChoice.ts` / `fogOfWarChoice.ts`, and who
 * asks is `main.ts`.
 */
import type { AiProfile } from "../../data/gameDataTypes";
import type { MissionModeChoice } from "../tutorial/missionModeChoice";
import type { FogOfWarChoice } from "../vision/fogOfWarChoice";
import type { VictoryConditionChoice } from "./victoryConditionChoice";

/**
 * One shape for every setup choice on the card.
 *
 * The rule the player is opting into lives in `hint`, and `hint` is a *tooltip*
 * rather than a paragraph under the control. The card had grown four explanatory
 * blocks stacked above "Maçı Başlat", which is a wall of text in front of the one
 * button the screen exists for; the rules still have to be discoverable (§78.1
 * exists because they were not), so they moved to hover where a player who wants
 * them finds them and a player who knows them does not have to read past them.
 */
interface SetupOption<T extends string> {
  readonly choice: T;
  readonly label: string;
  readonly hint: string;
}

/**
 * §78.1 task 4. The regional hint is not flavour: a strategic point is taken by
 * the control area of a road-connected outpost, never by parking units on it.
 * `strategicPointSystem.ts` has always enforced that and nothing ever said it,
 * and an undiscoverable rule produces exactly the surprise defeat §58's second
 * acceptance criterion forbids.
 */
const VICTORY_CONDITION_ROWS: readonly SetupOption<VictoryConditionChoice>[] = [
  {
    choice: "military",
    label: "Askerî",
    hint: "Maç yalnızca düşman merkezi yıkıldığında biter.",
  },
  {
    choice: "military_regional",
    label: "Askerî + Bölgesel",
    hint: "Askerî zafer geçerliliğini korur. Ek olarak iki stratejik geçidi belirli bir süre boyunca birlikte elinde tutan taraf kazanır. Geçitler oraya birlik göndererek değil, yola bağlı bir karakolun kontrol alanıyla alınır.",
  },
];

/**
 * A mode card carries one line the player reads without hovering. The tooltip
 * still holds the full rule, but the mode is the card's headline question and a
 * choice made from two words alone is a coin toss — `blurb` is the shortest
 * sentence that makes the two answers actually differ.
 */
interface ModeOption extends SetupOption<MissionModeChoice> {
  readonly blurb: string;
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
 * depot rules should be able to hover for one line about what they are turning
 * down.
 */
const MISSION_MODE_ROWS: readonly ModeOption[] = [
  {
    choice: "story",
    label: "Hikâye turu",
    blurb: "Sırayla verilen görevlerle öğren.",
    hint: "Normal bir maç, sırayla verilen görevlerle. Yol, depo ve kontrol alanı kurallarını oynayarak öğrenirsin; zincir bittiğinde maç serbest devam eder. Harita savaş sisi altında açılır: keşfetmek turun ilk dersi.",
  },
  {
    choice: "free",
    label: "Serbest maç",
    blurb: "Görev yok; kuralları kendin kur.",
    hint: "Görev yok. Bu oyunun yol/depo lojistiği ve Merkez'den yükseltme düzeni türün alışıldık kurallarından farklı; hepsini kendin keşfedersin.",
  },
];

/**
 * §59, phrased as two kinds of match rather than as an on/off switch.
 *
 * "Kapalı" alone would read as disabling an effect, and the hints have to carry
 * the part that is not obvious from the name: fog is what makes scouting, the
 * remembered-building markers and the AI's own blindness mean anything, so
 * turning it off is a change to how the match is *played*, not to how it looks.
 * The symmetry is worth stating outright — a player who assumes the AI cheats
 * under fog is a player who will never scout.
 *
 * A two-item tuple rather than an array, because the switch that renders it has
 * exactly two positions: the on choice first, the off choice second. A third
 * entry here would need a different control, and the type is what says so.
 */
const FOG_OF_WAR_ROWS: readonly [SetupOption<FogOfWarChoice>, SetupOption<FogOfWarChoice>] = [
  {
    choice: "on",
    label: "Açık",
    hint: "Harita keşfedilene kadar karanlık. Görmediğin düşman birlikleri gizlenir, keşfettiğin binalar hafızada kalır. Düşman da aynı sisin altında oynar — senin birliklerini ancak gördüğünde bilir.",
  },
  {
    choice: "off",
    label: "Kapalı",
    hint: "Tüm harita ve her iki tarafın birlikleri baştan görünür. Keşif ve baskın avantajı ortadan kalkar; doğrudan ekonomi ve ordu yarışına dönersin.",
  },
];

/**
 * §70/§72: difficulty is timing and quality, never cheating — the profiles differ
 * in reaction delay and, at the top end, a small economy multiplier that §73 caps.
 *
 * The hints say *that* rather than the numbers behind it. `balance/ai.json` is
 * tuning data and exists to be retuned; a tooltip quoting "3 saniye" would be a
 * copy of that table which nothing forces anyone to update, and the player is
 * choosing an opponent, not reading a spec.
 */
const AI_PROFILE_ROWS: readonly SetupOption<AiProfile>[] = [
  {
    choice: "easy",
    label: "Kolay",
    hint: "Rakip geç tepki verir ve hiçbir ekonomi avantajı almaz. Kuralları öğrenmek, bir açılışı denemek için.",
  },
  {
    choice: "normal",
    label: "Normal",
    hint: "Adil temel: bonussuz ekonomi, ölçülü tepki süresi. Dengenin ayarlandığı rakip budur.",
  },
  {
    choice: "hard",
    label: "Zor",
    hint: "Rakip neredeyse anında tepki verir ve küçük bir ekonomi avantajı alır. Hile değil, tempo: gördüğünü senin gördüğün kadar görür.",
  },
];

/** Everything the boot needs to know before it can build a match. */
export interface RtsMatchSetupValues {
  readonly missionMode: MissionModeChoice;
  readonly victoryCondition: VictoryConditionChoice;
  readonly fogOfWar: FogOfWarChoice;
  readonly aiProfile: AiProfile;
}

/**
 * The setup block, as a detached element the caller mounts wherever it wants.
 *
 * The card asks one question — which kind of match — and the rules of a free
 * match hang off it. Three shapes, because they are three kinds of decision:
 *
 * - **Mode**: two cards, side by side, the selected one in gold. It is the
 *   question the screen exists to ask, so it is the only control that states
 *   both answers in full without being opened or hovered.
 * - **Zafer / Zorluk**: dropdowns, side by side. Settings with a sensible
 *   default and three-ish answers each — eight more visible lines above "Maçı
 *   Başlat" would bury the button under rules most players never change.
 * - **Savaş sisi**: a switch, because it is the one binary here. A two-item
 *   dropdown makes the player open a menu to learn there was nothing to choose
 *   between; a switch says "on/off" while closed.
 *
 * The free-match block is **hidden** while the tur is selected, not disabled:
 * the tur teaches a fixed shape of match and its three rules are not the
 * player's to set. What is behind the hidden controls is a preference for a
 * *different* match, and `main.ts` treats it that way — the tur pins fog on and
 * regional victory off whatever those rows hold (`fogEnabledForMatch`), and
 * takes only the difficulty from them. The stored values are untouched either
 * way, so the next free match opens on exactly what the player last chose.
 *
 * Native controls throughout, skinned rather than replaced: the cards and the
 * switch are labels wrapped around a real radio and a real checkbox, which is
 * what a keyboard and a screen reader already understand.
 */
export class RtsMatchSetup {
  readonly element = document.createElement("div");
  private missionMode: MissionModeChoice;
  private victoryCondition: VictoryConditionChoice;
  private fogOfWar: FogOfWarChoice;
  private aiProfile: AiProfile;
  private readonly victorySelect: SetupSelect<VictoryConditionChoice>;
  private readonly aiProfileSelect: SetupSelect<AiProfile>;
  private readonly fogToggle: SetupToggle;
  /** Everything that only describes a free match, shown and hidden as one. */
  private readonly freeOptions = document.createElement("div");

  constructor(initial: RtsMatchSetupValues) {
    this.missionMode = initial.missionMode;
    this.victoryCondition = initial.victoryCondition;
    this.fogOfWar = initial.fogOfWar;
    this.aiProfile = initial.aiProfile;

    this.element.className = "rts-match-setup";
    const group = document.createElement("fieldset");
    group.className = "rts-match-setup-group";
    const legend = document.createElement("legend");
    legend.textContent = "Maç türü";
    group.appendChild(legend);

    // The mode comes first: it decides what kind of match this is, and everything
    // below is a rule *inside* that match. Reading them the other way round asks
    // the player to pick how the game ends before knowing whether they are being
    // walked through it.
    const modes = document.createElement("div");
    modes.className = "rts-match-mode-cards";
    for (const row of MISSION_MODE_ROWS) modes.appendChild(this.buildModeCard(row));
    group.appendChild(modes);

    this.freeOptions.className = "rts-match-setup-free";
    // All three on one line, in equal thirds. None of these answers is more than
    // a word or two wide, so giving the two dropdowns half the card each left
    // them stretched over empty space while the switch sat alone underneath —
    // three columns is both tighter and one rule per column.
    this.victorySelect = buildSetupSelect("rtsVictoryCondition", "Zafer", VICTORY_CONDITION_ROWS, (choice) => {
      this.victoryCondition = choice;
      syncSetupSelect(this.victorySelect, choice);
    });
    this.aiProfileSelect = buildSetupSelect("rtsAiProfile", "Zorluk", AI_PROFILE_ROWS, (choice) => {
      this.aiProfile = choice;
      syncSetupSelect(this.aiProfileSelect, choice);
    });
    this.fogToggle = buildSetupToggle("rtsFogOfWar", "Savaş sisi", FOG_OF_WAR_ROWS, (choice) => {
      this.fogOfWar = choice;
      syncSetupToggle(this.fogToggle, choice);
    });
    this.freeOptions.append(this.victorySelect.field, this.aiProfileSelect.field, this.fogToggle.field);
    group.appendChild(this.freeOptions);
    this.element.appendChild(group);

    // Seeded after construction so every control and its tooltip start out
    // agreeing with the match the boot would actually build.
    this.setMissionMode(this.missionMode);
    syncSetupSelect(this.victorySelect, this.victoryCondition);
    syncSetupSelect(this.aiProfileSelect, this.aiProfile);
    syncSetupToggle(this.fogToggle, this.fogOfWar);
  }

  /** What the controls currently say. Read once, when the player commits. */
  get values(): RtsMatchSetupValues {
    return {
      missionMode: this.missionMode,
      victoryCondition: this.victoryCondition,
      fogOfWar: this.fogOfWar,
      aiProfile: this.aiProfile,
    };
  }

  /**
   * One mode card: a real radio, hidden inside a label that is drawn as a card.
   *
   * Skinned rather than replaced — a `div` with a click handler would have cost
   * arrow-key navigation between the two answers, the grouping a screen reader
   * announces, and the "one of these is selected" semantics, all of which a radio
   * already has. The gold state is painted from `data-selected` rather than from
   * `:checked`, so it is set by the same method that owns the value and cannot
   * drift from it.
   */
  private buildModeCard(row: ModeOption): HTMLLabelElement {
    const card = document.createElement("label");
    card.className = "rts-match-mode-card";
    card.title = `${row.label} — ${row.hint}`;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "rts-mission-mode";
    input.value = row.choice;
    input.dataset.rtsMissionMode = row.choice;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      this.setMissionMode(row.choice);
    });
    const label = document.createElement("span");
    label.className = "rts-match-mode-card-label";
    label.textContent = row.label;
    const blurb = document.createElement("span");
    blurb.className = "rts-match-mode-card-blurb";
    blurb.textContent = row.blurb;
    card.append(input, label, blurb);
    return card;
  }

  private setMissionMode(choice: MissionModeChoice): void {
    this.missionMode = choice;
    // Scoped by name rather than by type: the card carries other inputs, and an
    // unscoped selector would reach controls this row does not own.
    for (const input of this.element.querySelectorAll<HTMLInputElement>("input[name='rts-mission-mode']")) {
      input.checked = input.value === choice;
      // The card is the label around the input, so the gold state rides on the
      // element that draws it rather than on a sibling selector.
      (input.closest(".rts-match-mode-card") as HTMLElement | null)
        ?.setAttribute("data-selected", String(input.checked));
    }
    // The tur's rules are fixed, so the controls that would set them are not
    // shown. Hidden, not emptied: `values` still reports them, and they are still
    // what the tur is built with.
    this.freeOptions.hidden = choice !== "free";
  }
}

/** A captioned dropdown plus everything needed to keep its tooltip honest. */
interface SetupSelect<T extends string> {
  readonly field: HTMLLabelElement;
  readonly select: HTMLSelectElement;
  readonly options: readonly SetupOption<T>[];
  readonly caption: string;
}

/**
 * One captioned dropdown. `hook` is the dataset key the control keeps for tests
 * and for anything that found the old radios by name.
 *
 * The title carries the selected option's rule and is re-written on every change,
 * so hovering the control always explains the match you are about to play rather
 * than the menu in the abstract.
 */
function buildSetupSelect<T extends string>(
  hook: string,
  caption: string,
  options: readonly SetupOption<T>[],
  onChange: (choice: T) => void,
): SetupSelect<T> {
  const field = document.createElement("label");
  field.className = "rts-match-setup-field";
  const text = document.createElement("span");
  text.className = "rts-match-setup-caption";
  text.textContent = caption;
  const select = document.createElement("select");
  select.dataset[hook] = "";
  for (const row of options) {
    const option = document.createElement("option");
    option.value = row.choice;
    option.textContent = row.label;
    // Not every browser shows a tooltip inside an open dropdown, which is why the
    // field's own title is the one that has to stay correct.
    option.title = row.hint;
    select.appendChild(option);
  }
  select.addEventListener("change", () => {
    const choice = options.find((row) => row.choice === select.value);
    if (choice) onChange(choice.choice);
  });
  field.append(text, select);
  return { field, select, options, caption };
}

/** Reflect a choice in its control and tooltip. Fires no handler. */
function syncSetupSelect<T extends string>(target: SetupSelect<T>, choice: T): void {
  target.select.value = choice;
  const option = target.options.find((row) => row.choice === choice);
  target.field.title = option ? `${target.caption}: ${option.label} — ${option.hint}` : target.caption;
}

/** A captioned switch over a two-answer choice, plus what its tooltip needs. */
interface SetupToggle {
  readonly field: HTMLLabelElement;
  readonly input: HTMLInputElement;
  readonly state: HTMLSpanElement;
  readonly options: readonly [SetupOption<FogOfWarChoice>, SetupOption<FogOfWarChoice>];
  readonly caption: string;
}

/**
 * One captioned switch. Takes the same two-option table the dropdown took, so
 * the labels and the rules behind them stay where every other choice keeps them:
 * `options[0]` is the on position, `options[1]` the off one.
 *
 * The checkbox is the control; the track and thumb are decoration drawn beside
 * it, and the selected option's name is printed next to them because a switch on
 * its own says "on" but never says *what* on means here ("Açık" / "Kapalı").
 */
function buildSetupToggle(
  hook: string,
  caption: string,
  options: readonly [SetupOption<FogOfWarChoice>, SetupOption<FogOfWarChoice>],
  onChange: (choice: FogOfWarChoice) => void,
): SetupToggle {
  const field = document.createElement("label");
  field.className = "rts-match-setup-field rts-match-setup-toggle";
  const text = document.createElement("span");
  text.className = "rts-match-setup-caption";
  text.textContent = caption;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset[hook] = "";
  const track = document.createElement("span");
  track.className = "rts-match-toggle-track";
  track.setAttribute("aria-hidden", "true");
  const thumb = document.createElement("span");
  thumb.className = "rts-match-toggle-thumb";
  track.appendChild(thumb);
  const state = document.createElement("span");
  state.className = "rts-match-toggle-state";
  input.addEventListener("change", () => {
    onChange(input.checked ? options[0].choice : options[1].choice);
  });
  // The state and the switch share one line under the caption, the same shape
  // the two dropdowns have in their columns: caption on top, control below.
  const row = document.createElement("span");
  row.className = "rts-match-toggle-row";
  row.append(state, track);
  field.append(text, input, row);
  return { field, input, state, options, caption };
}

/** Reflect a choice in the switch, its printed state and its tooltip. */
function syncSetupToggle(target: SetupToggle, choice: FogOfWarChoice): void {
  const [on, off] = target.options;
  const option = choice === on.choice ? on : off;
  target.input.checked = choice === on.choice;
  target.state.textContent = option.label;
  target.field.title = `${target.caption}: ${option.label} — ${option.hint}`;
}
