/**
 * Selection panel content — Vertical Slice Plan v0.2 §51 ("Seçim panelleri").
 *
 * The six panels the plan asks for are one panel with six answers, and the
 * answer is computed here as plain data rather than written into the DOM. Two
 * reasons, both taken from slices that already paid for the lesson:
 *
 * - §52's readable-reason criteria ("bir yapı çalışmadığında nedeni
 *   gösteriliyor") is a claim about *text*, and `test:engine` can hold text to
 *   account without a browser. This is the pattern `formatRtsAiDebug` (§82) and
 *   `RtsNotificationCenter` established.
 * - The panel must not decide anything. Like {@link RtsHudBar}, it renders what
 *   `RtsApp` pushed; here the deciding is a pure function, so the DOM component's
 *   only remaining rule is which node to touch when the content changed.
 *
 * Selection is one question with one answer: either an army, or a building. The
 * kinds below are the shapes that question can take, not a catalogue of
 * buildings — a Farm and a Gold Mine share `producer` because the player asks
 * them both the same thing.
 */
import type { UnitArmorClass, UnitBalanceStats, UnitRoleId } from "../../data/gameDataTypes";
import type { UnitStance } from "../units/unit";
import type { EconomyBuildingSnapshot, EconomyProductionStatus } from "../economy/economyProductionSystem";
import type { ProducerLogisticsStatus } from "../economy/productionLogisticsSystem";
import type { DepotNodeStatus } from "../economy/depotLogisticsSystem";
import type { BarracksQueueSnapshot } from "../structures/barracksProductionSystem";
import type { WorkerQueueSnapshot } from "../structures/workerProductionSystem";
import type { ProgressionSnapshot } from "../progression/kingdomProgressionSystem";
import type { MarketTradeSnapshot } from "../economy/marketTradeSystem";
import { formatCostShortfall, formatResourceCost, resourceLabel } from "./resourceLabels";
import { describeArmyRoster } from "./rtsArmyRosterView";

/**
 * A button the selected thing offers. Declarative on purpose: the panel maps
 * {@link id} to a callback and renders the rest, so what a button *says* — and
 * whether it is legal, and why not — stays under `test:engine` like the lines do.
 *
 * `enabled` is never computed here. Every rule behind it already belongs to a
 * system (`trainableUnits` owns the tier gate, `AgeSnapshot` owns the age gate),
 * and re-deriving it in the UI is how a button starts lying about the rule it
 * claims to enforce.
 */
export interface SelectionAction {
  readonly id: string;
  readonly label: string;
  /** Shown under the label; null when the action costs nothing. */
  readonly cost: string | null;
  readonly enabled: boolean;
  /**
   * True while this command has an ongoing effect, such as a production queue
   * or a kingdom upgrade. This is presentation state, not a pressed toggle.
   */
  readonly active?: boolean;
  /** Why it is refused. Null when enabled — a legal action needs no excuse. */
  readonly reason: string | null;
  /**
   * Tooltip text for a button that is *not* refused — what pressing it will
   * cost, or what the player is still short of.
   *
   * Separate from {@link reason} because `enabled` is defined as
   * `reason === null`: writing "you are 120 stone short" there would disable the
   * button, and a price the wallet cannot meet this frame is information, not a
   * refusal. Ignored when `reason` is set; a refusal outranks a hint.
   */
  readonly hint?: string | null;
}

/** What a selected worker is doing; the union of the two systems that own workers. */
export type WorkerJob = "idle" | "moving" | "building" | "repairing" | "producing" | "unreachable";

export interface SelectedUnitView {
  readonly id: number;
  readonly role: UnitRoleId;
  readonly stats: UnitBalanceStats;
  readonly health: number;
  readonly maxHealth: number;
  readonly stance: UnitStance;
  /** The player-facing order state, computed by the runtime from the Unit. */
  readonly order?: UnitOrder;
  /** Workers only; a Guard has no job beyond its orders. */
  readonly job: WorkerJob | null;
  /**
   * True when the unit is standing on ground it could never legally reach —
   * inside a building footprint it was caught under, the "sıkışıp kalma" a
   * freshly placed structure creates. It is the one state {@link RESCUE_ACTION}
   * exists to undo, so the panel offers that button only when it is set.
   */
  readonly trapped: boolean;
}

/** Compact live order state for the selection panel; it deliberately names no target. */
export type UnitOrder = "idle" | "moving" | "attacking" | "attack-moving";

/** A site that is not a building yet: the only thing to say is when it will be. */
export interface ConstructionDetailView {
  readonly kind: "construction";
  readonly progress: number;
  readonly assignedWorkers: number;
}

export interface ProducerDetailView {
  readonly kind: "producer";
  readonly production: EconomyBuildingSnapshot;
  readonly logistics: ProducerLogisticsStatus | null;
}

export interface DepotDetailView {
  readonly kind: "depot";
  readonly status: DepotNodeStatus;
  readonly componentId: number | null;
  /** Producers currently delivering here — the depot's whole reason to exist. */
  readonly linkedProducers: number;
  readonly occupied: boolean;
  readonly contribution?: Readonly<Record<string, number>>;
  readonly capacity?: Readonly<Record<string, number>>;
  readonly stock?: Readonly<Record<string, number>>;
}

export interface OutpostDetailView {
  readonly kind: "outpost";
  readonly controlRadius: number;
  readonly connectedControlRadius: number | null;
  readonly roadConnected: boolean;
}

export interface MilitaryDetailView {
  readonly kind: "military";
  readonly queue: BarracksQueueSnapshot;
  readonly rallySet: boolean;
  readonly connected: boolean;
  readonly upgrading: boolean;
  /**
   * The whole roster, locked entries included, straight from
   * `BarracksProductionSystem.trainableUnits` — the system that owns the tier
   * gate. §45's reason for showing a locked unit rather than hiding it: seeing
   * that an Archer costs Kışla II is what makes the upgrade read as a decision
   * instead of a surprise. It now appears on the Barracks, which is both where
   * the decision is made and the first moment it can be acted on.
   */
  readonly roster: readonly RosterEntry[];
}

export interface RosterEntry {
  readonly id: string;
  readonly stats: UnitBalanceStats;
  readonly unlocked: boolean;
}

/**
 * The command centre. Not a `PlacedStructure`: it is spawned by the match rather
 * than built, so it has no construction, no footprint cost and no owner to pay.
 */
export interface CenterDetailView {
  readonly kind: "center";
  readonly queue: WorkerQueueSnapshot;
  readonly controlRadius: number;
  readonly workerStats: UnitBalanceStats;
  /** The kingdom's centre-led progression: the one action, its cost, and its state. */
  readonly progression: CenterProgressionView;
}

