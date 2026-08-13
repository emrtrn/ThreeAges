/**
 * Formation choice — Askerî AI v2 planı §7, §8.
 *
 * The third sibling of {@link scoreIntents} and {@link scoreTargets}, and
 * deliberately built to the same contract: pure functions over plain records —
 * no world access, no time, no randomness (§80 determinism), weights in
 * `balance/ai.json`, and every decision carries the reason it won.
 *
 *     formationScore = missionFit     × w1
 *                    + terrainFit     × w2
 *                    + enemyFit       × w3
 *                    + compositionFit × w4
 *                    + cohesionFit    × w5
 *                    − transitionCost × w6
 *
 * Hysteresis is *not* reinvented here. `evaluation.hysteresisMargin` and
 * `evaluation.minimumCommitmentSeconds` already stop the director flapping
 * between intents; {@link betterFormation} applies the same margin, and the
 * army manager applies the same commitment window. There is no third "minimum
 * formation time" concept.
 */
import type { AiFormationWeights } from "../../data/gameDataTypes";
import {
  RTS_FORMATION_DEFINITIONS,
  type RtsFormationId,
} from "../units/formations/rtsFormationTypes";
import type { AiArmyMission, AiTacticalPhase } from "./aiTypes";

/**
 * §8: the enemy army reduced to one class. This is the `enemyFit` input, and
 * it is derived only from what the AI has *seen or remembers* (§17.2) — the
 * army manager filters through `aiVisionFilter` before the counts get here.
 */
export type AiEnemyCompositionClass =
  | "melee_heavy"
  | "ranged_heavy"
  | "siege_heavy"
  | "balanced"
  | "weak"
  | "fortified";

export const AI_ENEMY_COMPOSITION_CLASSES: readonly AiEnemyCompositionClass[] = [
  "melee_heavy",
  "ranged_heavy",
  "siege_heavy",
  "balanced",
  "weak",
  "fortified",
];

/** Counts of the three combat roles on one side of the fight. */
export interface AiRoleCounts {
  readonly guard: number;
  readonly archer: number;
  readonly siege: number;
}

/** Below this many seen units the enemy is a screen, not an army (§8 `WEAK`). */
const WEAK_ENEMY_UNITS = 2;
/** Share of one role at which the enemy army reads as built around it. */
const ROLE_DOMINANCE_SHARE = 0.5;

/**
 * §8: which class the seen enemy falls into.
 *
 * `fortified` is asked separately from the unit mix because it is a property of
 * the *target*, not of the enemy army: a defended structure standing over a
 * handful of troops is a different problem from the same troops in the open.
 */
export function enemyCompositionClass(
  seen: AiRoleCounts,
  options: { readonly fortifiedTarget: boolean } = { fortifiedTarget: false },
): AiEnemyCompositionClass {
  const total = seen.guard + seen.archer + seen.siege;
  if (options.fortifiedTarget) return "fortified";
  if (total <= WEAK_ENEMY_UNITS) return "weak";
  if (seen.siege / total >= ROLE_DOMINANCE_SHARE) return "siege_heavy";
  if (seen.archer / total >= ROLE_DOMINANCE_SHARE) return "ranged_heavy";
  if (seen.guard / total >= ROLE_DOMINANCE_SHARE) return "melee_heavy";
  return "balanced";
}

export interface AiFormationContext {
  /** §9: null for every mission that has no tactical phase. */
  readonly phase: AiTacticalPhase;
  readonly mission: AiArmyMission;
  readonly enemyClass: AiEnemyCompositionClass;
  /** Our own army, as counts — the `compositionFit` input. */
  readonly friendly: AiRoleCounts;
  /**
   * §14: how open the ground is, 0 (a bridge) to 1 (a field). Fed a constant
   * until the nav-derived width is measured; the scorer's shape does not change
   * when that arrives, only this number does.
   */
  readonly terrainWidth: number;
  /** §12: share of the army standing on its assigned slot, 0..1. */
  readonly cohesion: number;
  /** The formation currently held, or null before the first choice. */
  readonly current: RtsFormationId | null;
  /** Combat units available; a formation below its `minUnits` is not offered. */
  readonly unitCount: number;
}

