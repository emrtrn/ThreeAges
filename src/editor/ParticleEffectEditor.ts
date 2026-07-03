/**
 * Particle Effect Editor Lite — Forge's form-based authoring shell for
 * `*.effect.json` assets, opened from the Content Browser (double-click) or
 * right after "New → Particle Effect". Kept behind the editor's dynamic import
 * like the other asset editors, so nothing here ships in the game bundle.
 *
 * Layout mirrors the plan's mockup (§5.2), Unreal-inspired but form-only:
 *   - **Effect Stack** (left) — the fixed pipeline stages (System, Spawn,
 *     Initialize, Update, Renderer, Bounds). Not a node graph; clicking a stage
 *     scrolls the matching Details group into view.
 *   - **Live Preview** (center) — {@link ParticleEffectPreviewViewport}, the same
 *     runtime particle simulation the game uses, driven live off the edited def.
 *   - **Details** (right) — the stages as grouped, editable property forms.
 *   - **Toolbar** — Play / Pause / Restart the preview; Save, Duplicate, Close.
 *   - **Status bar** — spawn/capacity/blend summary + save status.
 *
 * State separation (plan): the edited {@link ParticleEffectDefinition} is the
 * asset data (what Save writes); all preview state (elapsed time, buffers,
 * play/pause) lives in the preview viewport, never in the def. Undo/redo is a
 * snapshot history of the def — one entry per field-edit session.
 */

import type { ParticleEffectDefinition } from "@engine/vfx/particleEffectTypes";
import { loadEffectAsset, saveEffectAsset } from "@/editor/particleEffectStore";
import { ParticleEffectPreviewViewport } from "@/editor/ParticleEffectPreviewViewport";
import { particleEffectPresetDefinition } from "@engine/vfx/particleEffectPresets";

type StatusTone = "info" | "success" | "warning" | "error";

export interface ParticleEffectEditorOptions {
  path: string;
  label: string;
  onStatus?: (message: string, tone?: StatusTone) => void;
  onSaved?: () => void;
}

// ─── Pipeline stages (left stack ⇄ details groups) ───────────────────────────

interface StageMeta {
  id: string;
  label: string;
  icon: string;
  hint: string;
}

const STAGES: readonly StageMeta[] = [
  { id: "system", label: "System", icon: "SYS", hint: "Lifetime, loop, capacity" },
  { id: "spawn", label: "Spawn", icon: "SPN", hint: "Rate / burst, shape" },
  { id: "initialize", label: "Initialize", icon: "INI", hint: "Birth size, colour, velocity" },
  { id: "update", label: "Update", icon: "UPD", hint: "Gravity, drag, size/colour over life" },
  { id: "renderer", label: "Renderer", icon: "RND", hint: "Blend, softness" },
  { id: "bounds", label: "Bounds", icon: "BND", hint: "Fixed culling volume" },
];

const SPAWN_SHAPES = ["point", "sphere", "box", "circle"] as const;
const SPAWN_MODES = ["rate", "burst"] as const;
const BLEND_MODES = ["alpha", "additive"] as const;
const SORT_MODES = ["none", "distance"] as const;
const BOUNDS_MODES = ["fixed", "autoPreview"] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Perceived brightness of a `#rrggbb` colour in [0, 1] (1 for unparseable). */
function hexLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return 1;
  const n = parseInt(match[1]!, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function clone(def: ParticleEffectDefinition): ParticleEffectDefinition {
  return JSON.parse(JSON.stringify(def)) as ParticleEffectDefinition;
}

function equal(a: ParticleEffectDefinition, b: ParticleEffectDefinition): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Walks a dotted path (numeric segments = array indices) and sets the leaf. */
function setPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let node: Record<string, unknown> | unknown[] = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]!;
    node = (node as Record<string, unknown>)[key] as Record<string, unknown> | unknown[];
    if (node === null || typeof node !== "object") return;
  }
  const leaf = parts[parts.length - 1]!;
  (node as Record<string, unknown>)[leaf] = value;
}

// ─── Editor ──────────────────────────────────────────────────────────────────

export class ParticleEffectEditor {
  private static activeInstance: ParticleEffectEditor | null = null;

  static async open(options: ParticleEffectEditorOptions): Promise<ParticleEffectEditor> {
    ParticleEffectEditor.activeInstance?.close();
    const editor = new ParticleEffectEditor(options);
    ParticleEffectEditor.activeInstance = editor;
    await editor.load();
    return editor;
  }