/**
 * The centre's whole progression surface — the single place the kingdom advances
 * its tier. It exposes exactly one next action ({@link ProgressionSnapshot.nextAction}),
 * be it a level-up or the Town transition, so the panel never has to choose
 * between two competing upgrade buttons.
 */
export interface CenterProgressionView {
  readonly snapshot: ProgressionSnapshot;
  /** How far an in-flight action has run, 0..1 (0 when idle). */
  readonly progress: number;
  /** Building id → label, so the Town action can name what it still waits on. */
  readonly requiredBuildingLabels: ReadonlyMap<string, string>;
  readonly settlementLabel: string;
  readonly townLabel: string;
  /** The owner's live stock, for naming what the next action's cost is short of. */
  readonly stock: Readonly<Record<string, number>>;
}

/**
 * The Market — plan Faz M2. Everything here is quoted state: the rates come
 * from {@link MarketTradeSystem}, which is the only thing allowed to compute
 * them, so the panel cannot print a price the trade would not honour.
 */
export interface MarketDetailView {
  readonly kind: "market";
  readonly trade: MarketTradeSnapshot;
  /** KR-M4: false when the control area under this Market has been taken. */
  readonly connected: boolean;
}

/**
 * The Tapınak's support field. Every number here is read straight off the
 * building's `aura` balance block plus the live count the aura system reached
 * this tick, so the panel cannot advertise protection the simulation is not
 * actually applying.
 */
export interface AuraDetailView {
  readonly kind: "aura";
  readonly radius: number;
  readonly healPerSecond: number;
  /** Absorbed fraction of incoming damage, 0..1. */
  readonly damageResistance: number;
  /** Own units the field reached on the last tick. */
  readonly sustainedUnits: number;
}

/** A completed building with no ongoing job of its own (House, and future kin). */
export interface PassiveDetailView {
  readonly kind: "passive";
  readonly populationCapacity: number;
}

export type StructureDetailView =
  | ConstructionDetailView
  | ProducerDetailView
  | DepotDetailView
  | OutpostDetailView
  | MilitaryDetailView
  | MarketDetailView
  | AuraDetailView
  | PassiveDetailView
  | CenterDetailView;

/**
 * The repair verb's whole state for one building — what it would cost, whether
 * it is already running, and the stock that decides if the player can pay.
 *
 * Held beside `detail` rather than inside it because repair is a property of
 * *being damaged*, not of being a Farm or a Barracks: every completed building
 * offers it under the same rule, and putting it in each detail kind would be the
 * same block written eight times.
 */
export interface StructureRepairView {
  /** Hit points missing right now; the button is absent when this is zero. */
  readonly missingHealth: number;
  /** Price of putting it back, already rounded to whole resources. */
  readonly cost: Readonly<Record<string, number>>;
  /** Worker-seconds of work; a second builder halves the wall-clock time. */
  readonly workerSeconds: number;
  /** True while a paid repair job is open on this building. */
  readonly active: boolean;
  /** 0..1 of the running job's paid-for work; 0 when nothing is running. */
  readonly progress: number;
  /** Workers sent to it, walking or already hammering. */
  readonly workers: number;
  /** The owner's live stock, so a refusal can name what it is short of. */
  readonly stock: Readonly<Record<string, number>>;
}

export interface SelectedStructureView {
  readonly id: number;
  readonly label: string;
  /** Data-owned icon enlarged and cropped by the selection-panel frame. */
  readonly icon?: string | undefined;
  readonly level: number;
  /** Current age family, supplied by the runtime because the UI does not own age state. */
  readonly ageLabel?: string;
  readonly health: number;
  readonly maxHealth: number;
  /** True once the player has clicked "Yık" and the panel is asking to confirm. */
  readonly demolishArmed?: boolean;
  /** True once the player has clicked "İnşaatı İptal Et" on this site. */
  readonly cancelConstructionArmed?: boolean;
  /**
   * Damage repair state. Absent/null for anything that cannot be repaired — an
   * unfinished foundation, an enemy building, or the command centre, which was
   * never bought and so has no build price to charge half of.
   */
  readonly repair?: StructureRepairView | null;
  readonly detail: StructureDetailView;
}

export type RtsSelectionView =
  | { readonly kind: "none" }
  | { readonly kind: "units"; readonly units: readonly SelectedUnitView[] }
  | { readonly kind: "structure"; readonly structure: SelectedStructureView };

/** A timed job the selection is running, rendered as a labelled progress bar. */
export interface SelectionProgress {
  /** What is progressing, e.g. "Lv2 yükseltmesi". */
  readonly label: string;
  /** Fraction complete, 0..1. */
  readonly value: number;
  /** Seconds left, shown next to the label. */
  readonly remainingSeconds: number;
  /**
   * An undo for the job the bar is showing, drawn as a compact ✕ at the end of
   * the bar's own row rather than as another card in the command deck.
   *
   * It rides on the progress bar because that is the only part of the panel that
   * *is* the queue: the deck answers "what can I build", and a cancel card there
   * competed for attention with the produce cards it was meant to correct while
   * pushing the deck wider. Absent when the job cannot be taken back (a kingdom
   * upgrade already spent its cost).
   */
  readonly cancel?: SelectionAction;
}

/** What the panel shows. `lines` is the panel's body, one fact per line. */
export interface SelectionPanelContent {
  readonly title: string;
  readonly summary: string;
  readonly lines: readonly string[];
  /** Buttons the selection offers; empty for anything the player cannot command. */
  readonly actions: readonly SelectionAction[];
  /** Presentation family for a structure with a non-generic command deck. */
  readonly actionLayout?: "compact" | "command-deck" | "market";
  readonly hint: string;
  /** Hover explanation for the panel body; null when there is nothing to resolve. */
  readonly tooltip: string | null;
  /** Visual metadata consumed by the fixed Faz D frame. */
  readonly portrait?: string | null;
  readonly selectionCount?: number;
  readonly health?: { readonly current: number; readonly max: number } | null;
  /** Collapsed type list shown beside a single portrait; layout, not game state. */
  readonly slots?: readonly SelectionSlot[];
  /**
   * A multi-unit selection, as one card per unit type.
   *
   * Present *instead of* the portrait/health/lines frame rather than beside it:
   * a group selection is a different question from a unit selection. One unit
   * asks "what is this and what is it doing", and the panel answers with health,
   * stance and matchup. Several units ask "what did I just grab", and every
   * per-unit fact in that frame becomes a lie the moment the selection is mixed
   * — one health bar for eleven bodies, one stance for two of them, one
   * matchup read off whichever type happened to be most numerous.
   *
   * So the panel switches shape. `RtsSelectionPanel` renders these left to
   * right at portrait size and hides the single-unit frame; see
   * `[data-rts-panel-mode="roster"]`.
   */
  readonly cards?: readonly SelectionUnitCard[];
  /** A running timed job (e.g. a level-up), or null/absent when nothing is timed. */
  readonly progress?: SelectionProgress | null;
}

