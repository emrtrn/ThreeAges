/**
 * AI Blackboard: a typed, per-agent key/value memory (Unreal `UBlackboardComponent`).
 *
 * The blackboard is the shared scratch space Behavior Trees, decorators and
 * services read and write (Faz 2+). A blackboard is created from a declared key
 * schema — keys are fixed up front, exactly like Unreal's Blackboard asset, so a
 * typo can never silently create a phantom key. Values are validated against each
 * key's declared {@link BlackboardValueKind}; a wrong-typed or unknown write is a
 * no-op (returns `false`).
 *
 * Runtime-only: the value store lives on the agent for the lifetime of the play
 * session and is **never serialized back to the layout** (AI runtime state is a
 * debug-inspect concern, per the AI plan). The key *schema* is authored data; the
 * *values* are not.
 *
 * Pure module: no Three.js, no DOM. Value imports use relative paths because the
 * engine-test bundler resolves no path aliases (mirrors `engine/behavior`).
 */
import type { Vec3 } from "../scene/layout";
import type { EntityId } from "../scene/entity";

/** The value kinds a blackboard key can hold (Unreal Blackboard key types subset). */
export type BlackboardValueKind = "boolean" | "number" | "string" | "vec3" | "entity";

export const BLACKBOARD_VALUE_KINDS: readonly BlackboardValueKind[] = [
  "boolean",
  "number",
  "string",
  "vec3",
  "entity",
];

/**
 * A stored blackboard value. `vec3` holds a 3-tuple and `entity` an
 * {@link EntityId}; `null` is a legal value for any key, meaning "unset / None"
 * (Unreal's cleared object/vector keys).
 */
export type BlackboardValue = boolean | number | string | Vec3 | EntityId | null;

/** One declared key of a blackboard schema. */
export interface BlackboardKeyDef {
  key: string;
  kind: BlackboardValueKind;
  /** Initial value applied at construction / {@link Blackboard.reset}. */
  default?: BlackboardValue;
}

export interface BlackboardEntrySnapshot {
  readonly key: string;
  readonly kind: BlackboardValueKind;
  readonly value: BlackboardValue;
}

/** Debug view of a blackboard: declared-key count + each key's current value. */
export interface BlackboardDebugSnapshot {
  readonly keyCount: number;
  readonly entries: readonly BlackboardEntrySnapshot[];
}

export function isBlackboardValueKind(value: unknown): value is BlackboardValueKind {
  return typeof value === "string" && (BLACKBOARD_VALUE_KINDS as readonly string[]).includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

/** Clones a value so callers can't alias the store (vec3 tuples are copied). */
function cloneBlackboardValue(value: BlackboardValue): BlackboardValue {
  return isVec3(value) ? [value[0], value[1], value[2]] : value;
}

/** The zero value for a kind when a key declares no default (Unreal parity). */
function defaultForKind(kind: BlackboardValueKind): BlackboardValue {
  switch (kind) {
    case "boolean":
      return false;
    case "number":
      return 0;
    case "string":
      return "";
    case "vec3":
    case "entity":
      return null;
  }
}

/**
 * Coerces an arbitrary value to a valid value for `kind`, or returns `undefined`
 * when it doesn't fit (an unknown/rejected write). `null` is always accepted.
 * Vec3 values are cloned so the store never aliases caller-owned arrays.
 */
export function normalizeBlackboardValue(
  kind: BlackboardValueKind,
  value: unknown,
): BlackboardValue | undefined {
  if (value === null) return null;
  switch (kind) {
    case "boolean":
      return typeof value === "boolean" ? value : undefined;
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    case "string":
    case "entity":
      return typeof value === "string" ? value : undefined;
    case "vec3":
      return isVec3(value) ? [value[0], value[1], value[2]] : undefined;
  }
}

/** Normalizes one authored key definition; returns null when unusable. */
export function normalizeBlackboardKey(value: unknown): BlackboardKeyDef | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.key !== "string" || value.key.length === 0) return null;
  if (!isBlackboardValueKind(value.kind)) return null;
  const def: BlackboardKeyDef = { key: value.key, kind: value.kind };
  const normalizedDefault = normalizeBlackboardValue(value.kind, value.default);
  if (normalizedDefault !== undefined) def.default = normalizedDefault;
  return def;
}

