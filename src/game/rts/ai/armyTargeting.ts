/**
 * Target scoring — `07_ENEMY_AI_DESIGN_v0.2.md` §60, §67, §69; plan §38
 * ("Hedef olarak dış ekonomi veya merkez seç").
 *
 * Pure functions over plain candidate records, exactly like {@link scoreIntents}:
 * no world access, no time, no randomness (§80 determinism). The army manager
 * projects the live world into candidates; everything decided here is testable
 * by handing it an array of objects.
 *
 * §60's headline rule is "Merkez her zaman en iyi hedef olmamalıdır". That falls
 * out of two things rather than a special case: an undefended outer farm carries
 * more EconomicValue than the centre does, and the centre's VictoryValue only
 * counts once we actually dominate (§69) — so a coin-flip army goes after soft
 * economy while a winning one closes the match out (§67).
 */
import type { AiTargetWeights } from "../../data/gameDataTypes";

/** The structure classes AI-1 can tell apart, in §60's priority order. */
export type AiTargetKind = "economy" | "depot" | "outpost" | "military" | "support" | "center";

export const AI_TARGET_KINDS: readonly AiTargetKind[] = [
  "economy",
  "depot",
  "outpost",
  "military",
  "support",
  "center",
];

/**
 * §60's EconomicValue/StrategicValue/VictoryValue per class, normalised to 0..1.
 * The weights that combine them are data (`ai.json` `army.targetWeights`); these
 * base values are the design's priority list, so they live with the formula.
 */
const KIND_VALUE: Readonly<Record<AiTargetKind, {
  readonly economic: number;
  readonly strategic: number;
  readonly victory: number;
}>> = {
  // §60 #2: undefended outer economy is the top standing target.
  economy: { economic: 1, strategic: 0.2, victory: 0 },
  // §60 #3: a depot cuts everything routed through it (Faz 4 logistics).
  depot: { economic: 0.8, strategic: 0.6, victory: 0 },
  // §60 #3/#5: an outpost is the region's claim — strategic more than economic.
  outpost: { economic: 0.3, strategic: 0.9, victory: 0 },
  // §60 #4: military production.
  military: { economic: 0.2, strategic: 0.8, victory: 0 },
  // Housing and the rest: real but minor.
  support: { economic: 0.3, strategic: 0.1, victory: 0 },
  // §60 #6: the centre alone carries VictoryValue.
  center: { economic: 0.2, strategic: 0.5, victory: 1 },
};

/** Guard power at which a target reads as fully defended (§60 DefenseStrength). */
const DEFENDED_POWER = 4;

/** Producers routed through one structure at which its loss reads as total. */
const LOGISTICS_FULL_PRODUCERS = 4;
/** Control radius at which a territory structure reads as holding a whole region. */
const LOGISTICS_FULL_TERRITORY = 24;

/** Beyond this the army is crossing the map; proximity contributes nothing. */
export const AI_TARGET_REACH = 96;

/**
 * §62: the "hedef değeri çok yüksek" bar a risky attack has to clear. With the
 * shipped weights an undefended, adjacent, top-class target scores ~1.54 and a
 * defended or distant one falls well below — so this reads as "only a prime
 * target justifies fighting at a disadvantage".
 */
export const AI_HIGH_VALUE_TARGET_SCORE = 1.5;

/**
 * Askerî AI v2 planı §11: what this target's fall would cut, in raw counts.
 *
 * Raw rather than pre-scored on purpose. The army manager reads it off the live
 * logistics systems (§11.3 — no new system is written, existing ones are asked
 * read-only); turning counts into a 0..1 term is scoring, and scoring lives
 * here with the rest of the formula.
 *
 * Fog (§17.2) is the caller's job: only producers the AI has actually seen may
 * appear in `servedProducers`, or a remembered depot would leak the shape of a
 * supply network nobody ever scouted.
 */
export interface AiTargetLogistics {
  /** Seen enemy producers that ship their output through this structure. */
  readonly servedProducers: number;
  /** Control radius this structure holds, in world units; 0 when it holds none. */
  readonly territoryRadius: number;
}

export interface AiTargetCandidate {
  /** Stable identity, so a re-scored world keeps commanding the same target. */
  readonly id: string;
  readonly kind: AiTargetKind;
  readonly x: number;
  readonly z: number;
  /** §60 Vulnerability: an already-damaged target is worth finishing. */
  readonly healthRatio: number;
  /** §60 DefenseStrength: enemy army power standing over this target. */
  readonly defensePower: number;
  /** World distance from the army to the target. */
  readonly distance: number;
  /**
   * §11: the flow this target carries. Optional because the class value alone
   * is still a complete score — a caller without a logistics view (every
   * headless targeting test) keeps the pre-§11 behaviour rather than being
   * forced to invent numbers.
   */
  readonly logistics?: AiTargetLogistics;
}

