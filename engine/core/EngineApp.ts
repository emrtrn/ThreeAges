import type { EngineUpdateContext, Subsystem } from "./Subsystem";
import { SubsystemRegistry } from "./SubsystemRegistry";
import { SubsystemProfiler, type SubsystemProfileSnapshot } from "./subsystemProfiler";

export class EngineApp {
  readonly subsystems = new SubsystemRegistry();

  private elapsedSeconds = 0;
  private frame = 0;
  private profiler: SubsystemProfiler | null = null;

  registerSubsystem(subsystem: Subsystem): Subsystem {
    return this.subsystems.register(subsystem);
  }

  /**
   * Turns on per-subsystem tick timing (idempotent). The `?debug` runtime enables
   * it for the overlay; the adaptive quality controller also enables it (with a
   * smaller window) so its bottleneck classifier has a passive CPU signal even
   * without `?debug` (plan §7.3) — the profiler is cheap (a few adds per record).
   * `now` is injectable for deterministic tests; it defaults to the registry
   * clock. `windowFrames` overrides the rolling-window size on first enable.
   */
  enableProfiling(now?: () => number, windowFrames?: number): SubsystemProfiler {
    if (!this.profiler) {
      this.profiler = windowFrames === undefined
        ? new SubsystemProfiler()
        : new SubsystemProfiler(windowFrames);
      this.subsystems.setProfiler(this.profiler, now);
    }
    return this.profiler;
  }

  /** Latest subsystem timing snapshot, or null when profiling is off. */
  getProfileSnapshot(): SubsystemProfileSnapshot | null {
    return this.profiler?.snapshot() ?? null;
  }

  async init(): Promise<void> {
    await this.subsystems.init();
  }

  async start(): Promise<void> {
    await this.subsystems.start();
  }

  update(deltaSeconds: number): EngineUpdateContext {
    this.elapsedSeconds += deltaSeconds;
    this.frame += 1;

    const context: EngineUpdateContext = {
      deltaSeconds,
      elapsedSeconds: this.elapsedSeconds,
      frame: this.frame,
    };
    this.subsystems.update(context);
    return context;
  }

  async dispose(): Promise<void> {
    await this.subsystems.dispose();
  }
}
