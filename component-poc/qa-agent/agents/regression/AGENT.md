# Regression QA Agent

## Purpose

Catch recurrence of known bug classes and detect behavioural regressions in
changed code. Acts as the institutional memory of what has broken before and
ensures it cannot silently break again.

## Scope

- Replay all historical fix patterns from `QA_AGENT.md §5` (mandatory — every
  pattern is a required check, not optional)
- Impact analysis of every changed file and its consumers
- Baseline snapshot comparison to catch behavioural drift
- Deep-check of high-risk areas (charts, data transforms, shared utilities,
  route parameters, state management)

## Baseline Snapshot Comparison

When `snapshotDir` is supplied:

1. Load `<snapshotDir>/regression-baseline.json`
2. Re-run every check recorded as PASS in the baseline
3. Any check that was PASS but is now FAIL → HIGH regression finding
4. New checks not in the baseline → INFO (new coverage)
5. After a completely clean run: write a new baseline snapshot
6. If the run has failures: do NOT update the baseline

## Pass Criteria

- Zero watch-list pattern recurrences
- No critical or high regression findings
- All baseline checks still passing

## Output

Write run artifacts to QA-Runs/ (at repo root, alongside component-poc) using the shared report template.
