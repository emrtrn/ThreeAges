import type { EngineUpdateContext, Subsystem } from "./Subsystem";

export class SubsystemRegistry {
  private readonly subsystems = new Map<string, Subsystem>();

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

  update(context: EngineUpdateContext): void {
    for (const subsystem of this.subsystems.values()) {
      subsystem.update?.(context);
    }
  }

  async dispose(): Promise<void> {
    const ordered = [...this.subsystems.values()];
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      await ordered[index]?.dispose?.();
    }
  }
}
