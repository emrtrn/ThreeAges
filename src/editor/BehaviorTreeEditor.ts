/**
 * Behavior Tree editor (v1) — Forge's authoring shell for `*.behavior.json`
 * assets, opened from the Content Browser (double-click / "Open").
 *
 * The editor pairs a **selectable structured outline** (left) with a **node
 * details form + raw-JSON authoring pane** (right):
 *   - The raw JSON stays the single source of truth: it is the save payload and
 *     the thing every view derives from. On every edit (typed JSON *or* a
 *     structured node-form action) it is parsed and run through the engine
 *     normalizer (`normalizeAiBehaviorTreeAsset`) — the same validator the dev
 *     save endpoint uses — so the outline, node form and validation panel always
 *     reflect what would be saved.
 *   - The outline renders the composite/task/wait/subtree tree plus each node's
 *     decorators and services, and each node is selectable.
 *   - The node form edits the selected node's primary fields (kind / id /
 *     task / seconds / behavior) and offers add-child / remove / reorder. Each
 *     action mutates a clone of the parsed tree and re-serializes it back into
 *     the raw pane, so there is no second save surface — the tested normalizer
 *     and the guarded `/__save-behavior` endpoint are reused verbatim.
 *   - Save posts the parsed object through `/__save-behavior`, which re-validates
 *     server-side; an invalid tree blocks the save with the normalizer error.
 *
 * Decorator/service authoring and task/service `params` remain raw-JSON edits
 * (surfaced as read-only chips + a count hint); a dedicated form is a later
 * slice.
 */

import type { AiBehaviorNode, AiBehaviorNodeKind } from "@engine/ai/behaviorAsset";
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

const NODE_KINDS: readonly AiBehaviorNodeKind[] = [
  "selector",
  "sequence",
  "task",
  "wait",
  "subtree",
];

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

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isComposite(node: Record<string, unknown> | null): boolean {
  return !!node && (node.kind === "selector" || node.kind === "sequence");
}

/** Serializes a node path (child indices from root) for a `data-bte-path` attr. */
function pathParam(path: readonly number[]): string {
  return path.join(".");
}

/** Parses a `data-bte-path` attribute back into a node path ("" → root []). */
function parsePathParam(value: string | null | undefined): number[] {
  if (!value) return [];
  return value.split(".").map((entry) => Number(entry));
}

function pathEq(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}

/** Walks the tree to the node at `path`, or null when the path is stale. */
function resolveNode(root: unknown, path: readonly number[]): Record<string, unknown> | null {
  let node: unknown = root;
  for (const index of path) {
    if (!isObj(node)) return null;
    const children = node.children;
    if (!Array.isArray(children) || index < 0 || index >= children.length) return null;
    node = children[index];
  }
  return isObj(node) ? node : null;
}

interface NodeParent {
  readonly parent: Record<string, unknown>;
  readonly children: unknown[];
  readonly index: number;
}

/** Resolves the parent + sibling index of `path`, or null for the root/stale. */
function resolveParent(root: unknown, path: readonly number[]): NodeParent | null {
  if (path.length === 0) return null;
  const parent = resolveNode(root, path.slice(0, -1));
  if (!parent || !Array.isArray(parent.children)) return null;
  const index = path[path.length - 1] ?? -1;
  if (index < 0 || index >= parent.children.length) return null;
  return { parent, children: parent.children, index };
}

/** A fresh node of `kind`, seeded with defaults that keep the tree valid where possible. */
function defaultNode(kind: AiBehaviorNodeKind): Record<string, unknown> {
  switch (kind) {
    case "selector":
    case "sequence":
      return { kind, children: [] };
    case "task":
      return { kind, task: "forge.setBlackboard" };
    case "wait":
      return { kind, seconds: 1 };
    case "subtree":
      return { kind, behavior: "" };
  }
}

/**
 * Converts a node to `kind` in place-ish (returns a new object), preserving the
 * shared base fields (id / decorators / services) and, for composite→composite,
 * the children. Kind-specific fields fall back to their defaults.
 */
