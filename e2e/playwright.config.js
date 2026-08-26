// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright config for E2E testing of gm-salesplanning-frontend.
 *
 * Default target is the deployed dev environment, so runs exercise the
 * actually-deployed bundle and are immune to a stale local `dist/`.
 *
 * Override to test a local build instead:
 *   E2E_BASE_URL=http://localhost:4173 npm test
 * (a local target must already be serving a fresh `npm run build` output)
 *
 * Note: network calls are still intercepted by page.route(), so this exercises
 * the deployed bundle against mock data — it does not hit the real backend.
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
        baseURL: process.env.E2E_BASE_URL || 'https://dev.salesplanning.ingka.com',
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
