/**
 * Localization types — Localization Plan §6, §7, §8.
 *
 * Shared vocabulary for the localization stack: locale metadata, bundles,
 * message parameters and the issues the service reports. Pure types plus a few
 * frozen constants; no DOM, no fetch, no three.js, so `test:engine` can exercise
 * every consumer on node.
 *
 * Two rules from the plan are encoded here rather than left to convention:
 *  - keys are *full dotted paths* (`building.lumber_camp.name`), never derived
 *    from visible text (§3.1, §8.1);
 *  - a domain file is a delivery/QA unit, not a key prefix — `errors.json`
 *    holds `placement.error.*` and `road.hint.*` alike (inventory §9.1).
 */

/** BCP-47 locale code as used by the registry and the locale folders. */
export type LocaleCode = string;

export type LocaleDirection = "ltr" | "rtl";

/** Font coverage group — Plan §14.1. Drives which webfont a locale needs. */
export type LocaleFontGroup = "latin" | "latin-cyrillic" | "cjk";

/** Release wave — Plan §4. `dev` is the always-on en/tr pair. */
export type LocaleTier = "dev" | "tier1" | "tier2" | "tier3" | "debug";

/** Registry record for one supported (or planned) locale — Plan §6.3. */
export interface LocaleDescriptor {
  readonly code: LocaleCode;
  /** Name shown in the language picker, written in that language (Plan §27). */
  readonly nativeName: string;
  /** Name used in docs, translation packages and tooling. */
  readonly englishName: string;
  /** Next locale in the fallback chain; `null` only for the source locale. */
  readonly fallback: LocaleCode | null;
  readonly tier: LocaleTier;
  readonly fontGroup: LocaleFontGroup;
  readonly direction: LocaleDirection;
  /** Selectable by the player. Planned locales stay registered but disabled. */
  readonly enabled: boolean;
  /**
   * Browser tags this locale *claims* during auto-detection (Plan §12.1 warns
   * against blindly mapping similar locales — every claim here is deliberate).
   */
  readonly browserTags: readonly string[];
  /** Locale handed to `Intl` — pseudo-locales borrow a real one. */
  readonly intlLocale: string;
}

/**
 * Domain files, in load order — inventory §9.1. Splitting by domain keeps merge
 * conflicts and translation packages small (Plan §7.2); `selection` alone is
 * ~35% of the string count, which is the concrete argument against one big file.
 */
export const LOCALE_DOMAINS = [
  "common",
  "menu",
  "hud",
  "buildings",
  "errors",
  "selection",
  "notifications",
  "objectives",
  "match",
  "units",
] as const;

export type LocaleDomain = (typeof LOCALE_DOMAINS)[number];

/** One `<locale>/<domain>.json` file: flat, full-key entries. */
export interface LocaleDomainFile {
  readonly domain: LocaleDomain;
  readonly entries: Readonly<Record<string, string>>;
}

/** Every domain of one locale, merged and ready for lookup. */
export interface LocaleBundle {
  readonly locale: LocaleCode;
  readonly entries: ReadonlyMap<string, string>;
  /** Which domain each key came from — used by the validator and by debug UI. */
  readonly keyDomains: ReadonlyMap<string, LocaleDomain>;
}

/** Values interpolated into a message. Booleans are only useful for `select`. */
export type TranslationParams = Readonly<Record<string, string | number | boolean>>;

/** Loads the raw domain files of one locale. Injected so node tests can fake it. */
export type LocaleDomainsLoader = (locale: LocaleCode) => Promise<readonly LocaleDomainFile[]>;

/** What the player sees instead of a translation — Plan §20. */
export type LocalizationDisplayMode =
  /** Normal: the active locale's text. */
  | "translated"
  /** Every lookup renders its own key — the fastest way to spot hardcoded text. */
  | "keys";

export type LocalizationIssueKind =
  /** Key missing in the active locale; the fallback answered instead. */
  | "fallback-used"
  /** Key missing in the active locale *and* in the fallback. */
  | "missing-key"
  /** Message pattern could not be parsed (authoring error in the JSON). */
  | "syntax"
  /** Pattern referenced a parameter the caller did not pass. */
  | "missing-parameter"
  /** Two domain files of one locale declared the same key. */
  | "duplicate-key"
  /** A domain file failed to load or was not valid JSON. */
  | "load-failed";

export interface LocalizationIssue {
  readonly kind: LocalizationIssueKind;
  readonly locale: LocaleCode;
  readonly key: string;
  readonly detail?: string;
}

export type LocalizationIssueReporter = (issue: LocalizationIssue) => void;

/** Persisted player language choice — step 1 of the Plan §12.1 resolution order. */
export interface LocalePreferenceStore {
  read(): LocaleCode | null;
  write(locale: LocaleCode): void;
}

/** Emitted after the active locale changes and its bundle is in memory (§13). */
export interface LocaleChangedEvent {
  readonly locale: LocaleCode;
  readonly previousLocale: LocaleCode | null;
  readonly descriptor: LocaleDescriptor;
}

export type LocaleChangedListener = (event: LocaleChangedEvent) => void;
