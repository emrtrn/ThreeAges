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
import type { ProducerLogisticsStatus, ProducerTransport } from "../economy/productionLogisticsSystem";
import type { DepotNodeStatus } from "../economy/depotLogisticsSystem";
import type { CaravanSnapshot } from "../logistics/caravanSystem";
import type { BarracksQueueSnapshot } from "../structures/barracksProductionSystem";
import type { WorkerQueueSnapshot } from "../structures/workerProductionSystem";
import type { ProgressionSnapshot } from "../progression/kingdomProgressionSystem";
import type { MarketTradeSnapshot } from "../economy/marketTradeSystem";
import type { MarketSupplyLine, MarketSupplyState } from "../economy/marketSupplySystem";
import { localizedList, t } from "../../localization/LocalizationService";
import { commandKeyLabel } from "../input/rtsInput";
import { formatCostShortfall, formatResourceCost, resourceLabel } from "./resourceLabels";
import { describeArmyRoster } from "./rtsArmyRosterView";
import {
  DEFAULT_RTS_FORMATION,
  RTS_FORMATION_DEFINITIONS,
  type RtsFormationId,
} from "../units/formations/rtsFormationTypes";

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

/** The global formation preference presented for a selected combat group. */
export interface FormationSelectionView {
  readonly active: RtsFormationId;
}

/** A live, player-commandable workplace offered beside a worker group. */
export interface WorkerAssignmentTarget {
  readonly structureId: number;
  readonly label: string;
  /** Existing building artwork; null keeps the card's framed fallback. */
  readonly icon: string | null;
  readonly assignedWorkers: number;
  readonly workerCapacity: number;
  /** Runtime-owned command routed through the panel's ordinary action seam. */
  readonly actionId: string;
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
  /** Direct local delivery has no donkey lane. */
  readonly transport: ProducerTransport | null;
  /** The automatic donkey, if this producer currently has a linked road. */
  readonly caravan: CaravanSnapshot | null;
  /** True when the global resource store has no capacity for the next load. */
  readonly caravanStorageFull: boolean;
  /**
   * Present only on a pasture. Its crew are shepherds — they leave to fetch
   * animals rather than standing at the building — so "İşçiler: 0/2" would be
   * both true and useless there: the number that says whether the pasture is
   * working is how full the pen is.
   */
  readonly livestock?: {
    readonly pennedAnimals: number;
    readonly livestockCapacity: number;
    readonly shepherds: number;
  } | null;
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
  /**
   * What this training building is called, from the balance data.
   *
   * Carried rather than derived, because the refusal names it: the panel used to
   * pick between two hardcoded names by production id, so a fork that added a
   * third training building would have had its Stables tell the player it was a
   * Barracks.
   */
  readonly buildingLabel: string;
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
  /**
   * Where each stocked resource's goods are coming from — supply plan Faz S5.
   *
   * The empty list is the honest reading of a project with no supply chain at
   * all, and it leaves the panel exactly as Faz S1 left it: a resource with no
   * line here keeps the generic "draw a road to a trade site" advice, because
   * that is all that can truthfully be said about it.
   */
  readonly supply: readonly MarketSupplyLine[];
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

/**
 * A selected trade site — supply plan Faz S6 ("kime ait, tamponu ne, kaç eşek
 * yolda").
 *
 * Not a {@link SelectedStructureView}, and the differences are all the ways a
 * site is not a building (KARAR 3-A): it is authored rather than built, so it
 * has no construction, no health, no owner who paid for it, and **no actions at
 * all** — the single decision it offers is made somewhere else entirely, with
 * the road tool. It is the deposit's sibling, promoted to something the panel
 * can talk about because unlike a deposit it has a *state* worth reading.
 *
 * The two nullable fields are the fog line, and they are nullable rather than
 * zero for the reason the Market's stock record is keyed rather than defaulted:
 * "a rival holds this and I cannot see inside it" must not render as "it is
 * empty". A site's buffer and its fleet are its holder's business — the same
 * rule that keeps an enemy Barracks from showing the player its queue.
 */
export interface SelectedTradeSiteView {
  readonly siteId: string;
  readonly label: string;
  /** Panel artwork from the site's balance row; absent leaves the frame empty. */
  readonly icon?: string | undefined;
  readonly resourceId: string;
  /** Faz S5's reading, from the observing kingdom's point of view. */
  readonly state: MarketSupplyState;
  /** Whose it is: the observer's, somebody else's, or nobody's. */
  readonly holder: "self" | "rival" | null;
  /** Output rate from `trade-sites.json`; an authored fact, so always shown. */
  readonly perMinute: number;
  readonly bufferCapacity: number;
  /** Goods waiting here — null unless the observer holds the site. */
  readonly buffered: number | null;
  /** Animals on this lane right now — null unless the observer holds the site. */
  readonly caravansOnRoad: number | null;
  /** The fleet size the site's balance row asks for. */
  readonly caravanCount: number;
}

export type RtsSelectionView =
  | { readonly kind: "none" }
  | {
    readonly kind: "units";
    readonly units: readonly SelectedUnitView[];
    /** Omitted by callers that only need the legacy selection readout. */
    readonly formation?: FormationSelectionView;
    /** Workplaces with open capacity, present for an explicitly held worker group. */
    readonly workerAssignments?: readonly WorkerAssignmentTarget[];
  }
  | { readonly kind: "structure"; readonly structure: SelectedStructureView }
  | { readonly kind: "trade-site"; readonly site: SelectedTradeSiteView };

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
  /**
   * Status badges shown as one strip under {@link lines}. Absent or empty for a
   * selection with no finite states worth scanning — a House, an army.
   *
   * See {@link SelectionChip} for why these are not simply more lines.
   */
  readonly chips?: readonly SelectionChip[];
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
  /** Multi-combat selection's V1 formation picker. No movement effect in Faz 1. */
  readonly formation?: SelectionFormationControls;
  /** Worker-only group selection's direct workplace cards. */
  readonly workerAssignments?: readonly WorkerAssignmentTarget[];
  /** A running timed job (e.g. a level-up), or null/absent when nothing is timed. */
  readonly progress?: SelectionProgress | null;
}

/**
 * How a chip reads at a glance. Four values rather than a boolean because the
 * question a status chip answers is not "on or off": a producer staffed 2/3 is
 * neither working nor broken, and painting it the same red as a severed road
 * would teach the player to stop trusting the colour.
 */
export type SelectionChipTone = "good" | "warn" | "bad" | "neutral";

