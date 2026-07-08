/**
 * StateTree editor (v1) — Forge's authoring shell for `*.stateTree.json` assets,
 * opened from the Content Browser (double-click / "Open").
 *
 * Mirrors the first slice of the Behavior Tree editor: the raw JSON stays the
 * single source of truth (it is the save payload and what every view derives
 * from), and each edit is parsed + run through the engine normalizer
 * (`normalizeAiStateTreeAsset`) — the same validator the dev `/__save-state-tree`
 * endpoint uses — so the outline, transition table and validation panel always
 * reflect what would be saved.
 *
 * The read-only structural views are:
 *   - a **nested state outline** (hierarchical states, with each state's enter
 *     conditions, task count, transition count and child count), and
 *   - a **transition table** flattening every state's outgoing transitions into
 *     `from → to` rows tagged with their event / guard-condition summary.
 *
 * State/transition form CRUD is a deliberate later slice; v1 authors through the
 * raw-JSON pane and reuses the tested normalizer + guarded save endpoint verbatim.
 */

import type {
  AiStateDef,
  AiStateTransitionDef,
} from "@engine/ai/stateTreeAsset";
import { normalizeAiStateTreeAsset } from "@engine/ai/stateTreeAsset";
import {
  defaultStateTreeJson,
  loadStateTreeText,
  saveStateTreeAsset,
} from "@/editor/stateTreeStore";

type StatusTone = "info" | "success" | "warning" | "error";

export interface StateTreeEditorOptions {
  path: string;
  label: string;
  onStatus?: (message: string, tone?: StatusTone) => void;
  onSaved?: () => void;
}

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

/** Compact one-line summary of a decorator/guard condition for chips + the table. */
function conditionLabel(raw: unknown): string {
  if (!isObj(raw)) return "condition";
  const kind = typeof raw.kind === "string" ? raw.kind : "?";
  switch (kind) {
    case "blackboard":
      return `${String(raw.key ?? "?")} ${String(raw.op ?? "")} ${
        raw.value === undefined ? "" : JSON.stringify(raw.value)
      }`.trim();
    case "distance":
      return `dist ${String(raw.key ?? "?")} ${String(raw.op ?? "")} ${String(raw.value ?? "?")}`;
    case "cooldown":
      return `cooldown ${String(raw.seconds ?? "?")}s`;
    case "hasPerceptionStimulus":
      return `sense ${String(raw.sense ?? "any")}`;
    default:
      return kind;
  }
}

function conditionsSummary(conditions: unknown): string {
  if (!Array.isArray(conditions) || conditions.length === 0) return "";
  return conditions.map(conditionLabel).join(" & ");
}

/** Result of parsing + validating the raw JSON pane. */
interface ParseState {
  /** Parsed JSON (any shape) when the text is valid JSON, else null. */
  value: unknown;
  /** The parsed `states` array cast for lenient outline walking, else null. */
  states: unknown[] | null;
  /** Normalizer error (parse or schema) shown in the validation panel, else "". */
  error: string;
  /** True when the parsed value passed the engine normalizer. */
  valid: boolean;
}

interface FlatTransition {
  readonly from: string;
  readonly transition: AiStateTransitionDef & Record<string, unknown>;
}

export class StateTreeEditor {
  private static activeInstance: StateTreeEditor | null = null;

  static async open(options: StateTreeEditorOptions): Promise<StateTreeEditor> {
    StateTreeEditor.activeInstance?.close();
    const editor = new StateTreeEditor(options);
    StateTreeEditor.activeInstance = editor;
    await editor.load();
    return editor;
  }

  private readonly overlay: HTMLDivElement;
  private readonly titleEl: HTMLElement;
  private readonly outlineHost: HTMLElement;
  private readonly tableHost: HTMLElement;
  private readonly validationHost: HTMLElement;
  private readonly rawEl: HTMLTextAreaElement;
  private readonly statusEl: HTMLElement;
  private readonly saveBtn: HTMLButtonElement;

  private raw = defaultStateTreeJson();
  private disposed = false;