export interface AiFormationScore {
  readonly formation: RtsFormationId;
  readonly score: number;
  readonly reason: string;
}

const FORMATION_IDS: readonly RtsFormationId[] = RTS_FORMATION_DEFINITIONS.map((entry) => entry.id);

const MINIMUM_UNITS: Readonly<Record<RtsFormationId, number>> = Object.fromEntries(
  RTS_FORMATION_DEFINITIONS.map((entry) => [entry.id, entry.minUnits]),
) as Record<RtsFormationId, number>;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * §3's table, read as "how well does this shape serve what the army is doing".
 *
 * The headline rule lives here: `column` is a travel formation, never a combat
 * one, so it collapses the moment the phase reaches `deploy`. That switch —
 * column unfolding into a line as contact nears — is the single most visible
 * sign to the player that the AI is preparing for a fight rather than walking
 * into one.
 */
function missionFit(context: AiFormationContext, formation: RtsFormationId): number {
  if (context.mission === "regroup") {
    return { loose: 1, column: 0.6, line: 0.4, square: 0.3, wedge: 0.1, crescent: 0.1 }[formation];
  }
  if (context.mission === "defendBase" || context.mission === "defendExpansion") {
    return { square: 1, line: 0.85, crescent: 0.5, loose: 0.35, wedge: 0.3, column: 0.1 }[formation];
  }
  switch (context.phase) {
    case "march":
      return { column: 1, loose: 0.7, line: 0.35, wedge: 0.25, crescent: 0.2, square: 0.2 }[formation];
    case "approach":
      return { line: 0.85, wedge: 0.85, crescent: 0.75, square: 0.6, column: 0.35, loose: 0.25 }[formation];
    case "deploy":
      return { line: 1, wedge: 0.95, crescent: 0.9, square: 0.7, loose: 0.15, column: 0.1 }[formation];
    case "reposition":
      return { loose: 0.9, column: 0.8, line: 0.5, square: 0.4, wedge: 0.25, crescent: 0.25 }[formation];
    case "engage":
    default:
      // §15: nothing is ordered in contact, so this branch only exists so the
      // scorer is total. Loose is the honest answer to "what shape is a melee".
      return { loose: 1, line: 0.5, crescent: 0.4, wedge: 0.4, square: 0.4, column: 0.1 }[formation];
  }
}

/** §14: narrow ground wants depth, open ground wants frontage. */
function terrainFit(width: number, formation: RtsFormationId): number {
  const open = clamp01(width);
  switch (formation) {
    case "column": return 1 - open;
    case "line": return open;
    case "crescent": return open * open;
    case "wedge": return 0.5 + 0.5 * open;
    case "square": return 0.6;
    case "loose": return 0.5;
  }
}

/** §8's response table. `rangedShare` is our own reach, which `crescent` needs. */
function enemyFit(
  enemyClass: AiEnemyCompositionClass,
  formation: RtsFormationId,
  rangedShare: number,
): number {
  switch (enemyClass) {
    // Guard pressure closes the gap; archers support, siege stays behind.
    case "ranged_heavy":
      return { wedge: 1, line: 0.6, crescent: 0.5, square: 0.4, column: 0.3, loose: 0.25 }[formation];
    // Envelop them only when we actually outrange them.
    case "melee_heavy":
      return {
        crescent: 0.5 + 0.5 * clamp01(rangedShare),
        line: 0.8,
        square: 0.55,
        wedge: 0.4,
        loose: 0.3,
        column: 0.2,
      }[formation];
    // A gun line punishes a dense block, so close fast and stay spread.
    case "siege_heavy":
      return { wedge: 0.9, loose: 0.8, line: 0.45, crescent: 0.4, column: 0.3, square: 0.15 }[formation];
    // Nothing left to fear from the field army; surround the target.
    case "weak":
      return { crescent: 0.9, line: 0.8, wedge: 0.6, loose: 0.5, column: 0.4, square: 0.3 }[formation];
    // The target is walls, not troops: keep the front wide enough to bring the
    // whole army to bear and keep the encirclement risk in mind.
    case "fortified":
      return { line: 0.8, wedge: 0.65, square: 0.55, crescent: 0.5, column: 0.4, loose: 0.35 }[formation];
    case "balanced":
    default:
      return { line: 1, crescent: 0.7, wedge: 0.6, square: 0.5, loose: 0.35, column: 0.25 }[formation];
  }
}

