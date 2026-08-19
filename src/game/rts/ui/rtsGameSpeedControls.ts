import { markStaticAria, markStaticText, refreshStaticText } from "./rtsStaticText";
import {
  RTS_SIMULATION_SPEEDS,
  type RtsSimulationSpeed,
} from "../simulation/simulationSpeed";

export type RtsGameSpeedControlMode = "player" | "debug";

export interface RtsGameSpeedControlsOptions {
  /** Player HUD deliberately exposes only the final, player-facing rates. */
  readonly speeds?: readonly RtsSimulationSpeed[];
  /** Debug mode keeps the accelerated iteration rates out of the player HUD. */
  readonly mode?: RtsGameSpeedControlMode;
}

const SPEED_LABEL: Record<RtsSimulationSpeed, string> = {
  1: "Normal",
  2: "2X",
  4: "4X",
  8: "8X",
};

/**
 * Speed picker presentation. It owns button state only; RtsApp remains the
 * single authority for the active simulation rate when player and debug
 * controls are both mounted.
 */
export class RtsGameSpeedControls {
  private readonly root = document.createElement("section");
  private readonly buttons = new Map<RtsSimulationSpeed, HTMLButtonElement>();
  private speed: RtsSimulationSpeed;

  constructor(
    initialSpeed: RtsSimulationSpeed,
    private readonly onChange: (speed: RtsSimulationSpeed) => void,
    options: RtsGameSpeedControlsOptions = {},
  ) {
    this.speed = initialSpeed;
    this.root.className = "rts-game-speed ui-interactive";
    const mode = options.mode ?? "player";
    this.root.dataset.rtsSpeedMode = mode;
    markStaticAria(this.root, mode === "debug" ? "hud.speed.aria.debug" : "hud.speed.aria");
    const label = document.createElement("span");
    label.className = "rts-game-speed-label";
    markStaticText(label, mode === "debug" ? "hud.speed.label.debug" : "hud.speed.label");
    const choices = document.createElement("div");
    choices.className = "rts-game-speed-choices";
    for (const speed of options.speeds ?? RTS_SIMULATION_SPEEDS) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = SPEED_LABEL[speed];
      button.dataset.rtsSpeed = String(speed);
      button.addEventListener("click", () => this.chooseSpeed(speed));
      this.buttons.set(speed, button);
      choices.appendChild(button);
    }
    this.root.append(label, choices);
    this.render();
  }

  /** The HUD owns placement; this control owns only speed-selection state. */
  mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  /**
   * Re-resolve the caption and aria label — Plan §13. The speed buttons say
   * "1x"/"2x", which no language rewrites.
   */
  retranslate(): void {
    refreshStaticText(this.root);
  }

  dispose(): void {
    this.root.remove();
  }

  /** Reflect a speed selected by a sibling player/debug control without looping. */
  setSpeed(speed: RtsSimulationSpeed): void {
    if (this.speed === speed) return;
    this.speed = speed;
    this.render();
  }

  private chooseSpeed(speed: RtsSimulationSpeed): void {
    if (this.speed === speed) return;
    this.setSpeed(speed);
    this.onChange(speed);
  }

  private render(): void {
    this.root.dataset.speed = String(this.speed);
    for (const [speed, button] of this.buttons) {
      button.setAttribute("aria-pressed", String(speed === this.speed));
    }
  }
}