export interface SelectionSlot {
  readonly label: string;
  readonly icon: string | null;
  readonly count: number;
}

/** One unit type in a group selection: a portrait, its name, and how many. */
export interface SelectionUnitCard extends SelectionSlot {
  readonly typeId: string;
}

/**
 * Action ids. Stable strings rather than an enum so the DOM can carry them in a
 * `data-` attribute and a test can name the button it means.
 */
export const TRAIN_ACTION_PREFIX = "train:";
export const TRAIN_WORKER_ACTION = "train-worker";
export const AGE_UP_ACTION = "age-up";
export const RALLY_ACTION = "rally";
/**
 * Free selected units trapped inside a building footprint — the player's answer
 * to "sıkışıp kalma" that does not cost them the unit. Offered on the unit panel
 * (never the building panel) only while at least one selected unit is trapped,
 * so it is not a standing button on a healthy army.
 */
export const RESCUE_ACTION = "rescue";
/** The centre's in-age level-up (Lv1→2 / Lv2→3); the Town step uses {@link AGE_UP_ACTION}. */
export const CENTER_LEVEL_UP_ACTION = "center-level-up";
export const DEMOLISH_ACTION = "demolish";
/**
 * Send workers to repair a damaged building. Offered only while there is damage
 * to undo, and it toggles: pressing it again while a crew is at work calls the
 * order off. Unlike demolish it needs no confirm step — the mistake it can cause
 * is a refundable payment, not a lost building.
 */
export const REPAIR_ACTION = "repair";
export const CANCEL_CONSTRUCTION_ACTION = "cancel-construction";
/**
 * Take the newest order back off a queue — the counterpart to
 * {@link TRAIN_ACTION_PREFIX} and {@link TRAIN_WORKER_ACTION}.
 *
 * One verb per queue rather than one per unit type, and always the *newest*
 * order: the mistake it exists to undo is an overshoot ("three Okçu, I wanted
 * two"), and the order a player regrets is the one they just added. Repeating
 * the click walks the queue back as far as they like, which is why there is no
 * separate "empty the queue" verb — a bulk button would only add a destructive
 * shortcut, and a confirm step, for something these clicks already do.
 */
export const CANCEL_TRAIN_ACTION = "cancel-train";
export const CANCEL_WORKER_ACTION = "cancel-worker";
export const TRADE_BUY_ACTION_PREFIX = "trade-buy:";
export const TRADE_SELL_ACTION_PREFIX = "trade-sell:";

const ARMOR_CLASS_LABEL: Record<UnitArmorClass, string> = {
  light: "hafif birim",
  heavy: "ağır birim",
  structure: "yapı",
};

const STANCE_LABEL: Record<UnitStance, string> = {
  aggressive: "Serbest",
  hold: "Pozisyonu Koru",
};

const WORKER_JOB_LABEL: Record<WorkerJob, string> = {
  idle: "boşta",
  moving: "yolda",
  building: "inşaatta",
  repairing: "tamirde",
  producing: "üretimde",
  unreachable: "erişemiyor",
};

const PRODUCTION_STATUS_LABEL: Record<EconomyProductionStatus, string> = {
  "awaiting-workers": "İşçi bekliyor",
  "workers-moving": "İşçiler yolda",
  producing: "Üretiyor",
  "buffer-full": "Tampon dolu",
  "missing-resource-node": "Kaynak düğümü yok",
  "missing-forest": "Yakında orman yok",
  "source-depleted": "Kaynak tükendi",
};

const LOGISTICS_LABEL: Record<ProducerLogisticsStatus, string> = {
  linked: "Bağlı",
  "outside-control": "Kontrol Dışı",
  "unlinked-road": "Yol Yok",
  "unlinked-depot": "Depo Yok",
  "unlinked-main-network": "Merkez Ağı Yok",
  "depot-occupied": "Depo İşgal Altında",
};

const LOGISTICS_REASON: Record<ProducerLogisticsStatus, string> = {
  linked: "Bu üretim yapısı, aynı yol ağındaki Depoya bağlı.",
  "outside-control": "Kontrol alanı kaybedildi; Karakolu veya alanı geri alın.",
  "unlinked-road": "Yapı footprint’ine temas eden bir yol hücresi gerekli.",
  "unlinked-depot": "Aynı yol ağında tamamlanmış bir Depo gerekli.",
  "unlinked-main-network": "Yolu, Merkezin başlangıç yol halkasına bağlayın.",
  "depot-occupied": "Bağlı Depo düşman işgali altında; işgali kaldırın.",
};

const WORKER_HINT = "Sağ tık: inşaata veya üretim yapısına ata · X: Görevi bırak";
const ARMY_HINT = "F: Saldırı-Hareket · H: Koru · G: Serbest · X: Dur";
const OUTPOST_HINT = "Sağ tık: menzildeki düşmana saldırı emri ver";

/** Above this an attacker is meaningfully strong; below its mirror, weak. */
const STRONG_MULTIPLIER = 1.1;
const WEAK_MULTIPLIER = 0.9;

/** The panel's whole answer for one selection, including its stable empty frame. */
export function describeSelection(view: RtsSelectionView): SelectionPanelContent {
  if (view.kind === "none") return {
    title: "Seçim yok",
    summary: "Haritada bir birlik veya yapı seçin.",
    lines: [],
    actions: [],
    hint: "Sol tıkla seçin · çift tıkla aynı birlik türünü seçin.",
    tooltip: null,
    portrait: null,
    selectionCount: 0,
    health: null,
  };
  if (view.kind === "units") {
    return view.units.length === 0 ? describeSelection({ kind: "none" }) : describeUnits(view.units);
  }
  return describeStructure(view.structure);
}

/**
 * The "free the trapped" button, or nothing. Returned as a list so the caller
 * can spread it into an actions row that is otherwise empty — a unit's verbs are
 * world gestures, and this is the one command it can carry, present only while
 * there is actually someone to dig out.
 */
function rescueActions(units: readonly SelectedUnitView[]): SelectionAction[] {
  const trapped = units.filter((unit) => unit.trapped).length;
  if (trapped === 0) return [];
  return [{
    id: RESCUE_ACTION,
    label: "Kurtar",
    cost: null,
    enabled: true,
    reason: null,
    hint: `${trapped} birim bir yapının içine sıkışmış; en yakın boş zemine çıkarır.`,
  }];
}

