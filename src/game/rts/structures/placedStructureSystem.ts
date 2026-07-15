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
import { ConstructionComponent } from "./constructionComponent";

export interface PlacedStructure {
  readonly id: number;
  readonly stats: BuildingBalanceStats;
  readonly x: number;
  readonly z: number;
  readonly blocker: NavBlocker;
  readonly object: Group;
  readonly construction: ConstructionComponent;
  readonly progressFill: Mesh;
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
    const progressFill = new Mesh(
      new BoxGeometry(stats.footprint.width - 0.4, 0.12, 0.36),
      new MeshStandardMaterial({ color: "#d8d05c", emissive: "#59520e", roughness: 0.7 }),
    );
    progressFill.name = "rts-construction-progress";
    progressFill.position.set(0, 0.3, -stats.footprint.depth / 2 - 0.35);
    progressFill.scale.x = 0.001;
    object.add(progressFill);
    this.root.add(object);
    const structure: PlacedStructure = {
      id,
      stats,
      x,
      z,
      blocker: buildingFootprintBlocker(stats, x, z),
      object,
      construction: new ConstructionComponent(stats.constructionSeconds),
      progressFill,
    };
    this.structures.push(structure);
    return structure;
  }

  navigationBlockers(): readonly NavBlocker[] {
    return this.structures.map((structure) => structure.blocker);
  }

  /** Apply one worker-second and promote the site visual when it completes. */
  advanceConstruction(structure: PlacedStructure, deltaSeconds: number): boolean {
    const justCompleted = structure.construction.advance(deltaSeconds);
    structure.progressFill.scale.x = Math.max(0.001, structure.construction.progress);
    if (justCompleted) this.finishVisual(structure);
    return justCompleted;
  }

  all(): readonly PlacedStructure[] {
    return this.structures;
  }

  /** Remove the newest unbuilt site. Targeted cancellation arrives with workers. */
  cancelLatest(): PlacedStructure | null {
    let index = -1;
    for (let i = this.structures.length - 1; i >= 0; i -= 1) {
      if (!this.structures[i]?.construction.complete) {
        index = i;
        break;
      }
    }
    if (index < 0) return null;
    const [structure] = this.structures.splice(index, 1);
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

  private finishVisual(structure: PlacedStructure): void {
    structure.object.remove(structure.progressFill);
    structure.progressFill.visible = false;
    const completed = new Mesh(
      new BoxGeometry(
        structure.stats.footprint.width * 0.72,
        Math.max(2.5, structure.stats.footprint.width * 0.45),
        structure.stats.footprint.depth * 0.72,
      ),
      new MeshStandardMaterial({ color: "#80684a", roughness: 0.85 }),
    );
    completed.name = "rts-complete-building-placeholder";
    completed.position.y = completed.geometry.parameters.height / 2 + 0.18;
    completed.castShadow = true;
    completed.receiveShadow = true;
    structure.object.add(completed);
  }
}
