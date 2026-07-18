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
import type { StructureUpgradeSnapshot } from "../structures/structureUpgradeSystem";
import { centerLevelReadyForTown, type AgeSnapshot } from "../progression/ageSystem";
import type { MarketTradeSnapshot } from "../economy/marketTradeSystem";
import { formatCostShortfall, formatResourceCost, resourceLabel } from "./resourceLabels";

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
export type WorkerJob = "idle" | "moving" | "building" | "producing" | "unreachable";

export interface SelectedUnitView {
  readonly id: number;
  readonly role: UnitRoleId;
  readonly stats: UnitBalanceStats;
  readonly health: number;
  readonly maxHealth: number;
  readonly stance: UnitStance;
  /** Workers only; a Guard has no job beyond its orders. */
  readonly job: WorkerJob | null;
}

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
  readonly age: AgeSnapshot;
  readonly controlRadius: number;
  readonly workerStats: UnitBalanceStats;
  /**
   * Building id → label, so the age button can name what it is waiting for in
   * the player's words. `missingBuildingIds` is ids, and "farm, lumber_camp" is
   * the data model talking, not the game.
   */
  readonly requiredBuildingLabels: ReadonlyMap<string, string>;
  /** The age's four-resource price, so the button can quote it before the click. */
  readonly ageCost: Readonly<Record<string, number>>;
  /** The owner's live stock, for naming what {@link ageCost} is still short of. */
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
  | PassiveDetailView
  | CenterDetailView;

/**
 * What one level step buys, so the panel can show the gain next to its cost
 * (plan Faz 3: "seviye + maliyet + kazanım gösterimi"). Absolute figures rather
 * than "the data step", because the player reads a total ("240 can"), and the
 * one delta that matters — extra health — is computed against the live building.
 */
export interface UpgradeGain {
  /** Maximum health at the next level. */
  readonly maxHealth: number;
  /** Extra maximum health the step adds over the building's current level. */
  readonly maxHealthDelta: number;
  /** Population capacity the next level supplies, or null when it grants none. */
  readonly populationCapacity: number | null;
  /** Control radius the next level supplies, or null when it grants none. */
  readonly controlRadius: number | null;
  /**
   * The Market spread the next level trades at, or null when the step does not
   * touch it. Faz M3: this is what makes levelling a Market a decision — the
   * building's other gains are health, and health is not why a Market is built.
   */
  readonly tradeCommission: number | null;
  readonly workerCapacity?: number | null;
  readonly perWorkerPerMinute?: number | null;
  readonly localBufferCapacity?: number | null;
  readonly carryCapacity?: number | null;
  readonly attackDamage?: number | null;
  readonly queueCapacity?: number | null;
  readonly storageCapacity?: Readonly<Record<string, number>> | null;
}

/**
 * The type-wide level-up path, when the building's data declares `levels`. It
 * is started from one selected structure but upgrades every completed structure
 * of that type for the owner; the next level's cost and state live entirely in
 * {@link StructureUpgradeSnapshot}.
 *
 * {@link gain} is the next step's benefits, or null at max level — it rides
 * alongside the snapshot so the panel can name what the cost is buying.
 * {@link progress} is how far the in-flight level-up has run (0..1), 0 when idle.
 */
export interface StructureUpgradeView {
  readonly snapshot: StructureUpgradeSnapshot;
  readonly gain: UpgradeGain | null;
  readonly progress: number;
  /** A broader progression action temporarily blocks new structure research. */
  readonly lockedReason?: string | null;
  /**
   * The owner's live stock, for naming what the next level's cost is short of.
   * Like the age button, affordability never disables the level-up — it only
   * decides what the tooltip and the click's answer say.
   */
  readonly stock?: Readonly<Record<string, number>>;
}

export interface SelectedStructureView {
  readonly id: number;
  readonly label: string;
  readonly level: number;
  /** Current age family, supplied by the runtime because the UI does not own age state. */
  readonly ageLabel?: string;
  readonly health: number;
  readonly maxHealth: number;
  /** True once the player has clicked "Yık" and the panel is asking to confirm. */
  readonly demolishArmed?: boolean;
  readonly detail: StructureDetailView;
  /** Null when the data gives this building no upgrade at all. */
  readonly upgrade: StructureUpgradeView | null;
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
}

