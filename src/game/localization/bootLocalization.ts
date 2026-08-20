/**
 * Localization boot wiring — Localization Plan §12.1, §13.
 *
 * The one browser-facing seam of the localization stack: it reads `?locale=`,
 * `navigator.languages` and the persisted `UserSettings.locale`, builds the
 * service around the fetch loader and installs it as the ambient `t()` source.
 *
 * It is a seventh file next to the six the plan names (§33) on purpose. The
 * service, registry, loader, formatter and debug modules stay pure and node-
 * testable; everything that can only exist in a browser — `window`,
 * `navigator`, `localStorage` — is collected here, and nowhere else.
 */
import { createLocalStorageAdapter } from "@engine/persistence/saveGameStore";
import { UserSettingsStore } from "@engine/persistence/userSettingsStore";
import { logger } from "../core/logger";
import { parseLocalizationDebugOptions } from "./LocalizationDebug";
import { loadLocaleDomains } from "./LocalizationLoader";
import {
  LocalizationService,
  setActiveLocalization,
  type MissingKeyMode,
} from "./LocalizationService";
import type { LocalePreferenceStore } from "./LocalizationTypes";

const log = logger("UI");

/**
 * `UserSettings.locale` is the slotless preference document the audio mix and
 * the graphics profile already share — a language choice belongs with them, not
 * in a key of its own. Storage can be disabled (private mode, embedded
 * browsers); the game then runs in the resolved locale without remembering it.
 */
function localePreferences(): LocalePreferenceStore | null {
  let store: UserSettingsStore;
  try {
    store = new UserSettingsStore({ storage: createLocalStorageAdapter(window.localStorage) });
  } catch {
    return null;
  }
  return {
    read: () => store.read().locale,
    write: (locale) => {
      store.setLocale(locale);
    },
  };
}

function browserLanguages(): readonly string[] {
  const languages = navigator.languages;
  if (Array.isArray(languages) && languages.length > 0) return languages;
  return navigator.language ? [navigator.language] : [];
}

/**
 * Reflect the active locale on the document root. CSS owns the actual font
 * stack, while the registry remains the single source of truth for script
 * coverage and direction. This makes `LocaleDescriptor.fontGroup` a runtime
 * contract instead of unused metadata.
 */
function applyLocaleDocumentAttributes(service: LocalizationService): void {
  const descriptor = service.getDescriptor();
  const root = document.documentElement;
  root.lang = descriptor.intlLocale;
  root.dir = descriptor.direction;
  root.dataset.locale = descriptor.code;
  root.dataset.localeFontGroup = descriptor.fontGroup;
}

/**
 * Build the service, resolve the boot locale and load its bundle.
 *
 * Never throws: a locale file that 404s is reported and leaves the fallback
 * chain to answer, because text is the last thing that should be able to stop
 * the game from booting.
 */
export async function bootLocalization(): Promise<LocalizationService> {
  const preferences = localePreferences();
  // A player never sees `⟦missing:…⟧`; a developer must not be able to miss it.
  const missingKeyMode: MissingKeyMode = import.meta.env.DEV ? "marker" : "key";
  const service = new LocalizationService({
    loadDomains: (locale) => loadLocaleDomains(locale),
    debug: parseLocalizationDebugOptions(location.search),
    browserLanguages: browserLanguages(),
    missingKeyMode,
    ...(preferences ? { preferences } : {}),
  });
  const locale = await service.initialize();
  setActiveLocalization(service);
  applyLocaleDocumentAttributes(service);
  service.onLocaleChanged(() => applyLocaleDocumentAttributes(service));
  log.info(`localization ready (${locale})`);
  if (import.meta.env.DEV) {
    (window as unknown as { __forgeLocalization?: unknown }).__forgeLocalization = service;
  }
  return service;
}
