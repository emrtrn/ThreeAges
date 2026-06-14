/**
 * SelectionStore - owns editor selection state: the active (primary) selection
 * plus the multi-select map. Moving this ownership out of `SceneApp` keeps the
 * shared runtime path from carrying editor-only state.
 *
 * Pure data over the existing `editor/core/selection` helpers; no Three.js or
 * DOM. `SceneApp` delegates here and renders/emits from these values.
 */
import {
  type Selection,
  selectionId,
  replaceSelectedGroup,
  replaceSelectedMany,
  selectedSelectionList,
  toggleSelectedGroup,
} from "./selection";

export class SelectionStore {
  /** The active (primary) selection, or null when nothing is selected. */
  private active: Selection | null = null;
  /** Multi-select set keyed by selectionId; includes the active selection. */
  private readonly selected = new Map<string, Selection>();

  get activeSelection(): Selection | null {
    return this.active;
  }

  set activeSelection(value: Selection | null) {
    this.active = value;
  }

  /** Number of objects currently in the multi-select set. */
  get selectedCount(): number {
    return this.selected.size;
  }

  /** Whether the given selection is part of the multi-select set. */
  has(selection: Selection): boolean {
    return this.selected.has(selectionId(selection));
  }

  /**
   * Replace the selection with a single active object and its group siblings,
   * returning the new active selection.
   */
  selectGroup(selection: Selection | null, groupSelections: Selection[]): Selection | null {
    this.active = replaceSelectedGroup(this.selected, selection, groupSelections);
    return this.active;
  }

  /**
   * Replace the selection with many objects, preferring `active` as the new
   * active selection when it remains valid.
   */
  selectMany(selections: Selection[], active: Selection | null): Selection | null {
    this.active = replaceSelectedMany(this.selected, selections, active);
    return this.active;
  }

  /** Toggle a group in/out of the selection, returning the new active. */
  toggleGroup(selection: Selection, groupSelections: Selection[]): Selection | null {
    this.active = toggleSelectedGroup(this.selected, this.active, selection, groupSelections);
    return this.active;
  }

  /** Valid selected objects, filtered + cloned for safe external use. */
  list(isValid: (selection: Selection) => boolean): Selection[] {
    return selectedSelectionList(this.selected, isValid);
  }
}
