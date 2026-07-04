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
