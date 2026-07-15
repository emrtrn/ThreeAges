/**
 * Global runtime error capture — Vertical Slice Plan v0.2 §14.
 *
 * Installs window-level handlers so uncaught errors and unhandled promise
 * rejections are routed through the System logger instead of dying silently in
 * the console. These are *runtime diagnostics*, kept separate from player-facing
 * messages (plan §14); surfacing an error to the player is a UI concern.
 *
 * Idempotent: calling install twice is a no-op.
 */
import { logger } from "./logger";

const log = logger("System");
let installed = false;

/** Attach `error` + `unhandledrejection` listeners once. Returns an uninstall
 *  function (useful for tests / hot reload). */
export function installGlobalErrorHandlers(): () => void {
  if (installed || typeof window === "undefined") {
    return () => {};
  }
  installed = true;

  const onError = (event: ErrorEvent): void => {
    log.error(
      `Uncaught error: ${event.message}`,
      event.error ?? `${event.filename}:${event.lineno}:${event.colno}`,
    );
  };

  const onRejection = (event: PromiseRejectionEvent): void => {
    log.error("Unhandled promise rejection", event.reason);
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    installed = false;
  };
}
