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
  validateResourceBalance,
  validateRoadBalance,
  validateUnitBalance,
} from "@/game/data/validateGameData";

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
  { path: "requiredBuildingLevel", label: "Gerekli bina seviyesi", min: 1, step: 1 },
  { path: "productionBuildingId", label: "Üretim binası" },
  { path: "cost.food", label: "Maliyet: Yiyecek", min: 0, step: 1 },
  { path: "cost.wood", label: "Maliyet: Odun", min: 0, step: 1 },
  { path: "cost.stone", label: "Maliyet: Taş", min: 0, step: 1 },
  { path: "cost.gold", label: "Maliyet: Altın", min: 0, step: 1 },
  { path: "damageMultipliers.light", label: "Hasar çarpanı: Hafif", min: 0, step: 0.05 },
  { path: "damageMultipliers.heavy", label: "Hasar çarpanı: Ağır", min: 0, step: 0.05 },
  { path: "damageMultipliers.structure", label: "Hasar çarpanı: Yapı", min: 0, step: 0.05 },
];

const BUILDINGS_FIELDS = [
  { path: "label", label: "Ad" },
  { path: "requiredAge", label: "Gerekli çağ", enum: ["settlement", "town"] },
  { path: "maxHealth", label: "Can (temel)", min: 1, step: 1 },
  { path: "constructionSeconds", label: "İnşa süresi (sn)", min: 0, step: 1 },
  { path: "visionRadius", label: "Görüş yarıçapı", min: 0, step: 1 },
  { path: "populationCapacity", label: "Nüfus kapasitesi (temel)", min: 0, step: 1 },
  { path: "cost.wood", label: "Maliyet: Odun", min: 0, step: 1 },
  { path: "cost.stone", label: "Maliyet: Taş", min: 0, step: 1 },
  { path: "footprint.width", label: "Ayak izi: Genişlik", min: 1, step: 1 },
  { path: "footprint.depth", label: "Ayak izi: Derinlik", min: 1, step: 1 },
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
  { path: "territory.expansionPlacementRange", label: "Bölge: Genişleme yerleştirme menzili", min: 0, step: 1 },
  // Structural tier indices: the validator requires levels [1,2,3], so editing
  // these only breaks a save. Shown read-only rather than as a live input.
  { path: "progression.settlement.[].level", label: "Yerleşim tier: Seviye", readonly: true },
  { path: "progression.town.[].level", label: "Kasaba tier: Seviye", readonly: true },
  { path: "levels.[].level", label: "Yükseltme seviyesi", readonly: true },
  { path: "economy.resourceId", label: "Ekonomi: Kaynak" },
  { path: "economy.workerCapacity", label: "Ekonomi: İşçi kapasitesi", min: 0, step: 1 },
  { path: "economy.perWorkerPerMinute", label: "Ekonomi: İşçi başı/dk", min: 0, step: 0.5 },
  { path: "economy.localBufferCapacity", label: "Ekonomi: Yerel tampon", min: 0, step: 1 },
  { path: "economy.gatherRadius", label: "Ekonomi: Toplama yarıçapı", min: 0, step: 1 },
  { path: "economy.carryCapacity", label: "Ekonomi: Taşıma kapasitesi", min: 0, step: 1 },
  { path: "market.lotSize", label: "Pazar: Lot boyutu", min: 1, step: 1 },
  { path: "market.commission", label: "Pazar: Komisyon (0-1)", min: 0, max: 1, step: 0.01 },
  { path: "market.priceStep", label: "Pazar: Fiyat adımı", min: 0, step: 0.01 },
  { path: "market.indexMin", label: "Pazar: Endeks alt sınır", min: 0, step: 0.05 },
  { path: "market.indexMax", label: "Pazar: Endeks üst sınır", min: 0, step: 0.05 },
  { path: "defense.attackDamage", label: "Savunma: Hasar", min: 0, step: 1 },
  { path: "defense.attackRange", label: "Savunma: Menzil", min: 0, step: 0.5 },
  { path: "defense.attackCooldown", label: "Savunma: Bekleme (sn)", min: 0, step: 0.1 },
  // Progression tiers and upgrade levels (any index):
  { path: "progression.settlement.[].maxHealth", label: "Yerleşim tier: Can", min: 1, step: 1 },
  { path: "progression.settlement.[].populationCapacity", label: "Yerleşim tier: Nüfus", min: 0, step: 1 },
  { path: "progression.town.[].maxHealth", label: "Kasaba tier: Can", min: 1, step: 1 },
  { path: "progression.town.[].populationCapacity", label: "Kasaba tier: Nüfus", min: 0, step: 1 },
  { path: "levels.[].maxHealth", label: "Seviye: Can", min: 1, step: 1 },
  { path: "levels.[].populationCapacity", label: "Seviye: Nüfus", min: 0, step: 1 },
  { path: "levels.[].durationSeconds", label: "Seviye: Süre (sn)", min: 0, step: 1 },
  { path: "levels.[].cost.wood", label: "Seviye maliyeti: Odun", min: 0, step: 1 },
  { path: "levels.[].cost.stone", label: "Seviye maliyeti: Taş", min: 0, step: 1 },
  { path: "levels.[].tradeCommission", label: "Seviye: Ticaret komisyonu (0-1)", min: 0, max: 1, step: 0.01 },
];

const RESOURCES_FIELDS = [
  { path: "label", label: "Ad" },
  { path: "safeNode.capacity", label: "Güvenli düğüm: Kapasite", min: 0, step: 1 },
  { path: "safeNode.perWorkerPerMinute", label: "Güvenli düğüm: İşçi başı/dk", min: 0, step: 0.5 },
  { path: "externalNode.capacity", label: "Dış düğüm: Kapasite", min: 0, step: 1 },
  { path: "externalNode.perWorkerPerMinute", label: "Dış düğüm: İşçi başı/dk", min: 0, step: 0.5 },
];

const AGES_FIELDS = [
  { path: "id", label: "Kimlik", readonly: true },
  { path: "label", label: "Ad" },
  { path: "upgradeSeconds", label: "Yükseltme süresi (sn)", min: 0, step: 1 },
  { path: "requiredCommandCenterLevel", label: "Gerekli merkez seviyesi", min: 1, step: 1 },
  { path: "cost.food", label: "Maliyet: Yiyecek", min: 0, step: 1 },
  { path: "cost.wood", label: "Maliyet: Odun", min: 0, step: 1 },
  { path: "cost.stone", label: "Maliyet: Taş", min: 0, step: 1 },
  { path: "cost.gold", label: "Maliyet: Altın", min: 0, step: 1 },
  { path: "commandCenter.maxHealth", label: "Merkez: Can", min: 1, step: 1 },
  { path: "commandCenter.controlRadius", label: "Merkez: Kontrol yarıçapı", min: 0, step: 1 },
  { path: "commandCenter.workerTrainingSeconds", label: "Merkez: İşçi üretim süresi (sn)", min: 0, step: 1 },
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

const ROADS_FIELDS = [
  { path: "cellSize", label: "Hücre boyutu (birim)", min: 0.1, step: 0.1 },
  { path: "woodCostPerCell", label: "Hücre başına odun maliyeti", min: 0, step: 1 },
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
      id: "ages",
      label: "Çağ Dengesi",
      path: "game-data/balance/ages.json",
      fields: AGES_FIELDS,
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
  ],
};
