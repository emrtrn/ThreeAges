/**
 * Formation ids are deliberately separate from {@link UnitStance}: "Serbest" is
 * a stance label (G), never a formation. The old `free` formation — "keep the
 * legacy group-move scatter" — was removed once every geometric formation was
 * shipped; a combat group now always marches in a readable shape, and legacy
 * scatter survives only where it still belongs (workers, and the fallback path
 * in `groupOrders` when no formation slot can be reached).
 */
export type RtsFormationId =
  | "line"
  | "column"
  | "wedge"
  | "crescent"
  | "square"
  | "loose";

export interface RtsFormationDefinition {
  readonly id: RtsFormationId;
  /**
   * Localization keys, not sentences (Plan §9). This catalogue is a module-level
   * constant read at import time; text here would be frozen in whichever
   * language the bundle happened to boot in.
   */
  readonly labelKey: string;
  readonly minUnits: number;
  readonly descriptionKey: string;
  /** Small local x/y dot coordinates; the selection UI owns their rendering. */
  readonly iconDots: readonly (readonly [number, number])[];
}

/** Hat is the widest, least surprising shape, so it inherits Serbest's seat. */
export const DEFAULT_RTS_FORMATION: RtsFormationId = "line";

/**
 * UI-facing V1 formation catalogue. Geometry and movement rules deliberately
 * arrive in Faz 2; keeping the ids and minimums here gives that work one stable
 * source without making the Phase 1 panel depend on movement code.
 */
export const RTS_FORMATION_DEFINITIONS: readonly RtsFormationDefinition[] = [
  { id: "line", labelKey: "selection.formation.line.name", minUnits: 2, descriptionKey: "selection.formation.line.description", iconDots: [[12, 50], [28, 50], [44, 50], [60, 50], [76, 50], [92, 50]] },
  { id: "column", labelKey: "selection.formation.column.name", minUnits: 2, descriptionKey: "selection.formation.column.description", iconDots: [[38, 15], [62, 15], [38, 42], [62, 42], [38, 69], [62, 69], [38, 96], [62, 96]] },
  { id: "wedge", labelKey: "selection.formation.wedge.name", minUnits: 3, descriptionKey: "selection.formation.wedge.description", iconDots: [[50, 12], [34, 38], [66, 38], [18, 68], [50, 68], [82, 68]] },
  { id: "crescent", labelKey: "selection.formation.crescent.name", minUnits: 6, descriptionKey: "selection.formation.crescent.description", iconDots: [[16, 16], [84, 16], [26, 40], [74, 40], [38, 64], [62, 64], [50, 82]] },
  { id: "square", labelKey: "selection.formation.square.name", minUnits: 8, descriptionKey: "selection.formation.square.description", iconDots: [[18, 18], [50, 18], [82, 18], [18, 50], [82, 50], [18, 82], [50, 82], [82, 82]] },
  { id: "loose", labelKey: "selection.formation.loose.name", minUnits: 2, descriptionKey: "selection.formation.loose.description", iconDots: [[18, 20], [73, 12], [48, 43], [88, 58], [14, 76], [62, 88]] },
];

export function isRtsFormationId(value: string): value is RtsFormationId {
  return RTS_FORMATION_DEFINITIONS.some((formation) => formation.id === value);
}
