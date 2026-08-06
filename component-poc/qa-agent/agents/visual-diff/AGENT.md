# Visual Diff QA Agent

## Purpose

Detect visual regressions in UI components by comparing screenshots of the
current build against a stored baseline. Eliminates the main source of
PARTIAL and MANUAL-ONLY results in Susan runs caused by visual-only checks.

## Scope

- Screenshot capture of Storybook stories and real-FE routes
- Pixel-level and structural diff against stored baseline images
- Threshold-based pass/fail with configurable tolerance per component
- Baseline management: create, update, and lock baselines

## How It Works

1. Build the frontend with auth disabled (`VITE_DISABLE_AUTH=true npm run build`).
2. Serve the built app or start Storybook.
3. For each target story or route, capture a screenshot.
4. Compare the screenshot against the stored baseline in `snapshotDir`.
5. If no baseline exists for a story/route, create one and record it as a new
   baseline (info finding — not a failure).
6. If a baseline exists, compute the pixel diff percentage.
7. If the diff exceeds `diffThresholdPercent` (default 0.1%), record a finding
   at the appropriate severity.
8. After a clean run, optionally update baselines with `updateBaseline: true`.

## Severity Mapping

| Diff % | Severity |
|--------|----------|
| > 5%   | critical |
| 2–5%   | high     |
| 0.5–2% | medium   |
| 0.1–0.5% | low   |
| < 0.1% | pass     |

## Integration with Susan

Susan may delegate visual checks to visual-diff rather than marking them as
PARTIAL or MANUAL-ONLY. When visual-diff produces a result for a test, Susan
adopts that result for any test case categorised as visual-only.

## Pass Criteria

- All diffs are within threshold
- No critical or high visual findings

## Output

Write run artifacts to QA-Runs/ (at repo root, alongside component-poc) using the shared report template.
Include a `snapshots` section listing each story/route, its diff percentage,
the baseline path, and the current screenshot path.