  private constructor(private readonly options: StateTreeEditorOptions) {
    this.overlay = document.createElement("div");
    this.overlay.className = "ste-overlay";
    this.overlay.innerHTML = `
<div class="ste-window">
  <header class="ste-header">
    <span class="ste-tab">
      <span class="ste-tab-icon">AI</span>
      <strong data-ste-title></strong>
      <span class="ste-badge">State Tree</span>
    </span>
    <div class="ste-header-actions">
      <button type="button" class="ste-save" data-ste-save title="Save (Ctrl+S)">Save</button>
      <button type="button" class="ste-close" data-ste-close title="Close (Esc)">×</button>
    </div>
  </header>
  <div class="ste-body">
    <aside class="ste-left">
      <div class="ste-section-title">State Outline</div>
      <div class="ste-outline" data-ste-outline></div>
      <div class="ste-section-title">Transitions</div>
      <div class="ste-table" data-ste-table></div>
      <div class="ste-section-title">Validation</div>
      <div class="ste-validation" data-ste-validation></div>
    </aside>
    <div class="ste-right">
      <div class="ste-section-title">Asset JSON</div>
      <textarea class="ste-raw" data-ste-raw spellcheck="false"></textarea>
    </div>
  </div>
  <footer class="ste-status" data-ste-status>Loading…</footer>
</div>`;
    document.body.append(this.overlay);

    this.titleEl = this.req("[data-ste-title]");
    this.outlineHost = this.req("[data-ste-outline]");
    this.tableHost = this.req("[data-ste-table]");
    this.validationHost = this.req("[data-ste-validation]");
    this.rawEl = this.req<HTMLTextAreaElement>("[data-ste-raw]");
    this.statusEl = this.req("[data-ste-status]");
    this.saveBtn = this.req<HTMLButtonElement>("[data-ste-save]");

    this.titleEl.textContent = options.label;
    this.req<HTMLButtonElement>("[data-ste-close]").addEventListener("click", () => this.close());
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
    if (!el) throw new Error(`StateTreeEditor: missing ${selector}`);
    return el;
  }

  private async load(): Promise<void> {
    try {
      this.raw = await loadStateTreeText(this.options.path);
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
      return { value: null, states: null, error: `Invalid JSON: ${describeError(error)}`, valid: false };
    }
    const rawStates = (value as { states?: unknown } | null)?.states;
    const states = Array.isArray(rawStates) ? rawStates : null;
    try {
      normalizeAiStateTreeAsset(value);
      return { value, states, error: "", valid: true };
    } catch (error) {
      return { value, states, error: describeError(error), valid: false };
    }
  }

  private renderDerived(): void {
    if (this.disposed) return;
    const state = this.parse();
    this.renderOutline(state);
    this.renderTable(state);
    this.renderValidation(state);
  }

  // --- State outline -------------------------------------------------------

  private renderOutline(state: ParseState): void {
    if (state.value === null) {
      this.outlineHost.innerHTML = `<div class="ste-empty">Fix the JSON to see the states.</div>`;
      return;
    }
    if (!state.states || state.states.length === 0) {
      this.outlineHost.innerHTML = `<div class="ste-empty">No <code>states</code> declared.</div>`;
      return;
    }
    this.outlineHost.innerHTML = `<ul class="ste-tree">${state.states
      .map((s) => this.stateHtml(s))
      .join("")}</ul>`;
  }

  /** Lenient recursive outline: renders whatever state shape is present. */
  private stateHtml(raw: unknown): string {
    if (!isObj(raw)) {
      return `<li class="ste-node"><div class="ste-node-row"><span class="ste-node-bad">malformed state</span></div></li>`;
    }
    const state = raw as Partial<AiStateDef> & Record<string, unknown>;
    const id = typeof state.id === "string" ? state.id : "?";
    const meta = this.stateMeta(state);
    const children = Array.isArray(state.states) ? state.states : [];
    const childHtml = children.length
      ? `<ul class="ste-tree">${children.map((child) => this.stateHtml(child)).join("")}</ul>`
      : "";
    return `
      <li class="ste-node">
        <div class="ste-node-row">
          <span class="ste-node-id">${esc(id)}</span>
          ${meta}
        </div>
        ${this.enterChips(state.enter)}
        ${childHtml}
      </li>`;
  }

