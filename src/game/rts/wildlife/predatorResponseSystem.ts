/**
 * Who comes running when a wolf gets its teeth into a worker.
 *
 * `retaliateAgainstAttack` already lets the *mauled worker* turn on the wolf,
 * and `updateUnitEngagement` already lets a soldier who happens to be idle
 * inside his acquisition circle answer it. Both are passive, and together they
 * are why a mauling reads as ignored: acquisition is nine units on the shipped
 * Guard, it only fires while the soldier is standing perfectly idle, and the
 * distance that looks like "right next to him" on a zoomed-out RTS camera is
 * several times that. So the garrison watches a worker die from what the player
 * sees as arm's length.
 *
 * This is the active half: a bite that lands is an **alarm**, and the two
 * nearest unoccupied soldiers of the victim's own kingdom are sent to the animal
 * that bit him. Two rather than "whoever hears it", because the answer to a wolf
 * must not be the answer to a raid — a den beside a lumber camp would otherwise
 * empty a barracks one bite at a time, and §2.6 already pins that one Guard is
 * enough to kill a wolf.
 *
 * What it deliberately does **not** touch:
 *
 * - **Anyone under orders.** A soldier walking a route the player (or the AI's
 *   army manager) gave him keeps walking it — the same rule the passive path
 *   states as "a transit order outranks an automatic defensive chase". Only
 *   genuinely idle soldiers answer, which is also what keeps this system from
 *   fighting the AI for the units it has already committed to a mission.
 * - **Hold Position.** A held unit answers what walks up to it and never leaves
 *   its ground; that is the whole of the stance.
 * - **The wolf's own rules.** Nothing here changes what a predator may hunt or
 *   where it may go; a responder is an ordinary attack order and the animal is
 *   an ordinary {@link CombatTarget}.
 *
 * Symmetric by construction: the dispatch reads the victim's owner, so the AI's
 * lumberjacks are defended by the AI's garrison on exactly the same terms, with
 * no AI-side code at all.
 */
import type { Vector3 } from "three";

import { combatDistance } from "../combat/combatTarget";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { Unit } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import { issueAttackOrder } from "../units/attackPathing";
import type { PredatorStrike } from "./predatorSystem";
import type { WildlifeAnimal } from "./wildlifeSystem";

/**
 * How many soldiers one mauling calls.
 *
 * Two: enough that the answer is visibly an answer (and survives one of them
 * being the wounded one), few enough that a den cannot drain a garrison. A wolf
 * is a reason to keep soldiers near the workers, not a reason to field an army.
 */
export const PREDATOR_RESPONDER_LIMIT = 2;

/**
 * How far a soldier hears the scream, in world units.
 *
 * Comfortably past the Guard's own nine-unit acquisition circle, and near the
 * wolf's own leash (`pursuitRadius`, 26 on the shipped pack) — so a garrison
 * posted at a camp answers anywhere inside the hunting ground of the den that
 * threatens it, which is the sentence the player is actually reading off the
 * screen when they post soldiers beside their woodcutters.
 */
export const PREDATOR_ALARM_RADIUS = 30;

/** Close enough to his post to count as back on it. */
const HOME_ARRIVAL_RADIUS = 1.5;

/** A soldier sent to an alarm, and the ground he left to answer it. */
interface Dispatch {
  readonly predator: WildlifeAnimal;
  /** Where he was standing when the call came; he walks back here afterwards. */
  readonly post: Vector3;
}

export class PredatorResponseSystem {
  private readonly dispatchByUnitId = new Map<number, Dispatch>();

  constructor(
    private readonly units: UnitSystem,
    private readonly navigation: RtsNavigation,
  ) {}

  /**
   * Retire finished responses, then answer this tick's bites.
   *
   * Retirement first, so a soldier freed by the wolf he just killed is eligible
   * for the bite that lands in the same tick a few meters away rather than
   * sitting out a frame — and so the responder cap counts only soldiers who are
   * actually still on their way.
   */
  update(strikes: readonly PredatorStrike[]): void {
    this.advanceResponses();
    if (strikes.length === 0) return;
    // One dispatch per predator per tick: a wolf biting twice inside one step
    // (game speed ×8 spans two attack intervals) is one alarm, not two.
    const answered = new Set<string>();
    for (const strike of strikes) {
      if (answered.has(strike.predator.id)) continue;
      answered.add(strike.predator.id);
      this.dispatchTo(strike.predator, strike.victim.owner);
    }
  }

  /** Soldiers currently on their way to, or fighting, a predator. */
  responders(): readonly Unit[] {
    const responding: Unit[] = [];
    for (const unit of this.units.all()) {
      if (this.dispatchByUnitId.has(unit.id)) responding.push(unit);
    }
    return responding;
  }

  // --- internals ------------------------------------------------------------

  /**
   * Keep the live responses closing, and end the ones that are over.
   *
   * Over means one of four things, and only the last is a judgement call: the
   * soldier is gone, the animal is gone (dead, or tamed out of the wild), the
   * order was replaced — a player clicking elsewhere ends the response, exactly
   * as it ends any other automatic behaviour — or the chase has dragged him past
   * his own leash. That last one is why the response is issued as a *commanded*
   * attack rather than an auto-acquired one: the engagement leash is measured
   * from where a chase began, which for a responder is the far side of the
   * alarm circle, so it would recall him mid-rescue. Measuring from his **post**
   * instead is the honest version of the same rule — he came a long way on
   * purpose, and what he may not do is keep going.
   */
  private advanceResponses(): void {
    if (this.dispatchByUnitId.size === 0) return;
    const byId = new Map(this.units.all().map((unit) => [unit.id, unit]));
    for (const [unitId, dispatch] of this.dispatchByUnitId) {
      const unit = byId.get(unitId);
      if (!unit || unit.health.depleted || unit.dying) {
        this.dispatchByUnitId.delete(unitId);
        continue;
      }
      const animal = dispatch.predator;
      const stillOnIt = unit.attackTarget === animal && !animal.dead && animal.owner === "wild";
      const strayed = unit.position.distanceTo(dispatch.post) > this.leashFor(unit);
      if (stillOnIt && !strayed) {
        this.keepClosing(unit, animal);
        continue;
      }
      this.dispatchByUnitId.delete(unitId);
      // Reaching here with the fight still on means the leash is what ended it,
      // which is the one case where the soldier has to be pulled off his target.
      this.sendHome(unit, dispatch, stillOnIt);
    }
  }

