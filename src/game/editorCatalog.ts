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
      validate: asTableValidator(validateUnitBalance),
    },
    {
      id: "buildings",
      label: "Yapı Dengesi",
      path: "game-data/balance/buildings.json",
      validate: asTableValidator(validateBuildingBalance),
    },
    {
      id: "resources",
      label: "Kaynak Dengesi",
      path: "game-data/balance/resources.json",
      validate: asTableValidator(validateResourceBalance),
    },
    {
      id: "ages",
      label: "Çağ Dengesi",
      path: "game-data/balance/ages.json",
      validate: asTableValidator(validateAgeBalance),
    },
    {
      id: "ai",
      label: "Yapay Zekâ Dengesi",
      path: "game-data/balance/ai.json",
      validate: asTableValidator(validateAiBalance),
    },
    {
      id: "roads",
      label: "Yol Dengesi",
      path: "game-data/balance/roads.json",
      validate: asTableValidator(validateRoadBalance),
    },
  ],
};
