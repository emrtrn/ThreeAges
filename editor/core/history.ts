export interface EditorCommand {
  label: string;
  undo: () => void;
  redo: () => void;
}

export interface EditorHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
}
