/**
 * "Last known" enemy buildings on the map — Vertical Slice Plan v0.2 §59,
 * GDD 08 §40.
 *
 * §40 offers two presentations: the last seen model, or a ghost sign. This drew
 * the sign — a flat translucent footprint square — and the reasoning was that an
 * abstract marker cannot drift out of date the way a cloned model would. In the
 * running game that argument lost to what the player actually sees: a scouted
 * enemy base reads as a field of red rectangles, and since a siege weapon
 * outranges its own vision, the common case is a gun shelling a red square. The
 * marker is honest about what it does not know and says nothing about what it
 * does — including which building it is, which is the one thing scouting is for.
 *
 * So the ghost is now the **last seen model**: the building the observer saw,
 * built from {@link RememberedStructure} alone.
 *
 * That does not give up the "memory can be wrong" property, because the model is
 * a *snapshot*, not a mirror. It is built once, from remembered data, and
 * rebuilt only when the memory itself changes — which {@link EnemyMemorySystem}
 * only ever does from a fresh sighting. A building that upgrades, takes damage or
 * is demolished under fog leaves its ghost exactly as it was; the player still
 * has to walk back and look. The signature in {@link markerSignature} is what
 * enforces that: it is the whole of the remembered appearance, so anything the
 * observer did not witness cannot change what is drawn.
 *
 * The old opacity-by-age fade went with the marker. It was §40's "bilgi
 * eskidikçe doğruluk kaybedebilir" expressed as transparency, which on a real
 * building would read as a rendering fault rather than as staleness — and the
 * snapshot above expresses the same idea structurally and more strongly: the age
 * of a belief shows up as the belief being *wrong*, not as it being faint.
 *
 * View only. It renders {@link EnemyMemorySystem} and never decides what is
 * remembered.
 */
import { Group } from "three";

import type { EnemyMemorySystem, RememberedStructure } from "./enemyMemorySystem";
import type { UnitOwner } from "../units/unit";

/**
 * Builds the visual for one remembered building.
 *
 * Injected rather than reached for, because resolving a building's art needs the
 * loaded Actor pack and this module must stay a renderer of memory. `null` is a
 * normal answer — the pack may still be loading — and simply means no ghost is
 * drawn this refresh; the next one retries.
 */
export type RememberedStructureVisualFactory = (
  remembered: RememberedStructure,
) => Group | null;

interface GhostMarker {
  readonly object: Group;
  /** The remembered appearance this was built from; see the module doc. */
  readonly signature: string;
}

export class GhostStructureView {
  readonly root = new Group();
  private readonly markers = new Map<number, GhostMarker>();

  constructor(
    private readonly memory: EnemyMemorySystem,
    private readonly observer: UnitOwner,
    private readonly createVisual: RememberedStructureVisualFactory,
  ) {
    this.root.name = "rts-structure-ghosts";
  }

  /**
   * Sync ghosts to the observer's current memory.
   *
   * Markers are keyed by structure id and kept while their signature holds, so a
   * building sitting under fog for the whole match costs one model build, not one
   * per tick — and, more importantly, is not silently re-derived from data that
   * may have moved on.
   */
  refresh(): void {
    const live = new Set<number>();

    for (const ghost of this.memory.ghosts(this.observer)) {
      const signature = markerSignature(ghost);
      const existing = this.markers.get(ghost.structureId);
      if (existing && existing.signature === signature) {
        live.add(ghost.structureId);
        continue;
      }
      // A re-sighting found it changed (levelled up, a new age's art). The old
      // snapshot is now known to be wrong, so it is replaced rather than kept.
      if (existing) this.removeMarker(ghost.structureId);
      if (this.createMarker(ghost, signature)) live.add(ghost.structureId);
    }

    for (const id of [...this.markers.keys()]) {
      if (live.has(id)) continue;
      // The memory was either re-sighted — the real building renders again, via
      // `fogVisibilityBinder` — or corrected away because it is gone. Either way
      // two of it must never be on screen at once.
      this.removeMarker(id);
    }
  }

  private createMarker(ghost: RememberedStructure, signature: string): boolean {
    const visual = this.createVisual(ghost);
    if (!visual) return false;
    const object = new Group();
    object.name = `rts-structure-ghost-${ghost.structureId}`;
    // Same anchor the live structure uses: origin at the footprint centre, on the
    // ground height sampled where it stands (`placedStructureSystem.place`), so
    // the ghost and the building it stands for occupy the same space exactly.
    object.position.set(ghost.x, ghost.groundY, ghost.z);
    object.add(visual);
    this.root.add(object);
    this.markers.set(ghost.structureId, { object, signature });
    return true;
  }

  private removeMarker(id: number): void {
    const marker = this.markers.get(id);
    if (!marker) return;
    this.root.remove(marker.object);
    this.markers.delete(id);
  }

  /**
   * Ghost visuals are clones off the Actor pack's templates and carry
   * `rtsSharedModel`, so their geometry and materials belong to
   * `RtsActorVisualFactory` and are freed with it — the same ownership rule
   * `placedStructureSystem` follows for live buildings. Disposing them here would
   * blank every other instance of the model.
   */
  dispose(): void {
    this.markers.clear();
    this.root.clear();
  }
}

/**
 * Everything about a remembered building that decides what is drawn.
 *
 * Deliberately not the sighting time: a belief growing older is not a reason to
 * rebuild the model, and folding `lastSeenAt` in here would rebuild every ghost
 * on every tick.
 */
function markerSignature(ghost: RememberedStructure): string {
  return [
    ghost.buildingId,
    ghost.age,
    ghost.level,
    ghost.x,
    ghost.z,
    ghost.groundY,
    ghost.footprintWidth,
    ghost.footprintDepth,
  ].join("|");
}
