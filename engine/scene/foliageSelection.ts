import type { Vec3 } from "./layout";
import type { LayoutFoliageInstance } from "./foliage";

/**
 * Pure, three-agnostic Foliage instance selection model (Faz 2 editing tools).
 *
 * Painted foliage instances are NOT scene selections — they have no Outliner row
 * and no gizmo. Foliage Mode owns their selection through the {@link FoliageSelection}
 * container so the Lasso / Select Invalid / Deselect All / Reattach / Remove tools
 * can act on a batch of instances at once. Selection is keyed by group id → the set
 * of selected instance indices within that group; the SceneApp reconciles/clears it
 * whenever a paint/erase mutates and re-indexes a group's instance array.
 */

/** A reference to one painted instance: its owning group id + index within that group. */
export interface FoliageInstanceRef {
  groupId: string;
  index: number;
}

/**
 * Editor-only selection set for painted foliage instances. Groups whose selection
 * empties are dropped so {@link isEmpty}/{@link groupIds} stay tight.
 */
export class FoliageSelection {
  private readonly groups = new Map<string, Set<number>>();

  has(groupId: string, index: number): boolean {
    return this.groups.get(groupId)?.has(index) ?? false;
  }

  add(groupId: string, index: number): void {
    let set = this.groups.get(groupId);
    if (!set) {
      set = new Set<number>();
      this.groups.set(groupId, set);
    }
    set.add(index);
  }

  addMany(groupId: string, indices: Iterable<number>): void {
    for (const index of indices) this.add(groupId, index);
  }

  remove(groupId: string, index: number): void {
    const set = this.groups.get(groupId);
    if (!set) return;
    set.delete(index);
    if (set.size === 0) this.groups.delete(groupId);
  }

  removeMany(groupId: string, indices: Iterable<number>): void {
    for (const index of indices) this.remove(groupId, index);
  }

  toggle(groupId: string, index: number): void {
    if (this.has(groupId, index)) this.remove(groupId, index);
    else this.add(groupId, index);
  }

  /** Drops any selection for a group (e.g. its instance array was re-indexed). */
  clearGroup(groupId: string): void {
    this.groups.delete(groupId);
  }

  clear(): void {
    this.groups.clear();
  }

  isEmpty(): boolean {
    return this.groups.size === 0;
  }

  /** Selected indices for one group (empty array when none). */
  indices(groupId: string): number[] {
    const set = this.groups.get(groupId);
    return set ? [...set] : [];
  }

  /** Total selected instances across every group. */
  size(): number {
    let total = 0;
    for (const set of this.groups.values()) total += set.size;
    return total;
  }

  /** Group ids that currently hold a selection. */
  groupIds(): string[] {
    return [...this.groups.keys()];
  }

  forEach(callback: (groupId: string, indices: ReadonlySet<number>) => void): void {
    for (const [groupId, set] of this.groups) callback(groupId, set);
  }
}

/** Indices of instances whose horizontal distance to `center` is within `radius`. */
export function foliageIndicesInRadius(
  instances: readonly LayoutFoliageInstance[],
  center: Vec3,
  radius: number,
): number[] {
  const r2 = radius * radius;
  const out: number[] = [];
  for (let i = 0; i < instances.length; i += 1) {
    const instance = instances[i]!;
    const dx = instance.position[0] - center[0];
    const dz = instance.position[2] - center[2];
    if (dx * dx + dz * dz <= r2) out.push(i);
  }
  return out;
}

/** Returns a new instance array with the given indices removed (Remove Selected). */
export function removeFoliageIndices(
  instances: readonly LayoutFoliageInstance[],
  indices: ReadonlySet<number>,
): LayoutFoliageInstance[] {
  const kept: LayoutFoliageInstance[] = [];
  for (let i = 0; i < instances.length; i += 1) {
    if (!indices.has(i)) kept.push(instances[i]!);
  }
  return kept;
}
