/**
 * Localization service — Localization Plan §6.2, §12, §13.
 *
 * The single entry point between the game and its text. UI code asks for a key
 * and gets a finished string; it never reads a locale file, never picks a
 * plural branch and never concatenates a sentence (Plan §6.1, §10).
 *
 * Responsibilities, straight from the plan: hold the active locale, resolve a
 * key, apply the fallback chain, interpolate parameters, announce locale
 * changes and report missing keys.
 *
 * Deliberately constructor-injected (loader, preference store, browser
 * languages, clock-free): every behaviour below is reachable from `test:engine`
 * on node, with no fetch and no DOM.
 */
import { logger } from "../core/logger";
import {
  DEFAULT_DEBUG_OPTIONS,
  missingKeyMarker,
  PSEUDO_LOCALE,
  type LocalizationDebugOptions,
} from "./LocalizationDebug";
import {
  formatList,
  formatMessage,
  formatNumber,
  formatPercent,
  LocalizationSyntaxError,
  type NumberStyle,
} from "./LocalizationFormatter";
import { createPseudoBundle, mergeLocaleDomains } from "./LocalizationLoader";
import {
  fallbackChain,
  localeDescriptor,
  matchBrowserLocale,
  selectableLocales,
  SOURCE_LOCALE,
} from "./localeRegistry";
import type {
  LocaleBundle,
  LocaleChangedEvent,
  LocaleChangedListener,
  LocaleCode,
  LocaleDescriptor,
  LocaleDomainsLoader,
  LocalePreferenceStore,
  LocalizationDisplayMode,
  LocalizationIssue,
  LocalizationIssueReporter,
  TranslationParams,
} from "./LocalizationTypes";

const log = logger("UI");

/** What a key that exists in no locale renders as — Plan §12.2, §20. */
export type MissingKeyMode =
  /** `⟦missing:key.path⟧` — loud, for development and QA. */
  | "marker"
  /** The bare key — visible and greppable, but not shouting at a player. */
  | "key";

export interface LocalizationServiceOptions {
  readonly loadDomains: LocaleDomainsLoader;
  readonly fallbackLocale?: LocaleCode;
  readonly preferences?: LocalePreferenceStore;
  readonly debug?: LocalizationDebugOptions;
  readonly onIssue?: LocalizationIssueReporter;
  readonly browserLanguages?: readonly string[];
  readonly missingKeyMode?: MissingKeyMode;
}

export interface SetLocaleOptions {
  /** Write the choice to the preference store. Off for the boot-time resolve. */
  readonly persist?: boolean;
}

/**
 * Plan §12.1's resolution order, as one pure function:
 *   1. saved player preference
 *   2. browser locale
 *   3. nearest supported match
 *   4. English
 *
 * with a development-only step 0 (`?locale=`) in front, which is also how the
 * pseudo-locale and the smoke suite reach a locale the picker never offers.
 */
export function resolveInitialLocale(options: {
  readonly forcedLocale?: LocaleCode | null;
  readonly savedLocale?: LocaleCode | null;
  readonly browserLanguages?: readonly string[];
  readonly fallbackLocale?: LocaleCode;
}): LocaleCode {
  const fallback = options.fallbackLocale ?? SOURCE_LOCALE;
  const forced = options.forcedLocale ?? null;
  // A forced locale may be disabled on purpose (qps-ploc); it only has to exist.
  if (forced !== null && localeDescriptor(forced) !== null) return forced;
  const saved = options.savedLocale ?? null;
  if (saved !== null && selectableLocales().some((entry) => entry.code === saved)) return saved;
  const matched = matchBrowserLocale(options.browserLanguages ?? []);
  return matched ?? fallback;
}

export class LocalizationService {
  private readonly loadDomains: LocaleDomainsLoader;
  private readonly fallbackLocale: LocaleCode;
  private readonly preferences: LocalePreferenceStore | null;
  private readonly onIssue: LocalizationIssueReporter | null;
  private readonly browserLanguages: readonly string[];
  private readonly missingKeyMode: MissingKeyMode;
  private readonly bundles = new Map<LocaleCode, LocaleBundle>();
  private readonly listeners = new Set<LocaleChangedListener>();
  private readonly missing = new Set<string>();
  private debug: LocalizationDebugOptions;
  private activeLocale: LocaleCode;