/** What the panel shows. `lines` is the panel's body, one fact per line. */
export interface SelectionPanelContent {
  readonly title: string;
  readonly summary: string;
  readonly lines: readonly string[];
  /** Buttons the selection offers; empty for anything the player cannot command. */
  readonly actions: readonly SelectionAction[];
  readonly hint: string;
  /** Hover explanation for the panel body; null when there is nothing to resolve. */
  readonly tooltip: string | null;
  /** A running timed job (e.g. a level-up), or null/absent when nothing is timed. */
  readonly progress?: SelectionProgress | null;
}

/**
 * Action ids. Stable strings rather than an enum so the DOM can carry them in a
 * `data-` attribute and a test can name the button it means.
 */
export const TRAIN_ACTION_PREFIX = "train:";
export const TRAIN_WORKER_ACTION = "train-worker";
export const AGE_UP_ACTION = "age-up";
export const RALLY_ACTION = "rally";
export const UPGRADE_ACTION = "upgrade";
export const DEMOLISH_ACTION = "demolish";
export const TRADE_BUY_ACTION_PREFIX = "trade-buy:";
export const TRADE_SELL_ACTION_PREFIX = "trade-sell:";

/** GDD 06 §6–§9 role summaries, in the player's language. */
const ROLE_DESCRIPTION: Record<UnitRoleId, string> = {
  guard: "Ön hat. Okçuları korur, dar geçidi tutar; yapılara karşı zayıftır.",
  archer: "Menzilli destek. Ön hattın arkasından vurur; yakın dövüşte erir.",
  siege: "Kuşatma. Yapıları yıkar; birimlere karşı savunmasızdır, koruma ister.",
  worker: "Ekonomi birimi. İnşa eder ve kaynak üretir; savaşmaz.",
};

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
  "depot-occupied": "Depo İşgal Altında",
};

const LOGISTICS_REASON: Record<ProducerLogisticsStatus, string> = {
  linked: "Bu üretim yapısı, aynı yol ağındaki Depoya bağlı.",
  "outside-control": "Kontrol alanı kaybedildi; Karakolu veya alanı geri alın.",
  "unlinked-road": "Yapı footprint’ine temas eden bir yol hücresi gerekli.",
  "unlinked-depot": "Aynı yol ağında tamamlanmış bir Depo gerekli.",
  "depot-occupied": "Bağlı Depo düşman işgali altında; işgali kaldırın.",
};

const UNIT_HINT = "F: Saldırı-Hareket · H: Pozisyonu Koru · G: Serbest · X: Dur";
const WORKER_HINT = "Sağ tık: inşaata veya üretim yapısına ata · X: Görevi bırak";
const STRUCTURE_HINT = "Sağ tık: seçili işçileri bu yapıya ata";
const OUTPOST_HINT = "Sağ tık: menzildeki düşmana saldırı emri ver";

/** Above this an attacker is meaningfully strong; below its mirror, weak. */
const STRONG_MULTIPLIER = 1.1;
const WEAK_MULTIPLIER = 0.9;

/** The panel's whole answer for one selection. Null when nothing is selected. */
export function describeSelection(view: RtsSelectionView): SelectionPanelContent | null {
  if (view.kind === "none") return null;
  if (view.kind === "units") {
    return view.units.length === 0 ? null : describeUnits(view.units);
  }
  return describeStructure(view.structure);
}

function describeUnits(units: readonly SelectedUnitView[]): SelectionPanelContent {
  const counts = new Map<UnitRoleId, number>();
  for (const unit of units) counts.set(unit.role, (counts.get(unit.role) ?? 0) + 1);
  const health = units.reduce((total, unit) => total + unit.health, 0);
  const maxHealth = units.reduce((total, unit) => total + unit.maxHealth, 0);
  const summary = `${[...counts]
    .map(([role, count]) => `${count} ${labelFor(units, role)}`)
    .join(" · ")} — Can: ${Math.ceil(health)}/${Math.ceil(maxHealth)}`;

  // A selection of nothing but workers is an economy question, and the army
  // panel has no answer to it: a Worker has no matchup and no stance. §51 lists
  // the worker panel separately for exactly this reason.
  const workersOnly = units.every((unit) => unit.role === "worker");
  if (workersOnly) {
    return {
      title: "İşçi",
      summary,
      lines: [ROLE_DESCRIPTION.worker, `Görev: ${jobBreakdown(units)}`],
      // A worker's verbs are all world gestures — right-click to assign, X to
      // drop the job — so it has nothing to put on a button.
      actions: [],
      hint: WORKER_HINT,
      tooltip: "Boşta bir işçi, oyuncunun oyuna borçlu olduğu bir karardır.",
    };
  }

  // The role shown is the most numerous *combat* role. Workers only describe the
  // selection when it is purely economic (handled above): dragging a box over a
  // mixed group is a question about the army, and answering "İşçi" because five
  // labourers outnumbered four Guards tells the player nothing they wanted.
  const ranked = [...counts].sort((left, right) => right[1] - left[1]);
  const [dominantRole] = ranked.find(([role]) => role !== "worker") ?? ranked[0]!;
  const sample = units.find((unit) => unit.role === dominantRole)!;
  const stances = new Set(units.map((unit) => unit.stance));
  return {
    title: "Seçim",
    summary,
    lines: [
      ROLE_DESCRIPTION[dominantRole],
      counterText(sample.stats),
      `Duruş: ${stances.size > 1 ? "Karışık" : STANCE_LABEL[[...stances][0] ?? "aggressive"]}`,
    ],
    // Army verbs are keyboard commands with a world target (F/H/G/X); the hint
    // row already teaches them, and a button cannot take the target anyway.
    actions: [],
    hint: UNIT_HINT,
    tooltip: null,
  };
}

