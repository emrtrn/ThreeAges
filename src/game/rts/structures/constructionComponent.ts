/** Bounded construction progress state for Phase 2 foundations. */
export class ConstructionComponent {
  private elapsedSeconds = 0;

  constructor(readonly durationSeconds: number) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new RangeError("construction duration must be > 0");
    }
  }

  get progress(): number {
    return Math.min(1, this.elapsedSeconds / this.durationSeconds);
  }

  get complete(): boolean {
    return this.progress >= 1;
  }

  /**
   * Advance only while one or more workers actively build. Each worker
   * contributes one worker-second, so four active workers finish four times as
   * much work per simulation second (up to the assignment cap).
   */
  advance(deltaSeconds: number, workerCount = 1): boolean {
    if (this.complete || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return false;
    if (!Number.isFinite(workerCount) || workerCount <= 0) return false;
    this.elapsedSeconds = Math.min(this.durationSeconds, this.elapsedSeconds + deltaSeconds * workerCount);
    return this.complete;
  }
}