/**
 * A compact status badge — a glyph, a short value, and a tone.
 *
 * The panel's body lines carry two different kinds of fact in the same
 * typeface: *measurements* that move continuously (production per minute, node
 * remaining, buffer) and *states* drawn from a small finite set (staffed or
 * not, road linked or not, which leg the caravan is on). The player reads the
 * first kind and scans the second, and printing both as `Etiket: değer`
 * sentences made a producer eight lines long — past the six the two-column body
 * can hold, so the grid opened a third column and clipped it.
 *
 * A chip is the second kind given its own shape. Nothing is lost by the
 * shortening: {@link tooltip} carries the sentence the chip stands in for,
 * which is where the §52 "bir yapı çalışmadığında nedeni gösteriliyor" criteria
 * still lives — and, being plain data like {@link SelectionPanelContent.lines},
 * `test:engine` can still hold that text to account without a browser.
 *
 * The icons are literal emoji for now, deliberately: the visual pass that
 * replaces them with the panel's own gold-on-parchment glyph set is a separate
 * job, and it only has to touch {@link CHIP_ICON}.
 */
export interface SelectionChip {
  /** Stable id, so a test (and the DOM) can name the chip it means. */
  readonly id: string;
  readonly icon: string;
  /** The short reading, e.g. "3/3" or "Bağlı". Never a full sentence. */
  readonly value: string;
  readonly tone: SelectionChipTone;
  /** The sentence the chip replaced; its tooltip and its accessible name. */
  readonly tooltip: string;
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

/** One button in the V1 formation module; the panel only renders this data. */
export interface SelectionFormationOption {
  readonly id: RtsFormationId;
  readonly label: string;
  readonly enabled: boolean;
  readonly tooltip: string;
  readonly iconDots: readonly (readonly [number, number])[];
}

/** Formation UI is present only for a multi-unit combat selection. */
export interface SelectionFormationControls {
  readonly active: RtsFormationId;
  readonly combatUnitCount: number;
  readonly options: readonly SelectionFormationOption[];
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
/** A worker-group card command; suffix is the target structure's runtime id. */
export const WORKER_ASSIGNMENT_ACTION_PREFIX = "assign-workers:";

// Key tables, not text: every one of these is built when the module loads,
// which is before a locale exists and before a language change can be heard.
// The sentence is resolved where it is shown (Plan §13).
const ARMOR_CLASS_KEY: Record<UnitArmorClass, string> = {
  light: "unit.armor_class.light",
  heavy: "unit.armor_class.heavy",
  structure: "unit.armor_class.structure",
};

/**
 * Exported so the story card's key hint can name a stance in exactly the words
 * the unit panel uses. Two spellings of "Pozisyonu Koru" would read as two
 * different orders to the player being taught the first one.
 */
export const STANCE_KEY: Record<UnitStance, string> = {
  aggressive: "unit.stance.aggressive",
  hold: "unit.stance.hold",
};

/** The stance in the player's language — the words the unit panel itself uses. */
export function stanceLabel(stance: UnitStance): string {
  return t(STANCE_KEY[stance]);
}

const WORKER_JOB_KEY: Record<WorkerJob, string> = {
  idle: "unit.job.idle",
  moving: "unit.job.moving",
  building: "unit.job.building",
  repairing: "unit.job.repairing",
  producing: "unit.job.producing",
  unreachable: "unit.job.unreachable",
};

const PRODUCTION_STATUS_KEY: Record<EconomyProductionStatus, string> = {
  "awaiting-workers": "selection.production.status.awaiting_workers",
  "workers-moving": "selection.production.status.workers_moving",
  producing: "selection.production.status.producing",
  "buffer-full": "selection.production.status.buffer_full",
  "missing-resource-node": "selection.production.status.missing_resource_node",
  "missing-forest": "selection.production.status.missing_forest",
  "missing-game": "selection.production.status.missing_game",
  "missing-livestock": "selection.production.status.missing_livestock",
  "source-depleted": "selection.production.status.source_depleted",
};

const LOGISTICS_KEY: Record<ProducerLogisticsStatus, string> = {
  linked: "selection.logistics.status.linked",
  "outside-control": "selection.logistics.status.outside_control",
  "unlinked-road": "selection.logistics.status.unlinked_road",
  "unlinked-depot": "selection.logistics.status.unlinked_depot",
  "unlinked-main-network": "selection.logistics.status.unlinked_main_network",
  "depot-occupied": "selection.logistics.status.depot_occupied",
};

/**
 * Every glyph the chip strip can draw, in one place.
 *
 * One map rather than literals at each call site, for the reason chips exist at
 * all: the same state must look the same on every building. A road link reads 🔗
 * on a Farm, a Depot, an Outpost and a Barracks, so a player who learns it once
 * has learned it everywhere — and the visual pass that swaps emoji for authored
 * artwork changes this map and nothing else.
 */
const CHIP_ICON = {
  workers: "👷",
  livestock: "🐑",
  logistics: "🔗",
  caravan: "🐴",
  warning: "⚠",
  siege: "⚔",
  delivery: "📦",
  rally: "🚩",
  repair: "🔨",
} as const;

/**
 * How loudly each production stop reads.
 *
 * The split is "the building is waiting" versus "the building is stuck": a
 * buffer that filled or a crew still walking clears itself in seconds, while a
 * depleted node or a missing forest needs the player to go and do something
 * about it. Painting both red would spend the alarm colour on the state that
 * does not need it.
 */
const PRODUCTION_STATUS_TONE: Record<EconomyProductionStatus, SelectionChipTone> = {
  "awaiting-workers": "warn",
  "workers-moving": "neutral",
  producing: "good",
  "buffer-full": "warn",
  "missing-resource-node": "bad",
  "missing-forest": "bad",
  "missing-game": "bad",
  "missing-livestock": "bad",
  "source-depleted": "bad",
};

const LOGISTICS_REASON_KEY: Record<ProducerLogisticsStatus, string> = {
  linked: "selection.logistics.reason.linked",
  "outside-control": "selection.logistics.reason.outside_control",
  "unlinked-road": "selection.logistics.reason.unlinked_road",
  "unlinked-depot": "selection.logistics.reason.unlinked_depot",
  "unlinked-main-network": "selection.logistics.reason.unlinked_main_network",
  "depot-occupied": "selection.logistics.reason.depot_occupied",
};

/**
 * The command hints, with their letters taken from the binding table.
 *
 * The letters used to be written into the sentence, so rebinding a command made
 * the hint lie in every language at once (inventory §7.6). `commandKeyLabel` is
 * the same source the key handler reads, and an unbound command shows a dash
 * rather than "undefined".
 */
function commandKey(command: Parameters<typeof commandKeyLabel>[0]): string {
  return commandKeyLabel(command) ?? "—";
}

function workerHint(): string {
  return t("selection.hint.worker", { stop: commandKey("stop") });
}

function armyHint(): string {
  return t("selection.hint.army", {
    attackMove: commandKey("attackMove"),
    retreat: commandKey("retreat"),
    hold: commandKey("hold"),
    aggressive: commandKey("aggressive"),
    stop: commandKey("stop"),
  });
}

/** Above this an attacker is meaningfully strong; below its mirror, weak. */
const STRONG_MULTIPLIER = 1.1;
const WEAK_MULTIPLIER = 0.9;

/** The panel's whole answer for one selection, including its stable empty frame. */
export function describeSelection(view: RtsSelectionView): SelectionPanelContent {
  if (view.kind === "none") return {
    title: t("selection.empty.title"),
    summary: t("selection.empty.summary"),
    lines: [],
    actions: [],
    hint: t("selection.empty.hint"),
    tooltip: null,
    portrait: null,
    selectionCount: 0,
    health: null,
  };
  if (view.kind === "units") {
    return view.units.length === 0
      ? describeSelection({ kind: "none" })
      : describeUnits(view.units, view.formation, view.workerAssignments);
  }
  if (view.kind === "trade-site") return describeTradeSite(view.site);
  return describeStructure(view.structure);
}

/**
 * The trade site panel — supply plan Faz S6.
 *
 * Answers the plan's three questions in the order a player asks them: whose is
 * it, is it filling, and is anything moving. Everything below that ordering is a
 * consequence of one fact — **there is nothing to command here**. A site is
 * never built, never repaired, never demolished and hires nobody (KARAR 3-A), so
 * the panel carries no actions and its hint has to say where the decision
 * actually lives, or an empty command deck reads as a bug rather than as the
 * rule.
 *
 * No health bar for the same reason: a site cannot be hurt, and an empty bar is
 * more honest than a full one that never moves. The portrait is the exception —
 * it identifies *which* of the three sites this is, which is a question the
 * player asks the moment a supply notification names one, so it is shown when
 * the balance row authors artwork and left empty when it does not.
 */
function describeTradeSite(site: SelectedTradeSiteView): SelectionPanelContent {
  const resource = resourceLabel(site.resourceId);
  const held = site.holder === "self";
  const lines = [
    t("selection.trade_site.production", { resource, rate: site.perMinute }),
    // The buffer is the site's own throughput story: full means the lane behind
    // it is too small, which is the reading `bufferFull` exists to prompt.
    held && site.buffered !== null
      ? t("selection.trade_site.buffer", {
          held: Math.floor(site.buffered),
          capacity: site.bufferCapacity,
        })
      : t("selection.trade_site.buffer_hidden", { capacity: site.bufferCapacity }),
    held && site.caravansOnRoad !== null
      ? t("selection.trade_site.caravans_on_road", {
          onRoad: site.caravansOnRoad,
          total: site.caravanCount,
        })
      : t("selection.trade_site.fleet", { total: site.caravanCount }),
  ];
  return {
    title: site.label,
    summary: t(TRADE_SITE_SUMMARY_KEY[site.state]),
    lines,
    chips: [
      {
        id: "holder",
        icon: CHIP_ICON.logistics,
        value: t(`selection.trade_site.holder.${site.holder ?? "none"}`),
        tone: site.holder === "self" ? "good" : site.holder === "rival" ? "bad" : "neutral",
        tooltip: t(`selection.trade_site.holder.${site.holder ?? "none"}.tooltip`),
      },
      // The buffer badge only exists for a site the observer holds: a "dolu"
      // chip on a rival's port would be reporting the inside of something the
      // player has no claim on.
      ...(held && site.buffered !== null && site.buffered >= site.bufferCapacity
        ? [{
          id: "buffer-full",
          icon: CHIP_ICON.delivery,
          value: t("selection.trade_site.buffer_full"),
          tone: "warn" as const,
          // The one number on this panel the player can act on twice over, so
          // both remedies are named — the same pair a producer's full buffer offers.
          tooltip: t("selection.trade_site.buffer_full.tooltip"),
        }]
        : []),
    ],
    actions: [],
    // The whole mechanic in one sentence, and it has to be here: a panel with an
    // empty command deck otherwise reads as an unfinished building.
    hint: t("selection.trade_site.hint"),
    tooltip: t(TRADE_SITE_SUMMARY_KEY[site.state]),
    portrait: site.icon ?? null,
    selectionCount: 1,
    health: null,
  };
}

/** One sentence per state — the panel's answer to "why is nothing arriving?". */
const TRADE_SITE_SUMMARY_KEY: Readonly<Record<MarketSupplyState, string>> = {
  supplying: "selection.trade_site.state.supplying",
  cut: "selection.trade_site.state.cut",
  unclaimed: "selection.trade_site.state.unclaimed",
  // Named as a consequence rather than as a state, because the remedy is the
  // information: a site is held by a road, so it is taken by cutting one.
  rival: "selection.trade_site.state.rival",
};

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
    label: t("selection.rescue.action"),
    cost: null,
    enabled: true,
    reason: null,
    hint: t("selection.rescue.hint", { count: trapped }),
  }];
}