function describeStructure(structure: SelectedStructureView): SelectionPanelContent {
  const base = describeStructureDetail(structure);
  const upgrade = upgradeAction(structure);
  const gainLine = upgradeGainLine(structure);
  const lines = gainLine ? [...base.lines, gainLine] : base.lines;
  // Demolish sits last on every building panel, after the upgrade: the row reads
  // left-to-right from what the building can become to what removes it.
  // The centre reaches here wrapped as a structure (`detail.kind === "center"`),
  // so demolish has to be excluded on the detail, not on the outer kind: razing
  // your own centre is the defeat condition, which is a thing you lose, not a
  // thing you order.
  const actions = [
    ...base.actions,
    ...(upgrade ? [upgrade] : []),
    ...(structure.detail.kind === "center" ? [] : [demolishAction(structure)]),
  ];
  return { ...base, lines, actions, progress: upgradeProgress(structure) };
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

/**
 * The level-up progress bar. Present only while a level-up is actually in flight
 * — a completed or never-started upgrade is a button, not a bar — and it names
 * the level it is climbing to so the bar reads as "Lv2 yükseltmesi", not just a
 * fill. The fraction comes straight from {@link StructureUpgradeView.progress}.
 */
function upgradeProgress(structure: SelectedStructureView): SelectionProgress | null {
  const upgrade = structure.upgrade;
  if (!upgrade || !upgrade.snapshot.upgrading) return null;
  return {
    label: `Lv${upgrade.snapshot.level + 1} yükseltmesi`,
    value: upgrade.progress,
    remainingSeconds: upgrade.snapshot.remainingSeconds,
  };
}

/**
 * The one line that turns "Lv2'ye Yükselt" into a decision: what the next level
 * grants. Health is shown as a total with the delta in parentheses; capacity and
 * radius, when the step sets them, as the totals the player will read on the
 * levelled building. Null once the building is at max or its data grants nothing.
 */
function upgradeGainLine(structure: SelectedStructureView): string | null {
  const upgrade = structure.upgrade;
  if (!upgrade?.gain || upgrade.snapshot.completed) return null;
  const { gain } = upgrade;
  const nextLevel = upgrade.snapshot.level + 1;
  const parts = [`${Math.round(gain.maxHealth)} can (+${Math.round(gain.maxHealthDelta)})`];
  if (gain.populationCapacity !== null) parts.push(`${gain.populationCapacity} nüfus`);
  if (gain.controlRadius !== null) parts.push(`${gain.controlRadius} kontrol yarıçapı`);
  if (gain.tradeCommission !== null) parts.push(`%${Math.round(gain.tradeCommission * 100)} komisyon`);
  if (gain.workerCapacity != null) parts.push(`${gain.workerCapacity} işçi`);
  if (gain.perWorkerPerMinute != null) parts.push(`${gain.perWorkerPerMinute}/dk işçi başı üretim`);
  if (gain.localBufferCapacity != null) parts.push(`${gain.localBufferCapacity} yerel tampon`);
  if (gain.carryCapacity != null) parts.push(`${gain.carryCapacity} taşıma`);
  if (gain.attackDamage != null) parts.push(`${gain.attackDamage} ok hasarı`);
  if (gain.queueCapacity != null) parts.push(`${gain.queueCapacity} sıra kapasitesi`);
  if (gain.storageCapacity != null) {
    parts.push(`Depo +${Object.entries(gain.storageCapacity).map(([resourceId, amount]) => `${amount} ${resourceLabel(resourceId)}`).join(", ")}`);
  }
  return `Lv${nextLevel}: ${parts.join(" · ")}`;
}

/**
 * The building's level-up button starts a type-wide research from the selected
 * building. No age gate stands between the player and it; completion upgrades
 * every completed matching structure for that owner.
 */
function upgradeAction(structure: SelectedStructureView): SelectionAction | null {
  const upgrade = structure.upgrade;
  if (!upgrade) return null;
  const { snapshot } = upgrade;
  if (snapshot.completed) {
    return {
      id: UPGRADE_ACTION,
      label: "En Üst Seviyede",
      cost: null,
      enabled: false,
      reason: `Tüm ${structure.label} yapıları en yüksek seviyede (Lv${snapshot.level}).`,
    };
  }
  const nextLevel = snapshot.level + 1;
  const reason = upgrade.lockedReason
    ?? (snapshot.upgrading
      ? `Lv${nextLevel} yükseltmesi sürüyor (${Math.ceil(snapshot.remainingSeconds)} sn).`
      : null);
  const nextCost = snapshot.nextCost ?? {};
  const cost = formatResourceCost(nextCost);
  const shortfall = upgrade.stock ? formatCostShortfall(nextCost, upgrade.stock) : null;
  return {
    id: UPGRADE_ACTION,
    label: `Lv${nextLevel}'ye Yükselt`,
    cost,
    enabled: reason === null,
    reason,
    hint: shortfall ? `Eksik: ${shortfall}. Toplam maliyet: ${cost}.` : `Maliyet: ${cost}.`,
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
        hint: STRUCTURE_HINT,
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
          `Ağ: ${detail.status === "linked" ? `bileşen #${detail.componentId}` : "yola bağlı değil"}`,
          `Teslim eden yapı: ${detail.linkedProducers}`,
          `Depo katkısı: ${formatStorageCapacity(detail.contribution ?? {})}`,
          `Global stok: ${formatStorageStock(detail.stock ?? {}, detail.capacity ?? {})}`,
          ...(detail.occupied ? ["Düşman işgali altında — teslimat durdu."] : []),
        ],
        actions: [],
        hint: STRUCTURE_HINT,
        tooltip: detail.occupied
          ? "İşgali kaldırmadan bu Depoya bağlı üreticiler global stoğa aktaramaz."
          : detail.status === "linked"
            ? "Bu Depo, aynı yol ağındaki üreticilerin çıktısını global stoğa aktarır."
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
    case "passive":
      return {
        title,
        summary,
        lines: detail.populationCapacity > 0
          ? [`Nüfus kapasitesi: +${detail.populationCapacity}`]
          : ["Pasif yapı."],
        actions: [],
        hint: STRUCTURE_HINT,
        tooltip: null,
      };
  }
}

