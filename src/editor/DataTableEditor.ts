/**
 * Data Table editor — Forge's form-based authoring shell for game-data balance
 * files (`public/game-data/balance/*.json`), opened from the Content Browser.
 *
 * Generic by construction: it knows nothing about "units" or "maxHealth". Given
 * an {@link EditorDataTableDef} (injected by the game via `GameEditorCatalog`),
 * it renders one collapsible section per top-level entry id and walks each entry
 * to its scalar leaves, emitting a labelled input per leaf keyed by its dotted
 * path (`cost.food`, `damageMultipliers.heavy`). Correctness is the game's rule:
 * Save runs `def.validate(document)` — the real runtime validator — and refuses
 * to write anything the `?rts` boot would reject, surfacing the field message.
 *
 * Self-contained: styles are injected once so the shared `style.css` is left
 * untouched. Dev-only, like every other `*Editor.ts`.
 */
import type { EditorDataTableDef, EditorDataTableFieldMeta } from "@/editor/gameEditorRegistry";
import { loadDataTable, loadDataTableDefaults, saveDataTable } from "@/editor/dataTableStore";

type StatusTone = "info" | "success" | "warning" | "error";

export interface DataTableEditorOptions {
  path: string;
  label: string;
  def: EditorDataTableDef;
  onStatus?: (message: string, tone?: StatusTone) => void;
  onSaved?: () => void;
}

/** A single editable scalar leaf discovered by walking an entry. */
interface Leaf {
  /** Dotted path within the entry, e.g. `cost.food`. */
  readonly path: string;
  readonly type: "number" | "string" | "boolean";
  /** Parent container + key so a committed edit writes straight back into the doc. */
  readonly container: Record<string, unknown> | unknown[];
  readonly key: string | number;
}

export class DataTableEditor {
  private static activeInstance: DataTableEditor | null = null;

  static async open(options: DataTableEditorOptions): Promise<DataTableEditor> {
    DataTableEditor.activeInstance?.close();
    const editor = new DataTableEditor(options);
    DataTableEditor.activeInstance = editor;
    await editor.load();
    return editor;
  }

  private readonly overlay: HTMLDivElement;
  private readonly titleEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly saveBtn: HTMLButtonElement;

  /** The parsed document, mutated in place as leaves are committed. */
  private doc: Record<string, unknown> = {};
  /** Field metadata keyed by dotted leaf path, for labels/steps/enums. */
  private readonly fieldMeta = new Map<string, EditorDataTableFieldMeta>();
  /** Committed (git HEAD) document, lazily fetched the first time an entry is reset. */
  private defaults: Record<string, unknown> | null = null;
  private disposed = false;

