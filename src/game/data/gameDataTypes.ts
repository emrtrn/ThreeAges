/**
 * Game-data shapes — Vertical Slice Plan v0.2 §14 / §72.
 *
 * These describe the read-only JSON served from `public/game-data/` (TD-003):
 * version stamps and test presets. Balance tables are added here when Faz 3+
 * introduce them; for Faz 0 only version + preset exist.
 *
 * Type-only module (no runtime cost); safe to import from both browser runtime
 * and node tests.
 */
import type { FeatureFlag } from "../core/featureFlags";

/** `public/game-data/version.json` — plan §17 "Build sürümü ve balance sürümü". */
export interface GameVersion {
  /** Semantic-ish build stamp for the code/data snapshot. */
  buildVersion: string;
  /** Balance-data revision, bumped when tuning numbers change (plan §71). */
  balanceVersion: string;
}

/** AI opponent tuning profile (plan §72). Only "normal" exists in Ürün A. */
export type AiProfile = "easy" | "normal" | "hard";

/** Starting stockpile a preset grants (plan §72). Keys are resource ids; the
 *  Ürün A economy uses food/wood/population, later products add stone/gold. */
export type StartingResources = Readonly<Record<string, number>>;

/**
 * A test preset — `public/game-data/presets/<id>.json` (plan §72).
 * Presets decide feature flags, starting resources, game speed, map state and
 * AI profile so a scenario is reproducible from data alone.
 */
export interface GamePreset {
  /** Stable id, must match the file name (e.g. "gameplay_proof"). */
  id: string;
  /** Human-readable label for menus / debug. */
  label: string;
  /** Feature-flag overrides for this scenario (unset flags keep their default). */
  flags: Partial<Record<FeatureFlag, boolean>>;
  /** Resources granted at match start. */
  startingResources: StartingResources;
  /** Simulation speed multiplier (1 = real time; debug_fast raises it). */
  gameSpeed: number;
  /** Map/level this preset boots into (blockout id; empty until Faz 2). */
  mapState: string;
  /** AI opponent profile. */
  aiProfile: AiProfile;
}

/** Balance stats shared by a unit definition (GDD 12 §5). */
export interface UnitBalanceStats {
  /** Maximum hit points; must be positive. */
  maxHealth: number;
  /** Damage dealt by one successful basic melee hit; must be positive. */
  attackDamage: number;
  /** Seconds between basic melee hits; must be positive. */
  attackCooldown: number;
  /** Maximum ground-plane distance from which a basic hit may land; must be positive. */
  attackRange: number;
  /** Seconds a completed production building needs to train this unit. */
  trainingSeconds: number;
  /** Resources reserved when this unit enters a production queue. */
  readonly cost: StartingResources;
  /** Population capacity consumed by this unit once queued. */
  readonly populationCost: number;
}

/** `public/game-data/balance/units.json` — keyed by stable unit id. */
export type UnitBalance = Readonly<Record<string, UnitBalanceStats>>;

/** One grid-aligned RTS building definition, loaded from balance/buildings.json. */
export interface BuildingBalanceStats {
  /** Stable data id, copied from the key in `balance/buildings.json`. */
  readonly id: string;
  readonly label: string;
  /** World-space footprint dimensions; both are multiples of the placement grid. */
  readonly footprint: { readonly width: number; readonly depth: number };
  /** Resource reservation is implemented in the following Phase 2 slice. */
  readonly cost: StartingResources;
  readonly constructionSeconds: number;
  /** Capacity supplied while this completed structure is standing. */
  readonly populationCapacity?: number;
  /** Present only on structures which turn assigned workers into a resource. */
  readonly economy?: EconomyProductionBalance;
  /** Present on structures which extend the control area once complete. */
  readonly territory?: TerritoryBuildingBalance;
}

/** Data-owned first-pass production behaviour for a food or wood structure. */
export interface EconomyProductionBalance {
  readonly resourceId: string;
  readonly workerCapacity: number;
  readonly perWorkerPerMinute: number;
  readonly localBufferCapacity: number;
}

/** Territory source and bounded expansion rule supplied by a completed structure. */
export interface TerritoryBuildingBalance {
  /** Radius unlocked immediately after this structure completes. */
  readonly controlRadius: number;
  /** Maximum gap from friendly territory when this special structure is placed. */
  readonly expansionPlacementRange: number;
}

/** `public/game-data/balance/buildings.json` — keyed by stable building id. */
export type BuildingBalance = Readonly<Record<string, BuildingBalanceStats>>;

/** `public/game-data/balance/roads.json` — first-pass logistics road tuning. */
export interface RoadBalance {
  /** Grid cell width in world units; intentionally independent from unit navigation. */
  readonly cellSize: number;
  /** Wood charged for each newly created road cell. */
  readonly woodCostPerCell: number;
}
