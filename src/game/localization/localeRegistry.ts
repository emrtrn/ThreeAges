/**
 * Locale registry — Localization Plan §6.3.
 *
 * One place that knows which locales exist, what they are called, how they fall
 * back and which browser tags they claim. Plan §6.3: "Desteklenen diller kod
 * içine dağınık olarak yazılmamalıdır."
 *
 * Registered ≠ shipped. Tier 1/2 locales are declared here so the fallback
 * chain, the font grouping and the browser-tag claims are decided once and
 * reviewable, but only `enabled` locales are selectable and only they get a
 * folder under `public/game-data/locales/` (Plan §33: no empty placeholder
 * folders before real production starts).
 *
 * `browserTags` is deliberately narrow. Plan §12.1 warns against mapping every
 * similar locale to each other: `pt-PT` is *not* claimed by `pt-BR`, and
 * `zh-Hant` is *not* claimed by `zh-CN` (§12.2).
 */
import { PSEUDO_LOCALE } from "./LocalizationDebug";
import type { LocaleCode, LocaleDescriptor } from "./LocalizationTypes";

/** Technical source of truth and end of every fallback chain — Plan §3.1. */
export const SOURCE_LOCALE: LocaleCode = "en";

const REGISTRY: readonly LocaleDescriptor[] = [
  {
    code: "en",
    nativeName: "English",
    englishName: "English",
    fallback: null,
    tier: "dev",
    fontGroup: "latin",
    direction: "ltr",
    enabled: true,
    browserTags: ["en"],
    intlLocale: "en",
  },
  {
    code: "tr",
    nativeName: "Türkçe",
    englishName: "Turkish",
    fallback: "en",
    tier: "dev",
    fontGroup: "latin",
    direction: "ltr",
    enabled: true,
    browserTags: ["tr"],
    intlLocale: "tr",
  },
  {
    code: "de",
    nativeName: "Deutsch",
    englishName: "German",
    fallback: "en",
    tier: "tier1",
    fontGroup: "latin",
    direction: "ltr",
    enabled: false,
    browserTags: ["de"],
    intlLocale: "de",
  },
  {
    code: "fr",
    nativeName: "Français",
    englishName: "French",
    fallback: "en",
    tier: "tier1",
    fontGroup: "latin",
    direction: "ltr",
    enabled: false,
    browserTags: ["fr"],
    intlLocale: "fr",
  },
  {
    code: "es-ES",
    nativeName: "Español (España)",
    englishName: "Spanish (Spain)",
    fallback: "en",
    tier: "tier1",
    fontGroup: "latin",
    direction: "ltr",
    enabled: false,
    // Claims bare `es` only until es-419 ships; Plan §4.4 lists es-419 as Tier 2.
    browserTags: ["es"],
    intlLocale: "es-ES",
  },
  {
    code: "pt-BR",
    nativeName: "Português (Brasil)",
    englishName: "Portuguese (Brazil)",
    fallback: "en",
    tier: "tier1",
    fontGroup: "latin",
    direction: "ltr",
    enabled: false,
    // `pt-PT` is intentionally absent — Plan §12.1's worked example.
    browserTags: ["pt", "pt-BR"],
    intlLocale: "pt-BR",
  },
  {
    code: "ru",
    nativeName: "Русский",
    englishName: "Russian",
    fallback: "en",
    tier: "tier1",
    fontGroup: "latin-cyrillic",
    direction: "ltr",
    enabled: false,
    browserTags: ["ru"],
    intlLocale: "ru",
  },
  {
    code: "zh-CN",
    nativeName: "简体中文",
    englishName: "Simplified Chinese",
    fallback: "en",
    tier: "tier1",
    fontGroup: "cjk",
    direction: "ltr",
    enabled: false,
    // Simplified script tags only — Plan §12.2 refuses zh-TW → zh-CN.
    browserTags: ["zh", "zh-CN", "zh-Hans"],
    intlLocale: "zh-CN",
  },
  {
    code: PSEUDO_LOCALE,
    nativeName: "Pseudo-localization",
    englishName: "Pseudo-localization",
    fallback: "en",
    tier: "debug",
    fontGroup: "latin",
    direction: "ltr",
    // Plan §20: development only, never offered to the player. Reachable through
    // `?locale=qps-ploc`, which bypasses the enabled check on purpose.
    enabled: false,
    browserTags: [],
    intlLocale: "en",
  },
];

export function localeRegistry(): readonly LocaleDescriptor[] {
  return REGISTRY;
}

/** Locales the player may pick — Plan §27's language list. */
export function selectableLocales(): readonly LocaleDescriptor[] {
  return REGISTRY.filter((entry) => entry.enabled);
}

export function localeDescriptor(code: LocaleCode): LocaleDescriptor | null {
  return REGISTRY.find((entry) => entry.code === code) ?? null;
}

export function isKnownLocale(code: LocaleCode): boolean {
  return localeDescriptor(code) !== null;
}

/**
 * Fallback chain from `code` down to the source locale, `code` first.
 *
 * Plan §12.2 wants this simple and predictable, so the chain is whatever the
 * registry declares plus a guaranteed `en` tail; a cycle in the data stops the
 * walk instead of hanging.
 */
export function fallbackChain(code: LocaleCode): readonly LocaleCode[] {
  const chain: LocaleCode[] = [];
  const seen = new Set<LocaleCode>();
  let current: LocaleCode | null = code;
  while (current !== null && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = localeDescriptor(current)?.fallback ?? null;
  }
  if (!seen.has(SOURCE_LOCALE)) chain.push(SOURCE_LOCALE);
  return chain;
}

/**
 * Best registered locale for a browser preference list — Plan §12.1 steps 2–3.
 *
 * Exact code wins over a declared `browserTags` claim, and an earlier browser
 * preference wins over a later one. Unclaimed tags return `null` rather than
 * guessing: an unmapped `pt-PT` player gets English, not surprise Brazilian
 * Portuguese.
 */
export function matchBrowserLocale(
  languages: readonly string[],
  options: { readonly enabledOnly?: boolean } = {},
): LocaleCode | null {
  const enabledOnly = options.enabledOnly ?? true;
  const candidates = enabledOnly ? selectableLocales() : REGISTRY;
  for (const raw of languages) {
    const tag = raw.trim();
    if (tag.length === 0) continue;
    const lowered = tag.toLowerCase();
    const exact = candidates.find((entry) => entry.code.toLowerCase() === lowered);
    if (exact) return exact.code;
    const claimed = candidates.find((entry) =>
      entry.browserTags.some((claim) => claim.toLowerCase() === lowered),
    );
    if (claimed) return claimed.code;
    // Last resort, the language subtag — but only onto a locale whose *code* is
    // that bare language. `de-AT` → `de` is safe; `pt-PT` → `pt-BR` is exactly
    // the guess Plan §12.1 forbids, and a regional locale never absorbs another
    // region this way. A generic `pt` still reaches `pt-BR`, because `pt-BR`
    // claims it explicitly above.
    const language = lowered.split("-")[0] ?? "";
    if (language.length === 0 || language === lowered) continue;
    const byLanguage = candidates.find((entry) => entry.code.toLowerCase() === language);
    if (byLanguage) return byLanguage.code;
  }
  return null;
}
