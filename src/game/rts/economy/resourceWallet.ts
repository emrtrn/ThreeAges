/**
 * Deterministic resource wallet for the RTS economy.
 *
 * Construction reservations are refundable exactly once, so cancelled sites
 * cannot duplicate stock or drive resources negative.  Economy producers use
 * `credit` and consumers can observe every balance change without reaching
 * into the wallet's private state.
 */
import type { StartingResources } from "../../data/gameDataTypes";

export interface ResourceReservation {
  readonly id: number;
  readonly cost: StartingResources;
}

export type ResourceChangeKind = "income" | "reserve" | "refund" | "reset";

export interface ResourceChange {
  readonly kind: ResourceChangeKind;
  readonly resourceId: string;
  readonly delta: number;
  readonly previousAmount: number;
  readonly amount: number;
  readonly elapsedSeconds: number;
  readonly reservationId?: number;
}

export type ResourceChangeListener = (change: ResourceChange) => void;

interface IncomeSample {
  readonly resourceId: string;
  readonly amount: number;
  readonly elapsedSeconds: number;
}

const RATE_WINDOW_SECONDS = 60;

export class ResourceWallet {
  private readonly amounts = new Map<string, number>();
  private readonly openReservations = new Set<number>();
  private readonly listeners = new Set<ResourceChangeListener>();
  private readonly incomeSamples: IncomeSample[] = [];
  private nextReservationId = 1;
  private elapsedSeconds = 0;

  constructor(startingResources: StartingResources) {
    this.reset(startingResources);
  }

  amount(resourceId: string): number {
    return this.amounts.get(resourceId) ?? 0;
  }

  snapshot(): StartingResources {
    return Object.fromEntries([...this.amounts.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }

  /** Subscribe to balance mutations. Returns an idempotent unsubscribe callback. */
  subscribe(listener: ResourceChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Advance match time for the rolling income-per-minute calculation. */
  advance(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("Resource wallet time delta must be a non-negative finite number");
    }
    this.elapsedSeconds += deltaSeconds;
    this.pruneIncomeSamples();
  }

  /** Credit production or another positive income source. */
  credit(resourceId: string, amount: number): void {
    this.assertPositiveAmount(resourceId, amount);
    const previousAmount = this.amount(resourceId);
    const nextAmount = previousAmount + amount;
    this.amounts.set(resourceId, nextAmount);
    this.incomeSamples.push({ resourceId, amount, elapsedSeconds: this.elapsedSeconds });
    this.pruneIncomeSamples();
    this.emit({
      kind: "income",
      resourceId,
      delta: amount,
      previousAmount,
      amount: nextAmount,
      elapsedSeconds: this.elapsedSeconds,
    });
  }

  /** Rolling positive income normalised to one minute of match time. */
  incomePerMinute(resourceId: string): number {
    const samples = this.incomeSamples.filter((sample) => sample.resourceId === resourceId);
    const first = samples[0];
    if (!first) return 0;
    const observedSeconds = Math.min(RATE_WINDOW_SECONDS, this.elapsedSeconds - first.elapsedSeconds);
    if (observedSeconds <= 0) return 0;
    const income = samples.reduce((total, sample) => total + sample.amount, 0);
    return (income / observedSeconds) * RATE_WINDOW_SECONDS;
  }

  /** Atomically deduct a cost, or return null without changing a balance. */
  reserve(cost: StartingResources): ResourceReservation | null {
    for (const [resourceId, amount] of Object.entries(cost)) {
      if (!Number.isFinite(amount) || amount < 0 || this.amount(resourceId) < amount) return null;
    }
    const normalized = Object.fromEntries(Object.entries(cost).filter(([, amount]) => amount > 0));
    for (const [resourceId, amount] of Object.entries(normalized)) {
      const previousAmount = this.amount(resourceId);
      const nextAmount = previousAmount - amount;
      this.amounts.set(resourceId, nextAmount);
      this.emit({
        kind: "reserve",
        resourceId,
        delta: -amount,
        previousAmount,
        amount: nextAmount,
        elapsedSeconds: this.elapsedSeconds,
        reservationId: this.nextReservationId,
      });
    }
    const reservation = { id: this.nextReservationId++, cost: normalized };
    this.openReservations.add(reservation.id);
    return reservation;
  }

  /** Refund exactly one still-open reservation. */
  refund(reservation: ResourceReservation): boolean {
    if (!this.openReservations.delete(reservation.id)) return false;
    for (const [resourceId, amount] of Object.entries(reservation.cost)) {
      const previousAmount = this.amount(resourceId);
      const nextAmount = previousAmount + amount;
      this.amounts.set(resourceId, nextAmount);
      this.emit({
        kind: "refund",
        resourceId,
        delta: amount,
        previousAmount,
        amount: nextAmount,
        elapsedSeconds: this.elapsedSeconds,
        reservationId: reservation.id,
      });
    }
    return true;
  }

  /** Finalize a spent reservation so a completed queue cannot refund it later. */
  commit(reservation: ResourceReservation): boolean {
    return this.openReservations.delete(reservation.id);
  }

  /** Reset a match wallet; any prior reservation token becomes invalid. */
  reset(startingResources: StartingResources): void {
    for (const [resourceId, amount] of this.amounts) {
      this.emit({
        kind: "reset",
        resourceId,
        delta: -amount,
        previousAmount: amount,
        amount: 0,
        elapsedSeconds: this.elapsedSeconds,
      });
    }
    this.amounts.clear();
    for (const [resourceId, amount] of Object.entries(startingResources)) {
      if (!Number.isFinite(amount) || amount < 0) {
        throw new RangeError(`Starting amount for "${resourceId}" must be a non-negative finite number`);
      }
      this.amounts.set(resourceId, amount);
      if (amount > 0) {
        this.emit({
          kind: "reset",
          resourceId,
          delta: amount,
          previousAmount: 0,
          amount,
          elapsedSeconds: this.elapsedSeconds,
        });
      }
    }
    this.openReservations.clear();
    this.incomeSamples.length = 0;
    this.nextReservationId = 1;
    this.elapsedSeconds = 0;
  }

  private assertPositiveAmount(resourceId: string, amount: number): void {
    if (!resourceId || !Number.isFinite(amount) || amount <= 0) {
      throw new RangeError("Resource credits require a non-empty id and positive finite amount");
    }
  }

  private pruneIncomeSamples(): void {
    const cutoff = this.elapsedSeconds - RATE_WINDOW_SECONDS;
    while (true) {
      const first = this.incomeSamples[0];
      if (!first || first.elapsedSeconds >= cutoff) return;
      this.incomeSamples.shift();
    }
  }

  private emit(change: ResourceChange): void {
    for (const listener of this.listeners) listener(change);
  }
}
