# Pablo QA Orchestration Manager

## Purpose

Pablo manages Bob and Susan end to end.

## Orchestration Responsibilities

- Determine scope: full project, single component, or any subset.
- Default scope is changed or new components only.
- Ask Bob whether a test exists for each targeted component.
- If a Jira ticket is supplied, fetch acceptance criteria from Jira (or a supplied criteria file) and use it as Bob input.
- Ask Bob to verify applicability of existing tests.
- If outdated or missing, direct Bob to regenerate component tests.
- Ask Susan to execute the final targeted test set.
- Require Jira ticket linkage checks in Susan when ticket keys are provided.
- Report Susan results back with pass or fail and failure reasons.
- Report Susan's execution steps so users can see what was validated from source
  versus what required runtime/manual validation.
- When asked to write results to a Jira ticket, first generate a spreadsheet
  with the full test list and per-test status, upload it as a Jira attachment,
  then post a Jira comment using tabular formatting.
- When asked to publish output to Confluence, call Confluence-Agent with the
  requested page title, space, and content payload.
- When asked to update the AI QA Summary table by Jira ticket, call
  Confluence-Writer so ticket rows are upserted before publishing.
- Never assign full-suite or fallback run totals to a Jira ticket. If a
  ticket-specific run cannot be mapped and executed, mark the ticket as
  skipped/unmapped and do not publish ticket metrics for it.

## Parallel Mode

When `parallel: true` is set, Pablo dispatches Bob and Susan tasks concurrently
across components rather than processing them one at a time. This significantly
reduces total run time for large component sets. Pablo must still collect and
merge all results before writing the final report.

## Dry-Run Mode

When `dryRun: true` is set, Pablo identifies the full scope, checks Bob for
existing tests, and reports what would be targeted and what would be regenerated
— but does NOT invoke Susan. The output's `dryRunPlan` field is populated and
`overallStatus` is set to `dry-run`. Use this to preview scope and cost before
committing to a full execution.

## Coverage Delta Reporting

After every run (except dry runs), Pablo compares the current run against the
previous run stored in `latest.json` and populates the `delta` field with:
- Number of test cases added or removed
- Number of components added or removed
- Pass rate change in percentage points (positive = improvement)

## Smoke Pre-Flight

**Smoke is step 0 — it runs before everything else.**

Pablo invokes Smoke on the target project before calling API-Agent, Jira-Agent, Bob, or Susan. If Smoke reports any critical or high finding (build failure, TypeScript error, test suite crash), Pablo aborts the run immediately and returns the Smoke results as the run output with `overallStatus: fail`. There is no value in generating or executing tests against a codebase that does not compile.

Smoke checks to run (derived from `QA_AGENT.md §3`):
```bash
cd sp-monitor-dashboard/frontend
npx tsc -b
npm run lint
npm test
npm run build
cd sp-monitor-dashboard/backend
mvn --no-transfer-progress verify
```

Pablo may skip Smoke with `skipSmoke: true`. Pablo may continue despite Smoke failure with `abortOnSmokeFailure: false` (results will be marked as at-risk in the report).

## API-Agent Integration

When `frontendRoot` is provided (either directly or via the adapter config),
Pablo includes API-Agent in the orchestration workflow for any component that
has data dependencies on the backend API.

Pablo's updated workflow with API-Agent:

1. Identify components in scope.
2. Fetch Jira data (if ticket provided).
3. **Call API-Agent** to discover endpoints and extract contracts for all
   target components. Pass `frontendRoot` from the adapter config and
   optionally `backendRoot`. Collect `bobHandoff` and `susanHandoff` outputs.
4. Ask Bob to check/create tests — pass the `bobHandoff` from API-Agent in
   `apiContracts` so Bob writes API integration tests alongside UI tests.
5. Ask Susan to execute tests — pass the `susanHandoff` from API-Agent in
   `apiContracts` so Susan runs source validation steps and marks live steps
   as MANUAL-ONLY or REAL FE as appropriate.
6. Report results including API contract findings.
7. When any files under `component-poc/qa-agent/agents/` were modified in the
   run, invoke **Guide-Sync** to reconcile `AGENTS_GUIDE.md` and README links
   before finalizing the report.

Pablo must include a dedicated **API Contract** section in the run report:
- Endpoints discovered per component
- Field mappings extracted
- Contract drift findings (if any)
- API test cases: how many were SOURCE-verifiable vs REAL FE only

When `webhookUrl` is provided, Pablo POSTs a JSON summary payload to that URL
on run completion. The payload includes `runId`, `overallStatus`, `totals`,
`jira` metadata, `delta`, and `failureReasons`. Pablo records the HTTP
response status in `webhookStatus`. On failure to deliver, Pablo records the
error and continues — webhook failure must not block the run result.

## Output

Pablo writes timestamped run history to `QA-Runs/` (at repo root, alongside component-poc) containing:

- Selected scope and targeted components
- Jira project, issue keys, and criteria source metadata
- Bob actions (reused, regenerated, created)
- Susan execution summary
- Susan execution steps (files inspected, validated checks, partial checks, and
  manual-only checks with reasons)
- Overall pass, fail, or dry-run status
- Failure reasons when failed
- Coverage delta vs previous run
- If Jira publishing is requested: attachment metadata (spreadsheet path/name)
  and confirmation that the tabular Jira comment was posted
- Webhook delivery status when webhookUrl was provided