function describeUnits(units: readonly SelectedUnitView[]): SelectionPanelContent {
  // Composition is counted per unit *type*, through the same model the HUD army
  // strip is built from. Two reasons it is not the role it used to be: a role
  // is a fixed four-value enum that a second Guard unit would collapse into the
  // first one's row under the first one's icon, and the panel would then be
  // counting something different from the strip six inches above it. Shared
  // model, shared order — the player learns one reading of "what is this group".
  const roster = describeArmyRoster(units);
  const health = units.reduce((total, unit) => total + unit.health, 0);
  const maxHealth = units.reduce((total, unit) => total + unit.maxHealth, 0);
  const summary = `Can: ${Math.ceil(health)}/${Math.ceil(maxHealth)}`;
  const workersOnly = units.every((unit) => unit.role === "worker");

  // More than one unit: answer "what did I just grab" with a card per type and
  // nothing else. See {@link SelectionPanelContent.cards} for why the per-unit
  // facts are dropped rather than aggregated.
  //
  // No hint row either: the cards *are* the panel, and a keyboard legend under
  // them turns a clean answer back into a wall of text. The verbs it taught are
  // unchanged and still listed under a single selection. The rescue button
  // stays, because it is a verb rather than a fact — a body trapped in a
  // footprint still needs digging out whether it was grabbed alone or in a
  // crowd, and no other surface offers that.
  if (units.length > 1) {
    return {
      title: "",
      summary: "",
      lines: [],
      actions: rescueActions(units),
      hint: "",
      tooltip: null,
      cards: roster.entries.map((entry) => ({
        typeId: entry.typeId,
        label: entry.label,
        icon: entry.icon,
        count: entry.count,
      })),
    };
  }

  // The portrait already identifies a single-type selection and carries its
  // count. Keep this compact strip only when a box selection mixes types, where
  // it is the only short way to explain the group composition.
  const slots = roster.entries.length > 1
    ? roster.entries.map((entry) => ({ label: entry.label, icon: entry.icon, count: entry.count }))
    : [];

  // Which single type the portrait shows. The most numerous *combat* type:
  // workers only describe the selection when it is purely economic, because
  // dragging a box over a mixed group is a question about the army, and
  // answering "İşçi" because five labourers outnumbered four Guards tells the
  // player nothing they wanted. A worker-only selection falls through to the
  // most numerous worker type.
  //
  // Ties fall back to roster order rather than to whichever unit the marquee
  // happened to sweep first — `sort` is stable, so an equal split between two
  // types names the same one every time the player reselects the group.
  const ranked = [...roster.entries].sort((left, right) => right.count - left.count);
  const dominant = ranked.find((entry) => entry.role !== "worker") ?? ranked[0]!;
  const sample = units.find((unit) => unit.stats.id === dominant.typeId)!;

  // The count badge is pinned to the portrait, so it counts what the portrait
  // shows — not the whole selection. Boxing one worker and one Guard used to
  // put a bold "×2" on a Guard portrait, which reads as "two Guards" however
  // carefully the strip below it disagrees. Nothing is lost by scoping it: a
  // single-type selection is unchanged (its type *is* the whole selection), and
  // a mixed one has {@link slots}, which names every type with its own count.
  const selectionCount = dominant.count;

  // A selection of nothing but workers is an economy question, and the army
  // panel has no answer to it: a Worker has no matchup and no stance. §51 lists
  // the worker panel separately for exactly this reason.
  if (workersOnly) {
    return {
      title: "İşçi",
      summary,
      lines: [`Görev: ${jobBreakdown(units)}`],
      // A worker's verbs are all world gestures — right-click to assign, X to
      // drop the job — so the only button it ever carries is the rescue, and
      // only while one of these workers is trapped inside a footprint.
      actions: rescueActions(units),
      hint: WORKER_HINT,
      tooltip: "Boşta bir işçi, oyuncunun oyuna borçlu olduğu bir karardır.",
      portrait: sample.stats.icon ?? null,
      selectionCount,
      health: { current: health, max: maxHealth },
      slots,
    };
  }

  const stances = new Set(units.map((unit) => unit.stance));
  return {
    title: sample.stats.label,
    summary,
    lines: [
      `Duruş: ${stances.size > 1 ? "Karışık" : STANCE_LABEL[[...stances][0] ?? "aggressive"]}`,
      `Komut: ${orderBreakdown(units)}`,
      counterText(sample.stats),
    ],
    // Army verbs are keyboard commands with a world target (F/H/G/X); the hint
    // row already teaches them, and a button cannot take the target anyway. The
    // rescue is the exception — it needs no world target — and appears only when
    // a selected unit is trapped.
    actions: rescueActions(units),
    // Commands remain keyboard-first. Presenting them as flat text rather than
    // button-shaped cards prevents a false promise that a click will issue a
    // ground-target command.
    hint: ARMY_HINT,
    tooltip: null,
    portrait: sample.stats.icon ?? null,
    selectionCount,
    health: { current: health, max: maxHealth },
    slots,
  };
}

function describeStructure(structure: SelectedStructureView): SelectionPanelContent {
  const base = describeStructureDetail(structure);
  if (structure.detail.kind === "construction") {
    return {
      ...base,
      actions: [...base.actions, cancelConstructionAction(structure)],
      portrait: structure.icon ?? null,
      selectionCount: 1,
      health: { current: structure.health, max: structure.maxHealth },
    };
  }
  // Centre-led progression: a building carries no upgrade button of its own — its
  // tier is read-only (shown in the panel title, e.g. "Depo · Kasaba Lv2"), and
  // the whole level/age ladder lives on the Merkez. Only the centre's own panel
  // (built in `describeCenter`) offers a progression action and a progress bar.
  //
  // Demolish sits last on every building panel. The centre reaches here wrapped
  // as a structure (`detail.kind === "center"`), so it is excluded on the detail:
  // razing your own centre is the defeat condition, a thing you lose, not order.
  // Repair sits before demolish: they are the two ends of the same decision
  // ("this building is hurt — save it or clear it"), and the constructive answer
  // should be the one under the player's cursor first.
  const repair = repairAction(structure);
  const actions = [
    ...base.actions,
    ...(repair ? [repair] : []),
    ...(structure.detail.kind === "center" ? [] : [demolishAction(structure)]),
  ];
  return {
    ...base,
    lines: [...base.lines, ...repairLines(structure)],
    actions,
    // Whatever the detail decided is timed — a kingdom upgrade on the centre, a
    // training bar on a producer of units. Deciding it here again would put the
    // panel back in the business of knowing which buildings train things.
    progress: base.progress ?? null,
    portrait: structure.icon ?? null,
    selectionCount: 1,
    health: { current: structure.health, max: structure.maxHealth },
  };
}

