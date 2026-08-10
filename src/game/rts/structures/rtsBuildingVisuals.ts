/**
 * Visual library for the RTS building contracts.
 *
 * Gameplay continues to own footprints, navigation blockers and construction;
 * this module only decides what a structure looks like, and since the
 * presentation plan's Faz 5 there is exactly one authority for that: the authored
 * Actor pack, reached through {@link RtsActorVisualFactory}. The code-side glTF
 * tables that used to live beside it (`rtsBuildingArt`) are gone, so a building's
 * art can no longer be changed in two places that disagree.
 *
 * What remains here is the mapping from *gameplay situations* — a completed
 * structure, a construction site, a placement preview, the centre — onto that one
 * lookup, plus the answer for the two cases where the pack has nothing: it is
 * still loading (keep the box the caller already has), or it is loaded and has no
 * entry (a coverage bug, shown as the explicit stand-in rather than dressed up as
 * finished art).
 */
import type { Group } from "three";

import type { SettlementAge } from "../../data/gameDataTypes";
import type { RtsActorVisualFactory } from "../content/rtsActorVisualFactory";
import { createRtsActorPlaceholder } from "../content/rtsActorPlaceholder";
import { findActorComponentNode, fitPresentationToFootprint } from "../content/rtsActorPresentationTree";
import type { CommandCenter } from "./commandCenter";
import type { PlacedStructure } from "./placedStructureSystem";

/**
 * The centre is spawned by its own system, so its footprint is not in `stats`
 * here.
 *
 * Exported because §40's ghost renderer has to fit the *same* footprint the live
 * centre was fitted to (`vision/ghostStructureView.ts`). A remembered centre a
 * size off its real one is the kind of thing that renders plausibly and is
 * wrong, so the number is shared rather than repeated.
 */
export const COMMAND_CENTER_VISUAL_FOOTPRINT = 8;
/** First-Age windmill blades make one calm revolution every four seconds. */
export const WINDMILL_MILL_DEGREES_PER_SECOND = 90;
const WINDMILL_MILL_COMPONENT_ID = "windmillMillPivot";

export class RtsBuildingVisuals {
  constructor(private readonly actorVisuals: RtsActorVisualFactory | null = null) {}

  /** Advance only completed First-Age windmill blade pivots. */
  update(structures: readonly PlacedStructure[], deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    const radians = WINDMILL_MILL_DEGREES_PER_SECOND * deltaSeconds * Math.PI / 180;
    for (const structure of structures) {
      if (!structure.construction.complete || structure.stats.id !== "windmill") continue;
      const mill = findActorComponentNode(structure.object, WINDMILL_MILL_COMPONENT_ID);
      // Town's current Actor does not yet author a separate mill. Its missing
      // pivot is deliberately a no-op until that art arrives.
      if (mill) mill.rotateZ(radians);
    }
  }

  applyToCenter(center: CommandCenter, age: SettlementAge = "settlement"): void {
    // The centre goes through the same resolution as every other building; it is
    // only spawned differently, not presented differently.
    const visual = this.resolve(
      "command_center",
      "completed",
      center.level,
      COMMAND_CENTER_VISUAL_FOOTPRINT,
      COMMAND_CENTER_VISUAL_FOOTPRINT,
      age,
    );
    if (visual) center.setVisual(visual);
  }

  createForStructure(structure: PlacedStructure, age: SettlementAge = "settlement"): Group | null {
    return this.resolve(
      structure.stats.id,
      "completed",
      structure.level,
      structure.stats.footprint.width,
      structure.stats.footprint.depth,
      age,
    );
  }

  createPreviewForBuilding(
    buildingId: string,
    footprintWidth: number,
    footprintDepth: number,
    age: SettlementAge = "settlement",
    level = 1,
  ): Group | null {
    return this.resolve(buildingId, "completed", level, footprintWidth, footprintDepth, age);
  }

  /**
   * The last-seen form of an enemy building — GDD 08 §40's ghost.
   *
   * Every input is remembered rather than looked up, which is the whole point:
   * this resolves what the observer saw, not what is there now. Same resolution
   * order as the live building, so a ghost and the real thing are the same model
   * and a re-sighting is not a visible swap.
   */
  createRememberedVisual(
    buildingId: string,
    level: number,
    footprintWidth: number,
    footprintDepth: number,
    age: SettlementAge,
  ): Group | null {
    return this.resolve(buildingId, "completed", level, footprintWidth, footprintDepth, age);
  }

  createConstructionVisual(
    structure: Pick<PlacedStructure, "stats">,
    age: SettlementAge = "settlement",
    level = 1,
  ): Group | null {
    return this.resolve(
      structure.stats.id,
      "construction",
      level,
      structure.stats.footprint.width,
      structure.stats.footprint.depth,
      age,
    );
  }

  /**
   * The one resolution order every call site shares.
   *
   * `null` means "nothing to show yet" and leaves the caller's existing box in
   * place; it is returned only while the pack is loading. Once the pack is ready,
   * an id it cannot answer for gets the stand-in instead — showing plausible art
   * for a missing mapping is how the second Farm mesh stayed invisible for so
   * long, and the stand-in makes it something a player reports.
   */
  private resolve(
    buildingId: string,
    state: "construction" | "completed",
    level: number,
    footprintWidth: number,
    footprintDepth: number,
    age: SettlementAge,
  ): Group | null {
    const actorVisual = this.actorVisuals?.createBuildingVisual(
      buildingId,
      state,
      level,
      footprintWidth,
      footprintDepth,
      age,
    );
    if (actorVisual) return actorVisual;
    if (!this.actorVisuals?.isReady()) return null;
    const placeholder = createRtsActorPlaceholder(`${buildingId}@${age}#${level}:${state}`);
    placeholder.userData.rtsSharedModel = true;
    fitPresentationToFootprint(placeholder, footprintWidth, footprintDepth);
    return placeholder;
  }
}
