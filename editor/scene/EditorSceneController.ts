import type { EditorCommand, EditorHistoryState } from "@editor/core/history";
import { EditorCommandStore } from "@editor/core/history";

type StatusTone = "info" | "success" | "warning" | "error";

export interface EditorSceneControllerHost {
  emitHistoryChanged: () => void;
  onStatus: (message: string, tone?: StatusTone) => void;
}

/**
 * Editor-only scene command controller. This starts as the history/command
 * owner; tightly coupled command orchestration moves here in later slices.
 */
export class EditorSceneController {
  private readonly host: EditorSceneControllerHost;
  private readonly commandStore = new EditorCommandStore();

  constructor(host: EditorSceneControllerHost) {
    this.host = host;
  }

  getHistoryState(): EditorHistoryState {
    return this.commandStore.state();
  }

  undo(): void {
    const result = this.commandStore.undo();
    if (!result) return;
    this.host.emitHistoryChanged();
    this.host.onStatus(result.statusMessage, result.statusTone);
  }

  redo(): void {
    const result = this.commandStore.redo();
    if (!result) return;
    this.host.emitHistoryChanged();
    this.host.onStatus(result.statusMessage, result.statusTone);
  }

  executeCommand(command: EditorCommand): void {
    const result = this.commandStore.execute(command);
    this.host.emitHistoryChanged();
    this.host.onStatus(result.statusMessage, result.statusTone);
  }
}
