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
import { fitPresentationToFootprint } from "../content/rtsActorPresentationTree";
import type { CommandCenter } from "./commandCenter";
import type { PlacedStructure } from "./placedStructureSystem";

/** The centre is spawned by its own system, so its footprint is not in `stats` here. */
const COMMAND_CENTER_FOOTPRINT = 8;

export class RtsBuildingVisuals {
  constructor(private readonly actorVisuals: RtsActorVisualFactory | null = null) {}

  applyToCenter(center: CommandCenter, age: SettlementAge = "settlement"): void {
    // The centre goes through the same resolution as every other building; it is
    // only spawned differently, not presented differently.
    const visual = this.resolve(
      "command_center",
      "completed",
      center.level,
      COMMAND_CENTER_FOOTPRINT,
      COMMAND_CENTER_FOOTPRINT,
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
