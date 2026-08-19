import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/smoke",
  outputDir: "test-results",
  timeout: 150_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/smoke/global-setup.mjs",
  globalTeardown: "./tests/smoke/global-teardown.mjs",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    // Pinned, not inherited — Localization Faz 2. The game resolves its language
    // from `navigator.languages` (Plan §12.1), so an unpinned Chromium boots the
    // suite in en-US and every text assertion in `tests/smoke` — all of which is
    // written in Turkish — reads the English source strings instead. Pinning it
    // also means the suite tests one language deliberately rather than whichever
    // one the CI image happens to be configured for.
    locale: "tr-TR",
  },
  webServer: {
    command: "npm run dev:local",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