  private readonly overlay: HTMLDivElement;
  private readonly titleEl: HTMLElement;
  private readonly stackHost: HTMLElement;
  private readonly detailsHost: HTMLElement;
  private readonly previewHost: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly saveBtn: HTMLButtonElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly hudEl: HTMLElement;
  private readonly warnBadge: HTMLElement;
  private readonly loopBtn: HTMLButtonElement;

  private preview: ParticleEffectPreviewViewport | null = null;
  private statsTimer = 0;
  private def: ParticleEffectDefinition = particleEffectPresetDefinition("blank");
  private path: string;
  private label: string;

  private readonly undoStack: ParticleEffectDefinition[] = [];
  private readonly redoStack: ParticleEffectDefinition[] = [];
  /** Snapshot captured at the start of the current field-edit session. */
  private commitBaseline: ParticleEffectDefinition | null = null;
  private dirty = false;
  private disposed = false;

  private constructor(private readonly options: ParticleEffectEditorOptions) {
    this.path = options.path;
    this.label = options.label;

    this.overlay = document.createElement("div");
    this.overlay.className = "pfx-overlay";
    this.overlay.innerHTML = `
<div class="pfx-window">
  <header class="pfx-header">
    <span class="pfx-tab">
      <span class="pfx-tab-icon">FX</span>
      <strong data-pfx-title></strong>
      <span class="pfx-badge">Particle Effect</span>
    </span>
    <div class="pfx-toolbar">
      <button type="button" class="pfx-tool-btn" data-pfx-play title="Play / Pause preview">❚❚ Pause</button>
      <button type="button" class="pfx-tool-btn" data-pfx-restart title="Restart preview">↻ Restart</button>
    </div>
    <div class="pfx-header-actions">
      <button type="button" class="pfx-tool-btn" data-pfx-duplicate title="Duplicate this effect">Duplicate</button>
      <button type="button" class="pfx-save" data-pfx-save title="Save (Ctrl+S)">Save</button>
      <button type="button" class="pfx-close" data-pfx-close title="Close (Esc)">×</button>
    </div>
  </header>
  <div class="pfx-body">
    <aside class="pfx-left">
      <div class="pfx-section-title">Effect Stack</div>
      <div class="pfx-stack" data-pfx-stack></div>
      <div class="pfx-section-title">Diagnostics</div>
      <div class="pfx-diag" data-pfx-diag></div>
    </aside>
    <div class="pfx-preview-wrap">
      <div class="pfx-preview-host" data-pfx-preview></div>
      <div class="pfx-hud" data-pfx-hud>Alive 0 / 0</div>
      <div class="pfx-warn-badge" data-pfx-warn hidden></div>
      <div class="pfx-preview-bar">
        <div class="pfx-speed" data-pfx-speed role="group" aria-label="Preview speed">
          <button type="button" data-speed="0.25">0.25×</button>
          <button type="button" data-speed="0.5">0.5×</button>
          <button type="button" data-speed="1" class="is-active">1×</button>
          <button type="button" data-speed="2">2×</button>
        </div>
        <button type="button" class="pfx-pv-btn is-active" data-pfx-loop title="Auto-replay one-shot effects">↻ Loop</button>
        <button type="button" class="pfx-pv-btn" data-pfx-burst title="Emit a single burst">✦ Burst</button>
      </div>
    </div>
    <aside class="pfx-details" data-pfx-details></aside>
  </div>
  <footer class="pfx-status" data-pfx-status>Loading…</footer>
</div>`;
    document.body.append(this.overlay);

    this.titleEl = this.req("[data-pfx-title]");
    this.stackHost = this.req("[data-pfx-stack]");
    this.detailsHost = this.req("[data-pfx-details]");
    this.previewHost = this.req("[data-pfx-preview]");
    this.statusEl = this.req("[data-pfx-status]");
    this.saveBtn = this.req<HTMLButtonElement>("[data-pfx-save]");
    this.playBtn = this.req<HTMLButtonElement>("[data-pfx-play]");
    this.hudEl = this.req("[data-pfx-hud]");
    this.warnBadge = this.req("[data-pfx-warn]");
    this.loopBtn = this.req<HTMLButtonElement>("[data-pfx-loop]");

    this.req<HTMLButtonElement>("[data-pfx-close]").addEventListener("click", () => this.close());
    this.saveBtn.addEventListener("click", () => void this.save());
    this.req<HTMLButtonElement>("[data-pfx-duplicate]").addEventListener("click", () => void this.duplicate());
    this.playBtn.addEventListener("click", () => this.togglePlay());
    this.req<HTMLButtonElement>("[data-pfx-restart]").addEventListener("click", () => this.preview?.restart());
    this.req<HTMLButtonElement>("[data-pfx-burst]").addEventListener("click", () => this.preview?.burst());
    this.loopBtn.addEventListener("click", () => this.toggleLoopPreview());
    for (const btn of this.overlay.querySelectorAll<HTMLButtonElement>("[data-pfx-speed] button")) {
      btn.addEventListener("click", () => this.setPreviewSpeed(parseFloat(btn.dataset.speed!), btn));
    }

    this.overlay.tabIndex = -1;
    this.overlay.addEventListener("keydown", (event) => this.onKeyDown(event));
    this.overlay.focus();
    this.renderStack();
  }

