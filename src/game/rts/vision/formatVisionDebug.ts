/**
 * §59 "Görüş debug overlay'i" — the numbers behind the fog, for `?rts&debug`.
 *
 * A text block rather than a second grid render: the fog plane *is* the visual
 * overlay, and drawing the same grid again in a debug colour would only restate
 * what the screen already shows. What is not visible on screen — and what the
 * §59 acceptance criteria actually need measured — is the other kingdom's fog,
 * the size of each side's memory, and the per-tick source count that the
 * "görüş güncellemesi performans sorunu oluşturmuyor" criterion rests on. So
 * this reports the parts you cannot see.
 *
 * Formatting only, following `formatRtsAiDebug`: pure, returns lines, and the
 * overlay stays free of vision imports.
 */
import type { EnemyMemorySystem } from "./enemyMemorySystem";
import type { VisionSystem } from "./visionSystem";
import type { UnitOwner } from "../units/unit";

const OWNERS: readonly UnitOwner[] = ["player", "enemy"];

const OWNER_LABEL: Readonly<Record<UnitOwner, string>> = {
  player: "oyuncu",
  enemy: "düşman",
};

export function formatVisionDebug(
  vision: VisionSystem,
  memory: EnemyMemorySystem,
  sourceCount: number,
  now: number,
): readonly string[] {
  const resolution = vision.gridResolution;
  const lines = [
    `görüş: ${resolution}×${resolution} hücre · ${sourceCount} kaynak/tick`,
  ];
  for (const owner of OWNERS) {
    const explored = (vision.exploredFraction(owner) * 100).toFixed(1);
    const known = memory.known(owner);
    const ghosts = memory.ghosts(owner);
    // The oldest belief is the interesting one: it is the single number that
    // says how stale this kingdom's picture of the map has been allowed to get.
    const oldest = ghosts.reduce((max, ghost) => Math.max(max, memory.ageOf(ghost, now)), 0);
    lines.push(
      `  ${OWNER_LABEL[owner]}: keşfedilmiş %${explored} · bilinen yapı ${known.length}`
      + ` (hayalet ${ghosts.length}${ghosts.length > 0 ? `, en eski ${oldest.toFixed(0)} sn` : ""})`,
    );
  }
  return lines;
}
