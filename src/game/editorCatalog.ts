/**
 * Assembles the game-owned catalogs/helpers the editor renders into a single
 * plain object. The composition root (`src/main.ts`) injects it into the editor
 * via `setGameEditorCatalog` (`@/editor/gameEditorRegistry`).
 *
 * This module imports NO editor code, so the `game → editor` direction stays
 * clean and the editor never imports `@/game`. Its inferred shape structurally
 * satisfies the editor's `GameEditorCatalog` contract; the assignability check
 * happens at the injection site in `src/main.ts` (the only module that sees both
 * layers), keeping this a data/behavior provider with no editor dependency.
 */
import { GAME_MODE_OPTIONS } from "@/game/gameModes/catalog";
import { BEHAVIOR_SCRIPT_IDS } from "@/game/behaviors";
import { resolveMontageBindings } from "@/game/montageInputBindings";
import { formatInputCode, keysForAction } from "@/game/defaultInputBindings";
import { createRagdollDriver } from "@/game/ragdollDriver";
import {
  validateAgeBalance,
  validateAiBalance,
  validateBuildingBalance,
  validateAnimalBalance,
  validateCaravanBalance,
  validateResourceBalance,
  validateRoadBalance,
  validateTradeSiteBalance,
  validateUnitBalance,
} from "@/game/data/validateGameData";
import {
  RTS_DAMAGE_AGED_SLOTS,
  RTS_DAMAGE_ANCHOR_MODES,
  RTS_DAMAGE_IMPACT_SLOTS,
  RTS_DAMAGE_REPEATING_SLOTS,
  RTS_DAMAGE_SLOTS,
  RTS_DAMAGE_SOUND_SLOTS,
  RTS_DAMAGE_SLOT_AGES,
  validateRtsContentDamageSection,
} from "@/game/rts/content/rtsContentCatalog";
import type { SettlementAge } from "@/game/data/gameDataTypes";
import { AUDIO_BUS_IDS } from "@engine/audio/audioBus";
import { normalizeAudioEventTable } from "@engine/audio/audioEventTable";
import { normalizeRtsMusicStateSettings } from "@/game/rts/audio/rtsMusicState";

/**
 * Wrap a runtime game-data validator as the editor's `validate` contract:
 * `null` when the document is accepted, otherwise the validator's own
 * field-level message. This is what lets the Data Table editor refuse a save
 * the game would reject at boot, using the exact same rules the runtime loads
 * with — without the editor ever importing `@/game`.
 */
/**
 * Audio event fields — audio plan §58's schema, one row per event.
 *
 * `clips` is the reason this table exists. It is a list of *manifest sound ids*,
 * and typing one by hand is the mistake with no feedback: a mistyped id resolves
 * to nothing and the event plays silence, which is indistinguishable from an
 * event that was never wired. Marked `assetOptions: "sound"`, it becomes a
 * picker over what the project actually ships — and an array path renders as an
 * add/remove list, which is also the only way to fill the variation set of an
 * event whose list is empty.
 *
 * The rest are the repeat-control and attenuation numbers. Their bounds mirror
 * `normalizeAudioEventTable`'s exactly, so the form refuses what the loader
 * would refuse rather than letting Save carry the message.
 */
/**
 * Audio event headings — the eleven channels of audio plan §5, in its order.
 *
 * The table's rows are a flat namespace and there are twenty-nine of them, so a
 * peer list means scrolling past music to reach a UI click. Membership is by id
 * prefix, which is free: the ids already carry the channel.
 *
 * Both headings that were once deliberately empty have since filled, and the
 * note is kept rather than deleted because what it records is a decision being
 * reversed by production. ECONOMY was §16 with no events; Paket 2 gave it eight.
 * LOGISTICS was the stronger claim — a channel the design chose *not* to give
 * its own sounds, on the grounds that the notification tiers carried it (§69) —
 * and Faz 5's buildings-and-logistics delivery overturned it: a road being paved,
 * a depot joining the network and a border moving out are three things a tier
 * cannot say. COMBAT gathers three prefixes because the table is coarser than
 * the inventories are (§81.2): siege and structure damage are combat sounds
 * without being combat *events*.
 */
const AUDIO_EVENT_CATEGORIES = [
  { id: "ui", label: "UI", prefixes: ["ui."] },
  { id: "notifications", label: "NOTIFICATIONS", prefixes: ["notify."] },
  { id: "economy", label: "ECONOMY", prefixes: ["economy.", "market."] },
  { id: "building", label: "BUILDING", prefixes: ["building."] },
  // The caravan sits here rather than under UNITS: a donkey is not a unit, it is
  // what a road is *for*, and an author looking for its hoofbeat looks where the
  // depot connection is.
  { id: "logistics", label: "LOGISTICS", prefixes: ["logistics.", "caravan."] },
  { id: "units", label: "UNITS", prefixes: ["unit."] },
  { id: "wildlife", label: "WILDLIFE", prefixes: ["wildlife."] },
  { id: "combat", label: "COMBAT", prefixes: ["combat.", "siege.", "structure."] },
  { id: "world-ambience", label: "WORLD_AMBIENCE", prefixes: ["world."] },
  { id: "music", label: "MUSIC", prefixes: ["music."] },
  { id: "voice", label: "VOICE", prefixes: ["voice."] },
  { id: "stingers", label: "STINGERS", prefixes: ["stinger."] },
];

const AUDIO_EVENT_FIELDS = [
  {
    path: "clips",
    label: "Klipler",
    assetOptions: "sound",
    hint: "Manifest ses id'leri. Birden fazlaysa tetik başına biri seçilir.",
  },
  {
    path: "bus",
    label: "Mix bus",
    enum: AUDIO_BUS_IDS,
    hint: "Ses seviyesi slider'ları ve ducking bus üzerinden işler.",
  },
  {
    path: "volume",
    label: "Seviye",
    min: 0,
    max: 10,
    step: 0.05,
    hint: "Kanalı için yüksek. 1'in üstü, sessiz bir bus'ta bir bildirimi aşması gereken tek seferlik sesler için normaldir.",
  },
  { path: "pitchVariation", label: "Pitch sapması (±oran)", min: 0, max: 0.5, step: 0.01 },
  { path: "cooldownMs", label: "Cooldown (ms)", min: 0, max: 600000, step: 10 },
  { path: "maxInstances", label: "Aynı anda en fazla", min: 1, max: 64, step: 1 },
  { path: "spatial", label: "Dünyada konumlu" },
  { path: "loop", label: "Döngü (yatak)" },
  {
    path: "stream",
    label: "Stream (uzun yatak)",
    hint: "Yalnız müzik ve ambiyans için. Kapalıyken klip belleğe tamamen açılır — iki dakikalık stereo bir parça ~44 MiB tutar ve sekme kapanana kadar durur. Tek seferlik seslerde açmayın: stream, zamanlanmış bir örneğe değil hazır olduğu ana başlar.",
  },
  { path: "refDistance", label: "Zayıflamanın başladığı mesafe", min: 0, step: 1 },
  {
    path: "maxDistance",
    label: "Duyulma menzili",
    min: 0,
    step: 1,
    hint: "Bunun ötesindeki kaynak hiç çalınmaz — hem zayıflama parametresi hem kesme.",
  },
  { path: "rolloff", label: "Zayıflama eğrisi", min: 0, max: 10, step: 0.1 },
];

/**
 * The `music` block beside the event table in the same file: how the bed moves
 * between tracks, and the thresholds §28's state machine reads.
 *
 * A second table rather than more fields on the first, because the two blocks
 * have different *rows*. An event is keyed by its id and there are thirty of
 * them; these are named settings that exist exactly once. `section` points each
 * table at its own depth and Save merges that depth back into the whole
 * document, so editing one never rewrites the other.
 *
 * Paths are relative to an entry, which for a scalar setting is the setting
 * itself (`crossfadeSeconds`) and for the states block is the key inside it
 * (`calmSeconds`) — the same rule every other table's field metadata follows.
 *
 * Bounds mirror the two normalizers exactly. They are not a second opinion: a
 * value outside them is refused at Save by the runtime's own parser, and the
 * form's job is to make that refusal impossible to reach by accident.
 */