  private req<T extends Element = HTMLElement>(selector: string): T {
    const el = this.overlay.querySelector<T>(selector);
    if (!el) throw new Error(`ParticleEffectEditor: missing ${selector}`);
    return el;
  }

  // ─── Load / lifecycle ──────────────────────────────────────────────────────

  private async load(): Promise<void> {
    try {
      this.def = await loadEffectAsset(this.path, this.label);
      this.undoStack.length = 0;
      this.redoStack.length = 0;
      this.dirty = false;
      this.preview = new ParticleEffectPreviewViewport(this.previewHost);
      this.preview.setDefinition(this.def);
      this.statsTimer = window.setInterval(() => this.updateHud(), 150);
      this.renderAll();
      this.setStatus("Ready.");
    } catch (error) {
      this.setStatus(`Failed to load: ${describeError(error)}`, "error");
    }
  }

  private renderAll(): void {
    if (this.disposed) return;
    this.titleEl.textContent = this.def.name || this.label;
    this.saveBtn.classList.toggle("is-dirty", this.dirty);
    this.renderDetails();
    this.renderDiagnostics();
    this.updateFooter();
    this.updatePlayButton();
  }

  private onKeyDown(event: KeyboardEvent): void {
    const ctrl = event.ctrlKey || event.metaKey;
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
    } else if (ctrl && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void this.save();
    } else if (ctrl && event.key.toLowerCase() === "z" && !event.shiftKey) {
      event.preventDefault();
      this.undo();
    } else if (ctrl && (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey))) {
      event.preventDefault();
      this.redo();
    }
  }

  // ─── Left stack ────────────────────────────────────────────────────────────

  private renderStack(): void {
    this.stackHost.replaceChildren();
    for (const stage of STAGES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pfx-stage";
      btn.dataset.stage = stage.id;
      btn.innerHTML = `
        <span class="pfx-stage-icon">${esc(stage.icon)}</span>
        <span class="pfx-stage-text"><strong>${esc(stage.label)}</strong><em>${esc(stage.hint)}</em></span>`;
      btn.addEventListener("click", () => this.focusStage(stage.id));
      this.stackHost.append(btn);
    }
  }

  private focusStage(id: string): void {
    const group = this.detailsHost.querySelector<HTMLElement>(`[data-group="${id}"]`);
    group?.scrollIntoView({ behavior: "smooth", block: "start" });
    for (const btn of this.stackHost.querySelectorAll<HTMLElement>(".pfx-stage")) {
      btn.classList.toggle("is-active", btn.dataset.stage === id);
    }
    group?.classList.add("is-flash");
    window.setTimeout(() => group?.classList.remove("is-flash"), 600);
  }

  // ─── Details form ──────────────────────────────────────────────────────────

  private renderDetails(): void {
    const d = this.def;
    const html: string[] = [];

    html.push(this.groupOpen("system", "System"));
    html.push(this.textRow("Name", "name", d.name));
    html.push(this.textRow("Category", "category", d.category));
    html.push(this.boolRow("Enabled", "system.enabled", d.system.enabled));
    html.push(this.boolRow("Loop", "system.loop", d.system.loop));
    html.push(this.numRow("Duration (s)", "system.duration", d.system.duration, 0, 60, 0.05));
    html.push(this.numRow("Max Particles", "system.maxParticles", d.system.maxParticles, 1, 4096, 1));
    html.push(this.groupClose());

    html.push(this.groupOpen("spawn", "Spawn"));
    html.push(this.enumRow("Mode", "spawn.mode", d.spawn.mode, SPAWN_MODES));
    if (d.spawn.mode === "rate") {
      html.push(this.numRow("Rate (/s)", "spawn.rate", d.spawn.rate, 0, 10000, 1));
    } else {
      html.push(this.numRow("Count", "spawn.count", d.spawn.count, 0, 4096, 1));
      html.push(this.numRow("Interval (s)", "spawn.interval", d.spawn.interval, 0, 60, 0.05));
    }
    html.push(this.numRow("Delay (s)", "spawn.delay", d.spawn.delay, 0, 60, 0.05));
    html.push(this.enumRow("Shape", "spawn.shape", d.spawn.shape, SPAWN_SHAPES));
    if (d.spawn.shape === "sphere" || d.spawn.shape === "circle") {
      html.push(this.numRow("Radius", "spawn.radius", d.spawn.radius, 0, 100, 0.05));
    } else if (d.spawn.shape === "box") {
      html.push(this.vec3Row("Box Size", "spawn.boxSize", d.spawn.boxSize, 0.05));
    }
    html.push(this.groupClose());

    html.push(this.groupOpen("initialize", "Initialize"));
    html.push(this.rangeRow("Lifetime (s)", "initialize.lifetime", d.initialize.lifetime, 0, 60, 0.05));
    html.push(this.rangeRow("Start Size", "initialize.startSize", d.initialize.startSize, 0, 100, 0.01));
    html.push(this.colorRow("Start Colour", "initialize.startColor", d.initialize.startColor));
    html.push(this.numRow("Start Opacity", "initialize.startOpacity", d.initialize.startOpacity, 0, 1, 0.01));
    html.push(this.vec3Row("Direction", "initialize.direction", d.initialize.direction, 0.05));
    html.push(this.rangeRow("Speed", "initialize.speed", d.initialize.speed, 0, 1000, 0.05));
    html.push(this.numRow("Spread (°)", "initialize.spreadAngleDeg", d.initialize.spreadAngleDeg, 0, 180, 1));
    html.push(this.rangeRow("Rotation (°)", "initialize.rotation", d.initialize.rotation, -360, 360, 1));
    html.push(this.rangeRow("Angular Vel (°/s)", "initialize.angularVelocity", d.initialize.angularVelocity, -720, 720, 1));
    html.push(this.groupClose());

    html.push(this.groupOpen("update", "Update"));
    html.push(this.numRow("Gravity Scale", "update.gravityScale", d.update.gravityScale, -10, 10, 0.01));
    html.push(this.numRow("Drag", "update.drag", d.update.drag, 0, 10, 0.01));
    html.push(this.vec3Row("Acceleration", "update.acceleration", d.update.acceleration, 0.05));
    html.push(this.rangeRow("End Size", "update.endSize", d.update.endSize, 0, 100, 0.01));
    html.push(this.colorRow("End Colour", "update.endColor", d.update.endColor));
    html.push(this.numRow("End Opacity", "update.endOpacity", d.update.endOpacity, 0, 1, 0.01));
    html.push(this.numRow("Fade In (s)", "update.fadeInTime", d.update.fadeInTime, 0, 60, 0.01));
    html.push(this.numRow("Fade Out (s)", "update.fadeOutTime", d.update.fadeOutTime, 0, 60, 0.01));
    html.push(this.groupClose());

    html.push(this.groupOpen("renderer", "Renderer"));
    html.push(this.roRow("Type", "sprite"));
    html.push(this.enumRow("Blend Mode", "renderer.blendMode", d.renderer.blendMode, BLEND_MODES));
    html.push(this.numRow("Softness", "renderer.softness", d.renderer.softness, 0, 1, 0.05));
    html.push(this.enumRow("Sort Mode", "renderer.sortMode", d.renderer.sortMode, SORT_MODES));
    html.push(this.groupClose());

    html.push(this.groupOpen("bounds", "Bounds"));
    html.push(this.enumRow("Mode", "system.bounds.mode", d.system.bounds.mode, BOUNDS_MODES));
    html.push(this.vec3Row("Min", "system.bounds.min", d.system.bounds.min, 0.1));
    html.push(this.vec3Row("Max", "system.bounds.max", d.system.bounds.max, 0.1));
    html.push(this.boolRow("Show In Preview", "system.bounds.showInPreview", d.system.bounds.showInPreview));
    html.push(this.groupClose());

    this.detailsHost.innerHTML = html.join("");
    this.bindDetailInputs();
  }

  private groupOpen(id: string, label: string): string {
    return `<section class="pfx-group" data-group="${id}"><header class="pfx-group-head">${esc(label)}</header><div class="pfx-group-body">`;
  }

  private groupClose(): string {
    return `</div></section>`;
  }

  private row(label: string, inner: string): string {
    return `<label class="pfx-row"><span class="pfx-row-label">${esc(label)}</span>${inner}</label>`;
  }

  private textRow(label: string, path: string, value: string): string {
    return this.row(label, `<input type="text" class="pfx-input" data-path="${esc(path)}" data-kind="text" value="${esc(value)}">`);
  }

  private roRow(label: string, value: string): string {
    return this.row(label, `<input type="text" class="pfx-input" value="${esc(value)}" disabled>`);
  }

  private numRow(label: string, path: string, value: number, min: number, max: number, step: number): string {
    return this.row(
      label,
      `<input type="number" class="pfx-input" data-path="${esc(path)}" data-kind="num" min="${min}" max="${max}" step="${step}" value="${value}">`,
    );
  }

  private rangeRow(label: string, path: string, value: readonly [number, number], min: number, max: number, step: number): string {
    return this.row(
      label,
      `<span class="pfx-range">
        <input type="number" class="pfx-input" data-path="${esc(path)}.0" data-kind="num" min="${min}" max="${max}" step="${step}" value="${value[0]}">
        <span class="pfx-range-sep">–</span>
        <input type="number" class="pfx-input" data-path="${esc(path)}.1" data-kind="num" min="${min}" max="${max}" step="${step}" value="${value[1]}">
      </span>`,
    );
  }

  private vec3Row(label: string, path: string, value: readonly [number, number, number], step: number): string {
    const axis = (i: number): string =>
      `<input type="number" class="pfx-input" data-path="${esc(path)}.${i}" data-kind="num" step="${step}" value="${value[i]}">`;
    return this.row(label, `<span class="pfx-vec3">${axis(0)}${axis(1)}${axis(2)}</span>`);
  }

  private colorRow(label: string, path: string, value: string): string {
    return this.row(
      label,
      `<span class="pfx-color"><input type="color" class="pfx-color-swatch" data-path="${esc(path)}" data-kind="color" value="${esc(value)}"><span class="pfx-color-hex">${esc(value)}</span></span>`,
    );
  }

  private boolRow(label: string, path: string, value: boolean): string {
    return this.row(label, `<input type="checkbox" class="pfx-check" data-path="${esc(path)}" data-kind="bool"${value ? " checked" : ""}>`);
  }

  private enumRow(label: string, path: string, value: string, options: readonly string[]): string {
    const opts = options
      .map((o) => `<option value="${esc(o)}"${o === value ? " selected" : ""}>${esc(o)}</option>`)
      .join("");
    return this.row(label, `<select class="pfx-input" data-path="${esc(path)}" data-kind="enum">${opts}</select>`);
  }

  private bindDetailInputs(): void {
    for (const el of this.detailsHost.querySelectorAll<HTMLElement>("[data-path]")) {
      const path = el.dataset.path!;
      const kind = el.dataset.kind!;
      if (kind === "num" || kind === "text" || kind === "color") {
        // Live update on input (no re-render → caret preserved); commit on change.
        el.addEventListener("input", () => this.onFieldInput(path, kind, el));
        el.addEventListener("change", () => this.commit());
      } else {
        // Enum / bool commit immediately (may re-render gated fields).
        el.addEventListener("change", () => this.onFieldToggle(path, kind, el));
      }
    }
  }

  // ─── Edits + undo/redo ─────────────────────────────────────────────────────

  private beginEdit(): void {
    if (!this.commitBaseline) this.commitBaseline = clone(this.def);
  }

  private onFieldInput(path: string, kind: string, el: HTMLElement): void {
    this.beginEdit();
    if (kind === "num") {
      const v = parseFloat((el as HTMLInputElement).value);
      if (!Number.isFinite(v)) return;
      setPath(this.def as unknown as Record<string, unknown>, path, v);
    } else if (kind === "text") {
      setPath(this.def as unknown as Record<string, unknown>, path, (el as HTMLInputElement).value);
      if (path === "name") this.titleEl.textContent = this.def.name || this.label;
    } else if (kind === "color") {
      const v = (el as HTMLInputElement).value;
      setPath(this.def as unknown as Record<string, unknown>, path, v);
      const hex = el.parentElement?.querySelector(".pfx-color-hex");
      if (hex) hex.textContent = v;
    }
    this.refreshPreview();
    this.updateFooter();
    this.renderDiagnostics();
  }

  private onFieldToggle(path: string, kind: string, el: HTMLElement): void {
    this.beginEdit();
    if (kind === "bool") {
      setPath(this.def as unknown as Record<string, unknown>, path, (el as HTMLInputElement).checked);
    } else {
      setPath(this.def as unknown as Record<string, unknown>, path, (el as HTMLSelectElement).value);
    }
    this.commit();
    this.refreshPreview();
    // Gated fields (spawn mode/shape, bounds) may appear/disappear → re-render.
    this.renderDetails();
    this.renderDiagnostics();
    this.updateFooter();
  }

  private commit(): void {
    const baseline = this.commitBaseline;
    this.commitBaseline = null;
    if (!baseline || equal(baseline, this.def)) return;
    this.undoStack.push(baseline);
    this.redoStack.length = 0;
    this.markDirty();
  }

  private undo(): void {
    // Flush any in-progress field edit first.
    this.commit();
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(clone(this.def));
    this.def = prev;
    this.afterHistoryChange();
  }

  private redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(clone(this.def));
    this.def = next;
    this.afterHistoryChange();
  }

  private afterHistoryChange(): void {
    this.markDirty();
    this.refreshPreview();
    this.renderAll();
  }

  private refreshPreview(): void {
    this.preview?.setDefinition(this.def);
  }

  // ─── Diagnostics / footer ──────────────────────────────────────────────────

  private warnings(): string[] {
    const d = this.def;
    const out: string[] = [];
    const burst = d.spawn.mode === "burst";

    if (burst && d.spawn.count > d.system.maxParticles) {
      out.push("maxParticles is lower than burst count");
    }
    if (
      d.system.loop &&
      ((d.spawn.mode === "rate" && d.spawn.rate <= 0) || (burst && d.spawn.count <= 0))
    ) {
      out.push("looping effect has no visible spawn source");
    }
    if (d.spawn.mode === "rate" && !d.system.loop && d.system.duration <= 0) {
      out.push("duration is zero but rate mode is selected");
    }
    if (d.renderer.blendMode === "alpha" && d.update.fadeOutTime <= 0 && d.update.endOpacity > 0) {
      out.push("alpha blend with no fade-out may look harsh");
    }
    if (
      d.renderer.blendMode === "additive" &&
      hexLuminance(d.initialize.startColor) < 0.12 &&
      hexLuminance(d.update.endColor) < 0.12
    ) {
      out.push("additive blend with a near-black source is nearly invisible");
    }
    if (d.initialize.lifetime[1] <= 0) {
      out.push("lifetime is zero — particles die instantly");
    }
    if (this.boundsMayClip()) {
      out.push("fixed bounds may clip the effect");
    }
    return out;
  }

  /**
   * Heuristic: from the origin, would a particle travelling along `direction` for
   * `lifetime` (plus its spawn extent and end size) leave the fixed bounds box?
   * The preview spawns from origin `[0,0,0]`, so bounds are compared against that.
   */
  private boundsMayClip(): boolean {
    const d = this.def;
    if (d.system.bounds.mode !== "fixed") return false;
    const dir = d.initialize.direction;
    const mag = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const travel = d.initialize.speed[1] * d.initialize.lifetime[1];
    const spawnExtent =
      d.spawn.shape === "sphere" || d.spawn.shape === "circle"
        ? d.spawn.radius
        : d.spawn.shape === "box"
          ? Math.max(d.spawn.boxSize[0], d.spawn.boxSize[1], d.spawn.boxSize[2]) / 2
          : 0;
    const margin = spawnExtent + d.update.endSize[1];
    const { min, max } = d.system.bounds;
    for (let axis = 0; axis < 3; axis += 1) {
      const reach = (dir[axis]! / mag) * travel;
      if (reach + margin > max[axis]! + 1e-4 || reach - margin < min[axis]! - 1e-4) {
        return true;
      }
    }
    return false;
  }

  private renderDiagnostics(): void {
    const el = this.req("[data-pfx-diag]");
    const issues = this.warnings();
    if (issues.length === 0) {
      el.innerHTML = `<span class="pfx-ok">✓ No warnings</span>`;
    } else {
      el.innerHTML = issues.map((i) => `<div class="pfx-issue">⚠ ${esc(i)}</div>`).join("");
    }
    if (issues.length === 0) {
      this.warnBadge.hidden = true;
    } else {
      this.warnBadge.hidden = false;
      this.warnBadge.textContent = `⚠ ${issues.length} warning${issues.length > 1 ? "s" : ""}`;
      this.warnBadge.title = issues.join("\n");
    }
  }

  private updateFooter(): void {
    const d = this.def;
    const spawn = d.spawn.mode === "rate" ? `rate ${d.spawn.rate}/s` : `burst ${d.spawn.count}`;
    const loop = d.system.loop ? "loop" : "one-shot";
    this.setStatus(
      `Spawn: ${spawn} · Cap ${d.system.maxParticles} · ${d.renderer.blendMode} · ${loop}`,
      "info",
    );
  }

  // ─── Toolbar actions ───────────────────────────────────────────────────────

  private togglePlay(): void {
    if (!this.preview) return;
    this.preview.setPlaying(!this.preview.isPlaying());
    this.updatePlayButton();
  }

  private updatePlayButton(): void {
    const playing = this.preview?.isPlaying() ?? true;
    this.playBtn.textContent = playing ? "❚❚ Pause" : "▶ Play";
  }

  private setPreviewSpeed(speed: number, active: HTMLButtonElement): void {
    this.preview?.setSpeed(speed);
    for (const btn of this.overlay.querySelectorAll<HTMLElement>("[data-pfx-speed] button")) {
      btn.classList.toggle("is-active", btn === active);
    }
  }

  private toggleLoopPreview(): void {
    if (!this.preview) return;
    const next = !this.preview.isLoopPreview();
    this.preview.setLoopPreview(next);
    this.loopBtn.classList.toggle("is-active", next);
  }

  /** Live alive/capacity readout, polled while the editor is open. */
  private updateHud(): void {
    if (!this.preview) return;
    const { alive, capacity } = this.preview.getStats();
    this.hudEl.textContent = `Alive ${alive} / ${capacity}`;
  }

  private async save(): Promise<void> {
    try {
      this.commit();
      this.setStatus("Saving…");
      await saveEffectAsset(this.path, this.def);
      this.dirty = false;
      this.saveBtn.classList.remove("is-dirty");
      this.setStatus("Saved.", "success");
      this.options.onSaved?.();
    } catch (error) {
      this.setStatus(`Save failed: ${describeError(error)}`, "error");
    }
  }

  /** Saves a sibling copy and re-points the editor to it. */
  private async duplicate(): Promise<void> {
    const suggestion = `${this.label}_Copy`;
    const name = window.prompt("Duplicate effect as", suggestion);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed || /[\\/]/.test(trimmed) || trimmed.includes("..")) {
      this.setStatus("Invalid duplicate name.", "warning");
      return;
    }
    const slash = this.path.lastIndexOf("/");
    const dir = slash >= 0 ? this.path.slice(0, slash + 1) : "";
    const newPath = `${dir}${trimmed}.effect.json`;
    try {
      this.commit();
      const copy = clone(this.def);
      copy.name = trimmed;
      await saveEffectAsset(newPath, copy);
      this.path = newPath;
      this.label = trimmed;
      this.def = copy;
      this.dirty = false;
      this.renderAll();
      this.options.onSaved?.();
      this.setStatus(`Duplicated to ${newPath}.`, "success");
    } catch (error) {
      this.setStatus(`Duplicate failed: ${describeError(error)}`, "error");
    }
  }

  // ─── Status / dispose ──────────────────────────────────────────────────────

  private setStatus(message: string, tone?: StatusTone): void {
    this.statusEl.textContent = message;
    this.statusEl.dataset.tone = tone ?? "";
    this.options.onStatus?.(message, tone);
  }

  private markDirty(): void {
    this.dirty = true;
    this.saveBtn.classList.add("is-dirty");
  }

  close(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.statsTimer) window.clearInterval(this.statsTimer);
    this.statsTimer = 0;
    this.preview?.dispose();
    this.preview = null;
    this.overlay.remove();
    if (ParticleEffectEditor.activeInstance === this) ParticleEffectEditor.activeInstance = null;
  }
}
