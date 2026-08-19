/**
 * Message formatter — Localization Plan §10, §11.
 *
 * An ICU MessageFormat *subset*, parsed once per pattern and formatted on top of
 * `Intl.PluralRules` / `Intl.NumberFormat` / `Intl.ListFormat`. Plan §11.1 bans
 * hand-written `amount === 1` plural logic; inventory §7.8 shows why it lands in
 * Faz 1 rather than Faz 2 — Turkish hides plurals (`3 işçi`), so the English
 * source text cannot even be written without it.
 *
 * Supported syntax:
 *   {name}                                  — interpolation (numbers get Intl)
 *   {name, number}                          — decimal / integer / percent styles
 *   {n, plural, one {…} other {…}}          — with `=0` exact matches, `offset:`
 *                                             and `#` for the formatted number
 *   {kind, select, wood {…} other {…}}
 *   '{'  '}'  ''                            — ICU apostrophe quoting
 *
 * Everything else is a hard parse error rather than a silent pass-through: a
 * pattern the formatter does not understand must fail where it is authored, not
 * render half a sentence in eight languages. That strictness is the trade the
 * project accepted when it chose an in-repo subset over a full ICU dependency.
 *
 * ICU apostrophe rule, verbatim, because Turkish needs it: `'` only starts a
 * quoted literal when the next character is `{`, `}`, `#` or `|`. A lone
 * apostrophe (`Kışla'dan`) stays a plain character.
 *
 * Pure module: no DOM, no fetch. Everything here is exercised by `test:engine`.
 */
import type { TranslationParams } from "./LocalizationTypes";

export class LocalizationSyntaxError extends Error {
  constructor(
    message: string,
    readonly pattern: string,
    readonly offset: number,
  ) {
    super(`${message} (offset ${offset}) in: ${pattern}`);
    this.name = "LocalizationSyntaxError";
  }
}

export type NumberStyle = "decimal" | "integer" | "percent";

/**
 * A resolved number format: a named style, plus the fraction digits an ICU
 * skeleton asked for.
 *
 * The skeleton half exists because a rate reads as a rate only with its decimal
 * (`+0.0/min`, not `+0/min`), and `toFixed(1)` cannot produce that — it writes a
 * dot into languages that use a comma (inventory §7.7). `{rate, number, ::.0}`
 * is the ICU spelling of "exactly one fraction digit, in this locale's script".
 */
export interface NumberFormatSpec {
  readonly style: NumberStyle;
  /** null = leave it to `Intl`'s default for the style. */
  readonly minimumFractionDigits: number | null;
  readonly maximumFractionDigits: number | null;
}

const DEFAULT_NUMBER_SPEC: NumberFormatSpec = {
  style: "decimal",
  minimumFractionDigits: null,
  maximumFractionDigits: null,
};

const PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);

export type MessageNode =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "arg"; readonly name: string }
  | { readonly kind: "number"; readonly name: string; readonly format: NumberFormatSpec }
  | {
      readonly kind: "plural";
      readonly name: string;
      readonly offset: number;
      readonly branches: readonly MessageBranch[];
    }
  | { readonly kind: "select"; readonly name: string; readonly branches: readonly MessageBranch[] }
  | { readonly kind: "pound" };

export interface MessageBranch {
  readonly key: string;
  readonly nodes: readonly MessageNode[];
}

/** Formatting problem found while rendering — never throws at runtime. */
export interface FormatIssue {
  readonly kind: "missing-parameter" | "wrong-parameter-type";
  readonly name: string;
  readonly detail?: string;
}

const IDENTIFIER = /[A-Za-z0-9_]/;

class MessageParser {
  private index = 0;

  constructor(private readonly pattern: string) {}

  parse(): readonly MessageNode[] {
    const nodes = this.parseNodes(false, false);
    if (this.index < this.pattern.length) {
      throw new LocalizationSyntaxError("Unexpected '}'", this.pattern, this.index);
    }
    return nodes;
  }

  private parseNodes(insideBranch: boolean, insidePlural: boolean): readonly MessageNode[] {
    const nodes: MessageNode[] = [];
    let text = "";
    const flush = (): void => {
      if (text.length > 0) {
        nodes.push({ kind: "text", value: text });
        text = "";
      }
    };
    while (this.index < this.pattern.length) {
      const char = this.pattern[this.index]!;
      if (char === "}") {
        if (!insideBranch) {
          throw new LocalizationSyntaxError("Unbalanced '}'", this.pattern, this.index);
        }
        break;
      }
      if (char === "{") {
        flush();
        nodes.push(this.parseArgument());
        continue;
      }
      if (char === "#" && insidePlural) {
        flush();
        nodes.push({ kind: "pound" });
        this.index += 1;
        continue;
      }
      if (char === "'") {
        text += this.readQuoted();
        continue;
      }
      text += char;
      this.index += 1;
    }
    flush();
    return nodes;
  }

