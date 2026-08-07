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
const MISSION_MODE_ROWS: readonly SetupOption<MissionModeChoice>[] = [
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
 * §59, phrased as two kinds of match rather than as an on/off switch.
 *
 * "Kapalı" alone would read as disabling an effect, and the hints have to carry
 * the part that is not obvious from the name: fog is what makes scouting, the
 * remembered-building markers and the AI's own blindness mean anything, so
 * turning it off is a change to how the match is *played*, not to how it looks.
 * The symmetry is worth stating outright — a player who assumes the AI cheats
 * under fog is a player who will never scout.
 */
const FOG_OF_WAR_ROWS: readonly SetupOption<FogOfWarChoice>[] = [
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
 * match hang off the row they belong to. Two shapes, because they are two kinds
 * of decision: the mode is the question itself and both answers stay visible as
 * radios, while zafer koşulu / savaş sisi / zorluk are settings with a sensible
 * default that fold into dropdowns instead of eight more lines above the start
 * button. Native controls throughout, which is what a keyboard and a screen
 * reader already understand.
 */
export class RtsMatchSetup {
  readonly element = document.createElement("div");
  private missionMode: MissionModeChoice;
  private victoryCondition: VictoryConditionChoice;
  private fogOfWar: FogOfWarChoice;
  private aiProfile: AiProfile;
  private readonly victorySelect: SetupSelect<VictoryConditionChoice>;
  private readonly fogSelect: SetupSelect<FogOfWarChoice>;
  private readonly aiProfileSelect: SetupSelect<AiProfile>;

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

    // The three rules of a free match, side by side with the row they belong to.
    const freeOptions = document.createElement("div");
    freeOptions.className = "rts-match-setup-inline";

    // The mode row comes first: it decides what kind of match this is, and the
    // three dropdowns are rules *inside* that match. Reading them the other way
    // round asks the player to pick how the game ends before knowing whether they
    // are being walked through it.
    for (const row of MISSION_MODE_ROWS) {
      const line = document.createElement("div");
      line.className = "rts-match-setup-row";
      line.appendChild(this.buildMissionRadio(row));
      // The strip hangs off "Serbest maç" because that is the match it describes.
      // The tur runs the same fog and the same opponent, so the two controls it
      // shares stay live while it is selected — they are attached to the free
      // row, not disabled by it.
      if (row.choice === "free") line.appendChild(freeOptions);
      group.appendChild(line);
    }

    this.victorySelect = buildSetupSelect("rtsVictoryCondition", "Zafer", VICTORY_CONDITION_ROWS, (choice) => {
      this.victoryCondition = choice;
      syncSetupSelect(this.victorySelect, choice);
    });
    this.fogSelect = buildSetupSelect("rtsFogOfWar", "Savaş sisi", FOG_OF_WAR_ROWS, (choice) => {
      this.fogOfWar = choice;
      syncSetupSelect(this.fogSelect, choice);
    });
    this.aiProfileSelect = buildSetupSelect("rtsAiProfile", "Zorluk", AI_PROFILE_ROWS, (choice) => {
      this.aiProfile = choice;
      syncSetupSelect(this.aiProfileSelect, choice);
    });
    freeOptions.append(this.victorySelect.field, this.fogSelect.field, this.aiProfileSelect.field);
    this.element.appendChild(group);

    // Seeded after construction so every control and its tooltip start out
    // agreeing with the match the boot would actually build.
    this.setMissionMode(this.missionMode);
    syncSetupSelect(this.victorySelect, this.victoryCondition);
    syncSetupSelect(this.fogSelect, this.fogOfWar);
    syncSetupSelect(this.aiProfileSelect, this.aiProfile);
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
   * One mode row: a radio, and its rule on hover.
   *
   * Radios rather than a dropdown for this one, unlike the three rules beside it:
   * the mode is the question the card is asking, and both answers have to be
   * visible without opening anything.
   */
  private buildMissionRadio(row: SetupOption<MissionModeChoice>): HTMLLabelElement {
    const wrapper = document.createElement("label");
    wrapper.className = "rts-match-setup-option";
    wrapper.title = `${row.label} — ${row.hint}`;
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
    label.textContent = row.label;
    wrapper.append(input, label);
    return wrapper;
  }

  private setMissionMode(choice: MissionModeChoice): void {
    this.missionMode = choice;
    // Scoped by name rather than by type: the card carries other inputs, and an
    // unscoped selector would reach controls this row does not own.
    for (const input of this.element.querySelectorAll<HTMLInputElement>("input[name='rts-mission-mode']")) {
      input.checked = input.value === choice;
    }
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
