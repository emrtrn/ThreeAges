/**
 * RTS world-progress presentation.
 *
 * These bars are DOM projected onto the field, rather than meshes living in
 * it: construction and training must remain readable above roofs, terrain and
 * building models at every camera angle.
 */
import { Vector3, type PerspectiveCamera } from "three";

export interface RtsWorldProgressEntry {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly progress: number;
  readonly label: string;
  /** Health uses a separate fill treatment but shares the same world anchor. */
  readonly variant?: "progress" | "health";
}

interface MountedEntry {
  readonly root: HTMLDivElement;
  readonly label: HTMLSpanElement;
  readonly fill: HTMLSpanElement;
}

export class RtsWorldProgressOverlay {
  private readonly root = document.createElement("div");
  private readonly entries = new Map<string, MountedEntry>();
  private readonly scratch = new Vector3();

  constructor() {
    this.root.className = "rts-world-progress-layer";
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
  }

  update(camera: PerspectiveCamera, width: number, height: number, entries: readonly RtsWorldProgressEntry[]): void {
    const active = new Set(entries.map((entry) => entry.id));
    for (const [id, mounted] of this.entries) {
      if (!active.has(id)) {
        mounted.root.remove();
        this.entries.delete(id);
      }
    }
    for (const entry of entries) this.updateEntry(camera, width, height, entry);
  }

  dispose(): void {
    this.entries.clear();
    this.root.remove();
  }

  private updateEntry(camera: PerspectiveCamera, width: number, height: number, entry: RtsWorldProgressEntry): void {
    let mounted = this.entries.get(entry.id);
    if (!mounted) {
      const root = document.createElement("div");
      root.className = "rts-world-progress";
      const label = document.createElement("span");
      label.className = "rts-world-progress-label";
      const track = document.createElement("span");
      track.className = "rts-world-progress-track";
      const fill = document.createElement("span");
      fill.className = "rts-world-progress-fill";
      track.appendChild(fill);
      root.append(label, track);
      this.root.appendChild(root);
      mounted = { root, label, fill };
      this.entries.set(entry.id, mounted);
    }

    this.scratch.set(entry.x, entry.y, entry.z).project(camera);
    const inFront = this.scratch.z >= -1 && this.scratch.z <= 1;
    if (!inFront || width <= 0 || height <= 0) {
      mounted.root.hidden = true;
      return;
    }
    const x = (this.scratch.x * 0.5 + 0.5) * width;
    const y = (-this.scratch.y * 0.5 + 0.5) * height;
    mounted.root.hidden = false;
    mounted.root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    mounted.root.classList.toggle("rts-world-health", entry.variant === "health");
    mounted.label.textContent = entry.label;
    mounted.fill.style.width = `${(Math.max(0, Math.min(1, entry.progress)) * 100).toFixed(1)}%`;
  }
}