  /** Count badges (tasks / transitions / children) shown next to a state id. */
  private stateMeta(state: Record<string, unknown>): string {
    const badges: string[] = [];
    const tasks = Array.isArray(state.tasks) ? state.tasks.length : 0;
    const transitions = Array.isArray(state.transitions) ? state.transitions.length : 0;
    const children = Array.isArray(state.states) ? state.states.length : 0;
    if (tasks > 0) badges.push(`<span class="ste-badge-sm ste-badge-task">${tasks} task${tasks === 1 ? "" : "s"}</span>`);
    if (transitions > 0) {
      badges.push(`<span class="ste-badge-sm ste-badge-trans">${transitions} →</span>`);
    }
    if (children > 0) badges.push(`<span class="ste-badge-sm ste-badge-child">${children} child</span>`);
    return badges.join("");
  }

  /** Enter-condition chips under a state row (when present). */
  private enterChips(enter: unknown): string {
    if (!Array.isArray(enter) || enter.length === 0) return "";
    const chips = enter
      .map((c) => `<span class="ste-chip ste-chip-enter">if ${esc(conditionLabel(c))}</span>`)
      .join("");
    return `<div class="ste-node-meta">${chips}</div>`;
  }

  // --- Transition table ----------------------------------------------------

  private renderTable(state: ParseState): void {
    if (state.value === null) {
      this.tableHost.innerHTML = "";
      return;
    }
    const rows = this.flattenTransitions(state.states);
    if (rows.length === 0) {
      this.tableHost.innerHTML = `<div class="ste-empty">No transitions.</div>`;
      return;
    }
    const body = rows
      .map((row) => {
        const t = row.transition;
        const to = typeof t.to === "string" ? t.to : "?";
        const event = typeof t.event === "string" ? t.event : "";
        const cond = conditionsSummary(t.conditions);
        const trigger = event
          ? `<span class="ste-chip ste-chip-event">event ${esc(event)}</span>`
          : cond
            ? `<span class="ste-cond">${esc(cond)}</span>`
            : `<span class="ste-cond ste-cond-always">always</span>`;
        return `<tr>
          <td class="ste-td-from">${esc(row.from)}</td>
          <td class="ste-td-arrow">→</td>
          <td class="ste-td-to">${esc(to)}</td>
          <td class="ste-td-trigger">${trigger}</td>
        </tr>`;
      })
      .join("");
    this.tableHost.innerHTML = `<table class="ste-trans-table"><tbody>${body}</tbody></table>`;
  }

  /** Depth-first walk collecting every state's outgoing transitions. */
  private flattenTransitions(states: unknown[] | null): FlatTransition[] {
    const out: FlatTransition[] = [];
    const walk = (list: unknown[]): void => {
      for (const raw of list) {
        if (!isObj(raw)) continue;
        const from = typeof raw.id === "string" ? raw.id : "?";
        if (Array.isArray(raw.transitions)) {
          for (const t of raw.transitions) {
            if (isObj(t)) out.push({ from, transition: t as FlatTransition["transition"] });
          }
        }
        if (Array.isArray(raw.states)) walk(raw.states);
      }
    };
    if (states) walk(states);
    return out;
  }

  // --- Validation + save ---------------------------------------------------

  private renderValidation(state: ParseState): void {
    if (state.valid) {
      this.validationHost.innerHTML = `<span class="ste-ok">✓ Valid state tree</span>`;
    } else {
      this.validationHost.innerHTML = `<div class="ste-issue">⚠ ${esc(state.error)}</div>`;
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
      await saveStateTreeAsset(this.options.path, state.value);
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
    if (StateTreeEditor.activeInstance === this) StateTreeEditor.activeInstance = null;
  }
}
