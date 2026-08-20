/**
 * Tier 1 locale release validator — Localization Plan Faz 7 / §24.
 *
 * This deliberately runs outside the engine test harness: translation parity is
 * a release invariant and must fail an ordinary production build before a
 * fallback can reach a player. The formatter supplies placeholder extraction,
 * so this stays aligned with the ICU subset that the game actually renders.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { extractPlaceholders } from "../src/game/localization/LocalizationFormatter";
import { localeRegistry } from "../src/game/localization/localeRegistry";
import { LOCALE_DOMAINS, type LocaleCode } from "../src/game/localization/LocalizationTypes";

const LOCALES_ROOT = "public/game-data/locales";
const TIER1_RELEASE_LOCALES = ["en", "tr", "zh-CN", "ru", "es-ES", "pt-BR", "de", "fr"] as const;

type LocaleEntries = ReadonlyMap<string, string>;

function fail(errors: string[], message: string): void {
  errors.push(message);
}

function list(items: Iterable<string>): string {
  return [...items].sort((left, right) => left.localeCompare(right)).join(", ");
}

function readLocale(locale: LocaleCode, errors: string[]): LocaleEntries {
  const entries = new Map<string, string>();
  const directory = join(LOCALES_ROOT, locale);
  if (!existsSync(directory)) {
    fail(errors, `${locale}: missing locale directory`);
    return entries;
  }

  const expectedFiles = new Set(LOCALE_DOMAINS.map((domain) => `${domain}.json`));
  for (const file of readdirSync(directory)) {
    if (file.endsWith(".json") && !expectedFiles.has(file)) {
      fail(errors, `${locale}: unexpected locale domain ${file}`);
    }
  }

  for (const domain of LOCALE_DOMAINS) {
    const file = join(directory, `${domain}.json`);
    if (!existsSync(file)) {
      fail(errors, `${locale}: missing ${domain}.json`);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      fail(errors, `${locale}/${domain}.json: invalid JSON (${String(error)})`);
      continue;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      fail(errors, `${locale}/${domain}.json: expected a flat object of key -> string`);
      continue;
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "string") {
        fail(errors, `${locale}/${domain}.json: ${key} must be a string`);
        continue;
      }
      if (key.trim().length === 0 || value.trim().length === 0) {
        fail(errors, `${locale}/${domain}.json: ${key || "<empty key>"} must not be blank`);
        continue;
      }
      if (entries.has(key)) {
        fail(errors, `${locale}: ${key} is declared more than once across locale domains`);
        continue;
      }
      entries.set(key, value);
    }
  }
  return entries;
}

function validateRegistry(errors: string[]): void {
  const enabledReleaseCodes = localeRegistry()
    .filter((locale) => locale.enabled && (locale.tier === "dev" || locale.tier === "tier1"))
    .map((locale) => locale.code);
  const expected = new Set<string>(TIER1_RELEASE_LOCALES);
  const actual = new Set(enabledReleaseCodes);
  const missing = TIER1_RELEASE_LOCALES.filter((locale) => !actual.has(locale));
  const unexpected = enabledReleaseCodes.filter((locale) => !expected.has(locale));
  if (missing.length > 0) fail(errors, `registry: enabled Tier 1 release locales missing: ${list(missing)}`);
  if (unexpected.length > 0) fail(errors, `registry: unexpected enabled release locales: ${list(unexpected)}`);
}

function validateParity(locale: string, source: LocaleEntries, candidate: LocaleEntries, errors: string[]): void {
  const missing = [...source.keys()].filter((key) => !candidate.has(key));
  const unexpected = [...candidate.keys()].filter((key) => !source.has(key));
  if (missing.length > 0) fail(errors, `${locale}: missing keys: ${list(missing)}`);
  if (unexpected.length > 0) fail(errors, `${locale}: unexpected keys: ${list(unexpected)}`);

  for (const [key, sourcePattern] of source) {
    const candidatePattern = candidate.get(key);
    if (candidatePattern === undefined) continue;
    try {
      const sourcePlaceholders = extractPlaceholders(sourcePattern);
      const candidatePlaceholders = extractPlaceholders(candidatePattern);
      if (sourcePlaceholders.join("\u0000") !== candidatePlaceholders.join("\u0000")) {
        fail(
          errors,
          `${locale}: placeholder mismatch for ${key} (expected ${list(sourcePlaceholders) || "none"}; got ${list(candidatePlaceholders) || "none"})`,
        );
      }
    } catch (error) {
      fail(errors, `${locale}: invalid ICU message for ${key} (${String(error)})`);
    }
  }
}

function main(): void {
  const errors: string[] = [];
  validateRegistry(errors);
  const bundles = new Map<LocaleCode, LocaleEntries>();
  for (const locale of TIER1_RELEASE_LOCALES) bundles.set(locale, readLocale(locale, errors));

  const source = bundles.get("en")!;
  for (const locale of TIER1_RELEASE_LOCALES) validateParity(locale, source, bundles.get(locale)!, errors);

  if (errors.length > 0) {
    console.error(`[locales] FAILED: ${errors.length} issue(s)`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[locales] OK: ${TIER1_RELEASE_LOCALES.length} release locales, ${source.size} keys each, ${LOCALE_DOMAINS.length} domains each`);
}

main();
