/**
 * Army roster model — "what do I own", collapsed by unit type.
 *
 * The HUD answers `Nüfus: 18/25` but not *what* those 18 are, and the only bulk
 * selection the player has is worker-specific (`I`) or hidden behind a
 * double-click. This is the shared model behind both fixes: a sorted list of
 * "12 İşçi, 5 Muhafız, 1 Topçu" that a strip of buttons and a breakdown panel
 * can each render without either of them deciding anything.
 *
 * Pure and DOM-free on purpose, mirroring the {@link rtsSelectionView} /
 * `rtsSelectionPanel` split the rest of the RTS UI already uses: the decisions
 * live here where a node test can read them, and the view that renders this owns
 * only *when to touch the DOM*.
 *
 * Two rules make it survive the game growing:
 *
 * 1. **It groups by unit type id, never by role.** `UnitRoleId` is a fixed
 *    four-value enum; variety arrives *inside* a role, so a roster keyed on role
 *    would silently merge a second Guard unit into the first one's row and make
 *    it unselectable as itself.
 * 2. **It reads each unit's own `stats`** rather than taking the balance table.
 *    A row therefore cannot fail to resolve, and a type with no live units
 *    simply has no row — the roster is a census, not a catalogue.
 */
import type { SettlementAge, UnitBalanceStats, UnitRoleId } from "../../data/gameDataTypes";

/**
 * The part of a `Unit` this model reads. Structural rather than the class, so
 * the roster stays testable without a scene, cannot reach into movement, combat
 * or presentation state by accident, and can describe anything that carries
 * unit stats — `Unit` itself and the selection panel's `SelectedUnitView` both
 * satisfy it as they stand.
 *
 * Just the stats: the type id is `stats.id`, and holding a second copy beside
 * it would be one more pair of fields that can disagree.
 */
export interface RosterUnit {
  readonly stats: UnitBalanceStats;
}

/** One unit type the player currently owns at least one of. */
export interface ArmyRosterEntry {
  readonly typeId: string;
  /** From `stats.label`; the roster never invents a name for a unit id. */
  readonly label: string;
  readonly icon: string | null;
  readonly role: UnitRoleId;
  readonly count: number;
  /** How many of them are free for work/orders; see {@link ArmyRosterOptions.isIdle}. */
  readonly idle: number;
  /** How many are in the live selection, so a chip can double as a subgroup readout. */
  readonly selected: number;
  /** `count * populationCost` — why the population bar reads what it reads. */
  readonly population: number;
}

export interface ArmyRosterView {
  /** Sorted; see {@link describeArmyRoster} for the ordering contract. */
  readonly entries: readonly ArmyRosterEntry[];
  readonly totalCount: number;
  readonly totalIdle: number;
  readonly totalPopulation: number;
}

/**
 * Generic in the unit type so a caller passing real `Unit`s gets `Unit` back in
 * its own predicates. Without it every call site would cast to reach the
 * gameplay state its "is this idle" answer is made of.
 */
export interface ArmyRosterOptions<T extends RosterUnit = RosterUnit> {
  /**
   * Whether a unit is free right now.
   *
   * A callback rather than a rule of this module because "idle" is answered by
   * systems the roster must not know: a worker's is `workerConstructionSystem` +
   * `economyProductionSystem`, a soldier's is "no order and not fighting".
   * Defaults to "nothing is idle", which is what a caller with no such systems
   * (a headless fixture) should get.
   */
  readonly isIdle?: (unit: T) => boolean;
  /** Whether a unit is in the live selection. Defaults to "nothing is selected". */
  readonly isSelected?: (unit: T) => boolean;
}

/**
 * Primary sort key: what the unit *is for*, in the order a player builds a
 * kingdom — the economy first, then the line that protects it, then the
 * specialists.
 *
 * A `Record` and not a lookup with a fallback: adding a role to
 * {@link UnitRoleId} without deciding where it sits in the roster must be a
 * compile error, because the alternative is a new role quietly sorting into
 * position zero and reshuffling a strip the player reads by muscle memory.
 */
const ROLE_ORDER: Record<UnitRoleId, number> = {
  worker: 0,
  guard: 1,
  archer: 2,
  siege: 3,
};

/** Secondary sort key, so an age's units stay grouped as they unlock. */
const AGE_ORDER: Record<SettlementAge, number> = {
  settlement: 0,
  town: 1,
};

/**
 * Collapse live units into a stable, sorted per-type census.
 *
 * Ordering is derived, never incidental: `units.json` key order and unit spawn
 * order are both wrong answers, because the first reshuffles the HUD when a
 * designer reorders a file and the second reshuffles it as the match plays.
 * The contract is role → unlock age → label (Turkish collation) → type id, the
 * last purely so two identically labelled types can never swap places.
 */
export function describeArmyRoster<T extends RosterUnit>(
  units: readonly T[],
  options: ArmyRosterOptions<T> = {},
): ArmyRosterView {
  const isIdle = options.isIdle ?? (() => false);
  const isSelected = options.isSelected ?? (() => false);

  // Mutable accumulators, frozen into readonly entries on the way out. One pass
  // over the army: this is rebuilt on a HUD sync, not on a player action.
  const groups = new Map<string, {
    stats: UnitBalanceStats;
    count: number;
    idle: number;
    selected: number;
  }>();
  for (const unit of units) {
    let group = groups.get(unit.stats.id);
    if (!group) {
      group = { stats: unit.stats, count: 0, idle: 0, selected: 0 };
      groups.set(unit.stats.id, group);
    }
    group.count += 1;
    if (isIdle(unit)) group.idle += 1;
    if (isSelected(unit)) group.selected += 1;
  }

  const entries: ArmyRosterEntry[] = [...groups].map(([typeId, group]) => ({
    typeId,
    label: group.stats.label,
    icon: group.stats.icon ?? null,
    role: group.stats.role,
    count: group.count,
    idle: group.idle,
    selected: group.selected,
    population: group.count * group.stats.populationCost,
  }));
  entries.sort(compareEntries(groups));

  return {
    entries,
    totalCount: entries.reduce((total, entry) => total + entry.count, 0),
    totalIdle: entries.reduce((total, entry) => total + entry.idle, 0),
    totalPopulation: entries.reduce((total, entry) => total + entry.population, 0),
  };
}

/**
 * A short string that changes exactly when the rendered roster would.
 *
 * The HUD pushes this every frame, so the view that renders it needs a cheap
 * "has anything moved" test before it touches the DOM — the same rule
 * `RtsHudBar` already applies per cell and `RtsSelectionPanel` applies to its
 * whole body.
 */
export function armyRosterSignature(view: ArmyRosterView): string {
  return view.entries
    .map((entry) => `${entry.typeId}:${entry.count}:${entry.idle}:${entry.selected}`)
    .join("|");
}

function compareEntries(
  groups: ReadonlyMap<string, { readonly stats: UnitBalanceStats }>,
): (a: ArmyRosterEntry, b: ArmyRosterEntry) => number {
  return (a, b) => {
    const byRole = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (byRole !== 0) return byRole;
    const ageA = AGE_ORDER[groups.get(a.typeId)!.stats.requiredAge];
    const ageB = AGE_ORDER[groups.get(b.typeId)!.stats.requiredAge];
    if (ageA !== ageB) return ageA - ageB;
    const byLabel = a.label.localeCompare(b.label, "tr");
    if (byLabel !== 0) return byLabel;
    return a.typeId.localeCompare(b.typeId);
  };
}
