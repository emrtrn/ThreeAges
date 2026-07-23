/**
 * Editor-owned contract for the game-provided catalogs/helpers the editor
 * renders: the Game Mode list, behavior-script ids, the montage→input binding
 * resolver, input-code formatting, and the ragdoll driver used by the
 * skeletal-mesh preview.
 *
 * Inversion of control. The editor core stays generic and must not import
 * `@/game` — a fork owns `src/game` and may reshape those exports. Instead the
 * composition root (`src/main.ts`, the only module allowed to see both the
 * editor and the game layer) injects the game's catalog here at editor startup
 * via {@link setGameEditorCatalog}; editor panels read it through
 * {@link getGameEditorCatalog}. The game's concrete types structurally satisfy
 * this contract, so no `@/game` symbol (value or type) leaks into the editor.
 *
 * The interface deliberately references only editor-importable layers
 * (`three`, `@engine/*`, `@/scene/*`), never `@/game`.
 */
import type { Object3D } from "three";
import type { Vec3 } from "@engine/scene/layout";
import type { RagdollGroupDesc, RagdollPose } from "@engine/physics/ragdoll";
import type {
  AssetSkeletonMontageDef,
  AssetSkeletonPhysicsBodyDef,
  AssetSkeletonPhysicsConstraintDef,
} from "@/scene/assetSkeletonLoader";

/** A selectable Game Mode as shown in the editor's World Settings dropdown. */
export interface EditorGameModeOption {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
}

/** An authored upper-body montage resolved to the input action that fires it. */
export interface EditorMontageBinding {
  readonly montage: string;
  readonly clip: string;
  readonly action: string;
  readonly mode: string;
  readonly blendInSeconds: number;
  readonly blendOutSeconds: number;
}

/** The physics-bridge slice the ragdoll driver needs (subset of the runtime physics API). */
export interface EditorRagdollPhysicsBridge {
  spawnRagdoll(desc: RagdollGroupDesc, options?: { detachEntityId?: string }): number | null;
  sampleRagdoll(id: number): RagdollPose[];
  despawnRagdoll(id: number): void;
}

/** The ragdoll driver handle the skeletal-mesh preview drives each tick. */
export interface EditorRagdollDriver {
  update(): void;
  getFollowPosition(): Vec3 | null;
  getDrivenNodes(): Object3D[];
  dispose(): void;
}

/**
 * Optional per-leaf metadata for a data-table field. Purely presentational —
 * the authoritative rule check is {@link EditorDataTableDef.validate}. Leaves
 * with no matching entry render generically from their raw key and value type.
 */
export interface EditorDataTableFieldMeta {
  /** Dotted leaf path within an entry, e.g. `cost.food` or `damageMultipliers.heavy`.
   *  A path segment of `[]` matches any array index (every tier/level at once). */
  readonly path: string;
  readonly label?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /** When set, the leaf renders as a dropdown of these string options. */
  readonly enum?: readonly string[];
  /** Renders the input disabled — for structural/identity fields the validator
   *  would reject edits to anyway (tier level indices, entry ids). */
  readonly readonly?: boolean;
  /** Tooltip on the field, e.g. explaining that a value is only the level-1 base. */
  readonly hint?: string;
}

/**
 * Optional label for a repeated (array) block, so the editor can title the
 * collapsible sub-group it renders for each element. Purely presentational.
 */
export interface EditorDataTableGroupMeta {
  /** Dotted path to the array itself, e.g. `progression.settlement` or `levels`. */
  readonly path: string;
  /** Friendly name for the block, e.g. `Yerleşim`. The editor appends the
   *  element's level (`— Seviye N`) to distinguish the tiers. */
  readonly label: string;
}

/**
 * A game-data file the editor's Data Table editor can open and save. The editor
 * stays generic: it renders each top-level entry as a per-field form by walking
 * the JSON's scalar leaves, and it enforces correctness by calling
 * {@link validate} — the game's real runtime validator, injected as a function so
 * no `@/game` symbol is imported into the editor.
 */
export interface EditorDataTableDef {
  /** Stable id, e.g. `units`. */
  readonly id: string;
  /** Human-readable title shown in the editor header. */
  readonly label: string;
  /** Public-root-relative JSON path, e.g. `game-data/balance/units.json`. */
  readonly path: string;
  /** Optional per-leaf presentation hints; keyed by dotted path. */
  readonly fields?: readonly EditorDataTableFieldMeta[];
  /**
   * Optional friendly names for repeated (array) blocks. When an entry contains
   * arrays (progression tiers, upgrade levels), the editor renders one
   * collapsible sub-group per element; these labels title those groups. Blocks
   * with no matching entry fall back to the array's own key.
   */
  readonly groups?: readonly EditorDataTableGroupMeta[];
  /**
   * Authoritative validation. Returns `null` when the parsed document is valid,
   * otherwise a field-level message. Wraps the same validator the runtime loads
   * with, so the editor cannot save data the game would reject at boot.
   */
  validate(raw: unknown): string | null;
}

/**
 * Game-provided data + helpers the editor renders, injected at startup. The
 * game assembles a plain object (`src/game/editorCatalog.ts`) whose inferred
 * shape structurally satisfies this contract.
 */
export interface GameEditorCatalog {
  /** Built-in Game Modes, in dropdown order. */
  readonly gameModeOptions: readonly EditorGameModeOption[];
  /** Known behavior-script ids offered as Event Binding suggestions. */
  readonly behaviorScriptIds: readonly string[];
  /** Resolves a character's authored montages to input bindings (game code map). */
  resolveMontageBindings(
    montages: readonly AssetSkeletonMontageDef[] | undefined,
  ): EditorMontageBinding[];
  /** Human-readable label for a raw input code (e.g. `KeyQ` → "Q"). */
  formatInputCode(code: string): string;
  /** Raw input codes bound to an action, in declaration order. */
  keysForAction(action: string): string[];
  /** Builds the ragdoll driver for the skeletal-mesh preview, or null. */
  createRagdollDriver(
    root: Object3D,
    bodies: readonly AssetSkeletonPhysicsBodyDef[],
    constraints: readonly AssetSkeletonPhysicsConstraintDef[],
    bridge: EditorRagdollPhysicsBridge,
    detachEntityId?: string,
  ): EditorRagdollDriver | null;
  /**
   * Game-data files editable through the Data Table editor. Omitted (or empty)
   * for a fork that ships no editable balance data — the editor then offers no
   * data-table opener, so the feature is naturally opt-in.
   */
  readonly dataTables?: readonly EditorDataTableDef[];
}

let catalog: GameEditorCatalog | null = null;

/** Injected once by the composition root before the editor renders. */
export function setGameEditorCatalog(next: GameEditorCatalog): void {
  catalog = next;
}

/** The injected game catalog. Throws if the composition root never registered it. */
export function getGameEditorCatalog(): GameEditorCatalog {
  if (!catalog) {
    throw new Error(
      "GameEditorCatalog was not registered — src/main.ts must call " +
        "setGameEditorCatalog(GAME_EDITOR_CATALOG) before constructing the editor.",
    );
  }
  return catalog;
}