  private constructor(private readonly options: DataTableEditorOptions) {
    for (const field of options.def.fields ?? []) this.fieldMeta.set(field.path, field);
    ensureStyles();

    this.overlay = document.createElement("div");
    this.overlay.className = "dte-overlay";
    this.overlay.innerHTML = `
<div class="dte-window" role="dialog" aria-label="Veri Tablosu Düzenleyici">
  <header class="dte-header">
    <span class="dte-tab">
      <span class="dte-tab-icon">DATA</span>
      <strong data-dte-title></strong>
      <span class="dte-badge">Veri Tablosu</span>
    </span>
    <div class="dte-header-actions">
      <button type="button" class="dte-save" data-dte-save title="Kaydet (Ctrl+S)">Kaydet</button>
      <button type="button" class="dte-close" data-dte-close title="Kapat (Esc)">×</button>
    </div>
  </header>
  <div class="dte-body" data-dte-body></div>
  <footer class="dte-status" data-dte-status>Yükleniyor…</footer>
</div>`;
    document.body.append(this.overlay);

    this.titleEl = this.req("[data-dte-title]");
    this.bodyEl = this.req("[data-dte-body]");
    this.statusEl = this.req("[data-dte-status]");
    this.saveBtn = this.req<HTMLButtonElement>("[data-dte-save]");

    this.req<HTMLButtonElement>("[data-dte-close]").addEventListener("click", () => this.close());
    this.saveBtn.addEventListener("click", () => void this.save());

    this.overlay.tabIndex = -1;
    this.overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); this.close(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void this.save();
      }
    });
    this.overlay.focus();
  }

  private req<T extends Element = HTMLElement>(selector: string): T {
    const el = this.overlay.querySelector<T>(selector);
    if (!el) throw new Error(`DataTableEditor: missing ${selector}`);
    return el;
  }

  private async load(): Promise<void> {
    try {
      const raw = await loadDataTable(this.options.path);
      if (!isPlainObject(raw)) {
        this.setStatus("Bu dosya girdi kimliğine göre bir nesne değil; düzenlenemez.", "error");
        return;
      }
      this.doc = raw;
      this.titleEl.textContent = this.options.def.label;
      this.renderEntries();
      this.setStatus(`Hazır — ${Object.keys(this.doc).length} girdi.`);
    } catch (error) {
      this.setStatus(`Yüklenemedi: ${describeError(error)}`, "error");
    }
  }

  private renderEntries(): void {
    this.bodyEl.replaceChildren();
    for (const entryId of Object.keys(this.doc)) {
      this.bodyEl.append(this.buildEntrySection(entryId));
    }
  }

  /** One collapsible section for a single entry: title, reset button, field grid. */
  private buildEntrySection(entryId: string): HTMLElement {
    const entry = this.doc[entryId];
    const section = document.createElement("details");
    section.className = "dte-entry";
    section.dataset.entryId = entryId;
    section.open = true;

    const summary = document.createElement("summary");
    summary.className = "dte-entry-title";
    const heading = document.createElement("span");
    heading.textContent = displayLabel(entry) ? `${entryId} — ${displayLabel(entry)}` : entryId;
    summary.append(heading);

    // Reset this one entry to its committed (git HEAD) values. Placed in the
    // summary; clicking it must not toggle the section open/closed.
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "dte-reset";
    reset.textContent = "Varsayılana dön";
    reset.title = "Bu başlığı depodaki (git) son kayıtlı değerlerine sıfırla";
    reset.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.resetEntry(entryId);
    });
    summary.append(reset);
    section.append(summary);

    const grid = document.createElement("div");
    grid.className = "dte-grid";
    if (isPlainObject(entry) || Array.isArray(entry)) {
      for (const leaf of collectLeaves(entry as Record<string, unknown> | unknown[], "")) {
        grid.append(this.renderLeaf(leaf));
      }
    } else {
      // A scalar top-level entry is itself a single leaf; key it by the entry id
      // so a flat config (e.g. roads.json) can label each value distinctly.
      grid.append(this.renderLeaf({ path: entryId, type: leafType(entry)!, container: this.doc, key: entryId }));
    }
    section.append(grid);
    return section;
  }

  /** Restore one entry to its committed defaults, then leave it as a dirty edit to save. */
  private async resetEntry(entryId: string): Promise<void> {
    try {
      if (!this.defaults) this.defaults = await loadDataTableDefaults(this.options.path);
      const defaultEntry = this.defaults[entryId];
      if (defaultEntry === undefined) {
        this.setStatus(`"${entryId}" depoda (git) yok; sıfırlanacak varsayılan değer bulunamadı.`, "warning");
        return;
      }
      this.doc[entryId] = structuredClone(defaultEntry);
      const rebuilt = this.buildEntrySection(entryId);
      const existing = this.bodyEl.querySelector(`.dte-entry[data-entry-id="${CSS.escape(entryId)}"]`);
      if (existing) existing.replaceWith(rebuilt);
      else this.renderEntries();
      this.markDirty();
      this.setStatus(`"${entryId}" varsayılana döndürüldü — kaydetmek için Kaydet'e basın.`, "info");
    } catch (error) {
      this.setStatus(`Varsayılanlar alınamadı: ${describeError(error)}`, "error");
    }
  }

  /**
   * Field metadata for a leaf: an exact-path entry wins, else the array-index
   * template (`levels.0.cost.wood` → `levels.[].cost.wood`) so one entry covers
   * every tier without listing indices.
   */
  private metaFor(path: string): EditorDataTableFieldMeta | undefined {
    return this.fieldMeta.get(path) ?? this.fieldMeta.get(templatePath(path));
  }

  private renderLeaf(leaf: Leaf): HTMLElement {
    const row = document.createElement("label");
    row.className = "dte-field";
    const meta = this.metaFor(leaf.path);
    if (meta?.hint) {
      row.title = meta.hint;
      row.classList.add("dte-field-hinted");
    }

    const name = document.createElement("span");
    name.className = "dte-field-label";
    name.textContent = meta?.label ?? (leaf.path || "(değer)");
    row.append(name);

    const current = (leaf.container as Record<string | number, unknown>)[leaf.key];
    let input: HTMLInputElement | HTMLSelectElement;
    if (leaf.type === "boolean") {
      input = document.createElement("input");
      input.type = "checkbox";
      (input as HTMLInputElement).checked = current === true;
    } else if (leaf.type === "string" && meta?.enum) {
      input = document.createElement("select");
      for (const option of meta.enum) {
        const opt = document.createElement("option");
        opt.value = option;
        opt.textContent = option;
        if (option === current) opt.selected = true;
        input.append(opt);
      }
    } else {
      input = document.createElement("input");
      input.type = leaf.type === "number" ? "number" : "text";
      input.value = current == null ? "" : String(current);
      if (leaf.type === "number") {
        if (meta?.min !== undefined) input.min = String(meta.min);
        if (meta?.max !== undefined) input.max = String(meta.max);
        if (meta?.step !== undefined) input.step = String(meta.step);
      }
    }
    input.className = "dte-field-input";
    if (meta?.readonly) {
      input.disabled = true;
      if (!row.title) row.title = "Bu alan yapısaldır ve düzenlenemez.";
    } else {
      input.addEventListener("change", () => this.commitLeaf(leaf, input));
    }
    row.append(input);
    return row;
  }

  /** Coerce the input back to the leaf's original JS type and write it into the doc. */
  private commitLeaf(leaf: Leaf, input: HTMLInputElement | HTMLSelectElement): void {
    const container = leaf.container as Record<string | number, unknown>;
    if (leaf.type === "boolean") {
      container[leaf.key] = (input as HTMLInputElement).checked;
    } else if (leaf.type === "number") {
      const next = Number((input as HTMLInputElement).value);
      if (!Number.isFinite(next)) {
        this.setStatus(`"${leaf.path}" sayısal olmalı; değişiklik yok sayıldı.`, "warning");
        (input as HTMLInputElement).value = String(container[leaf.key] ?? "");
        return;
      }
      container[leaf.key] = next;
    } else {
      container[leaf.key] = input.value;
    }
    this.markDirty();
  }

  private markDirty(): void {
    this.saveBtn.classList.add("is-dirty");
    this.setStatus("Kaydedilmemiş değişiklikler var.", "info");
  }

  private async save(): Promise<void> {
    const message = this.options.def.validate(this.doc);
    if (message !== null) {
      this.setStatus(`Geçersiz veri — kaydedilmedi: ${message}`, "error");
      return;
    }
    try {
      const result = await saveDataTable(this.options.path, this.doc);
      this.saveBtn.classList.remove("is-dirty");
      this.setStatus(
        result.changed ? "Kaydedildi. ?rts sekmesini yenileyerek görebilirsiniz." : "Değişiklik yok.",
        "success",
      );
      this.options.onSaved?.();
    } catch (error) {
      this.setStatus(`Kaydedilemedi: ${describeError(error)}`, "error");
    }
  }

  private setStatus(message: string, tone: StatusTone = "info"): void {
    if (this.disposed) return;
    this.statusEl.textContent = message;
    this.statusEl.dataset.tone = tone;
    this.options.onStatus?.(message, tone);
  }

  close(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (DataTableEditor.activeInstance === this) DataTableEditor.activeInstance = null;
    this.overlay.remove();
  }
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Replace array-index path segments with `[]` so field metadata is index-agnostic. */
function templatePath(path: string): string {
  return path.replace(/\.\d+(?=\.|$)/g, ".[]");
}

