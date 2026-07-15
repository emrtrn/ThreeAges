import {
  RTS_SIMULATION_SPEEDS,
  type RtsSimulationSpeed,
} from "../simulation/simulationSpeed";

const SPEED_LABEL: Record<RtsSimulationSpeed, string> = {
  1: "Normal",
  2: "2X",
  4: "4X",
  8: "8X",
};

/** Small always-visible speed selector for faster RTS iteration. */
export class RtsGameSpeedControls {
  private readonly root = document.createElement("section");
  private readonly buttons = new Map<RtsSimulationSpeed, HTMLButtonElement>();
  private speed: RtsSimulationSpeed;

  constructor(
    initialSpeed: RtsSimulationSpeed,
    private readonly onChange: (speed: RtsSimulationSpeed) => void,
  ) {
    this.speed = initialSpeed;
    this.root.className = "rts-game-speed ui-interactive";
    this.root.setAttribute("aria-label", "Oyun hızı");
    const title = document.createElement("strong");
    title.textContent = "Oyun Hızı";
    this.root.appendChild(title);
    const choices = document.createElement("div");
    choices.className = "rts-game-speed-choices";
    for (const speed of RTS_SIMULATION_SPEEDS) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = SPEED_LABEL[speed];
      button.dataset.rtsSpeed = String(speed);
      button.addEventListener("click", () => this.setSpeed(speed));
      this.buttons.set(speed, button);
      choices.appendChild(button);
    }
    this.root.appendChild(choices);
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
    this.render();
  }

  dispose(): void {
    this.root.remove();
  }

  private setSpeed(speed: RtsSimulationSpeed): void {
    if (this.speed === speed) return;
    this.speed = speed;
    this.render();
    this.onChange(speed);
  }

  private render(): void {
    this.root.dataset.speed = String(this.speed);
    for (const [speed, button] of this.buttons) {
      button.setAttribute("aria-pressed", String(speed === this.speed));
    }
  }
}
