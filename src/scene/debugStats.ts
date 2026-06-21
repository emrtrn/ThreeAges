/**
 * Tiny fps / draw-call readout for the HTML overlay (#debug-stats).
 * Enabled only with `?debug` in the URL so it never ships visible.
 * lil-gui (devDependency) is dynamically imported on demand later, when
 * scene parameters need live tweaking — keeps it out of the base bundle.
 */
import type { RuntimeStatsApp } from "./RuntimeSceneApp";

const UPDATE_INTERVAL_MS = 500;

export function attachDebugStats(app: RuntimeStatsApp, element: HTMLElement): void {
  let accumMs = 0;
  let frames = 0;

  app.onFrame = (deltaMs) => {
    accumMs += deltaMs;
    frames += 1;
    if (accumMs < UPDATE_INTERVAL_MS) return;

    const fps = (frames * 1000) / accumMs;
    const { drawCalls, triangles } = app.getRenderStats();
    element.textContent =
      `${fps.toFixed(0)} fps\n` +
      `${drawCalls} draw calls\n` +
      `${triangles} tris` +
      scriptMessageDebugText(app);
    accumMs = 0;
    frames = 0;
  };
}

function scriptMessageDebugText(app: RuntimeStatsApp): string {
  const snapshot = app.getScriptMessageDebugSnapshot();
  const { lastFlush, recentMessages } = snapshot;
  const lines = [
    "",
    "script messages",
    `flush p:${lastFlush.processed} d:${lastFlush.delivered} w:${lastFlush.warnings.length}`,
    `subscribers: ${snapshot.subscribers.length}`,
  ];
  for (const entry of recentMessages.slice(-5)) {
    const target = entry.envelope.target ?? "*";
    const payload = JSON.stringify(entry.envelope.payload);
    const payloadText = payload.length > 44 ? `${payload.slice(0, 41)}...` : payload;
    lines.push(
      `${entry.envelope.frame} ${entry.envelope.source}->${target} ${entry.envelope.type} ${entry.status}(${entry.delivered}) ${payloadText}`,
    );
  }
  if (lastFlush.warnings.length > 0) {
    lines.push(`last warning: ${lastFlush.warnings[0]?.code ?? "unknown"}`);
  }
  return `\n${lines.join("\n")}`;
}
