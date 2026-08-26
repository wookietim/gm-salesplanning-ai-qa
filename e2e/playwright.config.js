// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright config for E2E testing of gm-salesplanning-frontend.
 *
 * TARGET: local build on :4173 by default.
 *
 * Do NOT point the full suite at https://dev.salesplanning.ingka.com — it was
 * tried on 2026-08-26 and the host rate-limited us: 182/211 failed, 181 of them
 * with HTTP 429 Too Many Requests. The throttle is per-client and persisted for
 * minutes afterwards, blocking normal browser access to the dev site too.
 * 211 tests x full-bundle navigations is simply too much traffic for a shared
 * deployed environment.
 *
 * Use the deployed dev site for interactive/live-UI verification instead (a
 * handful of page loads), not for the automated suite.
 *
 * Override the target when needed:
 *   E2E_BASE_URL=http://localhost:5173 npm test
 */
module.exports = defineConfig({
    testDir: '.',
    testMatch: '**/*.spec.js',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        // NOTE: defaults to a LOCAL build. Targeting the deployed dev host for
        // the full 211-test suite triggers HTTP 429 rate limiting (see header).
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:4173',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    // No webServer: the target is a deployed environment by default. When
    // overriding E2E_BASE_URL to a localhost port, start that server yourself.
});
