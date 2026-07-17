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
import type { AgeSnapshot } from "../progression/ageSystem";
import { formatResourceCost, resourceLabel } from "./resourceLabels";

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
  | PassiveDetailView
  | CenterDetailView;

/**
 * The per-instance level-up path, when the building's data declares `levels`. It
 * hangs off the structure rather than off a detail kind because every kind of
 * building can have one — a House, a Depot and a Barracks all level up, and the
 * next level's cost and state live entirely in {@link StructureUpgradeSnapshot}.
 */
export interface StructureUpgradeView {
  readonly snapshot: StructureUpgradeSnapshot;
}

export interface SelectedStructureView {
  readonly id: number;
  readonly label: string;
  readonly level: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly detail: StructureDetailView;
  /** Null when the data gives this building no upgrade at all. */
  readonly upgrade: StructureUpgradeView | null;
}

export type RtsSelectionView =
  | { readonly kind: "none" }
  | { readonly kind: "units"; readonly units: readonly SelectedUnitView[] }
  | { readonly kind: "structure"; readonly structure: SelectedStructureView };

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
  return upgrade ? { ...base, actions: [...base.actions, upgrade] } : base;
}

/**
 * The building's level-up button, on the building itself. Levelling is
 * per-instance now (plan KR-01): the button acts only on the selected building
 * and names the exact next level, so "Kışla Lv2'ye Yükselt" is literal — no
 * type-wide promotion, and no age gate (KR-04) stands between the player and it.
 */
function upgradeAction(structure: SelectedStructureView): SelectionAction | null {
  const upgrade = structure.upgrade;
  if (!upgrade) return null;
  const { snapshot } = upgrade;
  if (snapshot.completed) {
    return {
      id: UPGRADE_ACTION,
      label: `${structure.label} En Üst Seviyede`,
      cost: null,
      enabled: false,
      reason: `${structure.label} en yüksek seviyede (Lv${snapshot.level}).`,
    };
  }
  const nextLevel = snapshot.level + 1;
  const reason = snapshot.upgrading
    ? `Lv${nextLevel} yükseltmesi sürüyor (${Math.ceil(snapshot.remainingSeconds)} sn).`
    : null;
  return {
    id: UPGRADE_ACTION,
    label: `${structure.label} Lv${nextLevel}'e Yükselt`,
    cost: formatResourceCost(snapshot.nextCost ?? {}),
    enabled: reason === null,
    reason,
  };
}

function describeStructureDetail(structure: SelectedStructureView): SelectionPanelContent {
  const { detail } = structure;
  const summary = `Can: ${Math.ceil(structure.health)}/${Math.ceil(structure.maxHealth)}`;
  const title = structure.level > 1 ? `${structure.label} T${structure.level}` : structure.label;
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

function describeCenter(
  title: string,
  summary: string,
  detail: CenterDetailView,
): SelectionPanelContent {
  const { queue, age } = detail;
  const isTown = age.age === "town";
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
      ageUpAction(age, detail.requiredBuildingLabels),
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
      ...(detail.upgrading ? ["T2 yükseltmesi sürüyor — üretim duraklatıldı."] : []),
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
 * The age button. Its refusal order mirrors `AgeSystem.startTownUpgrade`, and
 * the prerequisite comes from `AgeSnapshot.missingBuildingIds` — the system
 * already computes exactly which buildings are missing, so the button names them
 * instead of failing only once the player has pressed it (§52: a thing that will
 * not work says why). Cost is left to the click: the wallet can change between
 * frames, and a button that greys out mid-reach is worse than one that answers.
 */
function ageUpAction(age: AgeSnapshot, labels: ReadonlyMap<string, string>): SelectionAction {
  const missing = age.missingBuildingIds.map((id) => labels.get(id) ?? id);
  const reason = age.age === "town"
    ? "Kasaba Çağı zaten tamamlandı."
    : age.upgrading
      ? "Kasaba Çağı yükseltmesi sürüyor."
      : missing.length > 0
        ? `Önce şu yapılar gerekir: ${missing.join(", ")}.`
        : null;
  return {
    id: AGE_UP_ACTION,
    label: "Kasaba Çağına Geç",
    cost: null,
    enabled: reason === null,
    reason,
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
  const reason = !entry.unlocked
    ? `${entry.stats.label} için Kışla T${entry.stats.requiredBuildingLevel} gerekir.`
    : !detail.connected
      ? "Kontrol Dışı: bu Kışla birlik üretemez."
      : detail.upgrading
        ? "T2 yükseltmesi sürerken kuyruk duraklatıldı."
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