function convertNode(node: Record<string, unknown>, kind: AiBehaviorNodeKind): Record<string, unknown> {
  const out: Record<string, unknown> = { kind };
  if (typeof node.id === "string" && node.id.length > 0) out.id = node.id;
  if (Array.isArray(node.decorators) && node.decorators.length > 0) out.decorators = node.decorators;
  if (Array.isArray(node.services) && node.services.length > 0) out.services = node.services;
  switch (kind) {
    case "selector":
    case "sequence":
      out.children = Array.isArray(node.children) ? node.children : [];
      break;
    case "task":
      out.task = typeof node.task === "string" && node.task.length > 0 ? node.task : "forge.setBlackboard";
      break;
    case "wait":
      out.seconds = typeof node.seconds === "number" ? node.seconds : 1;
      break;
    case "subtree":
      out.behavior = typeof node.behavior === "string" ? node.behavior : "";
      break;
  }
  return out;
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
  private readonly formHost: HTMLElement;
  private readonly validationHost: HTMLElement;
  private readonly rawEl: HTMLTextAreaElement;
  private readonly statusEl: HTMLElement;
  private readonly saveBtn: HTMLButtonElement;

  private raw = defaultBehaviorTreeJson();
  /** Selected node path (child indices from root); null = nothing selected. */
  private selectedPath: number[] | null = null;
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
    <div class="bte-right">
      <div class="bte-section-title">Node Details</div>
      <div class="bte-form" data-bte-form></div>
      <div class="bte-section-title">Asset JSON</div>
      <textarea class="bte-raw" data-bte-raw spellcheck="false"></textarea>
    </div>
  </div>
  <footer class="bte-status" data-bte-status>Loading…</footer>
</div>`;
    document.body.append(this.overlay);

    this.titleEl = this.req("[data-bte-title]");
    this.outlineHost = this.req("[data-bte-outline]");
    this.formHost = this.req("[data-bte-form]");
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

    // Delegated outline selection: clicking anywhere inside a node's row (or its
    // decorator/service chips) selects that node. `closest` resolves the
    // innermost `.bte-node` so nested children win over their ancestors.
    this.outlineHost.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      const li = target?.closest<HTMLElement>(".bte-node[data-bte-path]");
      if (!li) return;
      this.selectedPath = parsePathParam(li.dataset.btePath);
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
      // Select the root by default so the node form is populated on open.
      this.selectedPath = [];
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
    // Drop a stale selection (e.g. the raw JSON was edited to a smaller tree).
    if (this.selectedPath && !resolveNode(state.root, this.selectedPath)) {
      this.selectedPath = null;
    }
    this.renderOutline(state);
    this.renderNodeForm(state);
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
    this.outlineHost.innerHTML = `<ul class="bte-tree">${this.nodeHtml(state.root, [])}</ul>`;
  }

  /** Lenient recursive outline: renders whatever node shape is present. */
  private nodeHtml(raw: unknown, path: number[]): string {
    const selected = this.selectedPath !== null && pathEq(path, this.selectedPath);
    if (!raw || typeof raw !== "object") {
      return `<li class="bte-node" data-bte-path="${pathParam(path)}"><div class="bte-node-row${
        selected ? " is-selected" : ""
      }"><span class="bte-node-bad">malformed node</span></div></li>`;
    }
    const node = raw as Partial<AiBehaviorNode> & Record<string, unknown>;
    const kind = typeof node.kind === "string" ? node.kind : "?";
    const color = NODE_COLORS[kind] ?? "#8a929c";
    const summary = esc(this.nodeSummary(kind, node));
    const meta = this.nodeMeta(node);
    const childHtml =
      (kind === "selector" || kind === "sequence") && Array.isArray(node.children)
        ? `<ul class="bte-tree">${node.children
            .map((child, index) => this.nodeHtml(child, [...path, index]))
            .join("")}</ul>`
        : "";
    return `
      <li class="bte-node" data-bte-path="${pathParam(path)}">
        <div class="bte-node-row${selected ? " is-selected" : ""}">
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

  // --- Node details form ---------------------------------------------------

  private renderNodeForm(state: ParseState): void {
    if (!isObj(state.value) || !isObj(state.root)) {
      this.formHost.innerHTML = `<div class="bte-form-empty">Add a valid <code>root</code> node to edit nodes.</div>`;
      return;
    }
    if (this.selectedPath === null) {
      this.formHost.innerHTML = `<div class="bte-form-empty">Select a node in the outline to edit it.</div>`;
      return;
    }
    const node = resolveNode(state.root, this.selectedPath);
    if (!node) {
      this.formHost.innerHTML = `<div class="bte-form-empty">Select a node in the outline to edit it.</div>`;
      return;
    }

    const kind = typeof node.kind === "string" ? node.kind : "?";
    const parent = resolveParent(state.root, this.selectedPath);
    const canRemove = this.selectedPath.length > 0;
    const canUp = !!parent && parent.index > 0;
    const canDown = !!parent && parent.index < parent.children.length - 1;

    const kindOptions = NODE_KINDS.map(
      (k) => `<option value="${k}"${k === kind ? " selected" : ""}>${k}</option>`,
    ).join("");

    const rows: string[] = [];
    rows.push(this.fieldRow("Kind", `<select data-bte-field="kind" class="bte-input">${kindOptions}</select>`));
    rows.push(
      this.fieldRow(
        "Id",
        `<input type="text" data-bte-field="id" class="bte-input" placeholder="(optional)" value="${esc(
          typeof node.id === "string" ? node.id : "",
        )}">`,
      ),
    );
    if (kind === "task") {
      rows.push(
        this.fieldRow(
          "Task",
          `<input type="text" data-bte-field="task" class="bte-input" value="${esc(
            typeof node.task === "string" ? node.task : "",
          )}">`,
        ),
      );
    } else if (kind === "wait") {
      rows.push(
        this.fieldRow(
          "Seconds",
          `<input type="number" step="0.1" min="0" data-bte-field="seconds" class="bte-input" value="${esc(
            typeof node.seconds === "number" ? String(node.seconds) : "1",
          )}">`,
        ),
      );
    } else if (kind === "subtree") {
      rows.push(
        this.fieldRow(
          "Behavior",
          `<input type="text" data-bte-field="behavior" class="bte-input" placeholder="assets/…/x.behavior.json" value="${esc(
            typeof node.behavior === "string" ? node.behavior : "",
          )}">`,
        ),
      );
    } else if (isComposite(node)) {
      const count = Array.isArray(node.children) ? node.children.length : 0;
      rows.push(
        `<div class="bte-form-hint">${count} child${count === 1 ? "" : "ren"} — use <strong>Add Child</strong> and the outline to arrange them.</div>`,
      );
    }

    const decCount = Array.isArray(node.decorators) ? node.decorators.length : 0;
    const svcCount = Array.isArray(node.services) ? node.services.length : 0;
    if (decCount > 0 || svcCount > 0) {
      rows.push(
        `<div class="bte-form-hint">${decCount} decorator${decCount === 1 ? "" : "s"}, ${svcCount} service${
          svcCount === 1 ? "" : "s"
        } — edit these in the Asset JSON pane.</div>`,
      );
    }

    const addKindOptions = NODE_KINDS.map((k) => `<option value="${k}">${k}</option>`).join("");
    this.formHost.innerHTML = `
      <div class="bte-form-toolbar">
        <span class="bte-form-add">
          <select data-bte-add-kind class="bte-input bte-input-sm"${isComposite(node) ? "" : " disabled"}>${addKindOptions}</select>
          <button type="button" data-bte-add class="bte-btn"${isComposite(node) ? "" : " disabled"} title="Add a child node">+ Add Child</button>
        </span>
        <button type="button" data-bte-remove class="bte-btn"${canRemove ? "" : " disabled"} title="Remove this node">Remove</button>
        <button type="button" data-bte-up class="bte-btn"${canUp ? "" : " disabled"} title="Move up among siblings">↑</button>
        <button type="button" data-bte-down class="bte-btn"${canDown ? "" : " disabled"} title="Move down among siblings">↓</button>
      </div>
      <div class="bte-form-fields">${rows.join("")}</div>`;

    this.bindNodeForm();
  }

  private fieldRow(label: string, control: string): string {
    return `<label class="bte-form-row"><span class="bte-form-label">${esc(label)}</span>${control}</label>`;
  }

  private bindNodeForm(): void {
    const kindSel = this.formHost.querySelector<HTMLSelectElement>('[data-bte-field="kind"]');
    kindSel?.addEventListener("change", () => this.applyKind(kindSel.value as AiBehaviorNodeKind));

    const idInput = this.formHost.querySelector<HTMLInputElement>('[data-bte-field="id"]');
    idInput?.addEventListener("change", () => this.applyStringField("id", idInput.value.trim(), true));

    const taskInput = this.formHost.querySelector<HTMLInputElement>('[data-bte-field="task"]');
    taskInput?.addEventListener("change", () => this.applyStringField("task", taskInput.value.trim(), false));

    const behaviorInput = this.formHost.querySelector<HTMLInputElement>('[data-bte-field="behavior"]');
    behaviorInput?.addEventListener("change", () =>
      this.applyStringField("behavior", behaviorInput.value.trim(), false),
    );

    const secondsInput = this.formHost.querySelector<HTMLInputElement>('[data-bte-field="seconds"]');
    secondsInput?.addEventListener("change", () => this.applySecondsField(secondsInput.value));

    const addKind = this.formHost.querySelector<HTMLSelectElement>("[data-bte-add-kind]");
    this.formHost
      .querySelector<HTMLButtonElement>("[data-bte-add]")
      ?.addEventListener("click", () => this.addChild((addKind?.value as AiBehaviorNodeKind) ?? "task"));
    this.formHost
      .querySelector<HTMLButtonElement>("[data-bte-remove]")
      ?.addEventListener("click", () => this.removeSelected());
    this.formHost
      .querySelector<HTMLButtonElement>("[data-bte-up]")
      ?.addEventListener("click", () => this.moveSelected(-1));
    this.formHost
      .querySelector<HTMLButtonElement>("[data-bte-down]")
      ?.addEventListener("click", () => this.moveSelected(1));
  }

  /**
   * Parses the raw pane, deep-clones it, hands the selected node (and the whole
   * asset) to `fn`, then re-serializes the clone back into the raw pane. `fn`
   * returns the new selection path (or null). Returning `undefined` aborts with
   * no change. Structured edits reuse the raw JSON as the single source of truth.
   */
  private mutateTree(
    fn: (asset: Record<string, unknown>) => number[] | null | undefined,
  ): void {
    let value: unknown;
    try {
      value = JSON.parse(this.raw);
    } catch {
      this.setStatus("Fix the JSON before editing nodes.", "error");
      return;
    }
    if (!isObj(value) || !isObj(value.root)) {
      this.setStatus("Add a valid root node first.", "warning");
      return;
    }
    const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    const nextSelection = fn(clone);
    if (nextSelection === undefined) return;
    this.selectedPath = nextSelection;
    this.raw = `${JSON.stringify(clone, null, 2)}\n`;
    this.rawEl.value = this.raw;
    this.markDirty();
    this.renderDerived();
  }

  private applyStringField(key: "id" | "task" | "behavior", value: string, removeWhenEmpty: boolean): void {
    if (this.selectedPath === null) return;
    const path = this.selectedPath;
    this.mutateTree((asset) => {
      const node = resolveNode(asset.root, path);
      if (!node) return undefined;
      if (removeWhenEmpty && value.length === 0) {
        delete node[key];
      } else {
        node[key] = value;
      }
      return path;
    });
  }

  private applySecondsField(rawValue: string): void {
    if (this.selectedPath === null) return;
    const path = this.selectedPath;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      this.setStatus("Seconds must be a number.", "warning");
      return;
    }
    this.mutateTree((asset) => {
      const node = resolveNode(asset.root, path);
      if (!node) return undefined;
      node.seconds = parsed;
      return path;
    });
  }

  private applyKind(kind: AiBehaviorNodeKind): void {
    if (this.selectedPath === null || !NODE_KINDS.includes(kind)) return;
    const path = this.selectedPath;
    this.mutateTree((asset) => {
      const node = resolveNode(asset.root, path);
      if (!node) return undefined;
      const converted = convertNode(node, kind);
      if (path.length === 0) {
        asset.root = converted;
      } else {
        const parent = resolveParent(asset.root, path);
        if (!parent) return undefined;
        parent.children[parent.index] = converted;
      }
      return path;
    });
  }

  private addChild(kind: AiBehaviorNodeKind): void {
    if (this.selectedPath === null) return;
    const path = this.selectedPath;
    this.mutateTree((asset) => {
      const node = resolveNode(asset.root, path);
      if (!isComposite(node)) {
        this.setStatus("Only selector/sequence nodes take children.", "warning");
        return undefined;
      }
      if (!Array.isArray(node!.children)) node!.children = [];
      const children = node!.children as unknown[];
      children.push(defaultNode(NODE_KINDS.includes(kind) ? kind : "task"));
      return [...path, children.length - 1];
    });
  }

  private removeSelected(): void {
    if (this.selectedPath === null) return;
    const path = this.selectedPath;
    if (path.length === 0) {
      this.setStatus("Cannot remove the root node.", "warning");
      return;
    }
    this.mutateTree((asset) => {
      const parent = resolveParent(asset.root, path);
      if (!parent) return undefined;
      parent.children.splice(parent.index, 1);
      // Select the parent so focus stays near the removed node.
      return path.slice(0, -1);
    });
  }

  private moveSelected(direction: -1 | 1): void {
    if (this.selectedPath === null || this.selectedPath.length === 0) return;
    const path = this.selectedPath;
    this.mutateTree((asset) => {
      const parent = resolveParent(asset.root, path);
      if (!parent) return undefined;
      const target = parent.index + direction;
      if (target < 0 || target >= parent.children.length) return undefined;
      const [moved] = parent.children.splice(parent.index, 1);
      parent.children.splice(target, 0, moved);
      return [...path.slice(0, -1), target];
    });
  }

  // --- Validation + save ---------------------------------------------------

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