/** A foundation has not become a building yet, so cancelling it returns its reservation in full. */
function cancelConstructionAction(structure: SelectedStructureView): SelectionAction {
  if (structure.cancelConstructionArmed) {
    return {
      id: CANCEL_CONSTRUCTION_ACTION,
      label: "İptali Onayla",
      cost: null,
      enabled: true,
      reason: null,
      hint: `${structure.label} şantiyesi kaldırılacak; tüm kaynaklar iade edilecek.`,
    };
  }
  return {
    id: CANCEL_CONSTRUCTION_ACTION,
    label: "İnşaatı İptal Et",
    cost: null,
    enabled: true,
    reason: null,
    hint: "Şantiyeyi kaldırır ve harcanan kaynakları tam iade eder. Onay ister.",
  };
}

/**
 * "Tamir Et", or nothing at all.
 *
 * Nothing is the right answer for an intact building: a permanently visible
 * repair button on a full-health base is a row of dead controls, and the verb
 * only becomes meaningful the moment there is damage to undo — the same moment
 * the world health bar appears over it.
 *
 * While a crew is at work the button turns into its own undo. The refusal it can
 * carry is a price, never a rule: repair is legal on any damaged building the
 * player owns, so the only thing that can stop it is an empty stockpile, and the
 * button says exactly how empty.
 */
function repairAction(structure: SelectedStructureView): SelectionAction | null {
  const repair = structure.repair ?? null;
  if (!repair) return null;
  if (repair.active) {
    return {
      id: REPAIR_ACTION,
      label: "Tamiri Durdur",
      cost: null,
      enabled: true,
      active: true,
      reason: null,
      hint: repair.progress > 0
        ? "Tamir sürüyor. Durdurursanız şu ana kadarki onarım kalır; ödeme geri gelmez."
        : "İşçiler henüz gelmedi; şimdi durdurursanız ödeme tam iade edilir.",
    };
  }
  if (repair.missingHealth <= 0) return null;
  const cost = formatResourceCost(repair.cost);
  const shortfall = formatCostShortfall(repair.cost, repair.stock);
  return {
    id: REPAIR_ACTION,
    label: "Tamir Et",
    cost,
    enabled: shortfall === null,
    reason: shortfall === null ? null : `Kaynak yetersiz: ${shortfall} gerekli.`,
    // Quoted as one worker's time, because that is the number the player can
    // check against the crew they are about to send: two workers halve it.
    hint: `${Math.ceil(repair.missingHealth)} can onarılır · tek işçiyle ${Math.ceil(repair.workerSeconds)} sn.`,
  };
}

/** The running repair as a body line, so the panel says it even without the button. */
function repairLines(structure: SelectedStructureView): string[] {
  const repair = structure.repair ?? null;
  if (!repair?.active) return [];
  return [repair.workers === 0
    ? `Tamir %${Math.floor(repair.progress * 100)} — işçi bekliyor.`
    : `Tamir %${Math.floor(repair.progress * 100)} · ${repair.workers} işçi çalışıyor.`];
}

/**
 * Razing one of your own buildings — the player's counterpart to combat
 * destruction. Offered on every placed building because the reasons to want it
 * are structural rather than per-type: a misplaced building blocking a road, a
 * depot on the wrong side of a front, population freed for a different army.
 *
 * Two-step by design. It is irreversible and refunds nothing, and the button
 * lives in the same row as "produce" and "upgrade" — one stray click next to
 * them should not cost a finished building. The armed state is owned by the
 * runtime and cleared when the selection changes, so it cannot outlive the
 * building it was aimed at.
 *
 * The command centre has no demolish: razing it is the defeat condition, which
 * is a thing you lose, not a thing you order.
 */
function demolishAction(structure: SelectedStructureView): SelectionAction {
  if (structure.demolishArmed) {
    return {
      id: DEMOLISH_ACTION,
      label: "Yıkımı Onayla",
      cost: null,
      enabled: true,
      reason: null,
      hint: `${structure.label} kalıcı olarak yıkılacak. Harcanan kaynaklar geri gelmez.`,
    };
  }
  return {
    id: DEMOLISH_ACTION,
    label: "Yık",
    cost: null,
    enabled: true,
    reason: null,
    hint: "Bu yapıyı kaldırır. Onay ister; kaynak iadesi yoktur.",
  };
}

/** Player-facing name of the tier one centre action produces, e.g. "Kasaba Lv2". */
function tierName(view: CenterProgressionView, age: "settlement" | "town", level: number): string {
  return `${age === "town" ? view.townLabel : view.settlementLabel} Lv${level}`;
}

/**
 * The centre's progression progress bar. Present only while an action is in
 * flight — a completed or idle progression is a button, not a bar — and it names
 * whichever action is running (a level-up or the Town transition).
 */
function centerProgress(view: CenterProgressionView): SelectionProgress | null {
  const { snapshot } = view;
  if (!snapshot.upgrading || !snapshot.nextAction) return null;
  const action = snapshot.nextAction;
  const label = action.kind === "town"
    ? `${view.townLabel} Çağı`
    : `${tierName(view, action.targetAge, action.targetLevel)} yükseltmesi`;
  return { label, value: view.progress, remainingSeconds: snapshot.remainingSeconds };
}

/**
 * The centre's single progression action — the one place the kingdom advances.
 * It is a level-up while below Lv3, the Town transition at Settlement Lv3, and a
 * disabled "top tier" note at Town Lv3. The Town action also names the buildings
 * it still waits on, exactly as the old age button did.
 *
 * A price the wallet cannot meet disables the button, so the level-up and the
 * Town transition read the same way: both fade when their requirement is unmet
 * (buildings for Town, cost for either), rather than the level-up staying lit
 * while a shortfall lives only in the hint. The shortfall still names the number.
 */
function centerProgressionAction(view: CenterProgressionView): SelectionAction {
  const { snapshot } = view;
  const action = snapshot.nextAction;
  if (!action) {
    return {
      id: CENTER_LEVEL_UP_ACTION,
      label: "En Üst Seviyede",
      cost: null,
      enabled: false,
      reason: `Krallık en yüksek kademede (${tierName(view, snapshot.age, snapshot.level)}).`,
    };
  }
  const cost = formatResourceCost(action.cost);
  const shortfall = formatCostShortfall(action.cost, view.stock);
  // A shortfall is what the stock cannot cover, so its presence is the "cannot
  // afford" gate — same flooring the HUD prints, so the button and the wallet agree.
  const unaffordableReason = shortfall ? `Kaynak yetersiz — eksik: ${shortfall}.` : null;
  if (action.kind === "town") {
    const missing = action.missingBuildingIds.map((id) => view.requiredBuildingLabels.get(id) ?? id);
    const reason = snapshot.upgrading
      ? `${view.townLabel} Çağı yükseltmesi sürüyor (${Math.ceil(snapshot.remainingSeconds)} sn).`
      : missing.length > 0
        ? `Önce şu yapılar gerekir: ${missing.join(", ")}.`
        : unaffordableReason;
    return {
      id: AGE_UP_ACTION,
      label: `${view.townLabel} Çağına Geç`,
      cost,
      enabled: reason === null,
      active: snapshot.upgrading,
      reason,
      hint: shortfall ? `Eksik: ${shortfall}. Toplam maliyet: ${cost}.` : `Maliyet: ${cost}.`,
    };
  }
  const targetLabel = tierName(view, action.targetAge, action.targetLevel);
  const reason = snapshot.upgrading
    ? `${targetLabel} yükseltmesi sürüyor (${Math.ceil(snapshot.remainingSeconds)} sn).`
    : unaffordableReason;
  return {
    id: CENTER_LEVEL_UP_ACTION,
    label: `${targetLabel}'ye Yükselt`,
    cost,
    enabled: reason === null,
    active: snapshot.upgrading,
    reason,
    hint: shortfall
      ? `Tüm yapılar ${targetLabel} olur. Eksik: ${shortfall}.`
      : `Tüm yapılar ${targetLabel} olur. Maliyet: ${cost}.`,
  };
}