function formatStorageCapacity(capacity: Readonly<Record<string, number>>): string {
  return ["food", "wood", "stone", "gold"]
    .map((resourceId) => `${resourceLabel(resourceId)} ${capacity[resourceId] ?? 0}`)
    .join(" · ");
}

function formatStorageStock(
  stock: Readonly<Record<string, number>>,
  capacity: Readonly<Record<string, number>>,
): string {
  return ["food", "wood", "stone", "gold"]
    .map((resourceId) => `${resourceLabel(resourceId)} ${Math.floor(stock[resourceId] ?? 0)}/${capacity[resourceId] ?? 0}`)
    .join(" · ");
}

function describeCenter(
  title: string,
  summary: string,
  detail: CenterDetailView,
): SelectionPanelContent {
  const { queue, age } = detail;
  const isTown = age.age === "town";
  // The age button does not exist until the centre is levelled far enough. A
  // greyed-out button would read as "you failed a check"; the truth is the age
  // has not opened yet, so the panel says what opens it on a line instead and
  // leaves the centre's own level-up button as the only thing to press.
  const centerReady = centerLevelReadyForTown(age);
  return {
    title,
    summary,
    lines: [
      `Kuyruk: ${queue.queued}/${queue.capacity}`,
      queue.trainingRemainingSeconds === null
        ? "Üretim yok."
        : `Üretiliyor: ${detail.workerStats.label} — ${Math.ceil(queue.trainingRemainingSeconds)} sn`,
      `Çağ: ${isTown ? "Kasaba" : "Yerleşim"}${age.upgrading ? " (yükseltiliyor)" : ""}`,
      `Kontrol yarıçapı: ${detail.controlRadius}`,
      ...(centerReady ? [] : [`Kasaba Çağı için Merkez Lv${age.requiredCenterLevel} gerekir.`]),
    ],
    actions: [
      {
        id: TRAIN_WORKER_ACTION,
        label: `${detail.workerStats.label} Üret`,
        cost: `${formatResourceCost(detail.workerStats.cost)} · ${detail.workerStats.populationCost} Nüfus`,
        // The centre's own gates only. Cost and population are checked when the
        // order is placed and answered with a message: pre-computing them here
        // would restate two systems' rules and could disagree with them.
        enabled: !age.upgrading,
        reason: age.upgrading ? "Kasaba Çağı yükseltmesi sürerken Merkez üretim yapamaz." : null,
      },
      ...(centerReady ? [ageUpAction(age, detail)] : []),
    ],
    hint: STRUCTURE_HINT,
    tooltip: age.upgrading
      ? "Yükseltme tamamlanınca Merkez kuyruğu kaldığı yerden devam eder."
      : "Merkez işçi üretir ve krallığın kontrol alanının çekirdeğidir.",
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
    hint: STRUCTURE_HINT,
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
      queue.trainingLabel === null
        ? "Üretim yok."
        : `Üretiliyor: ${queue.trainingLabel} — ${Math.ceil(queue.trainingRemainingSeconds ?? 0)} sn`,
      ...(queue.pendingLabels.length > 0 ? [`Sırada: ${queue.pendingLabels.join(", ")}`] : []),
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
    hint: STRUCTURE_HINT,
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
      ...trade.prices.map((price) => {
        const band = price.atCeiling ? " (tavan)" : price.atFloor ? " (taban)" : "";
        return `${resourceLabel(price.resourceId)}: al ${price.buyPrice} / sat ${price.sellPrice} altın`
          + ` · endeks ×${price.index.toFixed(2)}${band}`;
      }),
      ...(detail.connected ? [] : ["Kontrol Dışı — bu Pazar ticaret yapamaz."]),
    ],
    actions: trade.prices.flatMap((price) => [
      tradeAction("buy", price.resourceId, price.buyPrice, trade.lotSize, detail.connected),
      tradeAction("sell", price.resourceId, price.sellPrice, trade.lotSize, detail.connected),
    ]),
    hint: STRUCTURE_HINT,
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
  };
}