function describeUnits(
  units: readonly SelectedUnitView[],
  formation: FormationSelectionView | undefined,
  workerAssignments: readonly WorkerAssignmentTarget[] | undefined,
): SelectionPanelContent {
  // Composition is counted per unit *type*, through the same model the HUD army
  // strip is built from. Two reasons it is not the role it used to be: a role
  // is a fixed four-value enum that a second Guard unit would collapse into the
  // first one's row under the first one's icon, and the panel would then be
  // counting something different from the strip six inches above it. Shared
  // model, shared order — the player learns one reading of "what is this group".
  const roster = describeArmyRoster(units);
  const health = units.reduce((total, unit) => total + unit.health, 0);
  const maxHealth = units.reduce((total, unit) => total + unit.maxHealth, 0);
  const summary = t("selection.units.health", {
    current: Math.ceil(health),
    max: Math.ceil(maxHealth),
  });
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
    const combatUnitCount = units.filter((unit) => unit.role !== "worker").length;
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
      ...(workersOnly && workerAssignments !== undefined
        ? { workerAssignments }
        : {}),
      ...(combatUnitCount >= 2
        ? { formation: formationControls(formation?.active ?? DEFAULT_RTS_FORMATION, combatUnitCount) }
        : {}),
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
      title: t("selection.workers.title"),
      summary,
      lines: [t("selection.units.job", { jobs: jobBreakdown(units) })],
      // A worker's verbs are all world gestures — right-click to assign, X to
      // drop the job — so the only button it ever carries is the rescue, and
      // only while one of these workers is trapped inside a footprint.
      actions: rescueActions(units),
      hint: workerHint(),
      tooltip: t("selection.workers.tooltip"),
      portrait: sample.stats.icon ?? null,
      selectionCount,
      health: { current: health, max: maxHealth },
      slots,
    };
  }

  const stances = new Set(units.map((unit) => unit.stance));
  return {
    title: t(sample.stats.nameKey),
    summary,
    lines: [
      t("selection.units.stance", {
        stance: stances.size > 1
          ? t("unit.order.mixed")
          : stanceLabel([...stances][0] ?? "aggressive"),
      }),
      t("selection.units.order", { order: orderBreakdown(units) }),
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
    hint: armyHint(),
    tooltip: null,
    portrait: sample.stats.icon ?? null,
    selectionCount,
    health: { current: health, max: maxHealth },
    slots,
  };
}

