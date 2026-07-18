/**
 * The AI's information limit under fog — Vertical Slice Plan v0.2 §59, AI design
 * §20 ("bilgi sınırları") / §21 (AI-3's last-known model).
 *
 * `aiBlackboard.ts` was written as the single place the AI reads the world, so
 * that §20's limits are structural rather than a promise. Fog extends that same
 * idea one step: with a filter installed, every enemy read the AI makes is
 * routed through the same {@link VisionSystem} grid the player's screen is drawn
 * from, so §59's "AI görünmeyen birimlerin gerçek konumunu bilmiyor" holds
 * because there is no other path to the data — not because the AI was asked
 * nicely not to look.
 *
 * **Null means omniscient.** When the `fogOfWar` flag is off the filter is never
 * constructed and every consumer takes its original unfiltered path, so a
 * disabled flag costs nothing at runtime (plan §13). That is also why this is an
 * interface: `test:engine` drives the AI with a hand-written filter and no grid.
 *
 * Pure TS: no three.js, no DOM (Forge boundary, CLAUDE.md / TD-002).
 */
import type { UnitOwner } from "../units/unit";
import type { EnemyMemorySystem, RememberedStructure } from "../vision/enemyMemorySystem";
import type { VisionSystem } from "../vision/visionSystem";

export interface AiVisionFilter {
  /** True when the AI's kingdom has a vision source covering this point now. */
  canSee(x: number, z: number): boolean;
  /**
   * Enemy structures the AI believes exist — live sightings *and* stale ghosts
   * (§40). Army targeting reads this instead of the live structure list, which
   * is what lets the AI march on a base it scouted ten minutes ago and what
   * lets it march on one that has since been demolished.
   */
  knownEnemyStructures(): readonly RememberedStructure[];
}

/** Binds the shared vision/memory systems to one kingdom's point of view. */
export class VisionSystemAiFilter implements AiVisionFilter {
  constructor(
    private readonly vision: VisionSystem,
    private readonly memory: EnemyMemorySystem,
    private readonly owner: UnitOwner,
  ) {}

  canSee(x: number, z: number): boolean {
    return this.vision.isVisible(this.owner, x, z);
  }

  knownEnemyStructures(): readonly RememberedStructure[] {
    return this.memory.known(this.owner);
  }
}