  /**
   * Re-plan a responder's approach when his route runs out short of the animal.
   *
   * An attack order is pathed **once**, at the moment it is issued
   * ({@link issueAttackOrder} — "a later moving-target pursuit slice can add a
   * distance/cadence replan"), and a wolf does not wait where it was when the
   * call went out: it drifts around its victim, gives the body up, or picks the
   * next worker. Without this the rescue ends as a soldier standing on the spot
   * the wolf used to be, target in hand, doing nothing — the exact silhouette
   * this whole system exists to remove.
   *
   * Affordable precisely because it is scoped to responders: at most
   * {@link PREDATOR_RESPONDER_LIMIT} soldiers per hunting predator, and only on
   * the frames their path is actually exhausted, rather than a pursuit re-plan
   * for every unit in the match.
   */
  private keepClosing(unit: Unit, animal: WildlifeAnimal): void {
    if (unit.stance === "hold" || unit.hasMovementOrder) return;
    if (combatDistance(unit.position, animal) <= unit.attack.range) return;
    const path = this.navigation.planAttack(unit.position, animal, unit.attack.range);
    if (path && path.length > 0) unit.replanPath(path);
  }

  /**
   * How far from his post a responder may end up: the alarm he answered plus the
   * chase his own balance row already allows him. Data-owned rather than a
   * second tuning number, so a unit built to pursue pursues further here too.
   */
  private leashFor(unit: Unit): number {
    return PREDATOR_ALARM_RADIUS + unit.attack.chaseRange;
  }

  /**
   * Send a finished responder back to the ground he left.
   *
   * A plain automatic move, not a player one, so worker automation and the AI's
   * army manager both remain free to claim him on the way — the walk home is the
   * lowest-priority thing he could be doing. Skipped when something else already
   * has him (a fresh target, a new route) and when he never really left.
   */
  private sendHome(unit: Unit, dispatch: Dispatch, recalled: boolean): void {
    // Recalled mid-fight means the leash tripped: drop the target too, or the
    // pursuit order simply walks him straight back out again.
    if (recalled) unit.setAttackTarget(null);
    if (unit.attackTarget || unit.hasMovementOrder || unit.attackMoveTarget) return;
    if (unit.position.distanceTo(dispatch.post) <= HOME_ARRIVAL_RADIUS) return;
    const path = this.navigation.plan(unit.position, dispatch.post);
    // No route home leaves him where he stands rather than replanning forever;
    // he is a soldier on open ground, not a unit stuck in a footprint.
    if (path) unit.setMovePath(path);
  }

  /** Fill this predator's response up to {@link PREDATOR_RESPONDER_LIMIT}. */
  private dispatchTo(predator: WildlifeAnimal, owner: Unit["owner"]): void {
    if (predator.dead || predator.owner !== "wild") return;
    let onIt = 0;
    for (const dispatch of this.dispatchByUnitId.values()) {
      if (dispatch.predator === predator) onIt += 1;
    }
    const missing = PREDATOR_RESPONDER_LIMIT - onIt;
    if (missing <= 0) return;

    const radiusSquared = PREDATOR_ALARM_RADIUS * PREDATOR_ALARM_RADIUS;
    const candidates: { unit: Unit; distance: number }[] = [];
    for (const unit of this.units.unitsOf(owner)) {
      if (!this.available(unit)) continue;
      const dx = unit.position.x - predator.position.x;
      const dz = unit.position.z - predator.position.z;
      const distance = dx * dx + dz * dz;
      if (distance > radiusSquared) continue;
      candidates.push({ unit, distance });
    }
    // Nearest first, ties broken by roster order so a headless match and the
    // player's see the same two soldiers move (the wildlife determinism rule).
    candidates.sort((left, right) => left.distance - right.distance
      || left.unit.id - right.unit.id);
    for (const candidate of candidates.slice(0, missing)) {
      const unit = candidate.unit;
      this.dispatchByUnitId.set(unit.id, {
        predator,
        post: unit.position.clone(),
      });
      // Commanded rather than auto-acquired: see {@link advanceResponses} — the engagement
      // leash would recall him from the far side of the alarm circle before he
      // ever arrived, and this system carries its own recall instead.
      issueAttackOrder(unit, predator, this.navigation, false);
    }
  }

  /**
   * Whether this soldier is free to answer.
   *
   * Idle in the strict sense — no target, no route, no attack-move — which is
   * what makes this system safe to run beside every other one that gives orders:
   * it only ever claims a unit nobody else has claimed. Workers never fight
   * (their acquisition range is zero by data), and a held unit does not leave
   * its ground.
   */
  private available(unit: Unit): boolean {
    return unit.role !== "worker"
      && !unit.health.depleted
      && !unit.dying
      && unit.stance !== "hold"
      && unit.attackTarget === null
      && unit.attackMoveTarget === null
      && !unit.hasMovementOrder
      && !this.dispatchByUnitId.has(unit.id);
  }
}