/** How well our *own* mix suits the shape: a wedge needs a Guard core, a square needs someone to protect. */
function compositionFit(friendly: AiRoleCounts, formation: RtsFormationId): number {
  const total = friendly.guard + friendly.archer + friendly.siege;
  if (total <= 0) return 0.5;
  const guardShare = friendly.guard / total;
  const fragileShare = (friendly.archer + friendly.siege) / total;
  switch (formation) {
    case "wedge": return guardShare;
    case "square": return fragileShare;
    case "crescent": return clamp01(friendly.archer / total * 1.5);
    // A line is nobody's specialist shape and everybody's serviceable one.
    case "line": return 0.75;
    case "column": return 0.5;
    case "loose": return 0.4;
  }
}

/** §12: a tight shape is only worth ordering if the army can actually hold it. */
function cohesionFit(cohesion: number, formation: RtsFormationId): number {
  const held = clamp01(cohesion);
  switch (formation) {
    case "line":
    case "wedge":
    case "crescent":
    case "square":
      return held;
    case "column":
      return 0.5 + 0.5 * held;
    // The one shape a scattered army is already in.
    case "loose":
      return 1 - 0.5 * held;
  }
}

/** §7: every formation the army is large enough to form, best first. */
export function scoreFormations(
  context: AiFormationContext,
  weights: AiFormationWeights,
): readonly AiFormationScore[] {
  const total = context.friendly.guard + context.friendly.archer + context.friendly.siege;
  const rangedShare = total > 0 ? (context.friendly.archer + context.friendly.siege) / total : 0;
  const scored = FORMATION_IDS
    .filter((formation) => context.unitCount >= (MINIMUM_UNITS[formation] ?? 2))
    .map((formation) => {
      const mission = missionFit(context, formation);
      const terrain = terrainFit(context.terrainWidth, formation);
      const enemy = enemyFit(context.enemyClass, formation, rangedShare);
      const composition = compositionFit(context.friendly, formation);
      const cohesion = cohesionFit(context.cohesion, formation);
      const transition = context.current === null || context.current === formation ? 0 : 1;
      const score = weights.missionFit * mission
        + weights.terrainFit * terrain
        + weights.enemyFit * enemy
        + weights.compositionFit * composition
        + weights.cohesionFit * cohesion
        - weights.transitionCost * transition;
      return {
        formation,
        score,
        reason: `görev ${mission.toFixed(2)} · arazi ${terrain.toFixed(2)}`
          + ` · düşman ${enemy.toFixed(2)} (${context.enemyClass})`
          + ` · bileşim ${composition.toFixed(2)} · kohezyon ${cohesion.toFixed(2)}`,
      };
    });
  // §17.3: ties break on the catalogue order, never on array order.
  return [...scored].sort((a, b) => b.score - a.score
    || FORMATION_IDS.indexOf(a.formation) - FORMATION_IDS.indexOf(b.formation));
}

/**
 * The formation to hold, given the one currently held.
 *
 * The challenger has to beat the incumbent by `hysteresisMargin` — the same
 * rule and the same number the director uses to keep intents from flapping
 * (§7). A margin comparison on a possibly-negative score has to be additive:
 * multiplying by `1 + margin` makes a *worse* negative score win.
 */
export function betterFormation(
  context: AiFormationContext,
  weights: AiFormationWeights,
  hysteresisMargin: number,
): AiFormationScore | null {
  const scores = scoreFormations(context, weights);
  const best = scores[0];
  if (!best) return null;
  if (context.current === null) return best;
  const held = scores.find((entry) => entry.formation === context.current);
  // The held formation is no longer offered at all (the army shrank below its
  // minimum), so there is nothing to be loyal to.
  if (!held) return best;
  if (best.formation === held.formation) return held;
  return best.score >= held.score + Math.abs(held.score) * hysteresisMargin ? best : held;
}
