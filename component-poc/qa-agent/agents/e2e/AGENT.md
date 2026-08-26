# E2E QA Agent

## Purpose

Execute the target project's real Playwright end-to-end suite in a browser and
turn the results into deterministic per-test PASS/FAIL records.

This agent exists to close the largest gap in Susan's execution model: Susan
validates from source and marks anything requiring a running app as
`MANUAL-ONLY` or `REAL FE`. E2E actually runs those journeys.

## Scope

- Runs the project's existing Playwright suite (`testDir` from `playwright.config.ts`)
- Does **not** author new specs — that remains Bob's job
- Reports per-spec, per-project (browser) results with failure evidence
- Surfaces flaky tests (passed only on retry) as findings, not silent passes

## Configuration Discovery

The agent resolves its target in this order:

1. Explicit `e2eRoot` / `e2eCommand` in its own input
2. The adapter's `e2eRoot` / `e2eCommand` (`adapters/<id>/adapter.json`)
3. Fallback: `projectRoot` + `npm run test:e2e`

If no `test:e2e` script and no `playwright.config.*` can be found, the agent
returns `status: blocked` with a `blockedReason` — it must never report `pass`
for a suite it did not run.

## How It Works

1. Resolve `e2eRoot` and verify `playwright.config.*` exists.
2. Ensure browsers are installed (`npx playwright install --with-deps` when
   `installBrowsers: true`).
3. Run the suite with a machine-readable reporter, overriding the project's
   default `html` reporter:
   ```bash
   cd <e2eRoot>
   PLAYWRIGHT_JSON_OUTPUT_NAME=<reportPath> npx playwright test \
     --reporter=json <specFilters> <projectFlags>
   ```
4. Parse the JSON report into per-spec results.
5. Map results to findings using the severity mapping below.
6. Write run artifacts to `QA-Runs/`.

The Playwright config already declares a `webServer` block, so Playwright
starts and stops the app itself. The agent must **not** start a dev server
manually — doing so causes a port conflict with `--strictPort`.

## Severity Mapping

| Result | Severity | Notes |
|---|---|---|
| Test failed on every retry | critical | Confirmed broken user journey |
| Test failed, passed on retry (flaky) | high | Non-deterministic — must not be treated as pass |
| Suite could not start (config/browser/webServer error) | critical | Reported as `blocked` |
| Test skipped / `test.fixme` | low | Coverage gap |
| Test passed | info | No finding emitted |

## Integration with Susan

Susan delegates to E2E when `e2eCommand` or `e2eRoot` is present in her input.

- Any Bob test case whose venue is `REAL FE` and which maps to an executed
  Playwright spec adopts that spec's result **instead of** `MANUAL-ONLY`.
- Mapping is by `specMappings` (explicit test-ID → spec-title pairs) when
  supplied; otherwise Susan matches on normalised spec title.
- An E2E `critical` finding becomes a FAIL in Susan's output, with the
  Playwright error message and trace path as evidence.
- Unmapped Playwright specs are still reported in full, so real coverage is
  never hidden just because Bob has no corresponding test case.

## Integration with Pablo

Pablo passes `e2eCommand`/`e2eRoot` through to Susan whenever the adapter
defines them, unless `skipE2e: true`. E2E runs as part of Susan's execution
cycle, after source validation and alongside the other specialists.

E2E failures do not abort the run the way Smoke failures do — the full result
set is more useful than an early exit.

## Pass Criteria

- Every Playwright test passed on its first attempt
- Zero flaky tests
- The suite actually executed (`status` is not `blocked`)

## Output

Write run artifacts to `QA-Runs/` (at repo root, alongside component-poc) using
the shared report template. Include a `specs` section listing each test title,
its browser project, status, duration, and — for failures — the error message,
failing assertion, and trace/screenshot paths.
