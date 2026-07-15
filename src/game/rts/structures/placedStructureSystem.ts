/**
 * Phase 2 pre-construction structure sites.
 *
 * A confirmed placement creates a visible foundation and a nav blocker, but has
 * no gameplay function until the worker/construction slice supplies progress.
 */
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";

import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { BuildingBalanceStats } from "../../data/gameDataTypes";
import { buildingFootprintBlocker } from "./placementGrid";

export interface PlacedStructure {
  readonly id: number;
  readonly stats: BuildingBalanceStats;
  readonly x: number;
  readonly z: number;
  readonly blocker: NavBlocker;
  readonly object: Group;
}

export class PlacedStructureSystem {
  readonly root = new Group();
  private readonly structures: PlacedStructure[] = [];
  private nextId = 1;

  constructor() {
    this.root.name = "rts-placed-structures";
  }

  place(stats: BuildingBalanceStats, x: number, z: number): PlacedStructure {
    const object = new Group();
    const id = this.nextId++;
    object.name = `rts-construction-site-${id}`;
    object.position.set(x, 0, z);
    const foundation = new Mesh(
      new BoxGeometry(stats.footprint.width, 0.18, stats.footprint.depth),
      new MeshStandardMaterial({ color: "#9b7a4d", roughness: 0.95 }),
    );
    foundation.name = "rts-construction-foundation";
    foundation.position.y = 0.09;
    foundation.receiveShadow = true;
    foundation.castShadow = true;
    object.add(foundation);
    this.root.add(object);
    const structure: PlacedStructure = {
      id,
      stats,
      x,
      z,
      blocker: buildingFootprintBlocker(stats, x, z),
      object,
    };
    this.structures.push(structure);
    return structure;
  }

  navigationBlockers(): readonly NavBlocker[] {
    return this.structures.map((structure) => structure.blocker);
  }

  all(): readonly PlacedStructure[] {
    return this.structures;
  }

  /** Remove the newest unbuilt site. Targeted cancellation arrives with workers. */
  cancelLatest(): PlacedStructure | null {
    const structure = this.structures.pop() ?? null;
    if (!structure) return null;
    this.disposeStructure(structure);
    return structure;
  }

  clear(): void {
    for (const structure of this.structures) this.disposeStructure(structure);
    this.structures.length = 0;
  }

  private disposeStructure(structure: PlacedStructure): void {
    this.root.remove(structure.object);
    structure.object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    });
  }
}