function formationControls(active: RtsFormationId, combatUnitCount: number): SelectionFormationControls {
  return {
    active,
    combatUnitCount,
    options: RTS_FORMATION_DEFINITIONS.map((formation) => ({
      id: formation.id,
      label: t(formation.labelKey),
      enabled: combatUnitCount >= formation.minUnits,
      tooltip: t("selection.formation.tooltip", {
        formation: t(formation.labelKey),
        description: t(formation.descriptionKey),
        min: formation.minUnits,
      }),
      iconDots: formation.iconDots,
    })),
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
    chips: [...(base.chips ?? []), ...repairChips(structure)],
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
      label: t("selection.construction.cancel_confirm.action"),
      cost: null,
      enabled: true,
      reason: null,
      hint: t("selection.construction.cancel_confirm.hint", { building: structure.label }),
    };
  }
  return {
    id: CANCEL_CONSTRUCTION_ACTION,
    label: t("selection.construction.cancel.action"),
    cost: null,
    enabled: true,
    reason: null,
    hint: t("selection.construction.cancel.hint"),
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
      label: t("selection.repair.stop.action"),
      cost: null,
      enabled: true,
      active: true,
      reason: null,
      hint: t(repair.progress > 0
        ? "selection.repair.stop.hint_started"
        : "selection.repair.stop.hint_pending"),
    };
  }
  if (repair.missingHealth <= 0) return null;
  const cost = formatResourceCost(repair.cost);
  const shortfall = formatCostShortfall(repair.cost, repair.stock);
  return {
    id: REPAIR_ACTION,
    label: t("selection.repair.action"),
    cost,
    enabled: shortfall === null,
    reason: shortfall === null ? null : t("selection.repair.insufficient", { shortfall }),
    // Quoted as one worker's time, because that is the number the player can
    // check against the crew they are about to send: two workers halve it.
    hint: t("selection.repair.hint", {
      health: Math.ceil(repair.missingHealth),
      seconds: Math.ceil(repair.workerSeconds),
    }),
  };
}

/**
 * The running repair as a chip, so the panel says it even without the button.
 *
 * A chip rather than the body line it used to be for the reason repair is
 * offered on every building kind: as a line it landed in whichever body grid
 * the selected building had, and on a producer — the one panel that was already
 * over budget — it was the eighth line. The strip has room for it on all of them.
 */
function repairChips(structure: SelectedStructureView): SelectionChip[] {
  const repair = structure.repair ?? null;
  if (!repair?.active) return [];
  return [{
    id: "repair",
    icon: CHIP_ICON.repair,
    // The percent sign sits in front in Turkish and behind in English; `Intl`
    // owns that, not the sentence (inventory §7.7).
    value: t("selection.repair.chip", { progress: repair.progress }),
    tone: repair.workers === 0 ? "warn" : "good",
    tooltip: repair.workers === 0
      ? t("selection.repair.chip.waiting", { progress: repair.progress })
      : t("selection.repair.chip.working", {
          progress: repair.progress,
          workers: repair.workers,
        }),
  }];
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
      label: t("selection.demolish.confirm.action"),
      cost: null,
      enabled: true,
      reason: null,
      hint: t("selection.demolish.confirm.hint", { building: structure.label }),
    };
  }
  return {
    id: DEMOLISH_ACTION,
    label: t("selection.demolish.action"),
    cost: null,
    enabled: true,
    reason: null,
    hint: t("selection.demolish.hint"),
  };
}

/** Player-facing name of the tier one centre action produces, e.g. "Kasaba Lv2". */
function tierName(view: CenterProgressionView, age: "settlement" | "town", level: number): string {
  return t("selection.tier.name", {
    age: age === "town" ? view.townLabel : view.settlementLabel,
    level,
  });
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
    ? t("selection.progress.town", { age: view.townLabel })
    : t("selection.progress.tier", {
        tier: tierName(view, action.targetAge, action.targetLevel),
      });
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
      label: t("selection.progression.max.action"),
      cost: null,
      enabled: false,
      reason: t("selection.progression.max.reason", {
        tier: tierName(view, snapshot.age, snapshot.level),
      }),
    };
  }
  const cost = formatResourceCost(action.cost);
  const shortfall = formatCostShortfall(action.cost, view.stock);
  // A shortfall is what the stock cannot cover, so its presence is the "cannot
  // afford" gate — same flooring the HUD prints, so the button and the wallet agree.
  const unaffordableReason = shortfall
    ? t("selection.progression.insufficient", { shortfall })
    : null;
  if (action.kind === "town") {
    const missing = action.missingBuildingIds.map((id) => view.requiredBuildingLabels.get(id) ?? id);
    const reason = snapshot.upgrading
      ? t("selection.progression.town.upgrading", {
          age: view.townLabel,
          seconds: Math.ceil(snapshot.remainingSeconds),
        })
      : missing.length > 0
        // `localizedList`, not `join(", ")` — the separator is the language's
        // (inventory §7.5).
        ? t("selection.progression.town.missing_buildings", { buildings: localizedList(missing) })
        : unaffordableReason;
    return {
      id: AGE_UP_ACTION,
      label: t("selection.progression.town.action", { age: view.townLabel }),
      cost,
      enabled: reason === null,
      active: snapshot.upgrading,
      reason,
      hint: shortfall
        ? t("selection.progression.hint.shortfall", { shortfall, cost })
        : t("selection.progression.hint.cost", { cost }),
    };
  }
  const targetLabel = tierName(view, action.targetAge, action.targetLevel);
  const reason = snapshot.upgrading
    ? t("selection.progression.level.upgrading", {
        tier: targetLabel,
        seconds: Math.ceil(snapshot.remainingSeconds),
      })
    : unaffordableReason;
  return {
    id: CENTER_LEVEL_UP_ACTION,
    // "Yükselt: <kademe>" rather than "<kademe>'ye Yükselt": the dative comes
    // from the level number, so `'ye` is right for Lv2 (ikiye) and wrong for
    // Lv3 (üçe → `'e`). Both levels ship in `ages.json`, so the old form was
    // live-wrong on every Lv2→Lv3 upgrade.
    label: t("selection.progression.level.action", { tier: targetLabel }),
    cost,
    enabled: reason === null,
    active: snapshot.upgrading,
    reason,
    hint: shortfall
      ? t("selection.progression.level.hint.shortfall", { tier: targetLabel, shortfall })
      : t("selection.progression.level.hint.cost", { tier: targetLabel, cost }),
  };
}

