// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright config for E2E testing of gm-salesplanning-frontend.
 *
 * TARGET: the deployed dev environment by default.
 *
 * This tests the actually-deployed bundle, so it is immune to the stale local
 * `dist/` trap that historically caused large numbers of false failures, and it
 * needs no local build or server.
 *
 * ── Rate limiting (important) ────────────────────────────────────────────────
 * The first attempt at targeting this host (2026-08-26) was rate-limited:
 * 182/211 tests blocked with HTTP 429, and the throttle also cut off normal
 * browser access to the dev site for several minutes.
 *
 * Root cause was request volume, not the target itself. Every test gets a fresh
 * BrowserContext, so the ~1MB JS/CSS bundle was re-fetched 211 times.
 *
 * Mitigations now in place — do not remove these casually:
 *   1. `installAssetCache()` in the spec fetches each static asset AND the SPA
 *      index.html once per worker, then replays them from memory. Caching the
 *      document mattered as much as the assets: without it each of the 211
 *      tests made its own navigation request, which alone tripped the limit.
 *   2. Single worker when remote, so navigations are never concurrent.
 *   3. Retries enabled, so an isolated 429 does not fail the whole run.
 *
 * Measured result: the full 211-test suite makes ~39 network requests total
 * (was ~1500) and passes 211/211 against dev in ~3 minutes with zero 429s.
 *
 * If 429s ever reappear, that is the first thing to re-verify:
 *   E2E_ASSET_DEBUG=1 ... npx playwright test   # logs every cache miss
 *
 * Override the target for a local build:
 *   E2E_BASE_URL=http://localhost:4173 npm test   # serve a fresh `npm run build`
 */
const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.salesplanning.ingka.com';
const IS_REMOTE = !/localhost|127\.0\.0\.1/.test(BASE_URL);

module.exports = defineConfig({
    testDir: '.',
    testMatch: '**/*.spec.js',
    // Surfaced in the JSON report (config.use is NOT serialised by the JSON
    // reporter), so downstream tooling can record and publish the target that
    // was actually exercised instead of guessing.
    metadata: { targetUrl: BASE_URL },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    // A shared remote host can return isolated 429s under load; a retry keeps
    // that from failing an otherwise good run.
    retries: process.env.CI ? 2 : IS_REMOTE ? 1 : 0,
    workers: process.env.E2E_WORKERS
        ? Number(process.env.E2E_WORKERS)
        : process.env.CI
          ? 1
          : IS_REMOTE
            ? 1
            : undefined,
    reporter: 'html',
    use: {
        baseURL: BASE_URL,
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    // No webServer: the default target is a deployed environment. When
    // overriding E2E_BASE_URL to a localhost port, start that server yourself.
});