const AUDIO_MUSIC_FIELDS = [
  {
    path: "crossfadeSeconds",
    label: "Geçiş süresi (sn)",
    min: 0,
    max: 60,
    step: 0.5,
    hint: "İki parçanın üst üste bindiği süre. Geçiş her zaman parçanın sonuna oturur, yani bu sayı büyüdükçe örtüşme parçanın ortasına doğru kayar — küçük bir değer iki parçanın en zayıf yerlerini (birinin kapanışı, ötekinin girişi) çakıştırır ve geçiş duyulmaz.",
  },
  {
    path: "gapSeconds",
    label: "Parçalar arası boşluk (sn)",
    min: 0,
    max: 120,
    step: 0.5,
    hint: "0 = gerçek crossfade. Pozitif değer, kısılan parça ile başlayan parça arasına sessiz bir pencere koyar.",
  },
  {
    path: "segmentSeconds",
    label: "Süre bilinmiyorsa tutma (sn)",
    min: 5,
    max: 3600,
    step: 5,
    hint: "Yalnız süresi henüz ölçülmemiş klip için yedek: klip çözüldüğünde gerçek uzunluğu kullanılır.",
  },
  {
    path: "tensionVisibleEnemies",
    label: "Gerilim — görünen düşman",
    min: 1,
    max: 64,
    step: 1,
    hint: "Sisin ardındaki ordu sayılmaz; düşman işçisi de sayılmaz.",
  },
  {
    path: "battleActiveFights",
    label: "Savaş — süren çatışma",
    min: 1,
    max: 64,
    step: 1,
    hint: "Hedef tutan birim başına bir, iki taraftan da. Hayvana saldıran birim sayılmaz — av ya da kurt temizliği savaş değildir.",
  },
  {
    path: "threatRadius",
    label: "Savaş — merkeze tehdit mesafesi",
    min: 0,
    max: 500,
    step: 1,
    hint: "Görülen bir düşman merkeze bu kadar yaklaşırsa, ilk darbe inmeden savaş sayılır.",
  },
  {
    path: "calmSeconds",
    label: "Sakinleşme gecikmesi (sn)",
    min: 0,
    max: 300,
    step: 1,
    hint: "Yükseliş anında olur, düşüş bu kadar sessizlik ister. Yarıda kesilen bir düşüş pencereyi baştan başlatır.",
  },
];

/**
 * Validates the whole `events.json`, both halves.
 *
 * The engine normalizer owns the events, the buses and the transition timing;
 * `music.states` is the game's and it passes through the engine untouched (an
 * engine that knew what "visible enemies" means would stop being a template).
 * Composing them here is what keeps a threshold the match would refuse at boot
 * from being written by the form that authors it — and both audio tables share
 * this, because both save the same document.
 */
