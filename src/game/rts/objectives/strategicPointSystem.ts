/**
 * Who is holding each §58 capture objective, right now — Vertical Slice Plan
 * v0.2 §58 "Bölgesel Zafer" (Faz 11).
 *
 * §58 lists "ele geçirme durumu" and "dost kontrol alanı veya aktif karakol
 * bağlantısı koşulu" as two separate boxes, and this resolves both from state
 * that already exists rather than growing a capture mechanic of its own:
 *
 *  - **Held** is asked of {@link TerritoryControlSystem}. That system already
 *    answers "whose land is this cell", and its sources are exactly the centre
 *    and *completed* outposts — an outpost's larger radius only applies while it
 *    is road-connected. So "friendly control area or an active outpost link" is
 *    not a rule reimplemented here; it is the one rule, asked once.
 *  - **Contested** is a live enemy presence inside the point's radius. Territory
 *    is a single-owner grid (nearest source wins), so it can never report "both"
 *    — without this, an army standing on the objective would change nothing and
 *    §58's "AI sayacı durdurmak için tepki veriyor" would have no mechanism to
 *    react through.
 *
 * Pure state over injected readers: no three.js, no DOM, no time. `test:engine`
 * drives it by handing it plain functions.
 */
import type { RtsStrategicPoint } from "../world/rtsMapBlockout";
import type { TerritoryOwner } from "../territory/territoryControlSystem";
import type { UnitOwner } from "../units/unit";

/** A world-space presence the system can weigh against a point. */
export interface StrategicPointOccupant {
  readonly owner: UnitOwner;
  readonly x: number;
  readonly z: number;
}

export interface StrategicPointStatus {
  readonly point: RtsStrategicPoint;
  /** Whose control area covers the point; "neutral" when nobody's does. */
  readonly holder: TerritoryOwner;
  /**
   * True when the holder has an opponent standing on the objective. A contested
   * point still has a holder — contesting stalls the counter, it does not flip
   * ownership, which is what keeps a single scouting unit from *taking* a point
   * its kingdom has no territory near.
   */
  readonly contested: boolean;
}

export class StrategicPointSystem {
  private statuses: readonly StrategicPointStatus[] = [];

  /**
   * @param points authored map objectives; the system never invents one.
   * @param holderAt whose control area covers a world position — in practice
   *   `TerritoryControlSystem.ownerAt`, injected so tests need no grid.
   * @param occupants live units, sampled per refresh rather than subscribed to.
   */
  constructor(
    private readonly points: readonly RtsStrategicPoint[],
    private readonly holderAt: (x: number, z: number) => TerritoryOwner,
    private readonly occupants: () => readonly StrategicPointOccupant[],
  ) {}

  /** The last resolved status of every point, in authored order. */
  all(): readonly StrategicPointStatus[] {
    return this.statuses;
  }

  statusOf(id: string): StrategicPointStatus | null {
    return this.statuses.find((status) => status.point.id === id) ?? null;
  }

  /** Points this owner holds *and* is not being contested on. */
  securedBy(owner: UnitOwner): readonly StrategicPointStatus[] {
    return this.statuses.filter((status) => status.holder === owner && !status.contested);
  }

  /** True when every authored point is secured by this owner. */
  holdsAll(owner: UnitOwner): boolean {
    return this.points.length > 0 && this.securedBy(owner).length === this.points.length;
  }

  /**
   * Recompute every point's status. Cheap — two points against a unit list — so
   * it runs on the simulation tick rather than behind a change subscription that
   * would have to know about territory refreshes *and* unit movement.
   */
  refresh(): void {
    const occupants = this.occupants();
    this.statuses = this.points.map((point) => {
      const holder = this.holderAt(point.x, point.z);
      return {
        point,
        holder,
        contested: holder !== "neutral" && occupants.some((occupant) =>
          occupant.owner !== holder
          && Math.hypot(occupant.x - point.x, occupant.z - point.z) <= point.captureRadius),
      };
    });
  }

  reset(): void {
    this.statuses = [];
  }
}
