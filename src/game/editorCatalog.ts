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
  validateUnitBalance,
} from "@/game/data/validateGameData";
import {
  RTS_DAMAGE_ANCHOR_MODES,
  RTS_DAMAGE_IMPACT_SLOTS,
  RTS_DAMAGE_REPEATING_SLOTS,
  RTS_DAMAGE_SLOTS,
  validateRtsContentDamageSection,
} from "@/game/rts/content/rtsContentCatalog";

/**
 * Wrap a runtime game-data validator as the editor's `validate` contract:
 * `null` when the document is accepted, otherwise the validator's own
 * field-level message. This is what lets the Data Table editor refuse a save
 * the game would reject at boot, using the exact same rules the runtime loads
 * with — without the editor ever importing `@/game`.
 */
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
  impactDebris: "Darbe molozu",
  collapseDust: "Çöküş tozu",
  collapseDebris: "Çöküş molozu",
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

function damageSlotFields(prefix: string): readonly {
  path: string;
  label: string;
  hint?: string;
  enum?: readonly string[];
  assetOptions?: string;
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
    const rotated = repeating || impact;
    return [
      {
        // The whole array is one picker list, not a field per index: the effect
        // is chosen from the manifest's own effect assets, and a slot the file
        // left empty can be filled without hand-editing JSON.
        path: `${prefix}${slot}.effects`,
        label: "Efekt",
        assetOptions: "effect",
        hint: rotated
          ? "Content Drawer efekt varlığı. Birden fazla seçilirse yapı kimliğine göre biri kullanılır — bir bina ömrü boyunca aynı efekti oynatır."
          : "Content Drawer efekt varlığı. Tek atışlık slot: buradaki efektlerin hepsi aynı anda çalışır.",
      },
      {
        path: `${prefix}${slot}.anchor.mode`,
        label: "Konum",
        enum: RTS_DAMAGE_ANCHOR_MODES,
        hint: "Efektin doğduğu referans yükseklik. Ayak izinden türetilir, bu yüzden küçük ve büyük binalarda aynı girdi doğru kalır.",
      },
      {
        path: `${prefix}${slot}.anchor.offset.[]`,
        label: "Kayma",
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
  { path: "attackType", label: "Saldırı tipi", enum: ["melee", "ranged"] },
  { path: "attackDamage", label: "Saldırı hasarı", min: 0, step: 1 },
  { path: "attackCooldown", label: "Saldırı bekleme (sn)", min: 0, step: 0.1 },
  { path: "attackRange", label: "Saldırı menzili", min: 0, step: 0.1 },
  { path: "acquisitionRange", label: "Hedef bulma menzili", min: 0, step: 0.1 },
  { path: "chaseRange", label: "Kovalama menzili", min: 0, step: 0.1 },
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
    label: "Ekonomi: Kamp deposu (temel)",
    min: 0,
    step: 1,
    hint: "Lojistik toplayana kadar binada biriken maks. kaynak; dolduğunda üretim durur.",
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
  { path: "defense.arrowsPerVolley", label: "Savunma: Yaylım başına ok", min: 0, step: 1, hint: "Her atışta fırlatılan ok sayısı." },
  { path: "defense.damageMultipliers.light", label: "Savunma: Hasar çarpanı: Hafif", min: 0, step: 0.05, hint: "Hafif zırhlı birimlere karşı hasar çarpanı." },
  { path: "defense.damageMultipliers.heavy", label: "Savunma: Hasar çarpanı: Ağır", min: 0, step: 0.05, hint: "Ağır zırhlı birimlere karşı hasar çarpanı." },
  { path: "defense.damageMultipliers.structure", label: "Savunma: Hasar çarpanı: Yapı", min: 0, step: 0.05, hint: "Binalara karşı hasar çarpanı." },
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
    hint: "Bu seviyede Karakol'un ok başına hasarı. Oyunda kullanılan değer budur.",
  },
  { path: "progression.town.[].defense.attackDamage", label: "Kasaba tier: Savunma hasarı", min: 0, step: 1 },
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
    label: "Yerleşim tier: Kamp deposu",
    min: 0,
    step: 1,
    hint: "Bu seviyede lojistik toplayana kadar biriken maks. kaynak.",
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
    label: "Kasaba tier: Kamp deposu",
    min: 0,
    step: 1,
    hint: "Bu seviyede lojistik toplayana kadar biriken maks. kaynak.",
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
  { path: "maxHealth", label: "Can", min: 0, step: 5, hint: "Kervan saldırılabilir bir hedeftir; düşük can baskını ödüllendirir." },
  { path: "loadSeconds", label: "Yükleme/boşaltma (sn)", min: 0, step: 0.5, hint: "Yolun iki ucunda beklenen süre; kervanın 'çalışıyor' göründüğü an." },
  { path: "spawnPerProducer", label: "Üretici başına kervan", min: 1, step: 1, hint: "Bağlı her üreticinin yolda tuttuğu eşek sayısı. Tam sayı olmalıdır." },
];

const ROADS_FIELDS = [
  { path: "cellSize", label: "Hücre boyutu (birim)", min: 0.1, step: 0.1 },
  { path: "woodCostPerCell", label: "Hücre başına odun maliyeti", min: 0, step: 1 },
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
      groups: [DAMAGE_SLOT_GROUP("slots")],
      validate: asTableValidator(validateRtsContentDamageSection),
    },
    {
      id: "units",
      label: "Birim Dengesi",
      path: "game-data/balance/units.json",
      fields: UNITS_FIELDS,
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
