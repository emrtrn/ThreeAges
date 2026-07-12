import type { SaveGameStore } from "@engine/persistence/saveGameStore";
import type { UiViewModelStore } from "@engine/ui/uiViewModel";
import {
  applySaveState,
  consumeRestoreForLoadedLevel,
  type GameSaveState,
  type GameSaveRestoreRequest,
} from "@/game/saveGame";
import {
  buildSaveGameUiFields,
  emptySaveGameUiSlots,
  readSaveGameUiCommand,
  type SaveGameUiSlotId,
} from "@/game/saveGameUi";

/**
 * Everything the save coordinator needs from the runtime shell that it does not
 * own itself. Kept deliberately small: the coordinator owns the save store and
 * the pending-restore latch; gameplay-facing capture/apply and level travel stay
 * in {@link RuntimeSceneApp} and are reached through these callbacks so this
 * module never has to know about the physics/behavior/game-mode subsystems.
 */
export interface RuntimeSaveCoordinatorDeps {
  /** ViewModel-lite store backing the save-slot UI fields (owned by the shell). */
  readonly uiStore: UiViewModelStore;
  /** Captures the current gameplay state into a save payload, or null when unsavable. */
  collectSaveState(): GameSaveState | null;
  /** Applies a decoded restore request to the live scene (persistent state + player). */
  applyRestore(restore: GameSaveRestoreRequest): void;
  /** Enqueues level travel to the saved level (portal/menu-style handoff). */
  enqueueLevelTravel(levelPath: string): void;
  /** Clears any open UI screen stack after a successful load (returns to gameplay). */
  clearScreens(): void;
}

/**
 * Owns the slot-based save/load feature extracted from {@link RuntimeSceneApp}
 * (P2.3): the {@link SaveGameStore}, the pending-restore latch, quick-slot
 * write/load/delete, checkpoint autosave, the reserved `save:*` UI messages and
 * the save-slot UI fields. Behaviour is unchanged from the in-shell version —
 * this is a boundary extraction, not a redesign. Gameplay capture/apply and
 * level travel are delegated back to the shell through
 * {@link RuntimeSaveCoordinatorDeps}.
 */
export class RuntimeSaveCoordinator {
  private store: SaveGameStore<GameSaveState> | null = null;
  /** Latched restore applied after the saved level finishes loading; null when idle. */
  private pendingRestore: GameSaveRestoreRequest | null = null;

  constructor(private readonly deps: RuntimeSaveCoordinatorDeps) {}

  /** Rebinds the active game's save store (per project, set on scene boot). */
  setStore(store: SaveGameStore<GameSaveState> | null): void {
    this.store = store;
  }

  /**
   * Drops any pending restore. Called when a portal/menu travel supersedes a
   * save-load in flight, so the loaded level does not re-apply stale save state.
   */
  clearPendingRestore(): void {
    this.pendingRestore = null;
  }

  /**
   * Decodes a save payload and, if valid, latches it and travels to the saved
   * level; {@link applyPendingRestore} then re-applies it once that level loads.
   */
  requestSaveGameLoad(payload: unknown): boolean {
    const restore = applySaveState(payload);
    if (!restore) return false;
    this.pendingRestore = restore;
    this.deps.enqueueLevelTravel(restore.levelPath);
    return true;
  }

  /**
   * After a scene build, applies the pending restore only when it targets the
   * level that just loaded (portal travel to a different level clears it).
   */
  applyPendingRestore(loadedLevelPath: string): void {
    const result = consumeRestoreForLoadedLevel(this.pendingRestore, loadedLevelPath);
    this.pendingRestore = result.pending;
    if (!result.restore) return;
    this.deps.applyRestore(result.restore);
  }

  /** Intercepts reserved save-game widget messages (`save:write|load|delete:<slot>`). */
  handleUiMessage(message: string): boolean {
    const command = readSaveGameUiCommand(message);
    if (!command) return false;
    switch (command.kind) {
      case "write":
        this.writeSlot(command.slot);
        return true;
      case "load":
        this.loadSlot(command.slot);
        return true;
      case "delete":
        this.deleteSlot(command.slot);
        return true;
    }
  }

  /**
   * Writes an autosave from a `checkpoint` behavior into the named slot (P3.6).
   * Reuses the same serialization path as the manual save menu; failures degrade
   * to a console warning (crossing a checkpoint must never interrupt play). The
   * save-game UI fields refresh so an open menu reflects the new autosave.
   */
  writeCheckpointSave(slot: string): void {
    if (!this.store) return;
    const payload = this.deps.collectSaveState();
    if (!payload) return;
    const result = this.store.writeSlot(slot, payload);
    if (!result.ok) {
      console.warn("[runtime] checkpoint save failed", slot);
      return;
    }
    console.info("[runtime] checkpoint saved", slot);
    this.refreshUiFields();
    this.deps.uiStore.flush();
  }

  /** Rebuilds the save-slot UI fields from the current store contents. */
  refreshUiFields(): void {
    const slots = emptySaveGameUiSlots().map((view) => {
      const envelope = this.store?.readSlot(view.slot) ?? null;
      return envelope
        ? {
            ...view,
            updatedAt: envelope.updatedAt,
            levelPath: envelope.payload.activeLevelPath,
          }
        : view;
    });
    this.deps.uiStore.setFields(buildSaveGameUiFields(slots));
  }

  private writeSlot(slot: SaveGameUiSlotId): void {
    const payload = this.deps.collectSaveState();
    if (!this.store || !payload) {
      this.setStatus(slot, "Save unavailable");
      return;
    }
    const result = this.store.writeSlot(slot, payload);
    this.refreshUiFields();
    if (!result.ok) this.setStatus(slot, "Save failed");
    else this.deps.uiStore.flush();
  }

  private loadSlot(slot: SaveGameUiSlotId): void {
    const envelope = this.store?.readSlot(slot) ?? null;
    if (!envelope) {
      this.setStatus(slot, "Empty");
      return;
    }
    if (!this.requestSaveGameLoad(envelope.payload)) {
      this.setStatus(slot, "Load failed");
      return;
    }
    this.deps.clearScreens();
  }

  private deleteSlot(slot: SaveGameUiSlotId): void {
    if (!this.store) {
      this.setStatus(slot, "Save unavailable");
      return;
    }
    const ok = this.store.deleteSlot(slot);
    this.refreshUiFields();
    if (!ok) this.setStatus(slot, "Delete failed");
    else this.deps.uiStore.flush();
  }

  private setStatus(slot: SaveGameUiSlotId, status: string): void {
    this.deps.uiStore.setField(`save.slots.${slot}.status`, status);
    this.deps.uiStore.flush();
  }
}
