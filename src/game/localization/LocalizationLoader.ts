/**
 * Locale bundle loading — Localization Plan §7.
 *
 * Fetches `public/game-data/locales/<locale>/<domain>.json` and merges the
 * domain files into one lookup map. Base-path handling mirrors
 * `src/game/data/gameDataLoader.ts`, which is the project's other public-root
 * JSON reader.
 *
 * Two shape rules, both from the plan, are enforced here rather than left to
 * convention:
 *  - files hold **flat, full keys** (`"building.lumber_camp.name": "…"`), so a
 *    key can be grepped in one step and a domain file stays a delivery unit
 *    rather than a namespace (Plan §7.2, inventory §9.1);
 *  - a key declared twice across a locale's domains is an error, not a
 *    last-write-wins accident — the whole point of splitting the files is that
 *    two translators can work without silently overwriting each other.
 *
 * A missing or malformed domain file is reported and treated as empty: §12.2's
 * fallback chain is what covers a gap at runtime, and Plan §19's validator is
 * what fails the build for it. The game does not crash over a translation file.
 */
import {
  LOCALE_DOMAINS,
  type LocaleBundle,
  type LocaleCode,
  type LocaleDomain,
  type LocaleDomainFile,
  type LocalizationIssueReporter,
} from "./LocalizationTypes";
import { pseudoLocalize } from "./LocalizationDebug";

/**
 * Resolved lazily, not at module scope: `test:engine` imports the pure helpers
 * below on node, where `import.meta.env` does not exist. Only the fetch path
 * needs a base URL, so only the fetch path asks for one.
 */
function localesRoot(): string {
  const base = import.meta.env.BASE_URL;
  return `${base.endsWith("/") ? base : `${base}/`}game-data/locales`;
}

/** Public-root-relative path of one domain file — shared with the validator. */
export function localeDomainPath(locale: LocaleCode, domain: LocaleDomain): string {
  return `game-data/locales/${locale}/${domain}.json`;
}

/**
 * Coerce one parsed JSON file into entries, dropping anything that is not a
 * string. A nested object here means someone authored the file in the wrong
 * shape; it is reported so the validator's later hard-fail is not a surprise.
 */
export function readLocaleDomainEntries(
  locale: LocaleCode,
  domain: LocaleDomain,
  parsed: unknown,
  report?: LocalizationIssueReporter,
): Readonly<Record<string, string>> {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    report?.({
      kind: "load-failed",
      locale,
      key: domain,
      detail: `${localeDomainPath(locale, domain)} must be a JSON object of key -> string`,
    });
    return {};
  }
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "string") {
      report?.({
        kind: "load-failed",
        locale,
        key,
        detail: `${localeDomainPath(locale, domain)} holds a ${typeof value}; locale files are flat key -> string`,
      });
      continue;
    }
    entries[key] = value;
  }
  return entries;
}

/** Merge a locale's domain files into one bundle, refusing duplicate keys. */
export function mergeLocaleDomains(
  locale: LocaleCode,
  files: readonly LocaleDomainFile[],
  report?: LocalizationIssueReporter,
): LocaleBundle {
  const entries = new Map<string, string>();
  const keyDomains = new Map<string, LocaleDomain>();
  for (const file of files) {
    for (const [key, value] of Object.entries(file.entries)) {
      const owner = keyDomains.get(key);
      if (owner !== undefined) {
        report?.({
          kind: "duplicate-key",
          locale,
          key,
          detail: `declared in both ${owner}.json and ${file.domain}.json`,
        });
        continue;
      }
      entries.set(key, value);
      keyDomains.set(key, file.domain);
    }
  }
  return { locale, entries, keyDomains };
}

async function fetchDomain(
  locale: LocaleCode,
  domain: LocaleDomain,
  report?: LocalizationIssueReporter,
): Promise<LocaleDomainFile | null> {
  const url = `${localesRoot()}/${locale}/${domain}.json`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      report?.({
        kind: "load-failed",
        locale,
        key: domain,
        detail: `${response.status} ${response.statusText} (${url})`,
      });
      return null;
    }
    const parsed = (await response.json()) as unknown;
    return { domain, entries: readLocaleDomainEntries(locale, domain, parsed, report) };
  } catch (error) {
    report?.({
      kind: "load-failed",
      locale,
      key: domain,
      detail: `${String(error)} (${url})`,
    });
    return null;
  }
}

/**
 * Browser loader for one locale: every domain, in parallel.
 *
 * Injected into {@link LocalizationService} rather than imported by it, so node
 * checks can hand the service a fixture bundle without a fetch shim.
 */
export async function loadLocaleDomains(
  locale: LocaleCode,
  report?: LocalizationIssueReporter,
): Promise<readonly LocaleDomainFile[]> {
  const files = await Promise.all(
    LOCALE_DOMAINS.map((domain) => fetchDomain(locale, domain, report)),
  );
  return files.filter((file): file is LocaleDomainFile => file !== null);
}

/**
 * Derive the pseudo-locale from an already loaded source bundle — Plan §20.
 *
 * It is generated, never authored: a checked-in `qps-ploc` folder would go stale
 * the moment a key is added, and a stale pseudo-locale tests the wrong layout.
 */
export function createPseudoBundle(source: LocaleBundle, locale: LocaleCode): LocaleBundle {
  const entries = new Map<string, string>();
  for (const [key, value] of source.entries) entries.set(key, pseudoLocalize(value));
  return { locale, entries, keyDomains: source.keyDomains };
}