function describeStructureDetail(structure: SelectedStructureView): SelectionPanelContent {
  const { detail } = structure;
  const summary = t("selection.structure.health", {
    current: Math.ceil(structure.health),
    max: Math.ceil(structure.maxHealth),
  });
  const title = structure.ageLabel
    ? t("selection.structure.title.tier", {
        building: structure.label,
        age: structure.ageLabel,
        level: structure.level,
      })
    : structure.level > 1
      ? t("selection.structure.title.level", { building: structure.label, level: structure.level })
      : structure.label;
  switch (detail.kind) {
    case "construction":
      return {
        title,
        summary,
        lines: [t("selection.construction.progress", { progress: detail.progress })],
        // Same glyph a producer's crew gets. A site with nobody on it and a Farm
        // with nobody on it are the same problem with the same fix, and they
        // should be recognisable from across the screen as such.
        chips: [{
          id: "workers",
          icon: CHIP_ICON.workers,
          value: `${detail.assignedWorkers}`,
          tone: detail.assignedWorkers === 0 ? "bad" : "good",
          tooltip: detail.assignedWorkers === 0
            ? t("selection.construction.no_workers")
            : t("selection.construction.workers", { count: detail.assignedWorkers }),
        }],
        actions: [],
        hint: "",
        tooltip: t(detail.assignedWorkers === 0
          ? "selection.construction.tooltip.idle"
          : "selection.construction.tooltip.working"),
      };
    case "producer":
      return describeProducer(title, summary, detail);
    case "depot":
      return {
        title,
        summary,
        lines: [t("selection.depot.linked_producers", { count: detail.linkedProducers })],
        chips: [
          {
            id: "logistics",
            icon: CHIP_ICON.logistics,
            value: t(detail.status === "linked"
              ? "selection.depot.status.linked"
              : detail.status === "unlinked-main-network"
                ? "selection.depot.status.off_network"
                : "selection.depot.status.no_road"),
            tone: detail.status === "linked" ? "good" : "bad",
            tooltip: t(detail.status === "linked"
              ? "selection.depot.tooltip.linked"
              : detail.status === "unlinked-main-network"
                ? "selection.depot.tooltip.off_network"
                : "selection.depot.tooltip.no_road"),
          },
          ...(detail.occupied
            ? [{
              id: "occupied",
              icon: CHIP_ICON.siege,
              value: t("selection.depot.occupied"),
              tone: "bad" as const,
              tooltip: t("selection.depot.occupied.tooltip"),
            }]
            : []),
        ],
        actions: [],
        hint: "",
        tooltip: detail.occupied
          ? t("selection.depot.tooltip.occupied")
          : detail.status === "linked"
            ? t("selection.depot.tooltip.role")
            : t(detail.status === "unlinked-main-network"
              ? "selection.depot.tooltip.off_network_detail"
              : "selection.depot.tooltip.needs_road"),
      };
    case "outpost":
      return {
        title,
        summary,
        lines: [
          t("selection.outpost.control_radius", {
            radius: detail.roadConnected && detail.connectedControlRadius !== null
              ? detail.connectedControlRadius
              : detail.controlRadius,
          }),
        ],
        chips: [{
          id: "logistics",
          icon: CHIP_ICON.logistics,
          value: t(detail.roadConnected
            ? "selection.outpost.status.linked"
            : "selection.outpost.status.no_road"),
          // Not "bad": an unroaded Outpost still holds ground, it just holds
          // less of it. The red is kept for a link that was there and is gone.
          tone: detail.roadConnected ? "good" : "warn",
          tooltip: t(detail.roadConnected
            ? "selection.outpost.tooltip.linked"
            : "selection.outpost.tooltip.no_road"),
        }],
        actions: [],
        hint: t("selection.hint.outpost"),
        // "yerine" rather than a number + case suffix: Turkish suffixes follow
        // the vowel of the *spoken* number (16 → "16’dan", 20 → "20’ye"), which
        // a template cannot pick for a value it does not know at build time.
        tooltip: detail.roadConnected
          ? t("selection.outpost.hint.linked")
          : t("selection.outpost.hint.connect", {
              current: detail.controlRadius,
              connected: detail.connectedControlRadius ?? detail.controlRadius,
            }),
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
          t("selection.aura.radius", { radius: detail.radius }),
          t("selection.aura.heal", { amount: detail.healPerSecond }),
          t("selection.aura.resistance", { ratio: detail.damageResistance }),
        ],
        // How many bodies the field actually reached is the one live state here;
        // the three lines above are the building's fixed stats.
        chips: [{
          id: "sustained",
          icon: CHIP_ICON.workers,
          value: `${detail.sustainedUnits}`,
          tone: detail.sustainedUnits > 0 ? "good" : "neutral",
          tooltip: detail.sustainedUnits > 0
            ? t("selection.aura.sustained", { count: detail.sustainedUnits })
            : t("selection.aura.empty"),
        }],
        actions: [],
        hint: "",
        tooltip: t("selection.aura.tooltip"),
      };
    case "passive":
      return {
        title,
        summary,
        lines: detail.populationCapacity > 0
          ? [t("selection.passive.population", { amount: detail.populationCapacity })]
          : [t("selection.passive.summary")],
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
      t("selection.center.queue", { queued: queue.queued, capacity: queue.capacity }),
      // Same rule as the Barracks: the bar below states what is training and for
      // how long, except while an upgrade owns the bar — then the queue is either
      // paused or unshown, and the prose has to carry it.
      ...(queue.trainingRemainingSeconds === null
        ? [t("selection.center.no_production")]
        : snapshot.upgrading
          ? [t("selection.center.training", {
              unit: t(detail.workerStats.nameKey),
              seconds: Math.ceil(queue.trainingRemainingSeconds),
            })]
          : []),
      // Two keys rather than a parenthetical appended to one: "(yükseltiliyor)"
      // is a clause, and a language may not put it at the end.
      t(snapshot.upgrading ? "selection.center.tier_upgrading" : "selection.center.tier", {
        tier: tierName(progression, snapshot.age, snapshot.level),
      }),
      t("selection.outpost.control_radius", { radius: detail.controlRadius }),
    ],
    actions: [
      {
        id: TRAIN_WORKER_ACTION,
        label: t("selection.center.train_action", { unit: t(detail.workerStats.nameKey) }),
        cost: t("selection.center.train_cost", {
          cost: formatResourceCost(detail.workerStats.cost),
          population: detail.workerStats.populationCost,
        }),
        // The centre's own gates only. Cost and population are checked when the
        // order is placed and answered with a message: pre-computing them here
        // would restate two systems' rules and could disagree with them.
        enabled: !townUpgrading,
        active: queue.queued > 0,
        reason: townUpgrading
          ? t("selection.center.train_refused", { age: progression.townLabel })
          : null,
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
    tooltip: t(snapshot.upgrading
      ? "selection.center.tooltip.upgrading"
      : "selection.center.tooltip"),
  };
}

/** The centre's training bar, carrying the same ✕ the Barracks' bar does. */
function workerTrainingProgress(detail: CenterDetailView): SelectionProgress | null {
  const { queue } = detail;
  const remaining = queue.trainingRemainingSeconds;
  const duration = queue.trainingDurationSeconds;
  if (remaining === null || duration === null || !Number.isFinite(duration) || duration <= 0) return null;
  return {
    label: t("selection.center.training_progress", { unit: t(detail.workerStats.nameKey) }),
    value: 1 - Math.min(1, Math.max(0, remaining / duration)),
    remainingSeconds: remaining,
    cancel: cancelQueueAction(CANCEL_WORKER_ACTION, t(detail.workerStats.nameKey)),
  };
}

/**
 * The producer panel — the selection this whole chip split was written for.
 *
 * It used to print seven `Etiket: değer` lines (eight while a repair ran) into a
 * body grid that holds six, which opened a third column at a third of the width
 * and clipped every one of them. Four of those seven were states rather than
 * measurements, so they became the chip strip; what stays as prose is the three
 * numbers a player actually reads off a producer — what it makes, what is
 * sitting in its buffer, and how much of its node is left.
 */
function describeProducer(
  title: string,
  summary: string,
  detail: ProducerDetailView,
): SelectionPanelContent {
  const { production, logistics, transport, livestock } = detail;
  return {
    title,
    summary,
    lines: [
      // `::.0` instead of `toFixed(1)`: the decimal separator is the locale's
      // (inventory §7.7).
      t("selection.producer.output", {
        rate: production.productionPerMinute,
        resource: resourceLabel(production.resourceId),
      }),
      t("selection.producer.buffer", {
        held: production.localBuffer,
        capacity: production.localBufferCapacity,
      }),
      ...(livestock
        ? [t("selection.producer.pen", {
            penned: livestock.pennedAnimals,
            capacity: livestock.livestockCapacity,
          })]
        : []),
      ...(production.sourceRemaining === null
        ? []
        : [t("selection.producer.node", { remaining: production.sourceRemaining })]),
    ],
    chips: producerChips(detail),
    // Staffing a producer is a world gesture (select workers, right-click it),
    // so there is no verb here a button could carry.
    actions: [],
    hint: "",
    tooltip: transport === "direct"
      ? t("selection.producer.transport.direct")
      : logistics
      ? t(LOGISTICS_REASON_KEY[logistics])
      : t("selection.producer.transport.pending"),
  };
}

/** Staffing, road link, caravan leg, and whatever stopped production. */
function producerChips(detail: ProducerDetailView): SelectionChip[] {
  const { production, logistics, transport, livestock, caravan, caravanStorageFull } = detail;
  const chips: SelectionChip[] = [];

  // A pasture's crew are shepherds who leave to fetch animals, so the count that
  // says whether it is manned is the one the livestock block reports — but it is
  // the same question ("is anybody working here?") and takes the same slot.
  const crew = livestock ? livestock.shepherds : production.assignedWorkers;
  const capacity = production.workerCapacity;
  chips.push({
    id: "workers",
    icon: livestock ? CHIP_ICON.livestock : CHIP_ICON.workers,
    value: `${crew}/${capacity}`,
    // Idle-but-assigned is its own state: a crew still walking to the building
    // is neither missing nor at work, and it resolves itself in seconds.
    tone: crew === 0
      ? "bad"
      : crew < capacity || (!livestock && production.workingWorkers < production.assignedWorkers)
        ? "warn"
        : "good",
    tooltip: livestock
      ? t("selection.producer.crew.shepherds", { crew, capacity })
      : t("selection.producer.crew.workers", {
          assigned: production.assignedWorkers,
          capacity,
          working: production.workingWorkers,
        }),
  });

  const direct = transport === "direct";
  chips.push({
    id: "logistics",
    icon: CHIP_ICON.logistics,
    value: direct
      ? t("selection.producer.chip.local_transfer")
      : logistics
        ? t(LOGISTICS_KEY[logistics])
        : t("selection.producer.chip.waiting"),
    tone: direct || logistics === "linked" ? "good" : logistics === null ? "neutral" : "bad",
    tooltip: direct
      ? t("selection.producer.transport.direct")
      : logistics
        ? t(LOGISTICS_REASON_KEY[logistics])
        : t("selection.producer.transport.pending"),
  });

  const caravanChip = describeCaravanChip(production, logistics, transport, caravan, caravanStorageFull);
  if (caravanChip) chips.push(caravanChip);

  // A working building does not need a badge saying nothing is wrong with it —
  // the same rule the Barracks panel already followed and the producer did not.
  if (production.status !== "producing") {
    chips.push({
      id: "status",
      icon: CHIP_ICON.warning,
      value: t(PRODUCTION_STATUS_KEY[production.status]),
      tone: PRODUCTION_STATUS_TONE[production.status],
      tooltip: t("selection.producer.status_tooltip", {
        status: t(PRODUCTION_STATUS_KEY[production.status]),
      }),
    });
  }
  return chips;
}

/**
 * The caravan's leg, or nothing at all.
 *
 * Nothing when the producer delivers locally: there is no donkey on a direct
 * lane, and the logistics chip beside it already says "Yerel aktarım" — a second
 * chip repeating it was the clearest of the panel's duplications.
 *
 * The loading leg deliberately drops the numbers it used to print. The old line
 * read `Kervan: Yük bekliyor (19.4/120.0)`, which is the *same measurement* as
 * the `Yerel tampon` line directly above it wherever a producer's buffer
 * capacity and its caravan's carry threshold agree. The threshold is worth
 * knowing when they differ, so it moved to the tooltip rather than being
 * deleted.
 */
function describeCaravanChip(
  production: EconomyBuildingSnapshot,
  logistics: ProducerLogisticsStatus | null,
  transport: ProducerTransport | null,
  caravan: CaravanSnapshot | null,
  storageFull: boolean,
): SelectionChip | null {
  const chip = (value: string, tone: SelectionChipTone, tooltip: string): SelectionChip =>
    ({ id: "caravan", icon: CHIP_ICON.caravan, value, tone, tooltip });
  const storageFullChip = (): SelectionChip => chip(
    t("selection.caravan.storage_full"),
    "warn",
    t("selection.caravan.storage_full.tooltip"),
  );
  if (transport === "direct") return storageFull ? storageFullChip() : null;
  if (logistics !== "linked" || !caravan) {
    return chip(
      t("selection.caravan.awaiting_road"),
      "warn",
      t("selection.caravan.awaiting_road.tooltip"),
    );
  }
  if (storageFull) return storageFullChip();
  const threshold = caravan.carryCapacity;
  switch (caravan.phase) {
    case "outbound":
      return chip(
        t("selection.caravan.outbound"),
        "neutral",
        t("selection.caravan.outbound.tooltip", { threshold }),
      );
    case "unloading":
      return chip(
        t("selection.caravan.unloading"),
        "neutral",
        t("selection.caravan.unloading.tooltip"),
      );
    case "inbound":
      return chip(
        t("selection.caravan.inbound"),
        "neutral",
        t("selection.caravan.inbound.tooltip"),
      );
    case "loading":
      return chip(
        t("selection.caravan.loading"),
        "neutral",
        t("selection.caravan.loading.tooltip", {
          held: production.localBuffer,
          threshold,
        }),
      );
  }
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
      t("selection.center.queue", { queued: queue.queued, capacity: queue.capacity }),
      // What is training, and how long it has left, is the progress bar's line
      // now — repeating it as prose directly above the bar said it twice. The
      // pending roll-call went with it: "Kuyruk: 3/5" already carries how much
      // is waiting, and naming each order made the longest line in the panel out
      // of the least actionable fact.
      ...(queue.trainingNameKey === null ? [t("selection.center.no_production")] : []),
    ],
    chips: [
      {
        id: "rally",
        icon: CHIP_ICON.rally,
        value: t(detail.rallySet ? "selection.military.rally.set" : "selection.military.rally.none"),
        tone: detail.rallySet ? "good" : "neutral",
        tooltip: t(detail.rallySet
          ? "selection.military.rally.set.tooltip"
          : "selection.military.rally.none.tooltip"),
      },
      // The two things that stop a Barracks silently. Only shown when true: a
      // healthy Barracks does not need a badge saying nothing is wrong with it.
      ...(detail.upgrading
        ? [{
          id: "upgrading",
          icon: CHIP_ICON.warning,
          value: t("selection.military.upgrading"),
          tone: "warn" as const,
          tooltip: t("selection.military.upgrading.tooltip"),
        }]
        : []),
      ...(detail.connected
        ? []
        : [{
          id: "logistics",
          icon: CHIP_ICON.logistics,
          value: t("selection.military.disconnected"),
          tone: "bad" as const,
          // The building names itself rather than the sentence naming one kind:
          // this panel serves the Barracks and the Archery Range alike.
          tooltip: t("selection.military.disconnected.tooltip", { building: title }),
        }]),
    ],
    actions: [
      ...detail.roster.map((entry) => trainAction(entry, detail)),
      {
        id: RALLY_ACTION,
        label: t("selection.military.rally_action"),
        cost: null,
        enabled: true,
        reason: null,
      },
    ],
    actionLayout: "command-deck",
    progress: trainingProgress(queue),
    hint: "",
    tooltip: t(!detail.connected
      ? "selection.military.tooltip.disconnected"
      : detail.upgrading
        ? "selection.military.tooltip.upgrading"
        : "selection.military.tooltip.rally"),
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
  const supplyByResource = new Map(detail.supply.map((line) => [line.resourceId, line]));
  // One chip per stocked resource, and none at all when this project stocks
  // nothing — an empty `stocked` list must leave the panel exactly as it was.
  //
  // These were lines until the chip split, and three tradable resources made
  // three of them: enough on their own to push the Market body past the six
  // slots the two-column grid holds. Whether a lot can be bought is a yes/no
  // the player scans before pressing a card, which is exactly a chip's job.
  const stockChips: SelectionChip[] = Object.entries(trade.stock).map(([resourceId, held]) => {
    const line = supplyByResource.get(resourceId) ?? null;
    const buyable = held >= trade.lotSize;
    // Faz S5: a full shelf whose supply has stopped is warned about rather than
    // called good. It is the one state the stock number alone reads backwards —
    // the player sees 240 and plans around it, not knowing the lane behind it
    // died and this is the last of it.
    const flowing = line === null || line.state === "supplying";
    // Faz S6, the shelf's final form: the lot is named *always*, not only while
    // the shelf is short of one. It is the unit every number on this panel is
    // denominated in — the button buys one, the price is per one — so a bare
    // "Yiyecek 240" leaves the player doing the division that decides whether to
    // press. Reads as the same "have / need" the panel's other chips use.
    const lots = Math.floor(held / trade.lotSize);
    return {
      id: `stock:${resourceId}`,
      icon: CHIP_ICON.delivery,
      value: t("selection.market.stock_chip", {
        resource: resourceLabel(resourceId),
        held: Math.floor(held),
        lot: trade.lotSize,
      }),
      tone: buyable ? (flowing ? "good" : "warn") : "bad",
      tooltip: t(buyable ? "selection.market.stock.buyable" : "selection.market.stock.short", {
        resource: resourceLabel(resourceId),
        held: Math.floor(held),
        lots,
        lot: trade.lotSize,
        advice: supplyAdvice(line),
      }),
    };
  });
  return {
    title,
    summary,
    lines: [
      t("selection.market.lot_line", { lot: trade.lotSize, commission: trade.commission }),
      t("selection.market.price_line"),
    ],
    chips: [
      ...(detail.connected
        ? []
        : [{
          id: "logistics",
          icon: CHIP_ICON.logistics,
          value: t("selection.market.disconnected"),
          tone: "bad" as const,
          tooltip: t("selection.market.disconnected.tooltip"),
        }]),
      ...stockChips,
    ],
    actions: trade.prices.flatMap((price) => [
      tradeAction(
        "buy", price.resourceId, price.buyPrice, trade.lotSize, price.index, detail.connected,
        trade.stock[price.resourceId] ?? null,
        supplyByResource.get(price.resourceId) ?? null,
      ),
      // The sell button never sees the stock: selling is unchanged (KARAR 7-A).
      tradeAction("sell", price.resourceId, price.sellPrice, trade.lotSize, price.index, detail.connected, null, null),
    ]),
    actionLayout: "market",
    hint: "",
    tooltip: t(detail.connected
      ? "selection.market.tooltip"
      : "selection.market.tooltip.disconnected"),
  };
}