  constructor(options: LocalizationServiceOptions) {
    this.loadDomains = options.loadDomains;
    this.fallbackLocale = options.fallbackLocale ?? SOURCE_LOCALE;
    this.preferences = options.preferences ?? null;
    this.onIssue = options.onIssue ?? null;
    this.browserLanguages = options.browserLanguages ?? [];
    this.missingKeyMode = options.missingKeyMode ?? "marker";
    this.debug = options.debug ?? DEFAULT_DEBUG_OPTIONS;
    this.activeLocale = this.fallbackLocale;
  }

  /** Resolve the boot locale (§12.1) and load it plus the fallback. */
  async initialize(): Promise<LocaleCode> {
    await this.ensureBundle(this.fallbackLocale);
    const resolved = resolveInitialLocale({
      forcedLocale: this.debug.forcedLocale,
      savedLocale: this.readSavedLocale(),
      browserLanguages: this.browserLanguages,
      fallbackLocale: this.fallbackLocale,
    });
    await this.setLocale(resolved, { persist: false });
    return this.activeLocale;
  }

  /**
   * Switch language without a page reload — Plan §13. The bundle is in memory
   * before `localeChanged` fires, so a listener may re-render synchronously.
   */
  async setLocale(code: LocaleCode, options: SetLocaleOptions = {}): Promise<void> {
    const descriptor = localeDescriptor(code);
    if (!descriptor) {
      this.report({
        kind: "load-failed",
        locale: code,
        key: "",
        detail: "locale is not in the registry",
      });
      if (this.activeLocale !== this.fallbackLocale) {
        await this.setLocale(this.fallbackLocale, options);
      }
      return;
    }
    await this.ensureBundle(code);
    if (options.persist !== false) this.preferences?.write(code);
    if (this.activeLocale === code) return;
    const previousLocale = this.activeLocale;
    this.activeLocale = code;
    const event: LocaleChangedEvent = { locale: code, previousLocale, descriptor };
    for (const listener of [...this.listeners]) listener(event);
  }

  getLocale(): LocaleCode {
    return this.activeLocale;
  }

  getDescriptor(): LocaleDescriptor {
    return localeDescriptor(this.activeLocale) ?? localeDescriptor(SOURCE_LOCALE)!;
  }

  /** Locales the player may choose — Plan §27's picker feeds off this. */
  availableLocales(): readonly LocaleDescriptor[] {
    return selectableLocales();
  }

