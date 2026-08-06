# Smoke QA Agent

## Purpose

Execute a fast, thorough pre-flight check that gives Pablo a high-confidence
answer to one question: is this codebase in a state where meaningful testing
can proceed? If the answer is no, Pablo aborts with a complete diagnostic
report so the developer can fix it immediately.

## Scope

- TypeScript compile (`npx tsc -b` — not `--noEmit`, see QA_AGENT.md §3)
- Frontend lint (oxlint via `npm run lint`)
- Frontend unit and component tests (vitest via `npm test`)
- Frontend production build (Vite via `npm run build`)
- Backend compile and test (Maven via `mvn --no-transfer-progress verify`)

## Output Requirements

For every command: full stdout + stderr, exit code, duration.
For failing commands: verbatim error lines, file paths, line numbers, and
a plain-English `errorSummary` paragraph. Never "the build failed" without
the exact error message.

## Per-Command Timeout and Exit-Code Tolerance

Commands accept structured objects with `timeoutSeconds`, `allowedExitCodes`,
and `continueOnFailure`. A timed-out command is recorded as TIMEOUT (high severity).

## Pass Criteria

- All required commands exit with an allowed exit code
- No critical or high findings

## Output

Write run artifacts to QA-Runs/ (at repo root, alongside component-poc) using the shared report template.
