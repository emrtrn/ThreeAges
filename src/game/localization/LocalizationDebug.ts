/**
 * Localization debug surfaces — Localization Plan §20.
 *
 * Three development-only behaviours, none of which ships to a player:
 *
 *  - **missing-key marker** — `⟦missing:key.path⟧` instead of a blank label;
 *  - **key display mode** — every lookup renders its own key, which is how a
 *    hardcoded string is spotted (it is the one line that does *not* change);
 *  - **pseudo-localization** (`qps-ploc`) — accented, ~35% longer text that
 *    exposes fixed-width UI before a real translation exists (Plan §15.1).
 *
 * Key display mode is also the contract the test suite leans on: inventory
 * §7.10 counts 294 assertions bound to visible Turkish text, and the Faz 1
 * decision is that tests assert the *key*, not the sentence, so retuning a
 * translation cannot turn the build red.
 *
 * Pure module — parses a query string handed to it rather than reading
 * `window`, so `test:engine` can drive it on node.
 */
import type { LocaleCode, LocalizationDisplayMode } from "./LocalizationTypes";

/** Windows/ICU convention for a pseudo-locale — Plan §20. */
export const PSEUDO_LOCALE: LocaleCode = "qps-ploc";

const MISSING_PREFIX = "⟦missing:";
const MISSING_SUFFIX = "⟧";

/** Marker shown when neither the active locale nor the fallback has the key. */
export function missingKeyMarker(key: string): string {
  return `${MISSING_PREFIX}${key}${MISSING_SUFFIX}`;
}

export function isMissingKeyMarker(value: string): boolean {
  return value.startsWith(MISSING_PREFIX) && value.endsWith(MISSING_SUFFIX);
}

const ACCENTS: Readonly<Record<string, string>> = {
  a: "à", b: "ƀ", c: "ç", d: "ð", e: "è", f: "ƒ", g: "ğ", h: "ĥ", i: "ì", j: "ĵ",
  k: "ķ", l: "ĺ", m: "ɱ", n: "ñ", o: "ò", p: "þ", q: "ɋ", r: "ŕ", s: "š", t: "ţ",
  u: "ù", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "À", B: "Ɓ", C: "Ç", D: "Ð", E: "È", F: "Ƒ", G: "Ğ", H: "Ĥ", I: "Ì", J: "Ĵ",
  K: "Ķ", L: "Ĺ", M: "Ṁ", N: "Ñ", O: "Ò", P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ",
  U: "Ù", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

/** Padding ratio — Plan §15.1's expansion budget for short UI strings. */
const EXPANSION_RATIO = 0.35;
const MIN_PADDING = 2;

/**
 * Accent and lengthen a message pattern without breaking it.
 *
 * Anything inside `{…}` is copied verbatim: placeholder names, plural
 * categories and number styles are syntax, not prose, and accenting them would
 * turn a layout test into a parse error. Text inside plural branches therefore
 * stays unaccented too — the length padding is applied to the whole string, so
 * the overflow signal survives.
 */
export function pseudoLocalize(pattern: string): string {
  let out = "";
  let depth = 0;
  let index = 0;
  let accentedLetters = 0;
  while (index < pattern.length) {
    const char = pattern[index]!;
    if (char === "'") {
      // Copy ICU quoted literals verbatim so `'{'` keeps escaping a brace.
      const next = pattern[index + 1];
      if (next === "{" || next === "}" || next === "#" || next === "|") {
        out += char;
        index += 1;
        while (index < pattern.length) {
          out += pattern[index]!;
          if (pattern[index] === "'" && pattern[index + 1] !== "'") {
            index += 1;
            break;
          }
          index += 1;
        }
        continue;
      }
      out += char;
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") depth = Math.max(0, depth - 1);
    if (depth > 0 || char === "}") {
      out += char;
      index += 1;
      continue;
    }
    const accented = ACCENTS[char];
    if (accented !== undefined) {
      out += accented;
      accentedLetters += 1;
    } else {
      out += char;
    }
    index += 1;
  }
  const padding = "ẍ".repeat(Math.max(MIN_PADDING, Math.ceil(accentedLetters * EXPANSION_RATIO)));
  return `[!! ${out} ${padding} !!]`;
}

export interface LocalizationDebugOptions {
  /** `?locale=tr` — overrides the saved preference and browser detection. */
  readonly forcedLocale: LocaleCode | null;
  /** `?loc-debug=keys` — render keys instead of text. */
  readonly displayMode: LocalizationDisplayMode;
}

export const DEFAULT_DEBUG_OPTIONS: LocalizationDebugOptions = {
  forcedLocale: null,
  displayMode: "translated",
};

/**
 * Read the debug switches from a URL query string.
 *
 * `?locale=qps-ploc` deliberately reaches a registry entry that is *not*
 * enabled: the pseudo-locale is never offered in the language picker, but a
 * developer (and the smoke suite) must be able to ask for it by URL.
 */
export function parseLocalizationDebugOptions(search: string): LocalizationDebugOptions {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const forced = query.get("locale");
  const mode = query.get("loc-debug");
  return {
    forcedLocale: forced !== null && forced.trim().length > 0 ? forced.trim() : null,
    displayMode: mode === "keys" ? "keys" : "translated",
  };
}
