/**
 * The shape a debug table hands to {@link RtsDebugTableModal}.
 *
 * Two very different measurements share the modal — the CPU frame breakdown and
 * the GPU sweep — and they must *not* share a row shape: the CPU table's rows
 * add up to the frame, the GPU table's rows are differences between whole frames
 * and do not add up to anything. Keeping the modal a dumb renderer of
 * pre-formatted cells is what stops one table quietly inheriting the other's
 * arithmetic, and what keeps both sets of numbers testable without a DOM.
 */

export interface RtsDebugTableColumn {
  readonly label: string;
  /** Numbers read right-aligned; names read left. */
  readonly align: "left" | "right";
}

export interface RtsDebugTableRow {
  /** One string per column, already formatted. */
  readonly cells: readonly string[];
  /** 0–1, drawn as a bar behind the row. Clamped by the renderer. */
  readonly share: number;
  /** Styling hook (`region`, `remainder`, `debug`, `baseline`, `note`). */
  readonly kind: string;
}

export interface RtsDebugTableView {
  readonly title: string;
  /** One line under the title: what was measured, and under what conditions. */
  readonly meta: string;
  readonly columns: readonly RtsDebugTableColumn[];
  readonly rows: readonly RtsDebugTableRow[];
  /** How to read the table without drawing the wrong conclusion from it. */
  readonly notes: readonly string[];
  /** The same content as text, for the clipboard. */
  readonly clipboardText: string;
}