/**
 * One trade button. Only the control gate and the supply gate are decided here,
 * and both are facts the trade system already handed over. Whether the player
 * can *afford* it is deliberately left to the click, exactly as the age and
 * worker buttons leave it: the wallet moves every tick, and a button that greys
 * out from under a reaching hand is worse than one that answers with a reason.
 *
 * Stock is the exception, and the reason it is worth the difference: an empty
 * market is not a thing the player can fix by clicking harder or waiting a
 * second — it is fixed by drawing a road, somewhere else entirely. A dark
 * button that names the missing supply is the whole point of the mechanic
 * (§2.1), so it is stated up front rather than on refusal.
 *
 * `stock` is null for every sell button and for any resource this project does
 * not gate — "not stocked" and "stocked but empty" must not look alike.
 *
 * `supply` names *why* the shelf is short (Faz S5), which is a different fact
 * from how short it is and has a different remedy attached. Before it, one
 * sentence — "draw a road to a trade site" — answered every empty shelf, and it
 * was wrong advice in three of the four cases: for a lane that is running and
 * simply has not made a lot yet, for a road the player already paved and lost,
 * and for a map that authors no site of that kind at all.
 */
function tradeAction(
  direction: "buy" | "sell",
  resourceId: string,
  price: number,
  lotSize: number,
  index: number,
  connected: boolean,
  stock: number | null,
  supply: MarketSupplyLine | null,
): SelectionAction {
  const buying = direction === "buy";
  const goldLabel = resourceLabel("gold");
  const supplied = stock === null || stock >= lotSize;
  return {
    id: `${buying ? TRADE_BUY_ACTION_PREFIX : TRADE_SELL_ACTION_PREFIX}${resourceId}`,
    label: t(buying ? "selection.market.buy_action" : "selection.market.sell_action", {
      lot: lotSize,
      resource: resourceLabel(resourceId),
    }),
    // Signed against the player's gold, so the two directions cannot be
    // mistaken for each other at a glance.
    cost: t(buying ? "selection.market.buy_cost" : "selection.market.sell_cost", {
      price,
      gold: goldLabel,
    }),
    enabled: connected && supplied,
    reason: !connected
      ? t("selection.market.refused.disconnected")
      : supplied
        ? null
        // Names the shortfall *and* the reason for it: "128/200" says how far off
        // the lot is, the advice says which of the four different things the
        // player would have to do about it.
        : t("selection.market.refused.out_of_stock", {
          held: Math.floor(stock ?? 0),
          lot: lotSize,
          advice: supplyAdvice(supply),
        }),
    hint: t(buying ? "selection.market.buy_hint" : "selection.market.sell_hint", {
      resource: resourceLabel(resourceId),
      index,
      price,
      gold: goldLabel,
    }),
  };
}

