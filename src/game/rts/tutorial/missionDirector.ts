/**
 * Mission chain state machine — Hikâye / Öğretici Tur Modu, Faz 1.
 *
 * See `docs/planned/THREEAGES_STORY_TUTORIAL_MODE_PLAN.md`. The director reads
 * the world and hands out the next objective. It owns no simulation state,
 * mutates nothing, and is never asked permission for anything: a broken mission
 * chain must not be able to break a match.
 *
 * The one design decision that carries the whole mode: **there are no per-step
 * "done" flags.** The active step is defined as *the first step whose predicate
 * is currently false*. Everything the plan asks for falls out of that:
 *
 * - **Order independence.** A player who happens to build the depot before the
 *   farm does not get stuck being told to do what they already did; the step is
 *   already satisfied when the chain reaches it, so it clears in the same tick.
 *   An event-driven chain would have missed the event and deadlocked.
 * - **Reversibility.** Demolish the depot and "build a depot" is the first false
 *   predicate again, so it re-opens. This is not politeness — "connect the farm
 *   to the depot" is meaningless instruction while there is no depot.
 * - **Restart safety.** State is a single index derived from the world, so a
 *   restarted match needs no persistence story at all.
 *
 * Two things latch, and only two.
 *
 * The **finish**: once every step has been true at once the chain is over for
 * the match. Without that, a late-game population squeeze or a razed farm would
 * re-open a tutorial the player finished twenty minutes ago.
 *
 * A step marked **`latch`**: its goal measures something the player *did* rather
 * than something they still have (see {@link MissionStep.latch}). Opting in per
 * step rather than latching everything keeps the default honest — most of the
 * chain is about a kingdom that has to keep working, and a farm that has stopped
 * paying is worth being told about again.
 *
 * Pure: no DOM, no three.js, no timers. `test:engine` drives it with object
 * literals.
 */
import { isGoalMet, measureGoal, type MissionGoalProgress, type MissionWorldSnapshot } from "./missionPredicates";
import type { MissionScript, MissionStep } from "./missionScript";

export interface MissionDirectorState {
  /** The objective to show, or null before the first evaluation and once finished. */
  readonly step: MissionStep | null;
  /** 0-based position of `step`, or -1 when there is none. */
  readonly index: number;
  readonly total: number;
  readonly finished: boolean;
  /**
   * How far into the active step the player is, as of the last evaluation; null
   * when there is no active step. Carried on the state rather than recomputed by
   * the card, so the number on screen and the number the chain advances on are
   * the same read of the same world.
   */
  readonly progress: MissionGoalProgress | null;
}

export type MissionDirectorEvent =
  | { readonly kind: "step-activated"; readonly step: MissionStep; readonly index: number }
  | { readonly kind: "step-completed"; readonly step: MissionStep; readonly index: number }
  | { readonly kind: "chain-finished" };

export class MissionDirector {
  /** null until the first evaluation, so the opening emits an activation. */
  private activeIndex: number | null = null;
  private finishedChain = false;
  /**
   * Ids of `latch` steps that have already cleared. Ids rather than indices so a
   * script edited between sessions cannot silently latch a different step.
   */
  private readonly latched = new Set<string>();
  /**
   * The active step's progress at the last evaluation. Kept here rather than
   * recomputed in {@link state} because `state()` has no world to read — the
   * director is a pure function of what it was last shown.
   */
  private activeProgress: MissionGoalProgress | null = null;

  constructor(private readonly script: MissionScript) {
    if (script.steps.length === 0) {
      throw new Error(`Mission script "${script.id}" has no steps`);
    }
  }

  get label(): string {
    return this.script.label;
  }

  get intro(): string {
    return this.script.intro;
  }

  get outro(): string {
    return this.script.outro;
  }

