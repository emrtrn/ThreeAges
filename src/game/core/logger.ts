/**
 * Category logger — Vertical Slice Plan v0.2 §14.
 *
 * Small, dependency-free logging with per-category level gating. Runtime/system
 * diagnostics go here; they are kept separate from player-facing messages (plan
 * §14: "Runtime hata mesajları oyuncu mesajlarından ayrılmalı"). Player HUD
 * notifications are a UI concern and must NOT be routed through this logger.
 *
 * Debug builds default to the `debug` threshold (verbose); release builds
 * default to `warn` (quiet unless something is wrong). The minimum level can be
 * lowered/raised at boot via setLogLevel.
 *
 * Pure TS: uses the console only; no three.js / DOM-render imports.
 */

export const LOG_CATEGORIES = [
  "System",
  "Data",
  "Economy",
  "Logistics",
  "Combat",
  "AI",
  "UI",
] as const;

export type LogCategory = (typeof LOG_CATEGORIES)[number];

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let minLevel: LogLevel = "info";

/** Set the global minimum level. Boot code picks this from RuntimeConfig
 *  (debug → "debug", release → "warn"). */
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function getLogLevel(): LogLevel {
  return minLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function emit(
  level: LogLevel,
  category: LogCategory,
  message: string,
  detail?: unknown,
): void {
  if (!shouldLog(level)) return;
  const tag = `[${category}]`;
  const sink =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;
  if (detail === undefined) sink(tag, message);
  else sink(tag, message, detail);
}

export interface CategoryLogger {
  debug(message: string, detail?: unknown): void;
  info(message: string, detail?: unknown): void;
  warn(message: string, detail?: unknown): void;
  error(message: string, detail?: unknown): void;
}

/** Get a logger bound to one category, e.g. `const log = logger("Economy")`. */
export function logger(category: LogCategory): CategoryLogger {
  return {
    debug: (message, detail) => emit("debug", category, message, detail),
    info: (message, detail) => emit("info", category, message, detail),
    warn: (message, detail) => emit("warn", category, message, detail),
    error: (message, detail) => emit("error", category, message, detail),
  };
}