  /** ICU apostrophe handling — see the module note. */
  private readQuoted(): string {
    const next = this.pattern[this.index + 1];
    if (next === "'") {
      this.index += 2;
      return "'";
    }
    if (next !== "{" && next !== "}" && next !== "#" && next !== "|") {
      this.index += 1;
      return "'";
    }
    this.index += 1;
    let literal = "";
    while (this.index < this.pattern.length) {
      const char = this.pattern[this.index]!;
      if (char === "'") {
        if (this.pattern[this.index + 1] === "'") {
          literal += "'";
          this.index += 2;
          continue;
        }
        this.index += 1;
        return literal;
      }
      literal += char;
      this.index += 1;
    }
    throw new LocalizationSyntaxError("Unterminated quoted literal", this.pattern, this.index);
  }

  private parseArgument(): MessageNode {
    const start = this.index;
    this.index += 1; // '{'
    this.skipWhitespace();
    const name = this.readIdentifier();
    if (name.length === 0) {
      throw new LocalizationSyntaxError("Empty placeholder name", this.pattern, start);
    }
    this.skipWhitespace();
    if (this.peek() === "}") {
      this.index += 1;
      return { kind: "arg", name };
    }
    this.expect(",");
    this.skipWhitespace();
    const type = this.readIdentifier();
    this.skipWhitespace();
    switch (type) {
      case "number":
        return this.parseNumber(name);
      case "plural":
        // `{n, plural, …}` — unlike a number style, the branch list is required,
        // and so is the comma in front of it.
        this.expect(",");
        this.skipWhitespace();
        return this.parsePlural(name);
      case "select":
        this.expect(",");
        this.skipWhitespace();
        return this.parseSelect(name);
      default:
        throw new LocalizationSyntaxError(
          `Unsupported placeholder type "${type}" (supported: number, plural, select)`,
          this.pattern,
          start,
        );
    }
  }

  private parseNumber(name: string): MessageNode {
    let format = DEFAULT_NUMBER_SPEC;
    if (this.peek() === ",") {
      this.index += 1;
      this.skipWhitespace();
      format = this.pattern.startsWith("::", this.index)
        ? this.parseNumberSkeleton()
        : { ...DEFAULT_NUMBER_SPEC, style: this.parseNumberStyle() };
      this.skipWhitespace();
    }
    this.expect("}");
    return { kind: "number", name, format };
  }

  private parseNumberStyle(): NumberStyle {
    const raw = this.readIdentifier();
    if (raw !== "decimal" && raw !== "integer" && raw !== "percent") {
      throw new LocalizationSyntaxError(
        `Unsupported number style "${raw}" (supported: decimal, integer, percent, ::skeleton)`,
        this.pattern,
        this.index,
      );
    }
    return raw;
  }