function validateAudioEventsDocument(raw: unknown): unknown {
  const table = normalizeAudioEventTable(raw);
  const music = isRecord(raw) ? raw.music : undefined;
  normalizeRtsMusicStateSettings(isRecord(music) ? music.states : undefined);
  return table;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const asTableValidator =
  (fn: (raw: unknown) => unknown) =>
  (raw: unknown): string | null => {
    try {
      fn(raw);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };

/**
 * Damage-slot field metadata, generated rather than written out.
 *
 * The same six slots appear in all three damage tables, at two depths: directly
 * under the defaults entry, and under `slots.` for a material class or a
 * building. Generating from one list keeps a renamed slot from being labelled in
 * one table and raw in the others.
 */
const DAMAGE_SLOT_LABELS: Readonly<Record<string, string>> = {
  lightSmoke: "Hafif hasar dumanı",
  heavySmoke: "Ağır hasar dumanı",
  ruinSmoke: "Enkaz dumanı",
  debris: "Moloz",
  collapseDust: "Çöküş tozu",
};

/** Aged slots ask their effect once per age; these name the two rows. */
const DAMAGE_AGE_LABELS: Readonly<Record<SettlementAge, string>> = {
  settlement: "Yerleşim Çağı",
  town: "Kasaba Çağı",
};

/** The slot's own name when the game grows one before a label is written for it. */
const damageSlotLabel = (slot: string): string => DAMAGE_SLOT_LABELS[slot] ?? slot;

const DAMAGE_COLLAPSE_STYLE_FIELD = {
  path: "collapseStyle",
  label: "Çöküş biçimi",
  enum: ["topple", "inPlace"],
  hint: "topple: yana devrilir (silueti olan binalar). inPlace: yerinde kalır, materyali kararır — tarla, oduncu kampı, ocak gibi zemin yapıları için.",
};

const DAMAGE_MATERIAL_FIELD = {
  path: "material",
  label: "Malzeme sınıfı",
  hint: "Devralınacak malzeme sınıfının adı (Malzeme Sınıfları tablosundaki bir başlık). Boş bırakılırsa yalnızca varsayılanlar ve buradaki alanlar geçerlidir.",
};

/**
 * Shared by all three sound rows: the one thing an author has to know is that
 * this names an *event*, not a clip. What it sounds like, how loud, how often and
 * how far it carries all stay in the Ses Olayları table — writing a clip id here
 * would silently lose every one of them.
 */
const SOUND_FIELD_HINT =
  "Ses Olayları tablosundaki bir olay adı (ör. structure.impact_stone) — klip adı değil. Boş bırakılırsa bu slot sessizdir.";

function damageSlotFields(prefix: string): readonly {
  path: string;
  label: string;
  hint?: string;
  enum?: readonly string[];
  assetOptions?: string;
  referenceOptions?: string;
  order?: number;
  itemLabels?: readonly string[];
  min?: number;
  max?: number;
  step?: number;
}[] {
  // Slot names come from the runtime's own lists, so a slot the game adds or
  // renames can never stay labelled here as one that no longer exists. The slot
  // itself titles the editor's sub-group, so these labels stay short.
  return RTS_DAMAGE_SLOTS.flatMap((slot) => {
    const repeating = (RTS_DAMAGE_REPEATING_SLOTS as readonly string[]).includes(slot);
    const impact = (RTS_DAMAGE_IMPACT_SLOTS as readonly string[]).includes(slot);
    const aged = (RTS_DAMAGE_AGED_SLOTS as readonly string[]).includes(slot);
    const sounded = (RTS_DAMAGE_SOUND_SLOTS as readonly string[]).includes(slot);
    const rotated = repeating || impact;
    // The whole array is one picker list, not a field per index: the effect is
    // chosen from the manifest's own effect assets, and a slot the file left
    // empty can be filled without hand-editing JSON.
    const effectHint = rotated
      ? "Content Drawer efekt varlığı. Birden fazla seçilirse yapı kimliğine göre biri kullanılır — bir bina ömrü boyunca aynı efekti oynatır."
      : "Content Drawer efekt varlığı. Tek atışlık slot: buradaki efektlerin hepsi aynı anda çalışır.";
    return [
      // An aged slot asks once per age instead of once: the same building sheds
      // timber as a settlement and tile as a town, so there is no single answer
      // to give here. The buildings that keep one material in both ages say so
      // in the Malzeme Sınıfları table, not by collapsing these two rows.
      ...(aged
        ? RTS_DAMAGE_SLOT_AGES.map((age) => ({
          path: `${prefix}${slot}.ages.${age}`,
          label: `${DAMAGE_AGE_LABELS[age]} VFX`,
          assetOptions: "effect",
          order: age === "settlement" ? 10 : 30,
          hint: `${effectHint} Yalnızca sahibi ${age === "town" ? "Kasaba" : "Yerleşim"} çağındayken oynatılır.`,
        }))
        : [{
          path: `${prefix}${slot}.effects`,
          label: "VFX",
          assetOptions: "effect",
          order: 10,
          hint: effectHint,
        }]),
      // Three paths for one field, because `sound` is a union: a bare string
      // (both ages at once, which is how a material class pins one sound) or a
      // per-age map. The form renders from what the file actually holds, so
      // whichever shape was authored is the one that gets a labelled box and the
      // other two paths simply never match — no mode switch, no lost value.
      ...(sounded
        ? [
          {
            path: `${prefix}${slot}.sound`,
            label: "SFX",
            referenceOptions: "audio-events",
            order: 20,
            hint: `${SOUND_FIELD_HINT} Çağdan bağımsız tek bir olay adı; iki çağ için ayrı ses isteniyorsa bu alan yerine ${DAMAGE_AGE_LABELS.settlement} / ${DAMAGE_AGE_LABELS.town} satırları yazılır.`,
          },
          ...RTS_DAMAGE_SLOT_AGES.map((age) => ({
            path: `${prefix}${slot}.sound.${age}`,
            label: `${DAMAGE_AGE_LABELS[age]} SFX`,
            referenceOptions: "audio-events",
            order: age === "settlement" ? 20 : aged ? 40 : 30,
            hint: `${SOUND_FIELD_HINT} Yalnızca sahibi ${DAMAGE_AGE_LABELS[age]} çağındayken çalınır.`,
          })),
        ]
        : []),
      {
        path: `${prefix}${slot}.anchor.mode`,
        label: "Konum",
        order: 50,
        enum: RTS_DAMAGE_ANCHOR_MODES,
        hint: "Efektin doğduğu referans yükseklik. Ayak izinden türetilir, bu yüzden küçük ve büyük binalarda aynı girdi doğru kalır.",
      },
      {
        path: `${prefix}${slot}.anchor.offset.[]`,
        label: "Kayma",
        order: 60,
        itemLabels: ["X", "Y", "Z"],
        min: -50,
        max: 50,
        step: 0.05,
        hint: "Referans noktasının üstüne eklenen serbest kaydırma, dünya birimi.",
      },
      ...(repeating
        ? [{
          path: `${prefix}${slot}.intervalSeconds`,
          label: "Aralık (sn)",
          order: 70,
          min: 0.05,
          max: 60,
          step: 0.05,
          hint: "Efektin kaç saniyede bir yeniden tetikleneceği. Küçük değerler parçacık bütçesini hızla doldurur.",
        }]
        : []),
      ...(impact
        ? [{
          path: `${prefix}${slot}.minIntervalSeconds`,
          label: "En kısa aralık (sn)",
          order: 70,
          min: 0.05,
          max: 60,
          step: 0.05,
          hint: "Darbe slotu: iki patlama arasındaki en kısa süre. Yirmi birim aynı binayı döverken saniyede yirmi patlama olmasını engeller.",
        }]
        : []),
    ];
  });
}

/**
 * The deformation triple, which reads as three anonymous numbers without names.
 * Written once against a prefix because the defaults table edits it as its own
 * entry (`squash`) while an override reaches it through the block
 * (`collapseDeformation.squash`).
 */
const damageDeformationFields = (prefix: string) => [
  {
    path: `${prefix}squash`,
    label: "Basıklık",
    min: 0,
    max: 0.9,
    step: 0.01,
    hint: "Yapının çökerken ne kadar alçaldığı (0 = hiç, 0.9 = neredeyse yere yapışır).",
  },
  {
    path: `${prefix}splay`,
    label: "Yanal yayılma",
    min: 0,
    max: 1,
    step: 0.01,
    hint: "Alçalırken tabanın yanlara ne kadar genişlediği — moloz yığını hissi.",
  },
  {
    path: `${prefix}buckle`,
    label: "Eğilme",
    min: 0,
    max: 0.5,
    step: 0.01,
    hint: "Siluetin ne kadar yana kaykıldığı. Ağır hasarda küçük bir değer yeter.",
  },
];

const DAMAGE_RUIN_SECONDS_FIELD = {
  path: "ruinSeconds",
  label: "Enkaz süresi (sn)",
  min: 0,
  max: 120,
  step: 0.5,
  hint: "Çöküş bittikten sonra enkazın sahnede kalma süresi. Oyun kuralları açısından etkisizdir; 0 = hemen kaybolur.",
};

/** Defaults table: the deformation blocks are entries, so their leaves are bare. */
const DAMAGE_TUNING_FIELDS = [...damageDeformationFields(""), DAMAGE_RUIN_SECONDS_FIELD];

/** Material/building tables: the same values, reached through their block. */
const DAMAGE_OVERRIDE_TUNING_FIELDS = [
  ...damageDeformationFields("collapseDeformation."),
  ...damageDeformationFields("heavyDeformation."),
  DAMAGE_RUIN_SECONDS_FIELD,
];

/** Sub-group titles for the damage slots: one collapsible block per slot, named. */
const DAMAGE_SLOT_GROUP = (path: string) => ({
  path,
  label: "Sunum slotu",
  keyLabels: Object.fromEntries(RTS_DAMAGE_SLOTS.map((slot) => [slot, damageSlotLabel(slot)])),
});

/** Damage-slot SFX choices are the editable event ids, never raw sound clips. */
const DAMAGE_AUDIO_EVENT_OPTIONS = [{
  id: "audio-events",
  path: "game-data/audio/events.json",
  section: "events",
}] as const;

// Friendly Turkish labels + gentle min/max/step for the Data Table editor. These
// are presentation only — the authoritative range check stays in the validators
// above, so the bounds here are convenience, not gates. Paths are dotted leaf
// paths within an entry; `[]` matches any array index (every progression tier /
// level at once). Only the commonly-tuned fields are listed; the rest render
// from their raw key. No editor import: these structurally satisfy the editor's
// field-meta contract, checked at the injection site in src/main.ts.
const UNITS_FIELDS = [
  { path: "label", label: "Ad" },
  { path: "role", label: "Rol" },
  { path: "armorClass", label: "Zırh sınıfı", enum: ["light", "heavy"] },
  { path: "maxHealth", label: "Can", min: 1, step: 1 },
  { path: "moveSpeed", label: "Hareket hızı", min: 0, step: 0.1 },
  { path: "turnRateDegPerSecond", label: "Dönüş hızı (derece/sn)", min: 0, step: 5, hint: "Gövdenin saniyede kaç derece dönebileceği. Boş bırakılırsa birim anında döner — bacakları olan her birim için doğrusu budur. Tekerlekli top gibi bir gövdenin yerinde dönmek yerine yay çizmesi için doldurulur. Yön yalnızca görseldir: yavaş dönmek menzil ya da hasar kaybettirmez." },
  { path: "attackType", label: "Saldırı tipi", enum: ["melee", "ranged"] },
  { path: "attackDamage", label: "Saldırı hasarı", min: 0, step: 1 },
  { path: "attackCooldown", label: "Saldırı bekleme (sn)", min: 0, step: 0.1 },
  { path: "attackRange", label: "Saldırı menzili", min: 0, step: 0.1 },
  {
    path: "minAttackRange",
    label: "En yakın atış menzili",
    min: 0,
    step: 0.1,
    hint: "Bu mesafenin içindeki hedefe ateş edilmez — namlusu bu kadar aşağı inmeyen top içindir. Boş bırakılırsa alt sınır yoktur; elle savrulan ya da atılan her silah için doğrusu budur. Hedef bırakılmaz, yalnızca atış düşer: dibe sokulan düşmana tekme ile karşılık verilir. Saldırı menzilinden küçük olmalıdır.",
  },
  {
    path: "projectileSpeed",
    label: "Ok uçuş hızı (birim/sn)",
    min: 0.1,
    step: 1,
    hint: "Yalnızca okun görsel uçuş hızını değiştirir; hasar, menzil ve saldırı bekleme süresi değişmez.",
  },
  { path: "acquisitionRange", label: "Hedef bulma menzili", min: 0, step: 0.1 },
  { path: "chaseRange", label: "Kovalama menzili", min: 0, step: 0.1 },
  {
    path: "kickDamage",
    label: "Tekme hasarı",
    min: 0,
    step: 1,
    hint: "En yakın atış menzilinin içine giren düşmana atılan tekmenin hasarı. Gerçek hasardır: zırh sınıfı çarpanlarından ve siper direncinden geçer. Üçü birlikte doldurulur — tekme hasarı, menzili ve beklemesi.",
  },
  {
    path: "kickRange",
    label: "Tekme menzili",
    min: 0,
    step: 0.1,
    hint: "Tekmenin eriştiği mesafe. En yakın atış menzilinden büyük olamaz: aksi hâlde birimin aynı zemin üzerinde iki silahı olurdu.",
  },
  {
    path: "kickCooldown",
    label: "Tekme bekleme (sn)",
    min: 0,
    step: 0.1,
    hint: "Tekmeler arası süre. Saldırı beklemesinden bağımsızdır — topun yeniden doldurulması ile adamın tekme atma hızının ilgisi yoktur.",
  },
  { path: "visionRadius", label: "Görüş yarıçapı", min: 0, step: 1 },
  { path: "trainingSeconds", label: "Üretim süresi (sn)", min: 0, step: 1 },
  { path: "populationCost", label: "Nüfus maliyeti", min: 0, step: 1 },
  { path: "requiredAge", label: "Gerekli çağ", enum: ["settlement", "town"] },
  { path: "requiredSettlementLevel", label: "Gerekli merkez kademesi (çağ içi 1-3)", min: 1, max: 3, step: 1, hint: "Bu birimin açılması için krallığın gerekli çağ (requiredAge) içindeki asgari Merkez seviyesi." },
  { path: "productionBuildingId", label: "Üretim binası" },
  { path: "cost.food", label: "Maliyet: Yiyecek", min: 0, step: 1 },
  { path: "cost.wood", label: "Maliyet: Odun", min: 0, step: 1 },
  { path: "cost.stone", label: "Maliyet: Taş", min: 0, step: 1 },
  { path: "cost.gold", label: "Maliyet: Altın", min: 0, step: 1 },
  { path: "damageMultipliers.light", label: "Hasar çarpanı: Hafif", min: 0, step: 0.05 },
  { path: "damageMultipliers.heavy", label: "Hasar çarpanı: Ağır", min: 0, step: 0.05 },
  { path: "damageMultipliers.structure", label: "Hasar çarpanı: Yapı", min: 0, step: 0.05 },
  // Listed next to each other because the second only means anything with the
  // first set to "cannonball" — the validator refuses the pair otherwise, and an
  // author who could set the burst without seeing the weapon would not know why.
  {
    path: "structureAttackVfx",
    label: "Saldırı gösterimi",
    enum: ["firebrand", "cannonball"],
    hint: "Silahı sıradan kılıç/ok gibi görünmeyen birimler için. firebrand: Muhafız'ın binaya attığı meşale. cannonball: Topçu'nun her hedefe savurduğu gülle — hasarı gülle varana kadar bekler.",
  },
  {
    path: "impactEffect",
    label: "İsabet efekti",
    assetOptions: "effect",
    hint: "Gülle düştüğü noktada patlatılan Content Drawer efekt varlığı. Yalnızca 'cannonball' gösterimli birimlerde geçerlidir; boş bırakılırsa gülle sessizce iner.",
  },
];

const usesWorkerProduction = (economy: Readonly<Record<string | number, unknown>>): boolean =>
  typeof economy["perWorkerPerMinute"] === "number";

const workerCampBufferCapacity = (economy: Readonly<Record<string | number, unknown>>): number =>
  usesWorkerProduction(economy)
    ? Number(economy["workerCapacity"]) * Number(economy["perWorkerPerMinute"]) * 2
    : Number(economy["localBufferCapacity"]);

const BUILDINGS_FIELDS = [
  { path: "label", label: "Ad", hint: "Binanın oyunda ve arayüzde görünen adı." },
  { path: "icon", label: "İkon yolu", hint: "Yapı paletindeki simgenin dosya yolu (public köküne göre)." },
  {
    path: "requiredAge",
    label: "Gerekli çağ",
    enum: ["settlement", "town"],
    hint: "Bu binanın inşa edilebilmesi için gereken en düşük çağ. Boşsa Yerleşim çağından itibaren kurulabilir.",
  },
  {
    path: "requiredSettlementLevel",
    label: "Gerekli merkez kademesi (çağ içi 1-3)",
    min: 1,
    max: 3,
    step: 1,
    hint: "Bu binanın açılması için gereken çağ (requiredAge) içindeki asgari Merkez seviyesi. Boşsa çağın açıldığı anda kurulabilir. Örnek: Tarla = Yerleşim Lv2, ilk yiyecek Avcı Kulübesi ve Ağıl.",
  },
  {
    path: "maxHealth",
    label: "Can (temel)",
    min: 1,
    step: 1,
    hint: "Seviye 1 can değeri. Progression tier'ı olan binalarda oyundaki can aşağıdaki 'tier: Can' alanından gelir.",
  },
  { path: "constructionSeconds", label: "İnşa süresi (sn)", min: 0, step: 1, hint: "Bir işçinin binayı sıfırdan tamamlaması için gereken saniye." },
  { path: "visionRadius", label: "Görüş yarıçapı", min: 0, step: 1, hint: "Binanın harita üzerinde etrafını görebildiği menzil (birim)." },
  {
    path: "populationCapacity",
    label: "Nüfus kapasitesi (temel)",
    min: 0,
    step: 1,
    hint: "Bu binanın sağladığı nüfus tavanı (Ev). Progression tier'ı varsa oyundaki değer tier'dan gelir.",
  },
  { path: "cost.food", label: "Maliyet: Yiyecek", min: 0, step: 1, hint: "İnşa için gereken yiyecek." },
  { path: "cost.wood", label: "Maliyet: Odun", min: 0, step: 1, hint: "İnşa için gereken odun." },
  { path: "cost.stone", label: "Maliyet: Taş", min: 0, step: 1, hint: "İnşa için gereken taş." },
  { path: "cost.gold", label: "Maliyet: Altın", min: 0, step: 1, hint: "İnşa için gereken altın." },
  {
    path: "footprint.width",
    label: "Ayak izi: Genişlik",
    min: 1,
    step: 1,
    hint: "Binanın zeminde kapladığı hücre genişliği (birim); yerleştirme ve navigasyon engeli buradan üretilir.",
  },
  { path: "footprint.depth", label: "Ayak izi: Derinlik", min: 1, step: 1, hint: "Binanın zeminde kapladığı hücre derinliği (birim)." },
  // The top-level territory block is the placement / level-1 value; upgraded
  // levels take their radii from the progression tiers below, so the level-1
  // tier there must be kept in sync with these. Flagged so the value is not
  // mistaken for the single source of an outpost's control radius.
  {
    path: "territory.controlRadius",
    label: "Bölge: Kontrol yarıçapı (Sv1)",
    min: 0,
    step: 1,
    hint: "Yerleştirme / Seviye 1 değeri. Üst seviyeler için aşağıdaki progression tier'larını da güncelleyin; Sv1 tier ile aynı kalmalı.",
  },
  {
    path: "territory.connectedControlRadius",
    label: "Bölge: Bağlı kontrol yarıçapı (Sv1)",
    min: 0,
    step: 1,
    hint: "Yerleştirme / Seviye 1 değeri. Üst seviyeler progression tier'larından gelir.",
  },
  {
    path: "territory.expansionPlacementRange",
    label: "Bölge: Genişleme yerleştirme menzili",
    min: 0,
    step: 1,
    hint: "Bu Karakol'un çevresinde yeni bina yerleştirilebilen ek menzil (birim).",
  },
  // Structural tier indices: the validator requires levels [1,2,3], so editing
  // these only breaks a save. Shown read-only rather than as a live input.
  { path: "progression.settlement.[].level", label: "Yerleşim tier: Seviye", readonly: true },
  { path: "progression.town.[].level", label: "Kasaba tier: Seviye", readonly: true },
  // Base economy block. For buildings that carry progression tiers (farm,
  // lumber_camp, quarry, gold_mine) the runtime merges this with the active
  // age × level tier and the TIER WINS (structureUpgradeSystem.applyProgressionTier),
  // so the numbers here are only defaults/fallbacks — the value the match
  // actually uses lives in the `progression.*.economy.*` rows further down.
  // Hints spell that out because it is not obvious from the field name.
  { path: "economy.resourceId", label: "Ekonomi: Üretilen kaynak", hint: "Bu binanın topladığı kaynak türü (food/wood/stone/gold)." },
  {
    path: "economy.workerCapacity",
    label: "Ekonomi: Maks. işçi (temel)",
    min: 0,
    step: 1,
    hint: "Binada aynı anda çalışabilecek işçi sayısı. Progression tier'ı olan binalarda oyundaki değer aşağıdaki 'tier: Maks. işçi' alanından gelir.",
  },
  {
    path: "economy.perWorkerPerMinute",
    label: "Ekonomi: İşçi başı toplama/dk (temel)",
    min: 0,
    step: 0.5,
    hint: "Bir işçinin kaynağın başındayken dakikada topladığı ham miktar. DİKKAT: progression tier'ı olan binalarda oyunda bu değil, aşağıdaki tier değeri kullanılır. Oduncu Kampı gibi yük taşıyan binalarda gerçek verim, ağaç↔kamp yol süresi yüzünden bu sayıdan düşüktür.",
  },
  {
    path: "economy.localBufferCapacity",
    label: "Ekonomi: Kamp deposu (işçi üretiminde otomatik)",
    min: 0,
    step: 1,
    readonly: usesWorkerProduction,
    derive: workerCampBufferCapacity,
    hint: "İşçi sayısı × işçi başı toplama/dk × 2. Lojistik toplayana kadar binada biriken maks. kaynak; dolduğunda üretim durur.",
  },
  {
    path: "economy.gatherRadius",
    label: "Ekonomi: Kaynak arama yarıçapı",
    min: 0,
    step: 1,
    hint: "İşçilerin kamp çevresinde kaynağa (ağaca) gidebileceği maks. mesafe. Uzaklık arttıkça yol süresi uzar, dakikadaki gerçek verim düşer.",
  },
  {
    path: "economy.carryCapacity",
    label: "Ekonomi: İşçi taşıma kapasitesi",
    min: 0,
    step: 1,
    hint: "İşçinin kampa dönüp boşaltmadan önce taşıdığı maks. yük. Büyük değer = daha az gidiş-geliş = daha yüksek gerçek verim.",
  },
  {
    path: "economy.requiresForest",
    label: "Ekonomi: Orman gerektirir",
    hint: "Açıksa bina kaynağı doğrudan üretmek yerine yakındaki ağaçlara işçi gönderir (Oduncu Kampı modeli); 'Kaynak arama yarıçapı' ve 'Taşıma kapasitesi' bu binalar için geçerlidir.",
  },
  {
    path: "economy.requiresResourceNode",
    label: "Ekonomi: Kaynak yatağı gerektirir",
    hint: "Açıksa bina bir taş/altın yatağının üzerine kurulmalı ve kaynağı o yataktan çeker (Taş Ocağı / Altın Madeni).",
  },
  {
    path: "economy.requiresGame",
    label: "Ekonomi: Av hayvanı gerektirir",
    hint: "Açıksa bina yakındaki yaban hayvanına avcı gönderir (Avcı Kulübesi modeli). Tarladan farkı: sürü sonludur, tükenince kulübe boş kalır. 'Kaynak arama yarıçapı' sürünün dolaşma yarıçapından büyük olmalıdır, yoksa otlayan hayvan menzil dışına çıkar.",
  },
  {
    path: "economy.requiresLivestock",
    label: "Ekonomi: Evcil hayvan gerektirir",
    hint: "Açıksa bina üçüncü üretim şeklini kullanır (Ağıl modeli): üretim işçiyle değil ağıldaki hayvan sayısıyla ölçülür. Çobanlar hayvanı güdüp içeri sokar, sonra ağıl işçisiz üretir. Bu açıkken 'İşçi başı toplama/dk' isteğe bağlıdır; yerine 'Hayvan başı üretim/dk' geçer. Diğer kaynak bayraklarıyla (orman/yatak/av) birlikte kullanılamaz.",
  },
  {
    path: "economy.livestockCapacity",
    label: "Ekonomi: Ağıl kapasitesi (temel)",
    min: 0,
    step: 1,
    hint: "Ağılın alabileceği maks. hayvan sayısı; çoğalma da bu sayıda durur. Üretimin sert tavanı budur. Progression tier'ı olan binalarda oyundaki değer aşağıdaki tier alanından gelir.",
  },
  {
    path: "economy.perAnimalPerMinute",
    label: "Ekonomi: Hayvan başı üretim/dk (temel)",
    min: 0,
    step: 0.5,
    hint: "Ağıldaki bir hayvanın dakikada ürettiği yiyecek. Gerçek üretim = bu değer × ağıldaki hayvanların 'pastureYield' toplamı (tür çarpanı animals.json'da). DİKKAT: progression tier'ı olan binalarda oyunda aşağıdaki tier değeri kullanılır.",
  },
  { path: "market.lotSize", label: "Pazar: İşlem miktarı (lot)", min: 1, step: 1, hint: "Tek alım/satım işleminde el değiştiren kaynak miktarı." },
  { path: "market.basePrice.food", label: "Pazar: Taban fiyat: Yiyecek", min: 0, step: 1, hint: "Fiyat endeksi 1.0 iken bir lot yiyeceğin altın fiyatı." },
  { path: "market.basePrice.wood", label: "Pazar: Taban fiyat: Odun", min: 0, step: 1, hint: "Fiyat endeksi 1.0 iken bir lot odunun altın fiyatı." },
  { path: "market.basePrice.stone", label: "Pazar: Taban fiyat: Taş", min: 0, step: 1, hint: "Fiyat endeksi 1.0 iken bir lot taşın altın fiyatı." },
  {
    path: "market.commission",
    label: "Pazar: Komisyon oranı (0-1)",
    min: 0,
    max: 1,
    step: 0.01,
    hint: "Her işlemden kesilen pay; 0.15 = %15. Seviye yükseldikçe aşağıdaki 'tier: Ticaret komisyonu' bunu düşürür.",
  },
  {
    path: "market.priceStep",
    label: "Pazar: Fiyat kayma adımı",
    min: 0,
    step: 0.01,
    hint: "Her işlemin fiyat endeksini ne kadar oynattığı; büyük değer = fiyat daha hızlı değişir.",
  },
  {
    path: "market.indexMin",
    label: "Pazar: Fiyat endeksi alt sınırı",
    min: 0,
    step: 0.05,
    hint: "Fiyatın taban fiyata göre inebileceği en düşük çarpan (ör. 0.3 = %30).",
  },
  {
    path: "market.indexMax",
    label: "Pazar: Fiyat endeksi üst sınırı",
    min: 0,
    step: 0.05,
    hint: "Fiyatın taban fiyata göre çıkabileceği en yüksek çarpan (ör. 4 = 4×).",
  },
  {
    path: "defense.attackDamage",
    label: "Savunma: Hasar (temel)",
    min: 0,
    step: 1,
    hint: "Karakol'un ok başına hasarı (Seviye 1). Üst seviyeler aşağıdaki 'tier: Savunma hasarı' alanından gelir.",
  },
  { path: "defense.attackRange", label: "Savunma: Menzil", min: 0, step: 0.5, hint: "Karakol'un ateş açtığı menzil (birim)." },
  { path: "defense.attackCooldown", label: "Savunma: Atış aralığı (sn)", min: 0, step: 0.1, hint: "İki yaylım arasındaki saniye; küçük değer = daha hızlı ateş." },
  { path: "defense.arrowsPerVolley", label: "Savunma: Yaylım başına atış", min: 0, step: 1, hint: "Her yaylımda fırlatılan mermi sayısı (ok ya da gülle)." },
  { path: "defense.damageMultipliers.light", label: "Savunma: Hasar çarpanı: Hafif", min: 0, step: 0.05, hint: "Hafif zırhlı birimlere karşı hasar çarpanı." },
  { path: "defense.damageMultipliers.heavy", label: "Savunma: Hasar çarpanı: Ağır", min: 0, step: 0.05, hint: "Ağır zırhlı birimlere karşı hasar çarpanı." },
  { path: "defense.damageMultipliers.structure", label: "Savunma: Hasar çarpanı: Yapı", min: 0, step: 0.05, hint: "Binalara karşı hasar çarpanı." },
  // Same pairing rule as the unit block above: the burst only means anything on
  // a "cannonball" weapon, and the validator refuses the pair otherwise.
  {
    path: "defense.attackVfx",
    label: "Savunma: Silah gösterimi",
    enum: ["arrow", "cannonball"],
    hint: "arrow: düz ok izi, hasar anında düşer. cannonball: Topçu'nun güllesi — hasarı gülle varana kadar bekler.",
  },
  {
    path: "defense.impactEffect",
    label: "Savunma: İsabet efekti",
    assetOptions: "effect",
    hint: "Gülle düştüğü noktada patlatılan Content Drawer efekt varlığı. Yalnızca 'cannonball' silahında geçerlidir.",
  },
  // Progression tiers and upgrade levels (any index). These per-tier values are
  // the ones the running match resolves to (age × level); they override the
  // matching base-block fields above, so this is where the live numbers live.
  { path: "progression.settlement.[].maxHealth", label: "Yerleşim tier: Can", min: 1, step: 1, hint: "Yerleşim çağında bu seviyedeki can. Oyunda kullanılan değer budur." },
  { path: "progression.settlement.[].populationCapacity", label: "Yerleşim tier: Nüfus", min: 0, step: 1, hint: "Yerleşim çağında bu seviyede sağlanan nüfus tavanı (Ev)." },
  { path: "progression.town.[].maxHealth", label: "Kasaba tier: Can", min: 1, step: 1, hint: "Kasaba çağında bu seviyedeki can. Oyunda kullanılan değer budur." },
  { path: "progression.town.[].populationCapacity", label: "Kasaba tier: Nüfus", min: 0, step: 1, hint: "Kasaba çağında bu seviyede sağlanan nüfus tavanı (Ev)." },
  { path: "progression.settlement.[].queueCapacity", label: "Yerleşim tier: Üretim kuyruğu", min: 0, step: 1, hint: "Bu seviyede aynı anda sıraya alınabilen birim/yükseltme sayısı (Merkez/Kışla)." },
  { path: "progression.town.[].queueCapacity", label: "Kasaba tier: Üretim kuyruğu", min: 0, step: 1, hint: "Bu seviyede aynı anda sıraya alınabilen birim/yükseltme sayısı." },
  { path: "progression.settlement.[].storageCapacity.food", label: "Yerleşim tier: Depolama: Yiyecek", min: 0, step: 1, hint: "Bu seviyede Depo'nun sunduğu yiyecek depolama tavanı." },
  { path: "progression.settlement.[].storageCapacity.wood", label: "Yerleşim tier: Depolama: Odun", min: 0, step: 1 },
  { path: "progression.settlement.[].storageCapacity.stone", label: "Yerleşim tier: Depolama: Taş", min: 0, step: 1 },
  { path: "progression.settlement.[].storageCapacity.gold", label: "Yerleşim tier: Depolama: Altın", min: 0, step: 1 },
  { path: "progression.town.[].storageCapacity.food", label: "Kasaba tier: Depolama: Yiyecek", min: 0, step: 1 },
  { path: "progression.town.[].storageCapacity.wood", label: "Kasaba tier: Depolama: Odun", min: 0, step: 1 },
  { path: "progression.town.[].storageCapacity.stone", label: "Kasaba tier: Depolama: Taş", min: 0, step: 1 },
  { path: "progression.town.[].storageCapacity.gold", label: "Kasaba tier: Depolama: Altın", min: 0, step: 1 },
  {
    path: "progression.settlement.[].territory.controlRadius",
    label: "Yerleşim tier: Kontrol yarıçapı",
    min: 0,
    step: 1,
    hint: "Bu seviyede Karakol'un tek başına kontrol ettiği yarıçap (birim). Oyunda kullanılan değer budur.",
  },
  {
    path: "progression.settlement.[].territory.connectedControlRadius",
    label: "Yerleşim tier: Bağlı kontrol yarıçapı",
    min: 0,
    step: 1,
    hint: "Bir merkeze/bölgeye bağlıyken genişleyen kontrol yarıçapı.",
  },
  { path: "progression.town.[].territory.controlRadius", label: "Kasaba tier: Kontrol yarıçapı", min: 0, step: 1 },
  { path: "progression.town.[].territory.connectedControlRadius", label: "Kasaba tier: Bağlı kontrol yarıçapı", min: 0, step: 1 },
  {
    path: "progression.settlement.[].defense.attackDamage",
    label: "Yerleşim tier: Savunma hasarı",
    min: 0,
    step: 1,
    hint: "Bu seviyede Karakol'un atış başına hasarı. Oyunda kullanılan değer budur.",
  },
  { path: "progression.town.[].defense.attackDamage", label: "Kasaba tier: Savunma hasarı", min: 0, step: 1 },
  // The rest of the tier's defense block is optional: fill it only to change the
  // *weapon* at that tier — which is what turns the Town Karakol's bow into a
  // gun. Left empty, the tier keeps the base block's cadence, volley and table.
  {
    path: "progression.town.[].defense.attackCooldown",
    label: "Kasaba tier: Savunma atış aralığı (sn)",
    min: 0,
    step: 0.1,
    hint: "Bu seviyedeki yaylım aralığı. Boş bırakılırsa temel savunma bloğundaki değer geçerlidir.",
  },
  {
    path: "progression.town.[].defense.arrowsPerVolley",
    label: "Kasaba tier: Yaylım başına atış",
    min: 0,
    step: 1,
    hint: "Bu seviyedeki mermi sayısı. Top tek gülle atar; boş bırakılırsa temel blok geçerlidir.",
  },
  { path: "progression.town.[].defense.damageMultipliers.light", label: "Kasaba tier: Savunma çarpanı: Hafif", min: 0, step: 0.05 },
  { path: "progression.town.[].defense.damageMultipliers.heavy", label: "Kasaba tier: Savunma çarpanı: Ağır", min: 0, step: 0.05 },
  { path: "progression.town.[].defense.damageMultipliers.structure", label: "Kasaba tier: Savunma çarpanı: Yapı", min: 0, step: 0.05 },
  {
    path: "progression.town.[].defense.attackVfx",
    label: "Kasaba tier: Silah gösterimi",
    enum: ["arrow", "cannonball"],
    hint: "Kasaba çağındaki Karakol topa geçer: 'cannonball'. Boş bırakılırsa temel bloktaki silah kullanılır.",
  },
  {
    path: "progression.town.[].defense.impactEffect",
    label: "Kasaba tier: İsabet efekti",
    assetOptions: "effect",
    hint: "Gülle patlaması için Content Drawer efekt varlığı. Yalnızca 'cannonball' silahında geçerlidir.",
  },
  {
    path: "progression.settlement.[].tradeCommission",
    label: "Yerleşim tier: Ticaret komisyonu (0-1)",
    min: 0,
    max: 1,
    step: 0.01,
    hint: "Bu seviyede Pazar'ın işlem komisyonu; 0.15 = %15. Oyunda kullanılan değer budur.",
  },
  { path: "progression.town.[].tradeCommission", label: "Kasaba tier: Ticaret komisyonu (0-1)", min: 0, max: 1, step: 0.01 },
  // Per-tier economy — the values the match ACTUALLY uses (they override the
  // base economy block above). This is where you tune how much a worker gathers.
  {
    path: "progression.settlement.[].economy.workerCapacity",
    label: "Yerleşim tier: Maks. işçi",
    min: 0,
    step: 1,
    hint: "Yerleşim çağında bu seviyede aynı anda çalışabilecek işçi sayısı. Oyunda kullanılan değer budur.",
  },
  {
    path: "progression.settlement.[].economy.perWorkerPerMinute",
    label: "Yerleşim tier: İşçi başı toplama/dk",
    min: 0,
    step: 0.5,
    hint: "Yerleşim çağında bu seviyede işçi başına dakikada toplama. OYUNDA GERÇEKTEN KULLANILAN değer budur; üstteki temel değeri geçersiz kılar. İşçi başına odun/dk'yı buradan ayarlayın.",
  },
  {
    path: "progression.settlement.[].economy.localBufferCapacity",
    label: "Yerleşim tier: Kamp deposu (işçi üretiminde otomatik)",
    min: 0,
    step: 1,
    readonly: usesWorkerProduction,
    derive: workerCampBufferCapacity,
    hint: "İşçi sayısı × işçi başı toplama/dk × 2. Bu seviyede lojistik toplayana kadar biriken maks. kaynak.",
  },
  {
    path: "progression.settlement.[].economy.carryCapacity",
    label: "Yerleşim tier: Taşıma kapasitesi",
    min: 0,
    step: 1,
    hint: "Bu seviyede işçinin kampa dönmeden taşıdığı maks. yük (Oduncu Kampı).",
  },
  {
    path: "progression.settlement.[].economy.livestockCapacity",
    label: "Yerleşim tier: Ağıl kapasitesi",
    min: 0,
    step: 1,
    hint: "Yerleşim çağında bu seviyede ağılın alabileceği maks. hayvan sayısı. OYUNDA KULLANILAN değer budur; üretimin tavanını bu belirler.",
  },
  {
    path: "progression.settlement.[].economy.perAnimalPerMinute",
    label: "Yerleşim tier: Hayvan başı üretim/dk",
    min: 0,
    step: 0.5,
    hint: "Yerleşim çağında bu seviyede ağıldaki hayvan başına dakikalık yiyecek. OYUNDA KULLANILAN değer budur (Ağıl).",
  },
  {
    path: "progression.town.[].economy.workerCapacity",
    label: "Kasaba tier: Maks. işçi",
    min: 0,
    step: 1,
    hint: "Kasaba çağında bu seviyede aynı anda çalışabilecek işçi sayısı. Oyunda kullanılan değer budur.",
  },
  {
    path: "progression.town.[].economy.perWorkerPerMinute",
    label: "Kasaba tier: İşçi başı toplama/dk",
    min: 0,
    step: 0.5,
    hint: "Kasaba çağında bu seviyede işçi başına dakikada toplama. OYUNDA GERÇEKTEN KULLANILAN değer budur; üstteki temel değeri geçersiz kılar.",
  },
  {
    path: "progression.town.[].economy.localBufferCapacity",
    label: "Kasaba tier: Kamp deposu (işçi üretiminde otomatik)",
    min: 0,
    step: 1,
    readonly: usesWorkerProduction,
    derive: workerCampBufferCapacity,
    hint: "İşçi sayısı × işçi başı toplama/dk × 2. Bu seviyede lojistik toplayana kadar biriken maks. kaynak.",
  },
  {
    path: "progression.town.[].economy.carryCapacity",
    label: "Kasaba tier: Taşıma kapasitesi",
    min: 0,
    step: 1,
    hint: "Bu seviyede işçinin kampa dönmeden taşıdığı maks. yük (Oduncu Kampı).",
  },
  {
    path: "progression.town.[].economy.livestockCapacity",
    label: "Kasaba tier: Ağıl kapasitesi",
    min: 0,
    step: 1,
    hint: "Kasaba çağında bu seviyede ağılın alabileceği maks. hayvan sayısı. OYUNDA KULLANILAN değer budur.",
  },
  {
    path: "progression.town.[].economy.perAnimalPerMinute",
    label: "Kasaba tier: Hayvan başı üretim/dk",
    min: 0,
    step: 0.5,
    hint: "Kasaba çağında bu seviyede ağıldaki hayvan başına dakikalık yiyecek. OYUNDA KULLANILAN değer budur (Ağıl).",
  },
];

const RESOURCES_FIELDS = [
  { path: "label", label: "Ad" },
  {
    path: "tree.capacity",
    label: "Ağaç: Kapasite",
    min: 0,
    step: 5,
    hint: "Haritadaki HER ağacın tuttuğu odun. Ağaç işaretçisinde ayrıca ayarlanmaz; buradaki tek sayı hepsi için geçerlidir. Kesim hızı burada değil, Oduncu Kampı'nın seviye tablosundadır.",
  },
  { path: "safeNode.capacity", label: "Güvenli düğüm: Kapasite", min: 0, step: 1 },
  { path: "safeNode.perWorkerPerMinute", label: "Güvenli düğüm: İşçi başı/dk", min: 0, step: 0.5 },
  { path: "externalNode.capacity", label: "Dış düğüm: Kapasite", min: 0, step: 1 },
  { path: "externalNode.perWorkerPerMinute", label: "Dış düğüm: İşçi başı/dk", min: 0, step: 0.5 },
];

const ANIMALS_FIELDS = [
  { path: "label", label: "Ad" },
  { path: "meatCapacity", label: "Et kapasitesi (yiyecek)", min: 0, step: 5 },
  { path: "maxHealth", label: "Can", min: 0, step: 5 },
  { path: "moveSpeed", label: "Kaçış hızı", min: 0, step: 0.5, hint: "Avcıdan kaçarken; dörtnal klibi buna göre kalibre edilir." },
  { path: "walkClipSpeed", label: "Otlama / yürüme hızı", min: 0, step: 0.1, hint: "Yürüme animasyonunun doğal göründüğü hız. Hayvan tam bu hızda otlar, böylece ayak kayması olmaz. Büyütmek hem yürümeyi hem animasyonu birlikte hızlandırır." },
  { path: "fleeRadius", label: "Kaçış yarıçapı", min: 0, step: 0.5, hint: "Avcı bu mesafeye girince hayvan kaçar." },
  { path: "roamRadius", label: "Dolaşma yarıçapı", min: 0, step: 0.5, hint: "Sürü merkezinden en fazla bu kadar uzaklaşır; avcı kulübesinin menzilinden küçük kalmalı." },
  { path: "tameable", label: "Evcilleştirilebilir", hint: "Açıksa çoban bu türü öldürmek yerine Ağıl'a güdebilir. Kapalıysa aşağıdaki üç evcilleştirme alanı boş bırakılmalıdır; dolu bırakılırsa veri yüklenmez." },
  { path: "tameSeconds", label: "Sakinleştirme süresi (sn)", min: 0, step: 1, hint: "Çoban hayvanı bu kadar süre tutar; ancak evcilleştirilebilir türlerde geçerlidir. Karşılık veren bir türde bu süre aynı zamanda çobanın hasar yediği süredir." },
  { path: "pastureYield", label: "Ağıl verim çarpanı", min: 0, step: 0.1, hint: "Ağıl'ın 'Hayvan başı üretim/dk' değeri bununla çarpılır: bina ağılın ne kadar iyi olduğunu, bu alan hayvanın ne kadar iyi olduğunu söyler." },
  { path: "breedSeconds", label: "Doğum aralığı (sn)", min: 0, step: 5, hint: "Dolu bir ağılda bu türden yeni bir hayvan doğana kadar geçen süre; ağıl kapasitesine kadar." },
  { path: "retaliation.damage", label: "Karşılık: Vuruş hasarı", min: 0, step: 1, hint: "Hayvanı tutan (sakinleştiren ya da avlayan) işçiye vuruş başına verdiği hasar. Boğa modeli. Blok tamamen boş bırakılırsa tür karşılık vermez. Hasar × dakikadaki vuruş × sakinleştirme süresi bir işçinin canını geçerse o türü kimse evcilleştiremez; bu bir ayar kararıdır, doğrulayıcı karışmaz." },
  { path: "retaliation.attacksPerMinute", label: "Karşılık: Dakikadaki vuruş", min: 0, step: 1, hint: "Vuruş sıklığı. Her vuruş bir Attack_Headbutt oynatır." },
];

// Centre-led progression (docs/planned/THREEAGES_CENTER_LED_PROGRESSION_PLAN.md).
// Applied to each top-level age entry (settlement / town). The Town-only fields
// (cost, upgradeSeconds) are simply absent on the Settlement entry. `levelUpgrades`
// carries each age's Lv2 / Lv3 "cost only" centre upgrades.
const AGES_FIELDS = [
  { path: "id", label: "Kimlik", readonly: true },
  { path: "label", label: "Ad" },
  { path: "commandCenter.controlRadius", label: "Merkez: Kontrol yarıçapı", min: 0, step: 1 },
  { path: "commandCenter.workerTrainingSeconds", label: "Merkez: İşçi üretim süresi (sn)", min: 0, step: 1, hint: "Boş bırakılırsa işçinin kendi trainingSeconds değeri kullanılır (Yerleşim)." },
  // Town transition (Yerleşim Lv3 → Kasaba Lv1). Only the Town entry carries these.
  { path: "upgradeSeconds", label: "Kasaba geçiş süresi (sn)", min: 0, step: 1 },
  { path: "cost.food", label: "Kasaba geçiş maliyeti: Yiyecek", min: 0, step: 1 },
  { path: "cost.wood", label: "Kasaba geçiş maliyeti: Odun", min: 0, step: 1 },
  { path: "cost.stone", label: "Kasaba geçiş maliyeti: Taş", min: 0, step: 1 },
  { path: "cost.gold", label: "Kasaba geçiş maliyeti: Altın", min: 0, step: 1 },
  // Centre level upgrades within this age (Lv2, then Lv3).
  { path: "levelUpgrades.[].level", label: "Kademe yükseltmesi: Seviye", readonly: true },
  { path: "levelUpgrades.[].durationSeconds", label: "Kademe: Süre (sn)", min: 0, step: 1 },
  { path: "levelUpgrades.[].cost.food", label: "Kademe maliyeti: Yiyecek", min: 0, step: 1 },
  { path: "levelUpgrades.[].cost.wood", label: "Kademe maliyeti: Odun", min: 0, step: 1 },
  { path: "levelUpgrades.[].cost.stone", label: "Kademe maliyeti: Taş", min: 0, step: 1 },
  { path: "levelUpgrades.[].cost.gold", label: "Kademe maliyeti: Altın", min: 0, step: 1 },
];

const AI_FIELDS = [
  { path: "easy.economyMultiplier", label: "Kolay: Ekonomi çarpanı", min: 0, step: 0.05 },
  { path: "easy.reactionDelaySeconds", label: "Kolay: Tepki gecikmesi (sn)", min: 0, step: 0.5 },
  { path: "normal.economyMultiplier", label: "Normal: Ekonomi çarpanı", min: 0, step: 0.05 },
  { path: "normal.reactionDelaySeconds", label: "Normal: Tepki gecikmesi (sn)", min: 0, step: 0.5 },
  { path: "hard.economyMultiplier", label: "Zor: Ekonomi çarpanı", min: 0, step: 0.05 },
  { path: "hard.reactionDelaySeconds", label: "Zor: Tepki gecikmesi (sn)", min: 0, step: 0.5 },
  { path: "attackPowerRatio", label: "Saldırı güç oranı", min: 0, step: 0.05 },
  { path: "riskyAttackPowerRatio", label: "Riskli saldırı güç oranı", min: 0, step: 0.05 },
  { path: "retreatPowerRatio", label: "Geri çekilme güç oranı", min: 0, step: 0.05 },
  { path: "retreatHealthRatio", label: "Geri çekilme can oranı (0-1)", min: 0, max: 1, step: 0.05 },
  { path: "dominancePowerRatio", label: "Üstünlük güç oranı", min: 0, step: 0.05 },
  { path: "minimumCommitmentSeconds", label: "Asgari taahhüt süresi (sn)", min: 0, step: 1 },
  { path: "incomeTargetsPerMinute.food", label: "Gelir hedefi/dk: Yiyecek", min: 0, step: 1 },
  { path: "incomeTargetsPerMinute.wood", label: "Gelir hedefi/dk: Odun", min: 0, step: 1 },
  { path: "incomeTargetsPerMinute.stone", label: "Gelir hedefi/dk: Taş", min: 0, step: 1 },
  { path: "incomeTargetsPerMinute.gold", label: "Gelir hedefi/dk: Altın", min: 0, step: 1 },
  { path: "workerTarget.settlement", label: "İşçi hedefi: Yerleşim", min: 0, step: 1 },
  { path: "workerTarget.town", label: "İşçi hedefi: Kasaba", min: 0, step: 1 },
];

// V4 görünür lojistik: yük eşeği (`balance/logistics.json`). Tek girdi, çünkü
// kervan bir tür değil bir rol — bu tablo "eşek nasıl bir taşıyıcı" sorusunu
// yanıtlar, "hangi hayvan" sorusunu değil (o cevap Hayvan Dengesi'nde).
const LOGISTICS_FIELDS = [
  { path: "label", label: "Ad" },
  { path: "carryCapacity", label: "Sefer başına yük", min: 0, step: 5, hint: "Bir seferde taşınan kaynak. Üreticilerin en küçük 'Yerel tampon' değerini aşamaz: aşarsa kervan binayı her gelişinde boşaltır, tampon hiç dolmaz ve uzak üreticinin gecikmesi hissedilmez." },
  { path: "moveSpeed", label: "Yol hızı", min: 0, step: 0.1, hint: "Kervanın yolda ilerleme hızı. Yavaşlatmak uzak üreticiyi pahalılaştırır — kervan bir gecikmedir." },
  { path: "walkClipSpeed", label: "Yürüme klibi hızı", min: 0, step: 0.1, hint: "Yürüme animasyonunun doğal göründüğü hız. Yol hızıyla arası açılırsa eşek ayaklarını kaydırarak yürür; ikisini birlikte ayarlayın." },
  { path: "loadSeconds", label: "Yükleme/boşaltma (sn)", min: 0, step: 0.5, hint: "Yolun iki ucunda beklenen süre; kervanın 'çalışıyor' göründüğü an." },
  { path: "spawnPerProducer", label: "Üretici başına kervan", min: 1, step: 1, hint: "Bağlı her üreticinin yolda tuttuğu eşek sayısı. Tam sayı olmalıdır." },
];

// Arz noktaları (`balance/trade-sites.json`). Satırlar *tür*tür, tek tek nokta
// değil: haritada altı nokta var ama üç tür, ve bir türü ayarlamak iki yakayı
// birden ayarlar — adaletin veriden gelmesi bu yüzden.
const TRADE_SITE_FIELDS = [
  { path: "label", label: "Ad" },
  { path: "resourceId", label: "Kaynak", hint: "Bu noktanın pazara taşıdığı kaynak. Pazarda fiyatı olmayan bir kaynak seçilirse alış düğmesi hiç açılmaz." },
  { path: "perMinute", label: "Dakikada üretim", min: 0, step: 5, hint: "Tamponu dolduran hız. Sahip olunan üreticinin üstüne çıkarsa arz noktası kendi kampınızın yerini alır; altında kalması kasıtlıdır." },
  { path: "carryCapacity", label: "Sefer başına yük", min: 0, step: 5, hint: "Bir eşeğin tek seferde götürdüğü miktar. Tampondan büyük olamaz." },
  { path: "bufferCapacity", label: "Yerel tampon", min: 0, step: 10, hint: "Nokta durmadan önce biriktirebildiği miktar. Sefer yükünün altına inerse tampon hiç dolmaz ve 'tampon dolu' uyarısı kaybolur." },
  { path: "caravanCount", label: "Nokta başına kervan", min: 1, step: 1, hint: "Bu noktanın yolda tuttuğu eşek sayısı. Tek eşekle bir lot ~4 dakika sürer, dörtle ~1 dakika." },
  { path: "dock.width", label: "Rıhtım genişliği", min: 1, step: 1, hint: "Yolun değeceği alanın ölçüsü. Üstüne bina kurulamaz ve yol döşenemez; yol kenarından temas eder." },
  { path: "dock.depth", label: "Rıhtım derinliği", min: 1, step: 1 },
];

const ROADS_FIELDS = [
  { path: "cellSize", label: "Hücre boyutu (birim)", min: 0.1, step: 0.1 },
  { path: "costPerCell.wood", label: "Hücre başına odun maliyeti (Yerleşim)", min: 0, step: 1 },
  { path: "costPerCellByAge.town.stone", label: "Hücre başına taş maliyeti (Kasaba)", min: 0, step: 1 },
  { path: "visual.cornerRoundness", label: "Köşe yuvarlaklığı", min: 0, max: 1, step: 0.05 },
];

export const GAME_EDITOR_CATALOG = {
  gameModeOptions: GAME_MODE_OPTIONS,
  behaviorScriptIds: BEHAVIOR_SCRIPT_IDS,
  resolveMontageBindings,
  formatInputCode,
  keysForAction,
  createRagdollDriver,
  // Balance files editable from the editor's "Veri" menu. Each `validate` is the
  // real runtime validator (validateGameData.ts), so tuning from the editor can
  // never write data the `?rts` boot would reject; the editor's per-entry "reset
  // to defaults" restores an entry from git HEAD. Adding a file here is all it
  // takes to make it editable — the form and reset button are generic.
  dataTables: [
    // Three views onto one section of `rts-content.json`, each pointed at the
    // depth whose keys are the rows an author thinks in: the base presentation,
    // the debris families, and the per-building exceptions. Splitting them is
    // what lets one field-metadata list label all three.
    {
      id: "rts-damage-defaults",
      label: "Yapı Hasarı — Varsayılan Sunum",
      path: "game-data/content/rts-content.json",
      section: "damage.defaults",
      fields: [DAMAGE_COLLAPSE_STYLE_FIELD, ...DAMAGE_TUNING_FIELDS, ...damageSlotFields("")],
      optionSources: DAMAGE_AUDIO_EVENT_OPTIONS,
      // The `slots` entry's own keys are the slots, so the entry root is what
      // groups here; the material/building tables reach them under `slots`.
      groups: [DAMAGE_SLOT_GROUP("")],
      validate: asTableValidator(validateRtsContentDamageSection),
    },
    {
      id: "rts-damage-materials",
      label: "Yapı Hasarı — Malzeme Sınıfları",
      path: "game-data/content/rts-content.json",
      section: "damage.materials",
      fields: [
        DAMAGE_COLLAPSE_STYLE_FIELD,
        ...DAMAGE_OVERRIDE_TUNING_FIELDS,
        ...damageSlotFields("slots."),
      ],
      optionSources: DAMAGE_AUDIO_EVENT_OPTIONS,
      groups: [DAMAGE_SLOT_GROUP("slots")],
      validate: asTableValidator(validateRtsContentDamageSection),
    },
    {
      id: "rts-damage-buildings",
      label: "Yapı Hasarı — Bina Özel",
      path: "game-data/content/rts-content.json",
      section: "damage.buildings",
      fields: [
        DAMAGE_MATERIAL_FIELD,
        DAMAGE_COLLAPSE_STYLE_FIELD,
        ...DAMAGE_OVERRIDE_TUNING_FIELDS,
        ...damageSlotFields("slots."),
      ],
      optionSources: DAMAGE_AUDIO_EVENT_OPTIONS,
      groups: [DAMAGE_SLOT_GROUP("slots")],
      validate: asTableValidator(validateRtsContentDamageSection),
    },
    {
      id: "audio-events",
      label: "Ses Olayları",
      path: "game-data/audio/events.json",
      // The file carries the bus mix and two comment blocks alongside the table;
      // `section` points the editor at the depth whose keys are the rows an
      // author thinks in, so those never appear as editable entries.
      section: "events",
      fields: AUDIO_EVENT_FIELDS,
      entryCategories: AUDIO_EVENT_CATEGORIES,
      // The runtime's own normalizer, so the form cannot save a table the match
      // would refuse to load — and Save merges the section back before this runs,
      // which is what keeps the bus block intact.
      validate: asTableValidator(validateAudioEventsDocument),
    },
    {
      id: "audio-music",
      label: "Ses — Müzik Geçişleri",
      // Same file as the event table, a different depth of it. The music bed's
      // timing is not a property of any one sound — `crossfadeSeconds` describes
      // the *seam* between two plays — so it has never had a row to live on.
      path: "game-data/audio/events.json",
      section: "music",
      fields: AUDIO_MUSIC_FIELDS,
      validate: asTableValidator(validateAudioEventsDocument),
    },
    {
      id: "units",
      label: "Birim Dengesi",
      path: "game-data/balance/units.json",
      fields: UNITS_FIELDS,
      // `projectileSpeed` was introduced after the committed units table. A
      // reset must retain the gameplay-authored default instead of erasing the
      // field by restoring that older git revision verbatim.
      resetEntryDefaults: {
        archer_placeholder: { projectileSpeed: 25 },
      },
      validate: asTableValidator(validateUnitBalance),
    },
    {
      id: "buildings",
      label: "Yapı Dengesi",
      path: "game-data/balance/buildings.json",
      fields: BUILDINGS_FIELDS,
      // Friendly names for the repeated blocks so each tier/level renders as its
      // own collapsible sub-group (e.g. "Yerleşim — Seviye 1").
      groups: [
        { path: "progression.settlement", label: "Yerleşim çağı" },
        { path: "progression.town", label: "Kasaba çağı" },
      ],
      validate: asTableValidator(validateBuildingBalance),
    },
    {
      id: "resources",
      label: "Kaynak Dengesi",
      path: "game-data/balance/resources.json",
      fields: RESOURCES_FIELDS,
      validate: asTableValidator(validateResourceBalance),
    },
    {
      id: "animals",
      label: "Hayvan Dengesi",
      path: "game-data/balance/animals.json",
      fields: ANIMALS_FIELDS,
      validate: asTableValidator(validateAnimalBalance),
    },
    {
      id: "ages",
      label: "Çağ ve Merkez İlerleme Dengesi",
      path: "game-data/balance/ages.json",
      fields: AGES_FIELDS,
      groups: [
        { path: "levelUpgrades", label: "Merkez kademe yükseltmesi" },
      ],
      validate: asTableValidator(validateAgeBalance),
    },
    {
      id: "ai",
      label: "Yapay Zekâ Dengesi",
      path: "game-data/balance/ai.json",
      fields: AI_FIELDS,
      validate: asTableValidator(validateAiBalance),
    },
    {
      id: "roads",
      label: "Yol Dengesi",
      path: "game-data/balance/roads.json",
      fields: ROADS_FIELDS,
      validate: asTableValidator(validateRoadBalance),
    },
    {
      id: "trade-sites",
      label: "Arz Noktası Dengesi",
      path: "game-data/balance/trade-sites.json",
      fields: TRADE_SITE_FIELDS,
      // The cross-table check (`resourceId` has to be priced by the Market, and
      // gated by its `stocked` list) is deliberately not applied here: it needs
      // `buildings.json`, which this route does not load. The runtime boot and
      // the engine suite both apply it, so a site authored for a resource nobody
      // can buy is caught where it would actually be played.
      validate: asTableValidator(validateTradeSiteBalance),
    },
    {
      id: "logistics",
      label: "Lojistik Dengesi (Yük Eşeği)",
      path: "game-data/balance/logistics.json",
      fields: LOGISTICS_FIELDS,
      // The cross-table bound (`carryCapacity` vs the smallest producer buffer)
      // is deliberately not applied here: it needs `buildings.json`, which this
      // route does not load. The runtime boot does apply it, so a load authored
      // past the bound is refused where it would actually be played.
      validate: asTableValidator(validateCaravanBalance),
    },
  ],
};