/**
 * The age button. Its refusal order mirrors `AgeSystem.startTownUpgrade`, and
 * the prerequisite comes from `AgeSnapshot.missingBuildingIds` — the system
 * already computes exactly which buildings are missing, so the button names them
 * instead of failing only once the player has pressed it (§52: a thing that will
 * not work says why).
 *
 * Affordability deliberately does *not* gate it: the wallet can change between
 * frames, and a button that greys out mid-reach is worse than one that answers.
 * So the price rides on the button and the shortfall rides in its tooltip —
 * the player learns what it costs, and what they are short of, without the
 * button ever lying about whether the age is open to them.
 */
function ageUpAction(age: AgeSnapshot, detail: CenterDetailView): SelectionAction {
  const missing = age.missingBuildingIds.map((id) => detail.requiredBuildingLabels.get(id) ?? id);
  const reason = age.age === "town"
    ? "Kasaba Çağı zaten tamamlandı."
    : age.upgrading
      ? "Kasaba Çağı yükseltmesi sürüyor."
      : missing.length > 0
        ? `Önce şu yapılar gerekir: ${missing.join(", ")}.`
        : null;
  const cost = formatResourceCost(detail.ageCost);
  const shortfall = formatCostShortfall(detail.ageCost, detail.stock);
  return {
    id: AGE_UP_ACTION,
    label: "Kasaba Çağına Geç",
    cost,
    enabled: reason === null,
    reason,
    hint: shortfall ? `Eksik: ${shortfall}. Toplam maliyet: ${cost}.` : `Maliyet: ${cost}.`,
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
  const reason = !entry.unlocked
    ? entry.stats.requiredAge === "town"
      ? `${entry.stats.label} Kasaba Çağında açılır.`
      : `${entry.stats.label} için ${buildingLabel} Lv${entry.stats.requiredBuildingLevel} gerekir.`
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
  const order: readonly WorkerJob[] = ["idle", "moving", "building", "producing", "unreachable"];
  return order
    .filter((job) => (counts.get(job) ?? 0) > 0)
    .map((job) => `${counts.get(job)} ${WORKER_JOB_LABEL[job]}`)
    .join(" · ");
}

function labelFor(units: readonly SelectedUnitView[], role: UnitRoleId): string {
  return units.find((unit) => unit.role === role)?.stats.label ?? role;
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