/** Normalizes an authored key array, dropping malformed entries and duplicates. */
export function normalizeBlackboardKeys(value: unknown): BlackboardKeyDef[] {
  if (!Array.isArray(value)) return [];
  const out: BlackboardKeyDef[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const def = normalizeBlackboardKey(raw);
    if (!def || seen.has(def.key)) continue;
    seen.add(def.key);
    out.push(def);
  }
  return out;
}

/**
 * A per-agent typed key/value store built from a declared key schema. Only
 * declared keys can be written, and only with a value matching the key's kind;
 * any other write is a no-op. Reads clone `vec3` values so the internal store is
 * never mutated through a returned reference.
 */
export class Blackboard {
  private readonly defs = new Map<string, BlackboardKeyDef>();
  private readonly values = new Map<string, BlackboardValue>();

  constructor(keys: readonly BlackboardKeyDef[] = []) {
    for (const def of keys) {
      if (this.defs.has(def.key)) continue;
      this.defs.set(def.key, def);
      this.values.set(def.key, this.initialValue(def));
    }
  }

  private initialValue(def: BlackboardKeyDef): BlackboardValue {
    return def.default !== undefined ? cloneBlackboardValue(def.default) : defaultForKind(def.kind);
  }

  /** Whether `key` is a declared key of this blackboard. */
  has(key: string): boolean {
    return this.defs.has(key);
  }

  /** The declared kind of `key`, or undefined when the key is unknown. */
  kindOf(key: string): BlackboardValueKind | undefined {
    return this.defs.get(key)?.kind;
  }

  /** The declared key schema (defensive copy). */
  keys(): BlackboardKeyDef[] {
    return [...this.defs.values()].map((def) => ({ ...def }));
  }

  keyCount(): number {
    return this.defs.size;
  }

  /** Current value of `key` (cloned), or undefined when the key is unknown. */
  get(key: string): BlackboardValue | undefined {
    if (!this.defs.has(key)) return undefined;
    return cloneBlackboardValue(this.values.get(key) ?? null);
  }

  getBoolean(key: string): boolean | null {
    const value = this.values.get(key);
    return typeof value === "boolean" ? value : null;
  }

  getNumber(key: string): number | null {
    const value = this.values.get(key);
    return typeof value === "number" ? value : null;
  }

  getString(key: string): string | null {
    const value = this.values.get(key);
    return typeof value === "string" ? value : null;
  }

  getEntity(key: string): EntityId | null {
    const value = this.values.get(key);
    return typeof value === "string" ? value : null;
  }

  getVec3(key: string): Vec3 | null {
    const value = this.values.get(key);
    return isVec3(value) ? [value[0], value[1], value[2]] : null;
  }

  /**
   * Writes `value` to `key`. Returns false (a no-op) when the key is undeclared
   * or the value doesn't match the key's declared kind.
   */
  set(key: string, value: BlackboardValue): boolean {
    const def = this.defs.get(key);
    if (!def) return false;
    const normalized = normalizeBlackboardValue(def.kind, value);
    if (normalized === undefined) return false;
    this.values.set(key, normalized);
    return true;
  }

  /** Clears `key` to `null` (Unreal `ClearValue`). No-op on an unknown key. */
  clear(key: string): boolean {
    if (!this.defs.has(key)) return false;
    this.values.set(key, null);
    return true;
  }

  /** Restores every key to its declared default (or its kind's zero value). */
  reset(): void {
    for (const def of this.defs.values()) {
      this.values.set(def.key, this.initialValue(def));
    }
  }

  getDebugSnapshot(): BlackboardDebugSnapshot {
    const entries: BlackboardEntrySnapshot[] = [...this.defs.values()].map((def) => ({
      key: def.key,
      kind: def.kind,
      value: cloneBlackboardValue(this.values.get(def.key) ?? null),
    }));
    return { keyCount: this.defs.size, entries };
  }
}
