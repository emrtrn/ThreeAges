/**
 * Formation ids are deliberately separate from {@link UnitStance}. "Serbest"
 * is already a player-facing stance label; here it means legacy group movement.
 */
export type RtsFormationId =
  | "free"
  | "line"
  | "column"
  | "wedge"
  | "crescent"
  | "square"
  | "loose";

export interface RtsFormationDefinition {
  readonly id: RtsFormationId;
  readonly label: string;
  readonly minUnits: number;
  readonly description: string;
  /** Small local x/y dot coordinates; the selection UI owns their rendering. */
  readonly iconDots: readonly (readonly [number, number])[];
}

export const DEFAULT_RTS_FORMATION: RtsFormationId = "free";

/**
 * UI-facing V1 formation catalogue. Geometry and movement rules deliberately
 * arrive in Faz 2; keeping the ids and minimums here gives that work one stable
 * source without making the Phase 1 panel depend on movement code.
 */
export const RTS_FORMATION_DEFINITIONS: readonly RtsFormationDefinition[] = [
  { id: "line", label: "Hat", minUnits: 2, description: "Geniş bir cephe oluşturur.", iconDots: [[12, 50], [28, 50], [44, 50], [60, 50], [76, 50], [92, 50]] },
  { id: "column", label: "Kol", minUnits: 2, description: "Dar ve derin bir düzen oluşturur.", iconDots: [[38, 15], [62, 15], [38, 42], [62, 42], [38, 69], [62, 69], [38, 96], [62, 96]] },
  { id: "wedge", label: "Kama", minUnits: 3, description: "Merkezi öne çıkaran hücum düzeni.", iconDots: [[50, 12], [34, 38], [66, 38], [18, 68], [50, 68], [82, 68]] },
  { id: "crescent", label: "Hilal", minUnits: 6, description: "Kanatları öne çıkaran geniş düzen.", iconDots: [[16, 16], [84, 16], [26, 40], [74, 40], [38, 64], [62, 64], [50, 82]] },
  { id: "square", label: "Kare", minUnits: 8, description: "Kırılgan birlikleri merkezde korur.", iconDots: [[18, 18], [50, 18], [82, 18], [18, 50], [82, 50], [18, 82], [50, 82], [82, 82]] },
  { id: "loose", label: "Dağınık", minUnits: 2, description: "Birimler arasındaki mesafeyi artırır.", iconDots: [[18, 20], [73, 12], [48, 43], [88, 58], [14, 76], [62, 88]] },
  { id: "free", label: "Serbest", minUnits: 2, description: "Mevcut grup hareket düzenini kullanır.", iconDots: [[18, 20], [52, 15], [82, 26], [31, 51], [67, 54], [14, 82], [49, 78], [86, 84]] },
];

export function isRtsFormationId(value: string): value is RtsFormationId {
  return RTS_FORMATION_DEFINITIONS.some((formation) => formation.id === value);
}