function describeStructureDetail(structure: SelectedStructureView): SelectionPanelContent {
  const { detail } = structure;
  const summary = `Can: ${Math.ceil(structure.health)}/${Math.ceil(structure.maxHealth)}`;
  const title = structure.ageLabel
    ? `${structure.label} · ${structure.ageLabel} Lv${structure.level}`
    : structure.level > 1 ? `${structure.label} Lv${structure.level}` : structure.label;
  switch (detail.kind) {
    case "construction":
      return {
        title,
        summary,
        lines: [
          `İnşaat: %${Math.floor(detail.progress * 100)}`,
          detail.assignedWorkers === 0
            ? "İşçi yok — inşaat durdu."
            : `${detail.assignedWorkers} işçi çalışıyor.`,
        ],
        actions: [],
        hint: "",
        tooltip: detail.assignedWorkers === 0
          ? "Bir işçi seçip bu şantiyeye sağ tıklayın; işçisiz şantiye ilerlemez."
          : "Daha fazla işçi atamak inşaatı doğrusal olarak hızlandırır.",
      };
    case "producer":
      return describeProducer(title, summary, detail);
    case "depot":
      return {
        title,
        summary,
        lines: [
          `Yol: ${detail.status === "linked"
            ? "Merkez ağına bağlı"
            : detail.status === "unlinked-main-network"
              ? "Merkez ağına bağlı değil"
              : "yok"}`,
          `Teslim eden yapı: ${detail.linkedProducers}`,
          ...(detail.occupied ? ["Düşman işgali altında — teslimat durdu."] : []),
        ],
        actions: [],
        hint: "",
        tooltip: detail.occupied
          ? "İşgali kaldırmadan bu Depoya bağlı üreticiler global stoğa aktaramaz."
          : detail.status === "linked"
            ? "Bu Depo, Merkeze bağlı yol ağındaki üreticilerin çıktısını global stoğa aktarır ve kapasite ekler."
            : detail.status === "unlinked-main-network"
              ? "Depo yola bağlı, ancak bu yol Merkezin başlangıç halkasına ulaşmıyor."
              : "Depo footprint’ine temas eden bir yol hücresi kurun.",
      };
    case "outpost":
      return {
        title,
        summary,
        lines: [
          `Kontrol yarıçapı: ${detail.roadConnected && detail.connectedControlRadius !== null
            ? detail.connectedControlRadius
            : detail.controlRadius}`,
          detail.roadConnected
            ? "Merkez yol ağına bağlı — tam alan açık."
            : "Yol bağlantısı yok — yalnız küçük alan açık.",
        ],
        actions: [],
        hint: OUTPOST_HINT,
        // "yerine" rather than a number + case suffix: Turkish suffixes follow
        // the vowel of the *spoken* number (16 → "16’dan", 20 → "20’ye"), which
        // a template cannot pick for a value it does not know at build time.
        tooltip: detail.roadConnected
          ? "Karakol yıkılırsa açtığı alan kapanır; alandaki yapılar yerinde kalır."
          : `Merkeze yol çekin: bağlantı, kontrol yarıçapını ${detail.controlRadius} yerine ${detail.connectedControlRadius ?? detail.controlRadius} yapar.`,
      };
    case "military":
      return describeMilitary(title, summary, detail);
    case "market":
      return describeMarket(title, summary, detail);
    case "center":
      return describeCenter(title, summary, detail);
    case "aura":
      return {
        title,
        summary,
        lines: [
          `Etki alanı: ${detail.radius} birim yarıçap`,
          `İyileştirme: saniyede ${detail.healPerSecond} can`,
          `Hasar direnci: %${Math.round(detail.damageResistance * 100)}`,
          detail.sustainedUnits > 0
            ? `Alan içinde ${detail.sustainedUnits} birim korunuyor.`
            : "Alanda birim yok.",
        ],
        actions: [],
        hint: "",
        tooltip: "Alandaki kendi birimleriniz sürekli iyileşir ve aldıkları hasar azalır;"
          + " üst üste binen tapınaklar toplanmaz, en güçlü etki geçerlidir.",
      };
    case "passive":
      return {
        title,
        summary,
        lines: detail.populationCapacity > 0
          ? [`Nüfus kapasitesi: +${detail.populationCapacity}`]
          : ["Pasif yapı."],
        actions: [],
        hint: "",
        tooltip: null,
      };
  }
}

function describeCenter(
  title: string,
  summary: string,
  detail: CenterDetailView,
): SelectionPanelContent {
  const { queue, progression } = detail;
  const { snapshot } = progression;
  // Only the Town transition pauses the centre's worker queue (plan §4); a plain
  // level-up leaves it running, so worker production is refused only then.
  const townUpgrading = snapshot.upgrading && snapshot.upgradeKind === "town";
  return {
    title,
    summary,
    lines: [
      `Kuyruk: ${queue.queued}/${queue.capacity}`,
      // Same rule as the Barracks: the bar below states what is training and for
      // how long, except while an upgrade owns the bar — then the queue is either
      // paused or unshown, and the prose has to carry it.
      ...(queue.trainingRemainingSeconds === null
        ? ["Üretim yok."]
        : snapshot.upgrading
          ? [`Üretiliyor: ${detail.workerStats.label} — ${Math.ceil(queue.trainingRemainingSeconds)} sn`]
          : []),
      `Kademe: ${tierName(progression, snapshot.age, snapshot.level)}${snapshot.upgrading ? " (yükseltiliyor)" : ""}`,
      `Kontrol yarıçapı: ${detail.controlRadius}`,
    ],
    actions: [
      {
        id: TRAIN_WORKER_ACTION,
        label: `${detail.workerStats.label} Üret`,
        cost: `${formatResourceCost(detail.workerStats.cost)} · ${detail.workerStats.populationCost} Nüfus`,
        // The centre's own gates only. Cost and population are checked when the
        // order is placed and answered with a message: pre-computing them here
        // would restate two systems' rules and could disagree with them.
        enabled: !townUpgrading,
        active: queue.queued > 0,
        reason: townUpgrading ? `${progression.townLabel} Çağı yükseltmesi sürerken Merkez üretim yapamaz.` : null,
      },
      centerProgressionAction(progression),
    ],
    actionLayout: "compact",
    // One bar, two candidate jobs. A kingdom upgrade outranks the worker queue
    // because it is the rarer, longer and unrepeatable one — and while a *Town*
    // upgrade runs the queue is paused anyway, so a worker bar there would sit
    // frozen. The cost is that the worker cancel is out of reach for the length
    // of an upgrade; the orders keep their reservation and the ✕ returns with it.
    progress: centerProgress(progression) ?? workerTrainingProgress(detail),
    hint: "",
    tooltip: snapshot.upgrading
      ? "Yükseltme tamamlanınca Merkez etkileri tüm yapılara uygulanır."
      : "Merkez işçi üretir, krallığın kademesini yükseltir ve kontrol alanının çekirdeğidir.",
  };
}

