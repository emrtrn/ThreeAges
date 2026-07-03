import type { EngineUpdateContext, Subsystem } from "./Subsystem";
import type { SubsystemTimingRecorder } from "./subsystemProfiler";

export class SubsystemRegistry {
  private readonly subsystems = new Map<string, Subsystem>();
  /** When set (only under `?debug`), each subsystem's `update()` is timed. */
  private profiler: SubsystemTimingRecorder | null = null;
  private now: () => number = defaultNow;

  register(subsystem: Subsystem): Subsystem {
    if (this.subsystems.has(subsystem.id)) {
      throw new Error(`Subsystem already registered: ${subsystem.id}`);
    }
    this.subsystems.set(subsystem.id, subsystem);
    return subsystem;
  }

  has(id: string): boolean {
    return this.subsystems.has(id);
  }

  get<TSubsystem extends Subsystem = Subsystem>(id: string): TSubsystem | null {
    return (this.subsystems.get(id) as TSubsystem | undefined) ?? null;
  }

  require<TSubsystem extends Subsystem = Subsystem>(id: string): TSubsystem {
    const subsystem = this.get<TSubsystem>(id);
    if (!subsystem) throw new Error(`Subsystem not registered: ${id}`);
    return subsystem;
  }

  list(): readonly Subsystem[] {
    return [...this.subsystems.values()];
  }

  async init(): Promise<void> {
    for (const subsystem of this.subsystems.values()) {
      await subsystem.init?.();
    }
  }

  async start(): Promise<void> {
    for (const subsystem of this.subsystems.values()) {
      await subsystem.start?.();
    }
  }

  /**
   * Attaches (or clears) a timing recorder. With no recorder the update loop
   * keeps its plain, un-timed path so production pays nothing; with one, each
   * subsystem's `update()` is wrapped in a `now()` measurement. The `now` clock
   * is injectable so the wiring is deterministic in headless tests.
   */
  setProfiler(profiler: SubsystemTimingRecorder | null, now?: () => number): void {
    this.profiler = profiler;
    if (now) this.now = now;
  }

  update(context: EngineUpdateContext): void {
    const { profiler } = this;
    if (!profiler) {
      for (const subsystem of this.subsystems.values()) {
        subsystem.update?.(context);
      }
      return;
    }
    const now = this.now;
    for (const subsystem of this.subsystems.values()) {
      if (!subsystem.update) continue;
      const start = now();
      subsystem.update(context);
      profiler.record(subsystem.id, now() - start);
    }
    profiler.endFrame();
  }

  async dispose(): Promise<void> {
    const ordered = [...this.subsystems.values()];
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      await ordered[index]?.dispose?.();
    }
  }
}

/** High-resolution clock when available, else a millisecond fallback. */
function defaultNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
