/**
 * Behavior Tree editor (v1) — Forge's authoring shell for `*.behavior.json`
 * assets, opened from the Content Browser (double-click / "Open").
 *
 * This first version pairs a **structured outline** (left) with a **raw-JSON
 * authoring pane** (right):
 *   - The raw JSON is the edit surface. On every edit it is parsed and run
 *     through the engine normalizer (`normalizeAiBehaviorTreeAsset`) — the same
 *     validator the dev save endpoint uses — so the outline and validation panel
 *     always reflect what would be saved.
 *   - The outline renders the composite/task/wait/subtree tree plus each node's
 *     decorators and services, so the shape is legible without reading JSON.
 *   - Save posts the parsed object through `/__save-behavior`, which re-validates
 *     server-side; an invalid tree blocks the save with the normalizer error.
 *
 * Node-form CRUD (add/remove/reorder nodes, per-node property fields) is the
 * next slice; keeping v1 raw-JSON-driven reuses the tested normalizer and the
 * guarded endpoint with no new save surface.
 */

import type { AiBehaviorNode } from "@engine/ai/behaviorAsset";
import { normalizeAiBehaviorTreeAsset } from "@engine/ai/behaviorAsset";
import {
  defaultBehaviorTreeJson,
  loadBehaviorTreeText,
  saveBehaviorTreeAsset,
} from "@/editor/behaviorTreeStore";

type StatusTone = "info" | "success" | "warning" | "error";

export interface BehaviorTreeEditorOptions {
  path: string;
  label: string;
  onStatus?: (message: string, tone?: StatusTone) => void;
  onSaved?: () => void;
}

const NODE_COLORS: Record<string, string> = {
  selector: "#d4a45a",
  sequence: "#5a9fd4",
  task: "#6fd0a4",
  wait: "#8a9ad4",
  subtree: "#c47dd4",
};

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

/** Result of parsing + validating the raw JSON pane. */
interface ParseState {
  /** Parsed JSON (any shape) when the text is valid JSON, else null. */
  value: unknown;
  /** The parsed object cast for lenient outline walking, else null. */
  root: unknown;
  /** Normalizer error (parse or schema) shown in the validation panel, else "". */
  error: string;
  /** True when the parsed value passed the engine normalizer. */
  valid: boolean;
}

export class BehaviorTreeEditor {
  private static activeInstance: BehaviorTreeEditor | null = null;

  static async open(options: BehaviorTreeEditorOptions): Promise<BehaviorTreeEditor> {
    BehaviorTreeEditor.activeInstance?.close();
    const editor = new BehaviorTreeEditor(options);
    BehaviorTreeEditor.activeInstance = editor;
    await editor.load();
    return editor;
  }

  private readonly overlay: HTMLDivElement;
  private readonly titleEl: HTMLElement;
  private readonly outlineHost: HTMLElement;
  private readonly validationHost: HTMLElement;
  private readonly rawEl: HTMLTextAreaElement;
  private readonly statusEl: HTMLElement;
  private readonly saveBtn: HTMLButtonElement;

  private raw = defaultBehaviorTreeJson();
  private disposed = false;