  /**
   * The fraction-digit corner of ICU's number skeletons: `::.0`, `::.00`,
   * `::.0#`, `::.##`. Zeros are required digits, hashes optional ones. Anything
   * else in a skeleton is refused rather than half-understood — a skeleton the
   * formatter silently ignored would print the wrong number, not a wrong word.
   */
  private parseNumberSkeleton(): NumberFormatSpec {
    const start = this.index;
    this.index += 2;
    const skeleton = this.readWhile((char) => char !== "}").trim();
    const match = /^\.(0*)(#*)$/u.exec(skeleton);
    if (!match) {
      throw new LocalizationSyntaxError(
        `Unsupported number skeleton "::${skeleton}" (supported: ::.0, ::.00, ::.0#, ::.#)`,
        this.pattern,
        start,
      );
    }
    const required = match[1]!.length;
    return {
      style: "decimal",
      minimumFractionDigits: required,
      maximumFractionDigits: required + match[2]!.length,
    };
  }

  private parsePlural(name: string): MessageNode {
    let offset = 0;
    if (this.pattern.startsWith("offset:", this.index)) {
      this.index += "offset:".length;
      const digits = this.readWhile((char) => /[0-9-]/.test(char));
      const parsed = Number.parseInt(digits, 10);
      if (!Number.isFinite(parsed)) {
        throw new LocalizationSyntaxError("Invalid plural offset", this.pattern, this.index);
      }
      offset = parsed;
      this.skipWhitespace();
    }
    const branches = this.parseBranches(true);
    this.requireOther(branches, "plural");
    for (const branch of branches) {
      if (branch.key.startsWith("=")) {
        if (!/^=-?[0-9]+$/.test(branch.key)) {
          throw new LocalizationSyntaxError(
            `Invalid exact plural match "${branch.key}"`,
            this.pattern,
            this.index,
          );
        }
        continue;
      }
      if (!PLURAL_CATEGORIES.has(branch.key)) {
        throw new LocalizationSyntaxError(
          `Unknown plural category "${branch.key}"`,
          this.pattern,
          this.index,
        );
      }
    }
    return { kind: "plural", name, offset, branches };
  }

  private parseSelect(name: string): MessageNode {
    const branches = this.parseBranches(false);
    this.requireOther(branches, "select");
    return { kind: "select", name, branches };
  }

  private parseBranches(insidePlural: boolean): readonly MessageBranch[] {
    const branches: MessageBranch[] = [];
    for (;;) {
      this.skipWhitespace();
      if (this.peek() === "}") {
        this.index += 1;
        return branches;
      }
      if (this.index >= this.pattern.length) {
        throw new LocalizationSyntaxError("Unterminated placeholder", this.pattern, this.index);
      }
      const key = this.readWhile((char) => IDENTIFIER.test(char) || char === "=" || char === "-");
      if (key.length === 0) {
        throw new LocalizationSyntaxError("Expected a branch key", this.pattern, this.index);
      }
      if (branches.some((branch) => branch.key === key)) {
        throw new LocalizationSyntaxError(`Duplicate branch "${key}"`, this.pattern, this.index);
      }
      this.skipWhitespace();
      this.expect("{");
      const nodes = this.parseNodes(true, insidePlural);
      this.expect("}");
      branches.push({ key, nodes });
    }
  }

  private requireOther(branches: readonly MessageBranch[], type: string): void {
    if (!branches.some((branch) => branch.key === "other")) {
      throw new LocalizationSyntaxError(`${type} needs an "other" branch`, this.pattern, this.index);
    }
  }

  private peek(): string | undefined {
    return this.pattern[this.index];
  }

  private expect(char: string): void {
    this.skipWhitespace();
    if (this.pattern[this.index] !== char) {
      throw new LocalizationSyntaxError(`Expected "${char}"`, this.pattern, this.index);
    }
    this.index += 1;
  }

  private skipWhitespace(): void {
    this.readWhile((char) => /\s/.test(char));
  }

  private readIdentifier(): string {
    return this.readWhile((char) => IDENTIFIER.test(char));
  }

  private readWhile(predicate: (char: string) => boolean): string {
    let read = "";
    while (this.index < this.pattern.length && predicate(this.pattern[this.index]!)) {
      read += this.pattern[this.index]!;
      this.index += 1;
    }
    return read;
  }
}

const parseCache = new Map<string, readonly MessageNode[]>();

/** Parse (and memoize) one pattern. Throws {@link LocalizationSyntaxError}. */
export function parseMessage(pattern: string): readonly MessageNode[] {
  const cached = parseCache.get(pattern);
  if (cached) return cached;
  const nodes = new MessageParser(pattern).parse();
  parseCache.set(pattern, nodes);
  return nodes;
}

/** Every parameter name a pattern reads, nested branches included (Plan §19.1). */
export function extractPlaceholders(pattern: string): readonly string[] {
  const names = new Set<string>();
  const walk = (nodes: readonly MessageNode[]): void => {
    for (const node of nodes) {
      switch (node.kind) {
        case "arg":
        case "number":
          names.add(node.name);
          break;
        case "plural":
        case "select":
          names.add(node.name);
          for (const branch of node.branches) walk(branch.nodes);
          break;
        default:
          break;
      }
    }
  };
  walk(parseMessage(pattern));
  return [...names].sort((left, right) => left.localeCompare(right));
}

const numberFormatters = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();
const listFormatters = new Map<string, Intl.ListFormat>();

function numberFormatter(locale: string, spec: NumberFormatSpec): Intl.NumberFormat {
  const cacheKey = `${locale}|${spec.style}|${spec.minimumFractionDigits}|${spec.maximumFractionDigits}`;
  const cached = numberFormatters.get(cacheKey);
  if (cached) return cached;
  const base: Intl.NumberFormatOptions =
    spec.style === "integer"
      ? { maximumFractionDigits: 0 }
      : spec.style === "percent"
        ? { style: "percent", maximumFractionDigits: 0 }
        : {};
  const formatter = new Intl.NumberFormat(locale, {
    ...base,
    ...(spec.minimumFractionDigits === null
      ? {}
      : { minimumFractionDigits: spec.minimumFractionDigits }),
    ...(spec.maximumFractionDigits === null
      ? {}
      : { maximumFractionDigits: spec.maximumFractionDigits }),
  });
  numberFormatters.set(cacheKey, formatter);
  return formatter;
}

function pluralRulesFor(locale: string): Intl.PluralRules {
  const cached = pluralRules.get(locale);
  if (cached) return cached;
  const rules = new Intl.PluralRules(locale);
  pluralRules.set(locale, rules);
  return rules;
}

/**
 * Locale-aware number output — Plan §11.2 (`12345` → `12,345` / `12.345`), and
 * the fix for inventory §7.7's hand-written `%${percent}`, whose sign sits on
 * the wrong side in English.
 */
export function formatNumber(
  locale: string,
  value: number,
  style: NumberStyle = "decimal",
): string {
  return formatNumberSpec(locale, value, { ...DEFAULT_NUMBER_SPEC, style });
}

function formatNumberSpec(locale: string, value: number, spec: NumberFormatSpec): string {
  if (!Number.isFinite(value)) return "—";
  return numberFormatter(locale, spec).format(value);
}

/** `ratio` is a fraction (0.3 → `%30` in tr, `30%` in en). */
export function formatPercent(locale: string, ratio: number): string {
  return formatNumber(locale, ratio, "percent");
}

/**
 * Locale-aware list joining — inventory §7.5. English wants "wood, stone and
 * gold"; joining with ", " in code bakes one language's grammar into all of them.
 */
export function formatList(
  locale: string,
  items: readonly string[],
  type: "conjunction" | "disjunction" = "conjunction",
): string {
  if (items.length === 0) return "";
  const cacheKey = `${locale}|${type}`;
  let formatter = listFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.ListFormat(locale, { style: "long", type });
    listFormatters.set(cacheKey, formatter);
  }
  return formatter.format([...items]);
}

