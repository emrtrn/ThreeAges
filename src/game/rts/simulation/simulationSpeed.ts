/** Explicit, player-selectable simulation rates for rapid RTS testing. */
export const RTS_SIMULATION_SPEEDS = [1, 2, 4, 8] as const;

export type RtsSimulationSpeed = (typeof RTS_SIMULATION_SPEEDS)[number];

export function isRtsSimulationSpeed(value: number): value is RtsSimulationSpeed {
  return RTS_SIMULATION_SPEEDS.includes(value as RtsSimulationSpeed);
}

/** Split a scaled rendered-frame delta into simulation-safe steps. */
export function simulationSteps(
  frameSeconds: number,
  speed: RtsSimulationSpeed,
  maximumStepSeconds: number,
): readonly number[] {
  if (!Number.isFinite(frameSeconds) || frameSeconds < 0) {
    throw new RangeError("Frame delta must be a non-negative finite number");
  }
  if (!isRtsSimulationSpeed(speed)) throw new RangeError(`Unsupported RTS simulation speed: ${speed}`);
  if (!Number.isFinite(maximumStepSeconds) || maximumStepSeconds <= 0) {
    throw new RangeError("Maximum simulation step must be a positive finite number");
  }
  const steps: number[] = [];
  let remaining = frameSeconds * speed;
  while (remaining > 0) {
    const step = Math.min(remaining, maximumStepSeconds);
    steps.push(step);
    remaining -= step;
  }
  return steps;
}
