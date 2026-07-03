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
   * Turns on per-subsystem tick timing (idempotent). Only the `?debug` runtime
   * calls this, so the production update loop never times anything. `now` is
   * injectable for deterministic tests; it defaults to the registry clock.
   */
  enableProfiling(now?: () => number): SubsystemProfiler {
    if (!this.profiler) {
      this.profiler = new SubsystemProfiler();
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