  /**
   * Re-derive the active step from the world and report what changed.
   *
   * Safe to call at any rate — it is a pure read, and calling it more often
   * changes nothing but latency. `RtsApp` throttles it because rebuilding the
   * logistics snapshot has a cost, not because the director minds.
   *
   * @returns the events raised by this evaluation, oldest first. Empty once the
   *   chain has finished, which is what lets a caller stop asking.
   */
  evaluate(world: MissionWorldSnapshot): readonly MissionDirectorEvent[] {
    if (this.finishedChain) return [];

    // Latch before searching: a latched step counts as met from here on, so the
    // search below cannot walk back into it. Every step is re-tested each pass,
    // not just the active one — a `latch` step the player satisfied early is
    // caught the moment it is true rather than when the chain arrives at it.
    for (const step of this.script.steps) {
      if (step.latch && !this.latched.has(step.id) && isGoalMet(step.goal, world)) {
        this.latched.add(step.id);
      }
    }

    const nextIndex = this.script.steps.findIndex((step) =>
      !this.latched.has(step.id) && !isGoalMet(step.goal, world));
    const previousIndex = this.activeIndex;

    // Progress is refreshed on every pass, including the ones that change no
    // step: "1/3 linked" becoming "2/3 linked" is the whole reason the counter
    // exists, and that happens without the chain moving at all.
    this.activeProgress = nextIndex < 0
      ? null
      : measureGoal(this.script.steps[nextIndex]!.goal, world);

    if (nextIndex < 0) {
      this.finishedChain = true;
      this.activeIndex = null;
      const events: MissionDirectorEvent[] = [];
      // Everything from the last announced step onward genuinely just cleared.
      // On a first evaluation that already satisfies the chain, `previousIndex`
      // is null and nothing is reported as completed — the player was never told
      // to do any of it, so claiming they finished it would be a lie.
      if (previousIndex !== null) {
        for (let index = previousIndex; index < this.script.steps.length; index += 1) {
          events.push({ kind: "step-completed", step: this.script.steps[index]!, index });
        }
      }
      events.push({ kind: "chain-finished" });
      return events;
    }

    if (previousIndex === nextIndex) return [];
    this.activeIndex = nextIndex;

    const events: MissionDirectorEvent[] = [];
    // Moving forward: every step passed over is one the player completed, even
    // the ones they satisfied ahead of being asked. Moving *backward* is a
    // re-open, and reports no completion — nothing was achieved by losing a
    // building, and a "completed" event there would fire a congratulation at a
    // player who just lost something.
    if (previousIndex !== null && nextIndex > previousIndex) {
      for (let index = previousIndex; index < nextIndex; index += 1) {
        events.push({ kind: "step-completed", step: this.script.steps[index]!, index });
      }
    }
    events.push({ kind: "step-activated", step: this.script.steps[nextIndex]!, index: nextIndex });
    return events;
  }

  state(): MissionDirectorState {
    const index = this.activeIndex;
    return {
      step: index === null ? null : this.script.steps[index]!,
      index: index ?? -1,
      total: this.script.steps.length,
      finished: this.finishedChain,
      progress: index === null ? null : this.activeProgress,
    };
  }

  /**
   * End the chain now and leave the match running — the "serbest oyuna çevir"
   * escape hatch.
   *
   * Deliberately the same terminal state as finishing rather than a third mode:
   * from here on the director raises nothing and the card is gone, which is
   * exactly what "I'll take it from here" should do. It is *not* a completion,
   * so no `chain-finished` event fires and nothing congratulates the player for
   * a tur they chose to leave.
   *
   * @returns `true` if a live chain was ended; `false` when there was nothing to
   *   abandon, so a caller can tell a real escape from a repeated click.
   */
  abandon(): boolean {
    if (this.finishedChain) return false;
    this.finishedChain = true;
    this.activeIndex = null;
    this.activeProgress = null;
    return true;
  }

  /** A restarted match replays the chain from the top. */
  reset(): void {
    this.activeIndex = null;
    this.activeProgress = null;
    this.finishedChain = false;
    this.latched.clear();
  }
}
