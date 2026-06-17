/**
 * Pure TPS spawn resolution (no Three.js/DOM).
 *
 * In the TPS Game Mode the possessed player starts at the scene's first Player
 * Start marker (an instance under the synthetic `marker:playerStart` asset). When
 * the scene has no marker the player spawns at the world origin. Used by the
 * runtime shell to rewrite the player character's start transform before the
 * scene is built, so render, physics and behavior all begin at the spawn point.
 */
import { PLAYER_START_ASSET_ID } from "@engine/scene/shapes";
import { readRotation } from "@engine/scene/transform";
import type { RoomLayout, Vec3 } from "@engine/scene/layout";

export interface PlayerStartSpawn {
  /** Index into `layout.characters` of the resolved player. */
  readonly characterIndex: number;
  /** World spawn position (the marker's, or the origin when none exists). */
  readonly position: Vec3;
  /** Spawn yaw in degrees from the marker, or null to keep the authored facing. */
  readonly yawDeg: number | null;
}

/** Resolves the player character the same way the TPS mode possesses one. */
function resolvePlayerCharacterIndex(layout: RoomLayout): number | null {
  const tagged = layout.characters.findIndex((c) => c.metadata?.player === true);
  if (tagged !== -1) return tagged;
  const input = layout.characters.findIndex((c) => c.behavior?.script === "input-move");
  return input === -1 ? null : input;
}

/**
 * Computes where the TPS player should spawn, or null when the scene has no
 * player character to move. With a Player Start marker the player takes its
 * position + yaw; without one it spawns at the origin keeping its authored
 * facing.
 */
export function computePlayerStartSpawn(layout: RoomLayout): PlayerStartSpawn | null {
  const characterIndex = resolvePlayerCharacterIndex(layout);
  if (characterIndex === null) return null;

  const marker = layout.instances.find((entry) => entry.assetId === PLAYER_START_ASSET_ID)
    ?.placements[0];
  if (!marker) {
    return { characterIndex, position: [0, 0, 0], yawDeg: null };
  }
  return {
    characterIndex,
    position: [marker.position[0], marker.position[1], marker.position[2]],
    yawDeg: readRotation(marker)[1],
  };
}
