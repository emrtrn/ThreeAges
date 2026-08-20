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
const CJK_FONT_FILES = [
  "public/assets/ui/fonts/NotoSansSC-cjk-400.ttf",
  "public/assets/ui/fonts/NotoSansSC-cjk-700.ttf",
] as const;

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

type CmapLookup = (codePoint: number) => boolean;

function isHanIdeograph(codePoint: number): boolean {
  return (codePoint >= 0x3400 && codePoint <= 0x4dbf)
    || (codePoint >= 0x4e00 && codePoint <= 0x9fff)
    || (codePoint >= 0xf900 && codePoint <= 0xfaff)
    || (codePoint >= 0x20000 && codePoint <= 0x2fa1f);
}

/** Read the two Unicode cmap forms that a TrueType subset can use (formats 4 and 12). */
function cmapLookups(fontPath: string, errors: string[]): readonly CmapLookup[] {
  if (!existsSync(fontPath)) {
    fail(errors, `zh-CN font is missing: ${fontPath}`);
    return [];
  }
  const font = readFileSync(fontPath);
  const u16 = (offset: number): number => font.readUInt16BE(offset);
  const u32 = (offset: number): number => font.readUInt32BE(offset);
  let cmapOffset = -1;
  try {
    const tableCount = u16(4);
    for (let index = 0; index < tableCount; index += 1) {
      const record = 12 + index * 16;
      if (font.toString("ascii", record, record + 4) === "cmap") {
        cmapOffset = u32(record + 8);
        break;
      }
    }
    if (cmapOffset < 0) throw new Error("cmap table not found");
    const encodingCount = u16(cmapOffset + 2);
    const lookups: CmapLookup[] = [];
    for (let index = 0; index < encodingCount; index += 1) {
      const record = cmapOffset + 4 + index * 8;
      const subtable = cmapOffset + u32(record + 4);
      const format = u16(subtable);
      if (format === 12) {
        const groupCount = u32(subtable + 12);
        const groups = subtable + 16;
        lookups.push((codePoint) => {
          for (let group = 0; group < groupCount; group += 1) {
            const offset = groups + group * 12;
            if (codePoint >= u32(offset) && codePoint <= u32(offset + 4)) return true;
          }
          return false;
        });
      } else if (format === 4) {
        const segmentCount = u16(subtable + 6) / 2;
        const endCodes = subtable + 14;
        const startCodes = endCodes + segmentCount * 2 + 2;
        const deltas = startCodes + segmentCount * 2;
        const rangeOffsets = deltas + segmentCount * 2;
        lookups.push((codePoint) => {
          if (codePoint > 0xffff) return false;
          for (let segment = 0; segment < segmentCount; segment += 1) {
            const end = u16(endCodes + segment * 2);
            if (codePoint > end) continue;
            const start = u16(startCodes + segment * 2);
            if (codePoint < start) return false;
            const delta = u16(deltas + segment * 2);
            const rangeOffsetAddress = rangeOffsets + segment * 2;
            const rangeOffset = u16(rangeOffsetAddress);
            const glyph = rangeOffset === 0
              ? (codePoint + delta) & 0xffff
              : u16(rangeOffsetAddress + rangeOffset + (codePoint - start) * 2);
            return glyph !== 0;
          }
          return false;
        });
      }
    }
    if (lookups.length === 0) throw new Error("no Unicode cmap subtable (expected format 4 or 12)");
    return lookups;
  } catch (error) {
    fail(errors, `cannot read zh-CN font cmap ${fontPath}: ${String(error)}`);
    return [];
  }
}

function validateCjkGlyphCoverage(entries: LocaleEntries, errors: string[]): number {
  const required = new Set<number>();
  for (const pattern of entries.values()) {
    for (const character of pattern) {
      const codePoint = character.codePointAt(0)!;
      if (isHanIdeograph(codePoint)) required.add(codePoint);
    }
  }
  for (const fontPath of CJK_FONT_FILES) {
    const lookups = cmapLookups(fontPath, errors);
    if (lookups.length === 0) continue;
    const missing = [...required].filter((codePoint) => !lookups.some((lookup) => lookup(codePoint)));
    if (missing.length > 0) {
      const names = missing.map((codePoint) => `U+${codePoint.toString(16).toUpperCase()}`);
      fail(errors, `zh-CN font ${fontPath} is missing shipped Han glyphs: ${list(names)}`);
    }
  }
  return required.size;
}

function main(): void {
  const errors: string[] = [];
  validateRegistry(errors);
  const bundles = new Map<LocaleCode, LocaleEntries>();
  for (const locale of TIER1_RELEASE_LOCALES) bundles.set(locale, readLocale(locale, errors));

  const source = bundles.get("en")!;
  for (const locale of TIER1_RELEASE_LOCALES) validateParity(locale, source, bundles.get(locale)!, errors);
  const cjkGlyphCount = validateCjkGlyphCoverage(bundles.get("zh-CN")!, errors);

  if (errors.length > 0) {
    console.error(`[locales] FAILED: ${errors.length} issue(s)`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[locales] OK: ${TIER1_RELEASE_LOCALES.length} release locales, ${source.size} keys each, ${LOCALE_DOMAINS.length} domains each; ${cjkGlyphCount} zh-CN Han glyphs covered at 400/700`);
}

main();