/** The centre's training bar, carrying the same ✕ the Barracks' bar does. */
function workerTrainingProgress(detail: CenterDetailView): SelectionProgress | null {
  const { queue } = detail;
  const remaining = queue.trainingRemainingSeconds;
  const duration = queue.trainingDurationSeconds;
  if (remaining === null || duration === null || !Number.isFinite(duration) || duration <= 0) return null;
  return {
    label: `${detail.workerStats.label} üretiliyor`,
    value: 1 - Math.min(1, Math.max(0, remaining / duration)),
    remainingSeconds: remaining,
    cancel: cancelQueueAction(CANCEL_WORKER_ACTION, detail.workerStats.label),
  };
}

function describeProducer(
  title: string,
  summary: string,
  detail: ProducerDetailView,
): SelectionPanelContent {
  const { production, logistics } = detail;
  return {
    title,
    summary,
    lines: [
      `İşçiler: ${production.assignedWorkers}/${production.workerCapacity} (${production.workingWorkers} çalışıyor)`,
      `Üretim: ${production.productionPerMinute.toFixed(1)} ${resourceLabel(production.resourceId)}/dk`,
      `Yerel tampon: ${production.localBuffer.toFixed(1)}/${production.localBufferCapacity}`,
      ...(production.sourceRemaining === null
        ? []
        : [`Düğüm: ${production.sourceRemaining.toFixed(1)} kaldı`]),
      `Durum: ${PRODUCTION_STATUS_LABEL[production.status]}`,
      `Lojistik: ${logistics ? LOGISTICS_LABEL[logistics] : "Bekleniyor"}`,
    ],
    // Staffing a producer is a world gesture (select workers, right-click it),
    // so there is no verb here a button could carry.
    actions: [],
    hint: "",
    tooltip: logistics
      ? LOGISTICS_REASON[logistics]
      : "Yapı tamamlanınca lojistik bağlantısı hesaplanır.",
  };
}

function describeMilitary(
  title: string,
  summary: string,
  detail: MilitaryDetailView,
): SelectionPanelContent {
  const { queue } = detail;
  return {
    title,
    summary,
    lines: [
      `Kuyruk: ${queue.queued}/${queue.capacity}`,
      // What is training, and how long it has left, is the progress bar's line
      // now — repeating it as prose directly above the bar said it twice. The
      // pending roll-call went with it: "Kuyruk: 3/5" already carries how much
      // is waiting, and naming each order made the longest line in the panel out
      // of the least actionable fact.
      ...(queue.trainingLabel === null ? ["Üretim yok."] : []),
      `Toplanma noktası: ${detail.rallySet ? "belirlendi" : "yok"}`,
      // The two things that stop a Barracks silently. Only shown when true: a
      // healthy Barracks does not need a line saying nothing is wrong with it.
      ...(detail.upgrading ? ["Seviye yükseltmesi sürüyor — üretim duraklatıldı."] : []),
      ...(detail.connected ? [] : ["Kontrol Dışı — bu Kışla birlik üretemez."]),
    ],
    actions: [
      ...detail.roster.map((entry) => trainAction(entry, detail)),
      {
        id: RALLY_ACTION,
        label: "Toplanma Noktası",
        cost: null,
        enabled: true,
        reason: null,
      },
    ],
    actionLayout: "command-deck",
    progress: trainingProgress(queue),
    hint: "",
    tooltip: !detail.connected
      ? "Kontrol alanı kaybedilen askerî yapı üretim yapamaz; alanı geri alın."
      : detail.upgrading
        ? "Yükseltme tamamlanınca kuyruk kaldığı yerden devam eder."
        : "Yeni birlikler Toplanma Noktasına yürür.",
  };
}

/**
 * The Market panel — plan Faz M2 ("güncel al/sat fiyatları, endeks göstergesi,
 * 6 buton").
 *
 * One row per tradable resource carries both rates and the index, because the
 * decision the market exists to create ("sell now, or wait for the price to
 * recover?") cannot be made from a price alone: 128 gold means nothing without
 * knowing it started at 115 and is climbing. The index is shown as a multiplier
 * (×1.20) rather than a percentage — it is literally what the base price is
 * multiplied by, and a percentage would invite reading it as a change.
 *
 * The gap between the buy and sell price is the house's commission and is
 * stated outright: a player who does not know why buying back what they just
 * sold loses money will read it as a bug rather than the rule that stops the
 * market minting gold (§4.3).
 */
function describeMarket(
  title: string,
  summary: string,
  detail: MarketDetailView,
): SelectionPanelContent {
  const { trade } = detail;
  const commissionPercent = Math.round(trade.commission * 100);
  return {
    title,
    summary,
    lines: [
      `Lot: ${trade.lotSize} birim · komisyon %${commissionPercent}`,
      detail.connected
        ? "Fiyat ve endeks, aşağıdaki Al/Sat kartlarında."
        : "Kontrol Dışı — bu Pazar ticaret yapamaz.",
    ],
    actions: trade.prices.flatMap((price) => [
      tradeAction("buy", price.resourceId, price.buyPrice, trade.lotSize, price.index, detail.connected),
      tradeAction("sell", price.resourceId, price.sellPrice, trade.lotSize, price.index, detail.connected),
    ]),
    actionLayout: "market",
    hint: "",
    tooltip: detail.connected
      ? "Alım fiyatı yükseltir, satım düşürür. Komisyon yüzünden anlık al-sat her zaman zarardır."
      : "Kontrol alanı kaybedilen Pazar ticaret yapamaz; alanı geri alın.",
  };
}

/**
 * One trade button. Only the control gate is decided here — that rule is a fact
 * the trade system already handed over. Whether the player can *afford* it is
 * deliberately left to the click, exactly as the age and worker buttons leave
 * it: stock moves every tick, and a button that greys out from under a reaching
 * hand is worse than one that answers with a reason.
 */