  onLocaleChanged(listener: LocaleChangedListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Key display mode — Plan §20, and the hook the smoke suite asserts through. */
  setDisplayMode(mode: LocalizationDisplayMode): void {
    this.debug = { ...this.debug, displayMode: mode };
  }

  getDisplayMode(): LocalizationDisplayMode {
    return this.debug.displayMode;
  }

  has(key: string): boolean {
    return this.lookup(key) !== null;
  }

  /**
   * Resolve and format one key.
   *
   * Never throws: a broken pattern, a missing parameter or a missing key each
   * produce a visible marker and a reported issue. Text is the last thing that
   * should take a match down.
   */
  t(key: string, params: TranslationParams = {}): string {
    if (this.debug.displayMode === "keys") return key;
    const hit = this.lookup(key);
    if (!hit) {
      if (!this.missing.has(key)) {
        this.missing.add(key);
        this.report({ kind: "missing-key", locale: this.activeLocale, key });
      }
      return this.missingKeyMode === "marker" ? missingKeyMarker(key) : key;
    }
    if (hit.locale !== this.activeLocale) {
      this.report({
        kind: "fallback-used",
        locale: this.activeLocale,
        key,
        detail: `served from ${hit.locale}`,
      });
    }
    // Format in the locale the *text* came from: an English fallback string
    // needs English plural rules, not the active locale's.
    const intlLocale = localeDescriptor(hit.locale)?.intlLocale ?? hit.locale;
    try {
      return formatMessage(hit.value, intlLocale, params, (issue) => {
        this.report({
          kind: "missing-parameter",
          locale: hit.locale,
          key,
          detail: issue.detail ?? `parameter "${issue.name}"`,
        });
      });
    } catch (error) {
      if (error instanceof LocalizationSyntaxError) {
        this.report({ kind: "syntax", locale: hit.locale, key, detail: error.message });
        return this.missingKeyMode === "marker" ? missingKeyMarker(key) : key;
      }
      throw error;
    }
  }

  /** Locale-aware number output for call sites that have no sentence (Plan §11.2). */
  formatNumber(value: number, style: NumberStyle = "decimal"): string {
    return formatNumber(this.getDescriptor().intlLocale, value, style);
  }

  formatPercent(ratio: number): string {
    return formatPercent(this.getDescriptor().intlLocale, ratio);
  }

  formatList(items: readonly string[], type: "conjunction" | "disjunction" = "conjunction"): string {
    return formatList(this.getDescriptor().intlLocale, items, type);
  }

  /** Keys that resolved nowhere this session — Plan §19.1's runtime counterpart. */
  missingKeys(): readonly string[] {
    return [...this.missing].sort((left, right) => left.localeCompare(right));
  }

  resetMissingKeys(): void {
    this.missing.clear();
  }

  private lookup(key: string): { readonly locale: LocaleCode; readonly value: string } | null {
    for (const locale of fallbackChain(this.activeLocale)) {
      const value = this.bundles.get(locale)?.entries.get(key);
      if (value !== undefined) return { locale, value };
    }
    return null;
  }

  private async ensureBundle(code: LocaleCode): Promise<void> {
    if (this.bundles.has(code)) return;
    if (code === PSEUDO_LOCALE) {
      await this.ensureBundle(this.fallbackLocale);
      const source = this.bundles.get(this.fallbackLocale);
      if (source) this.bundles.set(code, createPseudoBundle(source, code));
      return;
    }
    const report: LocalizationIssueReporter = (issue) => this.report(issue);
    const files = await this.loadDomains(code);
    this.bundles.set(code, mergeLocaleDomains(code, files, report));
  }

  private readSavedLocale(): LocaleCode | null {
    try {
      return this.preferences?.read() ?? null;
    } catch (error) {
      log.warn(`Locale preference read failed: ${String(error)}`);
      return null;
    }
  }

  private report(issue: LocalizationIssue): void {
    this.onIssue?.(issue);
    if (issue.kind === "fallback-used") {
      log.debug(`localization: ${issue.key} fell back (${issue.detail ?? ""})`);
      return;
    }
    log.warn(
      `localization ${issue.kind}: ${issue.locale}${issue.key ? ` / ${issue.key}` : ""}${
        issue.detail ? ` — ${issue.detail}` : ""
      }`,
    );
  }
}

let activeService: LocalizationService | null = null;
let warnedAboutMissingService = false;

/**
 * Publish the service the bare {@link t} helper reads.
 *
 * The ~530 call sites Faz 2 will touch should not each thread a service
 * reference through their constructor; one ambient instance, set once at boot,
 * is the pragmatic shape. Tests set it explicitly and clear it after.
 */
export function setActiveLocalization(service: LocalizationService | null): void {
  activeService = service;
  if (service !== null) warnedAboutMissingService = false;
}

export function getActiveLocalization(): LocalizationService | null {
  return activeService;
}

/**
 * Translate through the ambient service — Plan §6.2's `t("building.barracks.name")`.
 *
 * Before boot (or in a unit test that forgot to install one) this returns the
 * missing marker and warns once, rather than throwing: a stray early call must
 * not be able to take the game down.
 */
export function t(key: string, params: TranslationParams = {}): string {
  if (activeService === null) {
    if (!warnedAboutMissingService) {
      warnedAboutMissingService = true;
      log.warn("localization: t() called before a service was installed");
    }
    return missingKeyMarker(key);
  }
  return activeService.t(key, params);
}
