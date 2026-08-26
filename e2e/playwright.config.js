// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright config for E2E testing of gm-salesplanning-frontend.
 *
 * The frontend app must be running on port 4173 before tests are executed.
 * Start it with:
 *   cd /path/to/gm-salesplanning-frontend && npm run dev -- --port 4173 --strictPort
 *
 * Then run these tests from this directory:
 *   npm test
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
        baseURL: 'http://localhost:4173',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    // The frontend app must already be running — we do NOT auto-start it here
    // because it lives in a separate repo. Start it manually before running tests.
});