/**
 * The remedy sentence behind one resource's shelf — supply plan Faz S5.
 *
 * Every branch names a different action, which is the test of whether the state
 * split earns its keep: repair the road you have, pave one you do not, cut the
 * rival's, or stop waiting because this map has nowhere to pave to. A null line
 * (a project with no supply chain wired, or a resource the market does not gate)
 * falls back to the generic advice this replaced, because that is all that can
 * honestly be said without knowing where the goods come from.
 */
function supplyAdvice(supply: MarketSupplyLine | null): string {
  if (supply === null) return t("selection.supply.generic");
  const site = supply.siteNameKey === null ? t("selection.supply.site_fallback") : t(supply.siteNameKey);
  switch (supply.state) {
    case "supplying":
      // Not a problem at all — the lane is running and the lot is still being
      // carried. Saying "draw a road" here would send the player to build a
      // second road to a site already delivering on the first.
      return t("selection.supply.supplying", { site });
    case "cut":
      return t("selection.supply.cut", { site });
    case "rival":
      return t("selection.supply.rival", { site });
    case "unclaimed":
      // Phrased like its three siblings — site first, then the verb — rather
      // than `${site}'na`. A case suffix cannot be attached in code: it changes
      // with the label's last vowel and with whether that label already carries
      // a possessive ending, so `-na` is only right for the three sites this
      // map happens to ship (all ending in one).
      return t("selection.supply.unclaimed", { site });
    case "absent":
      // The one answer no road can fix, and the reason `absent` is a state
      // rather than a missing line: a player who paves the whole map looking
      // for a port that was never authored has been lied to by this panel.
      return t("selection.supply.absent");
  }
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
  const newestKey = queue.pendingNameKeys.at(-1) ?? queue.trainingNameKey;
  const newest = newestKey === undefined || newestKey === null
    ? t("selection.queue.order_fallback")
    : t(newestKey);
  return {
    // The queue count stays a body line rather than being repeated here: an
    // upgrade can take this bar away from the queue, and the count must not
    // vanish with it.
    label: t("selection.queue.training", { unit: t(queue.trainingNameKey ?? "unit.unknown.name") }),
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
    label: t("selection.queue.cancel_action", { unit: newestLabel }),
    cost: null,
    enabled: true,
    reason: null,
    hint: t("selection.queue.cancel_hint", { unit: newestLabel }),
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
  // The building names itself from the data rather than from a hardcoded pair:
  // a fork that adds a third training building would otherwise be told its
  // Stables is a Barracks.
  const buildingLabel = detail.buildingLabel;
  // The gate is the kingdom's global centre tier, not this building's level: a
  // pure age gate (Lv1) reads "… Çağında açılır"; a higher tier names the level.
  const age = t(`common.age.${entry.stats.requiredAge === "town" ? "town" : "settlement"}.name`);
  const reason = !entry.unlocked
    ? entry.stats.requiredSettlementLevel <= 1
      ? t("selection.train.locked_age", { unit: t(entry.stats.nameKey), age })
      : t("selection.train.locked_tier", {
          unit: t(entry.stats.nameKey),
          age,
          level: entry.stats.requiredSettlementLevel,
        })
    : !detail.connected
      ? t("selection.train.disconnected", { building: buildingLabel })
      : detail.upgrading
        ? t("selection.train.upgrading")
        : full
          ? t("selection.train.queue_full", {
              queued: detail.queue.queued,
              capacity: detail.queue.capacity,
            })
          : null;
  return {
    id: `${TRAIN_ACTION_PREFIX}${entry.id}`,
    label: t("selection.train.action", { unit: t(entry.stats.nameKey) }),
    cost: t("selection.train.cost", {
      cost: formatResourceCost(entry.stats.cost),
      population: entry.stats.populationCost,
    }),
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
    .map((job) => t("selection.units.job_count", {
      count: counts.get(job) ?? 0,
      job: t(WORKER_JOB_KEY[job]),
    }))
    .join(" · ");
}

const UNIT_ORDER_KEY: Record<UnitOrder, string> = {
  idle: "unit.order.idle",
  moving: "unit.order.moving",
  attacking: "unit.order.attacking",
  "attack-moving": "unit.order.attack_move",
};

/** A mixed group must not claim every unit is following the first unit's order. */
function orderBreakdown(units: readonly SelectedUnitView[]): string {
  const orders = new Set(units.map((unit) => unit.order ?? "idle"));
  if (orders.size !== 1) return t("unit.order.mixed");
  return t(UNIT_ORDER_KEY[[...orders][0] ?? "idle"]);
}


/** Read the §33 row straight off the unit's data rather than restating it. */
function counterText(stats: UnitBalanceStats): string {
  const entries = Object.entries(stats.damageMultipliers) as [UnitArmorClass, number][];
  const strong = entries.filter(([, value]) => value >= STRONG_MULTIPLIER).map(([key]) => t(ARMOR_CLASS_KEY[key]));
  const weak = entries.filter(([, value]) => value <= WEAK_MULTIPLIER).map(([key]) => t(ARMOR_CLASS_KEY[key]));
  // `localizedList`, not `join(", ")`: English wants "light units and structures",
  // and the separator is the language's business (inventory §7.5).
  return [
    strong.length > 0 ? t("selection.counter.strong", { classes: localizedList(strong) }) : null,
    weak.length > 0 ? t("selection.counter.weak", { classes: localizedList(weak) }) : null,
  ].filter((part): part is string => part !== null).join(" · ") || t("selection.counter.balanced");
}