/**
 * §11.2: how much of the enemy's flow this target carries, 0..1.
 *
 * The point of the whole phase. `KIND_VALUE` already knows "a depot is
 * valuable"; this is what lets the AI know that *this* depot feeds three
 * producers and the one next to it feeds none — which is the difference between
 * playing the game's own rules and playing a building-class lookup table.
 */
export function logisticsDamage(logistics: AiTargetLogistics | undefined): number {
  if (!logistics) return 0;
  return clamp01(
    logistics.servedProducers / LOGISTICS_FULL_PRODUCERS
    + clamp01(logistics.territoryRadius / LOGISTICS_FULL_TERRITORY) * 0.5,
  );
}

export interface AiTargetScore {
  readonly candidate: AiTargetCandidate;
  readonly score: number;
  /** Short driver of the score, for §5 readability and the §82 panel. */
  readonly reason: string;
}

export interface AiTargetingContext {
  /**
   * §69: how decisively we outmatch the defence, 0..1. It gates VictoryValue,
   * which is what stops a fragile army from throwing itself at the centre and
   * what stops a dominant one from farming outbuildings forever (§67).
   */
  readonly dominance: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** §60 TargetScore for every candidate, best first. Ties break deterministically. */
export function scoreTargets(
  candidates: readonly AiTargetCandidate[],
  weights: AiTargetWeights,
  context: AiTargetingContext,
): readonly AiTargetScore[] {
  const scored = candidates.map((candidate) => scoreTarget(candidate, weights, context));
  return [...scored].sort((a, b) => b.score - a.score
    || AI_TARGET_KINDS.indexOf(a.candidate.kind) - AI_TARGET_KINDS.indexOf(b.candidate.kind)
    || a.candidate.id.localeCompare(b.candidate.id));
}

/** The single best target, or null when there is nothing to attack. */
export function bestTarget(
  candidates: readonly AiTargetCandidate[],
  weights: AiTargetWeights,
  context: AiTargetingContext,
): AiTargetScore | null {
  return scoreTargets(candidates, weights, context)[0] ?? null;
}

function scoreTarget(
  candidate: AiTargetCandidate,
  weights: AiTargetWeights,
  context: AiTargetingContext,
): AiTargetScore {
  const base = KIND_VALUE[candidate.kind];
  const vulnerability = clamp01(1 - candidate.healthRatio);
  const proximity = clamp01(1 - candidate.distance / AI_TARGET_REACH);
  const defense = clamp01(candidate.defensePower / DEFENDED_POWER);
  const victory = base.victory * clamp01(context.dominance);
  const logistics = logisticsDamage(candidate.logistics);

  const score = weights.economicValue * base.economic
    + weights.strategicValue * base.strategic
    + weights.victoryValue * victory
    + weights.vulnerability * vulnerability
    + weights.proximity * proximity
    + weights.logisticsValue * logistics
    - weights.defenseStrength * defense;

  return { candidate, score, reason: reasonFor(candidate, defense, victory, logistics) };
}

function reasonFor(
  candidate: AiTargetCandidate,
  defense: number,
  victory: number,
  logistics: number,
): string {
  if (candidate.kind === "center") {
    return victory > 0
      ? `merkez: üstünlük kuruldu (zafer değeri ${victory.toFixed(2)})`
      : "merkez: üstünlük yok, zafer değeri düşük";
  }
  // §11: when the flow this target carries is what won it the score, say so —
  // "depo: savunmasız" and "depo: 3 üreticiyi besliyor" are two different
  // decisions and the §82 panel has to be able to tell them apart.
  const served = candidate.logistics?.servedProducers ?? 0;
  if (logistics > 0 && served > 0) {
    return `${KIND_LABEL[candidate.kind]}: ${served} üreticiyi besliyor (lojistik ${logistics.toFixed(2)})`;
  }
  if (logistics > 0) return `${KIND_LABEL[candidate.kind]}: bölge tutuyor (lojistik ${logistics.toFixed(2)})`;
  if (defense <= 0) return `${KIND_LABEL[candidate.kind]}: savunmasız`;
  return `${KIND_LABEL[candidate.kind]}: savunma gücü ${candidate.defensePower.toFixed(1)}`;
}

const KIND_LABEL: Readonly<Record<AiTargetKind, string>> = {
  economy: "dış ekonomi",
  depot: "depo",
  outpost: "karakol",
  military: "askerî üretim",
  support: "yardımcı yapı",
  center: "merkez",
};