function tradeAction(
  direction: "buy" | "sell",
  resourceId: string,
  price: number,
  lotSize: number,
  index: number,
  connected: boolean,
): SelectionAction {
  const buying = direction === "buy";
  const goldLabel = resourceLabel("gold");
  return {
    id: `${buying ? TRADE_BUY_ACTION_PREFIX : TRADE_SELL_ACTION_PREFIX}${resourceId}`,
    label: `${lotSize} ${resourceLabel(resourceId)} ${buying ? "Al" : "Sat"}`,
    // Signed against the player's gold, so the two directions cannot be
    // mistaken for each other at a glance.
    cost: `${buying ? "-" : "+"}${price} ${goldLabel}`,
    enabled: connected,
    reason: connected ? null : "Kontrol Dışı: bu Pazar ticaret yapamaz.",
    hint: `${resourceLabel(resourceId)} endeksi ×${index.toFixed(2)}. ${buying ? "Alım" : "Satım"} fiyatı: ${price} ${goldLabel}.`,
  };
}

/**
 * The military building's training bar, with its own undo attached.
 *
 * Absent while nothing trains: an idle Barracks has no timed job, and a bar at
 * zero would read as a stalled one. The bar names the unit *in production*; the
 * cancel takes the *newest* order, which is usually a different one — so the
 * button says which, rather than letting the bar's label imply it.
 */
function trainingProgress(queue: BarracksQueueSnapshot): SelectionProgress | null {
  const remaining = queue.trainingRemainingSeconds;
  const duration = queue.trainingDurationSeconds;
  if (remaining === null || duration === null || !Number.isFinite(duration) || duration <= 0) return null;
  const newest = queue.pendingLabels.at(-1) ?? queue.trainingLabel ?? "sipariş";
  return {
    // The queue count stays a body line rather than being repeated here: an
    // upgrade can take this bar away from the queue, and the count must not
    // vanish with it.
    label: `${queue.trainingLabel ?? "Birlik"} üretiliyor`,
    value: 1 - Math.min(1, Math.max(0, remaining / duration)),
    remainingSeconds: remaining,
    cancel: cancelQueueAction(CANCEL_TRAIN_ACTION, newest),
  };
}

/**
 * The ✕ beside a training bar. Never disabled, and deliberately not gated on a
 * lost control area or an in-flight upgrade: those stop *training*, and a player
 * whose ground was taken mid-queue is exactly who needs their stone back —
 * refusing the refund because the building is in trouble punishes them twice.
 */
function cancelQueueAction(id: string, newestLabel: string): SelectionAction {
  return {
    id,
    label: `Son siparişi iptal et: ${newestLabel}`,
    cost: null,
    enabled: true,
    reason: null,
    hint: `Kuyruktaki en son siparişi (${newestLabel}) iptal eder; maliyeti tam iade edilir.`,
  };
}

/**
 * One roster button. The refusal order matters and mirrors
 * `BarracksProductionSystem.queueUnit`: the tier gate is reported before
 * anything else, so a player who cannot build the unit *at all* is told that
 * rather than being told their ground was taken.
 */
function trainAction(entry: RosterEntry, detail: MilitaryDetailView): SelectionAction {
  const full = detail.queue.queued >= detail.queue.capacity;
  const buildingLabel = entry.stats.productionBuildingId === "archery_range" ? "Okçuluk Alanı" : "Kışla";
  // The gate is the kingdom's global centre tier, not this building's level: a
  // pure age gate (Lv1) reads "… Çağında açılır"; a higher tier names the level.
  const reqAgeLabel = entry.stats.requiredAge === "town" ? "Kasaba" : "Yerleşim";
  const reason = !entry.unlocked
    ? entry.stats.requiredSettlementLevel <= 1
      ? `${entry.stats.label} ${reqAgeLabel} Çağında açılır.`
      : `${entry.stats.label} için ${reqAgeLabel} Lv${entry.stats.requiredSettlementLevel} gerekir.`
    : !detail.connected
      ? `Kontrol Dışı: bu ${buildingLabel} birlik üretemez.`
      : detail.upgrading
        ? "Seviye yükseltmesi sürerken kuyruk duraklatıldı."
        : full
          ? `Kuyruk dolu (${detail.queue.queued}/${detail.queue.capacity}).`
          : null;
  return {
    id: `${TRAIN_ACTION_PREFIX}${entry.id}`,
    label: `${entry.stats.label} Üret`,
    cost: `${formatResourceCost(entry.stats.cost)} · ${entry.stats.populationCost} Nüfus`,
    enabled: reason === null,
    reason,
  };
}

function jobBreakdown(units: readonly SelectedUnitView[]): string {
  const counts = new Map<WorkerJob, number>();
  for (const unit of units) {
    const job = unit.job ?? "idle";
    counts.set(job, (counts.get(job) ?? 0) + 1);
  }
  // Fixed order, not insertion order: the same selection must read the same way
  // twice, and a breakdown that reshuffles as workers change job is unreadable.
  const order: readonly WorkerJob[] = ["idle", "moving", "building", "repairing", "producing", "unreachable"];
  return order
    .filter((job) => (counts.get(job) ?? 0) > 0)
    .map((job) => `${counts.get(job)} ${WORKER_JOB_LABEL[job]}`)
    .join(" · ");
}

const UNIT_ORDER_LABEL: Record<UnitOrder, string> = {
  idle: "Bekliyor",
  moving: "Hareket ediyor",
  attacking: "Saldırıyor",
  "attack-moving": "Saldırı-hareket",
};

/** A mixed group must not claim every unit is following the first unit's order. */
function orderBreakdown(units: readonly SelectedUnitView[]): string {
  const orders = new Set(units.map((unit) => unit.order ?? "idle"));
  if (orders.size !== 1) return "Karışık";
  return UNIT_ORDER_LABEL[[...orders][0] ?? "idle"];
}


/** Read the §33 row straight off the unit's data rather than restating it. */
function counterText(stats: UnitBalanceStats): string {
  const entries = Object.entries(stats.damageMultipliers) as [UnitArmorClass, number][];
  const strong = entries.filter(([, value]) => value >= STRONG_MULTIPLIER).map(([key]) => ARMOR_CLASS_LABEL[key]);
  const weak = entries.filter(([, value]) => value <= WEAK_MULTIPLIER).map(([key]) => ARMOR_CLASS_LABEL[key]);
  return [
    strong.length > 0 ? `Güçlü: ${strong.join(", ")}` : null,
    weak.length > 0 ? `Zayıf: ${weak.join(", ")}` : null,
  ].filter((part): part is string => part !== null).join(" · ") || "Dengeli hasar.";
}