  private constructor(private readonly options: BehaviorTreeEditorOptions) {
    this.overlay = document.createElement("div");
    this.overlay.className = "bte-overlay";
    this.overlay.innerHTML = `
<div class="bte-window">
  <header class="bte-header">
    <span class="bte-tab">
      <span class="bte-tab-icon">AI</span>
      <strong data-bte-title></strong>
      <span class="bte-badge">Behavior Tree</span>
    </span>
    <div class="bte-header-actions">
      <button type="button" class="bte-save" data-bte-save title="Save (Ctrl+S)">Save</button>
      <button type="button" class="bte-close" data-bte-close title="Close (Esc)">×</button>
    </div>
  </header>
  <div class="bte-body">
    <aside class="bte-left">
      <div class="bte-section-title">Tree Outline</div>
      <div class="bte-outline" data-bte-outline></div>
      <div class="bte-section-title">Validation</div>
      <div class="bte-validation" data-bte-validation></div>
    </aside>
    <div class="bte-raw-wrap">
      <div class="bte-section-title">Asset JSON</div>
      <textarea class="bte-raw" data-bte-raw spellcheck="false"></textarea>
    </div>
  </div>
  <footer class="bte-status" data-bte-status>Loading…</footer>
</div>`;
    document.body.append(this.overlay);

    this.titleEl = this.req("[data-bte-title]");
    this.outlineHost = this.req("[data-bte-outline]");
    this.validationHost = this.req("[data-bte-validation]");
    this.rawEl = this.req<HTMLTextAreaElement>("[data-bte-raw]");
    this.statusEl = this.req("[data-bte-status]");
    this.saveBtn = this.req<HTMLButtonElement>("[data-bte-save]");

    this.titleEl.textContent = options.label;
    this.req<HTMLButtonElement>("[data-bte-close]").addEventListener("click", () => this.close());
    this.saveBtn.addEventListener("click", () => void this.save());
    this.rawEl.addEventListener("input", () => {
      this.raw = this.rawEl.value;
      this.markDirty();
      this.renderDerived();
    });

    this.overlay.tabIndex = -1;
    this.overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void this.save();
      }
    });
    this.overlay.focus();
  }

  private req<T extends Element = HTMLElement>(selector: string): T {
    const el = this.overlay.querySelector<T>(selector);
    if (!el) throw new Error(`BehaviorTreeEditor: missing ${selector}`);
    return el;
  }

  private async load(): Promise<void> {
    try {
      this.raw = await loadBehaviorTreeText(this.options.path);
      this.rawEl.value = this.raw;
      this.saveBtn.classList.remove("is-dirty");
      this.renderDerived();
      this.setStatus("Ready.");
    } catch (error) {
      this.setStatus(`Failed to load: ${describeError(error)}`, "error");
    }
  }

  /** Parses the raw pane and returns its JSON + validation state. */
  private parse(): ParseState {
    let value: unknown;
    try {
      value = JSON.parse(this.raw);
    } catch (error) {
      return { value: null, root: null, error: `Invalid JSON: ${describeError(error)}`, valid: false };
    }
    const root = (value as { root?: unknown } | null)?.root ?? null;
    try {
      normalizeAiBehaviorTreeAsset(value);
      return { value, root, error: "", valid: true };
    } catch (error) {
      return { value, root, error: describeError(error), valid: false };
    }
  }

  private renderDerived(): void {
    if (this.disposed) return;
    const state = this.parse();
    this.renderOutline(state);
    this.renderValidation(state);
  }

  private renderOutline(state: ParseState): void {
    if (state.value === null) {
      this.outlineHost.innerHTML = `<div class="bte-outline-empty">Fix the JSON to see the tree.</div>`;
      return;
    }
    if (!state.root) {
      this.outlineHost.innerHTML = `<div class="bte-outline-empty">No <code>root</code> node.</div>`;
      return;
    }
    this.outlineHost.innerHTML = `<ul class="bte-tree">${this.nodeHtml(state.root)}</ul>`;
  }

  /** Lenient recursive outline: renders whatever node shape is present. */
  private nodeHtml(raw: unknown): string {
    if (!raw || typeof raw !== "object") {
      return `<li class="bte-node"><span class="bte-node-bad">malformed node</span></li>`;
    }
    const node = raw as Partial<AiBehaviorNode> & Record<string, unknown>;
    const kind = typeof node.kind === "string" ? node.kind : "?";
    const color = NODE_COLORS[kind] ?? "#8a929c";
    const summary = esc(this.nodeSummary(kind, node));
    const meta = this.nodeMeta(node);
    const childHtml =
      (kind === "selector" || kind === "sequence") && Array.isArray(node.children)
        ? `<ul class="bte-tree">${node.children.map((child) => this.nodeHtml(child)).join("")}</ul>`
        : "";
    return `
      <li class="bte-node">
        <div class="bte-node-row">
          <span class="bte-node-kind" style="--bte-color:${color}">${esc(kind)}</span>
          ${summary ? `<span class="bte-node-sub">${summary}</span>` : ""}
        </div>
        ${meta}
        ${childHtml}
      </li>`;
  }

  private nodeSummary(kind: string, node: Record<string, unknown>): string {
    switch (kind) {
      case "task":
        return typeof node.task === "string" ? node.task : "(no task)";
      case "wait":
        return typeof node.seconds === "number" ? `${node.seconds}s` : "";
      case "subtree":
        return typeof node.behavior === "string" ? `→ ${node.behavior}` : "(no behavior)";
      case "selector":
      case "sequence": {
        const count = Array.isArray(node.children) ? node.children.length : 0;
        return `${count} child${count === 1 ? "" : "ren"}`;
      }
      default:
        return "";
    }
  }

  /** Renders decorator + service chips under a node row (when present). */
  private nodeMeta(node: Record<string, unknown>): string {
    const rows: string[] = [];
    if (Array.isArray(node.decorators) && node.decorators.length > 0) {
      const chips = node.decorators
        .map((d) => `<span class="bte-chip bte-chip-dec">${esc(this.decoratorLabel(d))}</span>`)
        .join("");
      rows.push(`<div class="bte-node-meta">${chips}</div>`);
    }
    if (Array.isArray(node.services) && node.services.length > 0) {
      const chips = node.services
        .map((s) => `<span class="bte-chip bte-chip-svc">${esc(this.serviceLabel(s))}</span>`)
        .join("");
      rows.push(`<div class="bte-node-meta">${chips}</div>`);
    }
    return rows.join("");
  }

  private decoratorLabel(raw: unknown): string {
    if (!raw || typeof raw !== "object") return "decorator";
    const d = raw as Record<string, unknown>;
    const kind = typeof d.kind === "string" ? d.kind : "?";
    switch (kind) {
      case "blackboard":
        return `if ${String(d.key ?? "?")} ${String(d.op ?? "")} ${d.value === undefined ? "" : JSON.stringify(d.value)}`.trim();
      case "distance":
        return `dist ${String(d.key ?? "?")} ${String(d.op ?? "")} ${String(d.value ?? "?")}`;
      case "cooldown":
        return `cooldown ${String(d.seconds ?? "?")}s`;
      case "hasPerceptionStimulus":
        return `sense ${String(d.sense ?? "any")}`;
      default:
        return kind;
    }
  }

  private serviceLabel(raw: unknown): string {
    if (!raw || typeof raw !== "object") return "service";
    const s = raw as Record<string, unknown>;
    const name = typeof s.service === "string" ? s.service : "?";
    return typeof s.interval === "number" ? `${name} @${s.interval}s` : name;
  }

  private renderValidation(state: ParseState): void {
    if (state.valid) {
      this.validationHost.innerHTML = `<span class="bte-ok">✓ Valid behavior tree</span>`;
    } else {
      this.validationHost.innerHTML = `<div class="bte-issue">⚠ ${esc(state.error)}</div>`;
    }
  }

  private async save(): Promise<void> {
    const state = this.parse();
    if (!state.valid) {
      this.setStatus(`Cannot save: ${state.error}`, "error");
      return;
    }
    try {
      this.setStatus("Saving…");
      await saveBehaviorTreeAsset(this.options.path, state.value);
      this.saveBtn.classList.remove("is-dirty");
      this.setStatus("Saved.", "success");
      this.options.onSaved?.();
    } catch (error) {
      this.setStatus(`Save failed: ${describeError(error)}`, "error");
    }
  }

  private setStatus(message: string, tone?: StatusTone): void {
    this.statusEl.textContent = message;
    this.statusEl.dataset.tone = tone ?? "";
    this.options.onStatus?.(message, tone);
  }

  private markDirty(): void {
    this.saveBtn.classList.add("is-dirty");
  }

  close(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.overlay.remove();
    if (BehaviorTreeEditor.activeInstance === this) BehaviorTreeEditor.activeInstance = null;
  }
}