function selectPluralBranch(
  node: Extract<MessageNode, { kind: "plural" }>,
  locale: string,
  value: number,
): readonly MessageNode[] {
  const exact = node.branches.find((branch) => branch.key === `=${value}`);
  if (exact) return exact.nodes;
  const category = pluralRulesFor(locale).select(value - node.offset);
  const match = node.branches.find((branch) => branch.key === category);
  return (match ?? node.branches.find((branch) => branch.key === "other")!).nodes;
}

/** Shared by the `number` and `plural` cases, which both need a real number. */
function reportNonNumber(
  name: string,
  value: string | number | boolean | undefined,
  report: (issue: FormatIssue) => void,
): void {
  if (value === undefined) report({ kind: "missing-parameter", name });
  else {
    report({
      kind: "wrong-parameter-type",
      name,
      detail: `expected a number, got ${typeof value}`,
    });
  }
}

interface RenderContext {
  readonly locale: string;
  readonly params: TranslationParams;
  readonly report: (issue: FormatIssue) => void;
  /** Value `#` renders inside the innermost plural, already offset-adjusted. */
  readonly poundValue: number | null;
}

function renderNodes(nodes: readonly MessageNode[], context: RenderContext): string {
  let out = "";
  for (const node of nodes) {
    switch (node.kind) {
      case "text":
        out += node.value;
        break;
      case "pound":
        out +=
          context.poundValue === null
            ? "#"
            : formatNumber(context.locale, context.poundValue, "decimal");
        break;
      case "arg": {
        const value = context.params[node.name];
        if (value === undefined) {
          context.report({ kind: "missing-parameter", name: node.name });
          out += `{${node.name}}`;
          break;
        }
        out += typeof value === "number" ? formatNumber(context.locale, value) : String(value);
        break;
      }
      case "number": {
        const value = context.params[node.name];
        if (typeof value !== "number") {
          reportNonNumber(node.name, value, context.report);
          out += `{${node.name}}`;
          break;
        }
        out += formatNumberSpec(context.locale, value, node.format);
        break;
      }
      case "plural": {
        const value = context.params[node.name];
        if (typeof value !== "number") {
          reportNonNumber(node.name, value, context.report);
          // Still render *something* readable: the "other" branch is the one
          // every language is required to have.
          const other = node.branches.find((branch) => branch.key === "other")!;
          out += renderNodes(other.nodes, { ...context, poundValue: null });
          break;
        }
        const branch = selectPluralBranch(node, context.locale, value);
        out += renderNodes(branch, { ...context, poundValue: value - node.offset });
        break;
      }
      case "select": {
        const value = context.params[node.name];
        if (value === undefined) context.report({ kind: "missing-parameter", name: node.name });
        const key = value === undefined ? "other" : String(value);
        const branch =
          node.branches.find((entry) => entry.key === key) ??
          node.branches.find((entry) => entry.key === "other")!;
        out += renderNodes(branch.nodes, context);
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/**
 * Render one pattern. Syntax errors throw (authoring bug, caught by the service
 * and by the validator); missing parameters are reported and rendered as the
 * literal `{name}` so the gap is visible without blanking the UI.
 */
export function formatMessage(
  pattern: string,
  locale: string,
  params: TranslationParams = {},
  report: (issue: FormatIssue) => void = () => {},
): string {
  const nodes = parseMessage(pattern);
  // Fast path: the overwhelming majority of UI strings are plain text.
  if (nodes.length === 1 && nodes[0]!.kind === "text") return nodes[0]!.value;
  return renderNodes(nodes, { locale, params, report, poundValue: null });
}