function leafType(value: unknown): Leaf["type"] | null {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  return null;
}

/**
 * Depth-first walk of an entry to its editable scalar leaves. Nested objects and
 * arrays recurse with a dotted path (`levels.0.maxHealth`); null/other values are
 * skipped so a leaf always has a coercible type.
 */
function collectLeaves(node: Record<string, unknown> | unknown[], prefix: string): Leaf[] {
  const leaves: Leaf[] = [];
  const entries: [string | number, unknown][] = Array.isArray(node)
    ? node.map((value, index) => [index, value])
    : Object.entries(node);
  for (const [key, value] of entries) {
    const path = prefix ? `${prefix}.${key}` : String(key);
    const type = leafType(value);
    if (type) {
      leaves.push({ path, type, container: node, key });
    } else if (isPlainObject(value) || Array.isArray(value)) {
      leaves.push(...collectLeaves(value as Record<string, unknown> | unknown[], path));
    }
  }
  return leaves;
}

/** A `label`/`name` scalar on an entry, used as a friendly section subtitle. */
function displayLabel(entry: unknown): string {
  if (!isPlainObject(entry)) return "";
  const label = entry.label ?? entry.name;
  return typeof label === "string" ? label : "";
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ─── Injected styles (keeps the shared style.css untouched) ──────────────────

function ensureStyles(): void {
  if (document.getElementById("dte-styles")) return;
  const style = document.createElement("style");
  style.id = "dte-styles";
  style.textContent = `
.dte-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;
  background:rgba(10,12,16,.6);backdrop-filter:blur(2px);outline:none;}
.dte-window{display:flex;flex-direction:column;width:min(720px,92vw);height:min(80vh,900px);
  background:#1e2127;color:#dfe3ea;border:1px solid #333842;border-radius:8px;box-shadow:0 12px 48px rgba(0,0,0,.5);overflow:hidden;}
.dte-header{display:flex;align-items:center;gap:12px;padding:10px 12px;background:#252932;border-bottom:1px solid #333842;}
.dte-tab{display:flex;align-items:center;gap:8px;flex:1;min-width:0;}
.dte-tab-icon{font-size:10px;font-weight:700;letter-spacing:.5px;color:#8b93a3;background:#30353f;padding:2px 6px;border-radius:4px;}
.dte-tab strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dte-badge{font-size:11px;color:#8b93a3;background:#30353f;padding:2px 8px;border-radius:10px;}
.dte-header-actions{display:flex;gap:8px;}
.dte-save,.dte-close{border:1px solid #3a4650;background:#2c313b;color:#dfe3ea;border-radius:5px;cursor:pointer;padding:5px 12px;font:inherit;}
.dte-save.is-dirty{background:#3a5bd0;border-color:#4a6bea;}
.dte-close{padding:5px 10px;line-height:1;}
.dte-save:hover,.dte-close:hover{filter:brightness(1.15);}
.dte-body{flex:1;overflow:auto;padding:10px 12px;}
.dte-entry{border:1px solid #2e333d;border-radius:6px;margin-bottom:8px;background:#22262e;}
.dte-entry-title{cursor:pointer;padding:8px 12px;font-weight:600;user-select:none;display:flex;align-items:center;justify-content:space-between;gap:12px;}
.dte-reset{flex:0 0 auto;border:1px solid #3a4650;background:#2c313b;color:#cdd4df;border-radius:5px;cursor:pointer;padding:3px 10px;font:inherit;font-size:12px;font-weight:500;}
.dte-reset:hover{filter:brightness(1.2);border-color:#c8955a;color:#ffce7a;}
.dte-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;padding:6px 12px 12px;}
.dte-field{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0;}
.dte-field-label{color:#aeb6c4;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dte-field-hinted .dte-field-label::after{content:" ⓘ";color:#7f8aa0;}
.dte-field-input:disabled{opacity:.55;cursor:not-allowed;}
.dte-field-input{flex:0 0 44%;background:#171a20;color:#dfe3ea;border:1px solid #333842;border-radius:4px;padding:4px 6px;font:inherit;}
.dte-field-input[type=checkbox]{flex:0 0 auto;}
.dte-field-input:focus{outline:none;border-color:#4a6bea;}
.dte-status{padding:8px 12px;border-top:1px solid #333842;background:#252932;font-size:12px;color:#aeb6c4;}
.dte-status[data-tone=error]{color:#ff8a8a;}
.dte-status[data-tone=success]{color:#8fe0a4;}
.dte-status[data-tone=warning]{color:#ffce7a;}
`;
  document.head.append(style);
}
