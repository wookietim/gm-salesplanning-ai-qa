# QA Agent System — Complete User Guide

> **Last updated:** 2026-08-10
> **Location:** `component-poc/qa-agent/agents/`

---

## Table of Contents

1. [Overview](#overview)
2. [Agent Roster](#agent-roster)
3. [Agent Details](#agent-details)
   - [API-Agent — API Discovery and Contract Extraction](#api-agent--api-discovery-and-contract-extraction)
   - [Pablo — Orchestration Manager](#pablo--orchestration-manager)
   - [Bob — Test Creator](#bob--test-creator)
   - [Susan — Test Executor](#susan--test-executor)
   - [Jira-Agent — Ticket Fetcher](#jira-agent--ticket-fetcher)
   - [Smoke — Confidence Checks](#smoke--confidence-checks)
   - [Regression — Historical Defect Replay](#regression--historical-defect-replay)
   - [Accessibility — WCAG Validation](#accessibility--wcag-validation)
   - [API Contract — Schema Drift Detection](#api-contract--schema-drift-detection)
   - [Visual Diff — Screenshot-Based Visual Regression](#visual-diff--screenshot-based-visual-regression)
   - [Guide-Sync — Documentation Synchronization](#guide-sync--documentation-synchronization)
4. [How the Agents Work Together](#how-the-agents-work-together)
5. [Asking Pablo to Do Things — Examples](#asking-pablo-to-do-things--examples)
6. [Pablo Input Reference](#pablo-input-reference)
7. [Output Artifacts](#output-artifacts)
8. [Severity Model](#severity-model)
9. [Adding a New Agent](#adding-a-new-agent)

---

## Overview

The QA Agent System is a multi-agent framework for automated and semi-automated quality assurance of the Commercial Planning Platform (`sp-monitor-dashboard/`). Agents are specialised roles — each has a defined `AGENT.md`, `prompt.md`, `input.schema.json`, and `output.schema.json`. They communicate through structured handoffs rather than ad-hoc messages.

**Pablo** is the entry point you talk to most of the time. He manages the other agents end-to-end so you don't have to.

---

## Agent Roster

| Agent | Role | Who calls it |
|---|---|---|
| **Pablo** | Orchestration manager | You |
| **API-Agent** | API discovery, contract extraction, Bob/Susan handoff | Pablo (automatic), or you directly |
| **Unit-Test-QA** | Ephemeral unit test writer and executor | Pablo (automatic after API-Agent), or you directly |
| **Security-QA** | Full-stack security audit — XSS, token storage, CORS, auth, CVEs | Pablo (automatic after Smoke), or you directly |
| **Bob** | Component test creator | Pablo (or you directly) |
| **Susan** | Component test executor | Pablo (or you directly) |
| **Jira-Agent** | Jira ticket fetcher | Bob, Pablo |
| **Smoke** | Fast CI confidence checks | You or CI |
| **Regression** | Historical defect replay + baseline snapshot comparison | You or CI |
| **Accessibility** | WCAG / a11y scanning | You or CI |
| **API Contract** | Request/response schema validation | You or CI |
| **Visual Diff** | Screenshot-based visual regression detection | You, Susan (delegated), or CI |
| **Guide-Sync** | Keeps AGENTS_GUIDE and README links in sync with agent changes | Pablo (after agent-definition changes), or you directly |

---

## Agent Details

---

### API-Agent — API Discovery and Contract Extraction

**Folder:** `agents/api-agent/`

API-Agent analyses local project source code to discover every API endpoint a component depends on, extracts the full request/response contract, and produces structured handoffs that Bob uses for test writing and Susan uses for test execution. **No running server, no MCP, and no OpenAPI document required.**

#### The problem it solves

Components like `SalesByWeek` receive data that has been fetched from a backend and transformed before it reaches the component. Without API-Agent, Bob has no reliable knowledge of:
- Which endpoint feeds the component
- What request body is actually sent
- What raw field names the backend returns
- What transformations map those raw fields to the props the component renders

This means Bob's tests could pass with mock data while a silent field rename or unit-scaling bug breaks real data display entirely. API-Agent closes that gap.

#### What API-Agent does

**Phase 1 — Component tracing:** Reads the target component source and identifies every React Query hook it calls.

**Phase 2 — Service layer tracing:** Follows each hook back through `queries.ts` → `api.ts` to extract:
- The endpoint URL and HTTP method
- The full request body shape (metric key, level, filters)
- The `transformResponse` function — every raw API field → frontend field mapping, including arithmetic transformations (e.g. `salesCy = weeklyNetSalesCy / 1000`), null fallbacks, and derived calculations

**Phase 3 — Backend cross-reference (optional):** When `backendRoot` is provided, reads backend row classes (e.g. `WeeklySalesTrendPaRow.kt`) and reports any field names the frontend expects that don't exist in the backend — **contract drift findings**.

**Phase 4 — Bob handoff:** Produces `testCasesToGenerate` for each component:
- Happy path at all product levels (COUNTRY, HFB, PA)
- Transformation correctness tests (known raw value → expected transformed value)
- Null/missing field fallback tests
- Empty data / API error state tests

**Phase 5 — Susan handoff:** Produces `sourceValidationSteps` (Susan checks `transformResponse` from source alone — no live server needed) and `liveValidationSteps` (exact curl-equivalent requests for real backend validation).

#### This project's known API contract

The `gm-salesplanning` project uses a single POST endpoint for all metric data:

| Field | Value |
|---|---|
| Endpoint | `POST /metrics` (resolved from `VITE_BACKEND_HOST` + `VITE_METRICS_PATH`) |
| Auth | Bearer JWT via MSAL (`Authorization: Bearer <token>`) |
| Metric types | `WEEKLY_SALES_TREND`, `ROLLING_SALES_TREND` |
| Levels | `country`, `hfb`, `pa`, `pra` |
| Response path | `data.data[n]` |

A separate `GET /metrics/hierarchy` endpoint returns HFB hierarchy data.

#### Pass criteria

- All target components have a fully traced endpoint chain
- No unmapped component-to-service links
- No contract drift findings (when `backendRoot` is provided)

---

### Unit-Test-QA — Ephemeral Unit Test Writer and Executor

**Folder:** `agents/unit-test-qa/`

Unit-Test-QA is a world-class unit test engineer that combines authoring and execution into a single ephemeral pass. It writes production-quality Vitest tests for pure-logic code units, executes them against the real project, and reports findings — then deletes every test file it created.

**Key principle: it leaves the project exactly as it found it.** No `.test.ts` files are added. No configuration is modified. The tests live for the duration of one run.

#### What it tests

- Data transformation functions (`transformResponse`, `parseNumber`, field scaling)
- Utility functions (`getFiscalWeekInfo`, threshold classifiers, sort/filter logic)
- Boundary values (e.g. index 93 → red, 94 → orange — off-by-one threshold bugs)
- Null/undefined handling (e.g. `parseFloat("N/A")` → `null`, not `NaN`)
- Transformation correctness (e.g. `weeklyNetSalesCy = 123456` → `salesCy = 123.456`)

#### How it works

1. Creates `<projectRoot>/__unit-test-qa-tmp__/` (temporary)
2. Writes one `.test.ts` file per target unit using the project's existing test style
3. Runs `npx vitest run __unit-test-qa-tmp__/ --reporter json` from the project root (path aliases and jsdom environment work normally)
4. Captures per-test pass/fail results
5. **Deletes `__unit-test-qa-tmp__/` entirely**
6. Reports results — the generated test code is preserved in the report as the only record

#### When Pablo calls it

Pablo calls Unit-Test-QA **after API-Agent** and before Bob, passing the `fieldMappings` from API-Agent's output as `apiContractHints`. This lets Unit-Test-QA generate transformation-correctness tests with exact numeric examples before Bob writes the broader test plan.

#### A FAIL result is a confirmed production bug

Every test failure indicates a real defect in the production code. Unit-Test-QA reports the actual vs expected value, which production file is wrong, and exactly what to change to fix it.

#### Pass criteria

- All generated tests pass
- Temp directory deleted after run

---

### Security-QA — Full-Stack Security Audit

**Folder:** `agents/security-qa/`

Security-QA is a world-class application security specialist that audits the full stack for exploitable vulnerabilities — not suggestions, but real attack vectors with evidence, attack chains, and specific code fixes. It runs automatically in every Pablo pipeline and can be invoked standalone for a security-only scan.

#### When it runs
- **Always** in Pablo's pipeline: after Smoke, before Bob and Susan
- **Standalone**: `"Pablo, run a security scan for SSPLAN-698"` or `"Pablo, run a full security scan"`
- **Feeds Bob**: produces `securityTests` — Bob adds `[SECURITY: SEC-xxx]` test cases to every plan
- **Feeds Susan**: produces `securityValidationSteps` — Susan validates security checks from source
- **CRITICAL finding → Pablo aborts the run** (same gate as Smoke)

#### What Security-QA audits

| Category | What it checks |
|---|---|
| **XSS** | `dangerouslySetInnerHTML`, `innerHTML`, `eval`, unsanitised API data in DOM |
| **Token storage** | MSAL `cacheLocation: 'localStorage'` (tokens readable after XSS) |
| **Token lifecycle** | `clearToken()` on signout, expiry validation, tokens in logs |
| **Route param injection** | Path params used in API calls without allowlist validation |
| **Open redirect** | `redirectUri` and `postLogoutRedirectUri` validation |
| **sessionStorage** | Sensitive data stored in sessionStorage |
| **CORS** | `allowedHeaders: ["*"]`, `allowedMethods: ["*"]`, wildcard origins |
| **CSRF** | Scope of CSRF exemption — is it tight enough? |
| **Public endpoints** | Swagger UI/API docs accessible without auth in production |
| **Error disclosure** | Raw exception messages returned in API responses |
| **JWT validation** | Issuer/audience claims validated? |
| **BigQuery injection** | Query parameters parameterised? |
| **Dependencies** | `npm audit` for CVEs in frontend packages |
| **Security headers** | CSP, HSTS, X-Frame-Options, X-Content-Type-Options |

#### Known findings (pre-confirmed from source)

| ID | Severity | Finding |
|---|---|---|
| SEC-001 | HIGH | MSAL `cacheLocation: 'localStorage'` — tokens readable by XSS scripts |
| SEC-002 | MEDIUM | CORS `allowedHeaders: ["*"]` too permissive |
| SEC-003 | MEDIUM | CORS `allowedMethods: ["*"]` allows TRACE/CONNECT |
| SEC-004 | MEDIUM | `/swagger-ui/**` publicly accessible without auth |
| SEC-005 | MEDIUM | `GlobalExceptionHandler` leaks raw exception messages |
| SEC-006 | LOW | `sessionStorage` used for navigation paths |

#### Pass criteria

- Zero CRITICAL findings
- Zero HIGH findings
- All MEDIUM findings documented with remediation

---

### Pablo — Orchestration Manager

**Folder:** `agents/pablo/`

Pablo is the conductor. You give him a scope and optionally a Jira ticket; he coordinates Bob and Susan and reports back a clear pass or fail with evidence. Talking to Pablo is almost always the right starting point.

#### What Pablo does

1. Determines scope: changed/new components (default), full project, or an explicit component list.
2. Optionally fetches acceptance criteria from Jira (via Jira-Agent) or a supplied criteria file.
3. Asks Bob whether tests already exist for each targeted component and whether they are still applicable.
4. Directs Bob to regenerate any outdated or missing tests.
5. Hands the final test set to Susan for execution.
6. Requires Jira linkage checks in Susan results when ticket keys are provided.
7. Returns a timestamped run report with per-test status, Susan execution steps, and an overall PASS / FAIL verdict.
8. On request: generates an Excel spreadsheet of test results, uploads it to Jira as an attachment, and posts a tabular Jira comment linking to the spreadsheet.

**Pablo's orchestration workflow:**
1. **[Step 0] Smoke pre-flight** — build, lint, test, compile. Abort immediately if critical/high finding (unless `skipSmoke: true` or `abortOnSmokeFailure: false`)
2. Identify scope (changed / full / explicit list)
3. Fetch Jira data (if ticket provided)
4. **Call API-Agent** → collect `bobHandoff` + `susanHandoff` + contract drift findings
5. Ask Bob to create/update tests, passing API-Agent's `bobHandoff` as `apiContracts` and Regression findings as `regressionFindings`
6. Ask Susan to execute, passing API-Agent's `susanHandoff`, `regressionSnapshotDir`, `accessibilityRoutes`, and `apiBaseUrl`
7. Collect results (including Susan's specialist agent results) and report
8. If any files under `component-poc/qa-agent/agents/` were modified in the run, call **Guide-Sync** to reconcile `AGENTS_GUIDE.md` and README links before closing

**Parallel mode (`parallel: true`):** Pablo dispatches Bob and Susan tasks for all components concurrently instead of sequentially. Significantly reduces run time for large component sets.

**Dry-run mode (`dryRun: true`):** Pablo identifies scope and checks Bob for existing tests but does NOT invoke Susan. Returns a `dryRunPlan` showing exactly what would be targeted, regenerated, and estimated test count. `overallStatus` is set to `dry-run`.

**Coverage delta reporting:** After every run Pablo compares results against the previous run in `latest.json` and reports test case counts added/removed, component counts added/removed, and pass-rate change in percentage points.

**Webhook / Slack notification (`webhookUrl`):** On run completion Pablo POSTs a JSON summary payload (runId, overallStatus, totals, jira metadata, delta, failureReasons) to the provided URL. Delivery failure does not affect the run result.

#### Output files

Pablo writes results to `QA-Runs/` (at repo root, alongside `component-poc`) using the pattern:

```
pablo-result-<TICKET>-<scope>-<YYYYMMDD-HHmmss>.md
pablo-result-<TICKET>-<scope>-<YYYYMMDD-HHmmss>.json
```

---

### Bob — Test Creator

**Folder:** `agents/bob/`

Bob generates human-readable, machine-traceable QA test plans for individual components.

#### What Bob does

- Produces happy path **and** sad path tests for every component — no exceptions.
- Derives acceptance criteria from Jira-Agent output when a ticket is supplied.
- Categorises every test by validation venue: STORYBOOK, REAL FE, HYBRID.
- Flags missing or ambiguous acceptance criteria explicitly with `confidenceScore`.
- **Regression tests:** when Pablo passes `regressionFindings` (sourced from the Regression baseline), Bob generates a dedicated sad-path regression test for every finding, labelled `[REGRESSION: <id>]` and traceable back to the original finding.
- **Performance tests:** at least one per component (data volume + measurable criterion).
- **i18n/l10n tests:** at least one per component across all supported markets.
- **API integration tests:** when `apiContracts` from API-Agent is provided, Bob generates transformation correctness tests, null-handling tests, and level-variant tests.
- Prefixes output filenames with the Jira ticket key when one is provided.

#### Output format per component

- Component name and purpose
- Acceptance criteria source (Jira keys + extracted criteria)
- Happy path scenarios
- Sad path scenarios
- Data self-consistency checks
- Accessibility checks
- Evidence to capture
- Risks, assumptions, and out-of-scope notes

#### Test case format

Each test case contains: Test ID · Title · Priority · Preconditions · Test data · Steps · Expected result · Failure signals.

---

### Susan — Test Executor

**Folder:** `agents/susan/`

Susan reads Bob's test plans and validates them against the project source code, emitting a deterministic per-test pass/fail record.

#### What Susan does

- Reads each Bob component QA test plan and executes all tests.
- Applies tests across **all applicable routes** by default.
- Produces PASS / FAIL / PARTIAL / MANUAL-ONLY for every test ID.
- `totals.partial` and `totals.manualOnly` are required schema fields.
- **Venue filter** and **failed-only re-run** inputs available (see Pablo input reference).
- **Delegates to specialist agents during execution:**
  - **Regression** (`regressionSnapshotDir`) — invoked per component; changed files + risk areas → regression findings mapped to Bob's regression test cases
  - **Accessibility** (`accessibilityRoutes`) — invoked for any component with a11y test cases; pa11y findings → FAIL/PARTIAL on accessibility tests
  - **API Contract** (`apiBaseUrl` + `discoveredEndpoints`) — invoked when live backend is available; schema drift findings → FAIL on API integration test cases
  - **Visual Diff** — invoked for visual-only test cases; pixel diff result → 1:1 test result
- Writes a **Susan Execution Steps** section documenting source-validated, partial, and manual-only checks with evidence.

---

### Jira-Agent — Ticket Fetcher

**Folder:** `agents/jira-agent/`

A low-level helper that Bob and Pablo call internally. You rarely call Jira-Agent directly — instead you pass your Jira credentials to Pablo and he delegates.

#### What Jira-Agent does

- Accepts a ticket key, Jira base URL, email, and API token.
- Sanitises credentials before any API call (replaces `#` with `@`, trims whitespace, lowercases email).
- Fetches the full Jira issue payload via the REST API.
- Extracts: summary, description, acceptance criteria, status, issue type, priority, assignee, reporter, labels, fix versions, linked issues, comments, and custom AC fields.
- For **Stories**: recursively fetches every subtask's full detail and includes it in the output.
- Returns structured output with a `warnings` array for any missing fields or auth issues.

---

### Smoke — Confidence Checks

**Folder:** `agents/smoke/`

Fast, thorough pre-flight checks that run as Pablo's **step 0**. Smoke answers one question: *is this codebase in a state where meaningful testing can proceed?* If no, Pablo aborts with a complete diagnostic report.

#### When it runs
- **Always** as Pablo's first action (unless `skipSmoke: true`)
- Also callable standalone or by CI

#### What Smoke checks

| Command | What it catches |
|---|---|
| `npx tsc -b` | TypeScript compile errors — type mismatches, missing props, broken imports |
| `npm run lint` | Lint violations (oxlint) |
| `npm test` | Failing unit/component tests |
| `npm run build` | Vite build failures |
| `mvn verify` | Backend compile errors and failing Java/Kotlin tests |

#### Output quality

For every failing command Smoke produces:
- Full stdout + stderr (verbatim)
- Exact error lines with file paths and line numbers
- A plain-English `errorSummary` paragraph
- A developer action list — what to fix and where

#### Pass criteria

All required commands exit successfully with no critical or high findings.

---

### Regression — Historical Defect Replay

**Folder:** `agents/regression/`

Institutional memory for bugs. Every historical failure pattern in `QA_AGENT.md §5` is a required check — not a suggestion. Called by Susan per component during execution.

#### When it runs
- **Susan invokes it** for each component under test
- Also callable standalone or by CI

#### What Regression does

1. **Loads the watch-list** from `QA_AGENT.md §5` — runs every pattern as a required check
2. **Analyses changed files** — identifies consumers, classifies risk (interface change, deletion, rename, behaviour change), checks each consumer
3. **Baseline snapshot comparison** — flags any previously-passing check that now fails as HIGH; writes a new baseline after clean runs
4. **Deep-checks risk areas** — chart metric types, data transformations, shared utilities, route parameters, state management

#### Output
Full impact analysis per changed file, watch-list results table, baseline diff, findings with exact evidence, and explicit passing confirmations.

#### Pass criteria

Zero watch-list recurrences; no critical or high findings; all baseline checks still passing.

---

### Accessibility — WCAG Validation

**Folder:** `agents/accessibility/`

Full WCAG 2.1 AA audit. Every finding includes the exact criterion, file/line, current state, required state, and a specific fix. Called by Susan for every component with accessibility test cases.

#### When it runs
- **Susan invokes it** for each component with a11y tests
- Also callable standalone or by CI

#### What Accessibility covers

| Phase | What | Requires running app? |
|---|---|---|
| Source review | Semantic HTML, ARIA usage, keyboard patterns, images, forms, colour | No |
| Automated scan | pa11y-ci against built + served app | Yes |
| Keyboard test plan | Step-by-step tab/focus/activation script | No (script for human) |
| Screen reader test plan | Expected NVDA/VoiceOver announcements | No (script for human) |

#### Pass criteria

No Level A or AA violations; all pa11y gates pass; keyboard test script confirms all controls are reachable.

---

### API Contract — Schema Drift Detection

**Folder:** `agents/api-contract/`

Field-level, type-level API contract validation with evidence. Every finding includes the actual response body excerpt and explains the exact UI impact. Called by Susan when a live backend is available.

#### When it runs
- **Susan invokes it** when `apiBaseUrl` is provided, passing `discoveredEndpoints` from API-Agent
- Also callable standalone

#### What API Contract validates

- Field presence for every `rawField` in `fieldMappings`
- JavaScript type correctness for each field
- Value range sanity after transformations
- Edge cases: missing filters, invalid IDs, unknown metric types
- All level variants (country, hfb, pa, pra) as separate requests

#### Two modes

**API-Agent driven:** Susan passes `discoveredEndpoints`. API Contract tests all levels, validates every field mapping, and produces curl-equivalent requests in every finding.

**Manual:** Provide `endpoints` with optional `schemaPath` snapshot for diff-based validation.

#### Pass criteria

No critical or high contract findings; all raw fields present and correctly typed.

---

### Visual Diff — Screenshot-Based Visual Regression

**Folder:** `agents/visual-diff/`

Eliminates the main source of PARTIAL and MANUAL-ONLY results in Susan runs by replacing visual-only checks with automated screenshot comparison against stored baselines.

#### What Visual Diff does

1. Builds the frontend with `VITE_DISABLE_AUTH=true` and serves it (or starts Storybook).
2. Captures a screenshot for each entry in `targets` (Storybook stories or real-FE routes).
3. Compares each screenshot against a stored baseline in `snapshotDir`.
4. If no baseline exists, creates one and records an INFO finding (not a failure).
5. Reports pixel diff percentage and severity for every target.
6. When `updateBaseline: true` and no critical/high findings, overwrites baselines with current screenshots.

#### Severity mapping

| Diff % | Severity |
|---|---|
| > 5% | Critical |
| 2–5% | High |
| 0.5–2% | Medium |
| 0.1–0.5% | Low |
| < 0.1% | Pass |

#### Integration with Susan

Susan may delegate visual-only test cases to Visual Diff rather than marking them PARTIAL or MANUAL-ONLY, adopting Visual Diff's result for those cases.

#### Pass criteria

All diffs within threshold; no critical or high visual findings.

---

### Guide-Sync — Documentation Synchronization

**Folder:** `agents/guide-sync/`

Guide-Sync keeps documentation aligned with the real agent system. It reconciles
`AGENTS_GUIDE.md` and README links against the current agent configs, prompts,
and schemas whenever agent definitions change.

#### What Guide-Sync checks

1. Agent roster in `AGENTS_GUIDE.md` matches `configs/qa-agent.config.json`
2. Every enabled agent has an Agent Details section
3. Flow diagrams reflect current orchestration and delegation
4. Paths and artifacts use current standards (`QA-Tests/`, `QA-Runs/`)
5. Examples are current, non-duplicated, and schema-aligned
6. README links to `component-poc/qa-agent/AGENTS_GUIDE.md`

#### Pass criteria

- No stale agent entries or missing agent sections
- No stale paths/URLs/roles in the guide
- No duplicate example blocks

#### Output

Guide-Sync writes a synchronization report to `QA-Runs/` documenting:
- mismatches found
- sections updated
- source files used as truth for each fix

---

## How the Agents Work Together

```
You
 └─▶ Pablo
       ├─▶ [Step 0] Smoke        (pre-flight — abort if build/tests broken)
       ├─▶ [Step 0b] Security-QA (security audit — abort if CRITICAL; feeds Bob + Susan)
       ├─▶ Jira-Agent            (fetches ticket data)
       ├─▶ API-Agent             (discovers API contracts from source)
       │     └─▶ bobHandoff ──▶ Bob
       │     └─▶ susanHandoff ──▶ Susan
       │     └─▶ fieldMappings ──▶ Unit-Test-QA
       ├─▶ Unit-Test-QA          (ephemeral unit tests for transformations + utilities)
       │     └─▶ findings (confirmed bugs) ──▶ Pablo run report
       ├─▶ Bob                   (creates/updates test plans + security + regression tests)
       │     └─▶ receives securityTests from Security-QA
       │     └─▶ receives regressionFindings from Regression baseline
       └─▶ Susan                 (executes tests + validates security steps)
             ├─▶ securityValidationSteps from Security-QA
             ├─▶ Regression      (per component — checks changed files vs baseline)
             ├─▶ Accessibility   (per component with a11y tests — pa11y scans)
             ├─▶ API Contract    (when apiBaseUrl available — live schema validation)
             └─▶ Visual Diff     (for visual-only test cases — screenshot comparison)
       └─▶ Guide-Sync            (when agent definitions change — updates AGENTS_GUIDE/README links)

Specialist agents called directly (standalone / CI):
  Smoke · Security-QA · Unit-Test-QA · Regression · Accessibility · API Contract · Visual Diff · Guide-Sync
```

Specialist agents can run independently — you or your CI pipeline can call them directly.

---

## Asking Pablo to Do Things — Examples

Below are copy-paste-ready examples. Replace values in `< >` with your own.

---

### Example 1 — Quick changed-component run (no Jira)

> Run QA on whatever has changed. No Jira ticket needed.

```
Ask Pablo to run QA on changed components.
```

Pablo will:
- Scope to new or modified components automatically.
- Ask Bob to create/update tests.
- Ask Susan to execute them.
- Return a PASS / FAIL report.

---

### Example 2 — Full project QA run

> Test everything, not just what changed.

```
Ask Pablo to run a full QA scan across the entire project.
```

---

### Example 3 — QA for a specific Jira ticket

> Run QA for ticket SSPLAN-698, pulling acceptance criteria directly from Jira.

```
Ask Pablo to run QA for Jira ticket SSPLAN-698.
Jira base URL: https://jira.example.com
Jira email: my.email@example.com
Jira API token: <your-token>
```

Pablo will call Jira-Agent to retrieve the ticket's acceptance criteria, pass them to Bob for test generation, then hand the tests to Susan for execution.

---

### Example 4 — QA for a specific component list

> Only test two named components, no full sweep.

```
Ask Pablo to run QA on these components only:
- sp-monitor-dashboard/frontend/src/features/overview/OverviewPage
- sp-monitor-dashboard/frontend/src/features/hero/HeroMetric
```

---

### Example 5 — Jira ticket QA + write results back to Jira

> Run QA for SSPLAN-623 and post the results as a Jira comment with an Excel attachment.

```
Ask Pablo to run QA for Jira ticket SSPLAN-623, then write the results back to that Jira ticket.
Jira base URL: https://jira.example.com
Jira email: my.email@example.com
Jira API token: <your-token>
```

Pablo will:
1. Fetch SSPLAN-623 from Jira.
2. Run Bob and Susan against the scoped components.
3. Generate an Excel spreadsheet with the full test list and per-test status.
4. Upload the spreadsheet to SSPLAN-623 as a Jira attachment.
5. Post a tabular Jira comment summarising the run and referencing the attachment.

---

### Example 6 — Supply acceptance criteria from a local file instead of Jira

> You have AC text saved locally and don't want to connect to Jira.

```
Ask Pablo to run QA using the acceptance criteria in:
agents/pablo/templates/ssplan-701-hero-ac.txt

Target components:
- sp-monitor-dashboard/frontend/src/features/hero/HeroMetric
```

---

### Example 7 — Regenerate stale tests for a ticket

> Tests exist but the Jira story has changed — force a refresh.

```
Ask Pablo to check whether tests for SSPLAN-701 are up to date and regenerate them if the Jira ticket has changed since the last run.
Jira base URL: https://jira.example.com
Jira email: my.email@example.com
Jira API token: <your-token>
```

Pablo will compare the Jira `updated` timestamp against the existing test plan metadata and instruct Bob to regenerate if the ticket is newer.

---

### Example 8 — Storybook-only execution

> You want only Storybook-venue checks (no REAL FE / SSO-dependent execution).

```
Ask Pablo to run QA for SSPLAN-698, but Susan should only execute tests categorised as STORYBOOK venue. Skip REAL FE tests.
Jira base URL: https://jira.example.com
Jira email: my.email@example.com
Jira API token: <your-token>
```

---

### Example 9 — Dry-run: preview scope without executing

> See exactly what Pablo would test before committing to a full run.

```
Ask Pablo to do a dry run for Jira ticket SSPLAN-701.
Jira base URL: https://jira.example.com
Jira email: my.email@example.com
Jira API token: <your-token>
```

Pablo returns a `dryRunPlan` with `componentsToTest`, `testsToRegenerate`, `testsToReuse`, and `estimatedTestCount`. Susan is not invoked. `overallStatus` will be `dry-run`.

---

### Example 10 — Parallel run for a large component set

> Speed up a full project scan by running components concurrently.

```
Ask Pablo to run a full QA scan in parallel mode.
```

---

### Example 11 — Run with Slack notification

> Get a Slack alert when the run finishes.

```
Ask Pablo to run QA for changed components and post results to our Slack webhook.
webhookUrl: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXX
```

---

### Example 12 — Re-run only failed tests

> After fixing failures, re-run only the tests that were FAIL or PARTIAL last time.

```
Ask Susan to re-run only the failed tests from the last run.
runId: pablo-result-SSPLAN-698-real-fe-20260805-164532
failedOnly: true
```

---

### Example 13 — Visual diff against Storybook baseline

> Check for visual regressions in Storybook stories after a UI change.

```
Ask visual-diff to compare current Storybook screenshots against the baseline.
snapshotDir: component-poc/qa-agent/agents/visual-diff/baselines
targetType: storybook
targets:
  - id: breadcrumbs-default
    url: http://localhost:6006/?path=/story/breadcrumbs--default
  - id: breadcrumbs-hfb
    url: http://localhost:6006/?path=/story/breadcrumbs--with-hfb
```

---

### Example 14 — Full QA including API contract tests for SalesByWeek

> Tell Pablo to test SalesByWeek, which will automatically trigger API-Agent to discover the endpoint contract and feed it to Bob and Susan.

```
Ask Pablo to run QA for Jira ticket SSPLAN-623, specifically for the SalesByWeek component.
frontendRoot: /Users/timothy.collins/Documents/ikea work/gm-salesplanning-frontend
backendRoot: /Users/timothy.collins/Documents/ikea work/gm-salesplanning-backend
Jira base URL: https://jira.example.com
Jira email: my.email@example.com
Jira API token: <your-token>
```

Pablo will:
1. Fetch SSPLAN-623 from Jira for acceptance criteria.
2. Call API-Agent with the frontend + backend roots to discover the `POST /metrics WEEKLY_SALES_TREND` contract used by `SalesByWeek`.
3. Extract all `transformResponse` field mappings (e.g. `weeklyNetSalesCy / 1000 → salesCy`).
4. Direct Bob to write both UI tests AND API integration tests — including transformation correctness tests for every field mapping.
5. Ask Susan to validate all `transformResponse` mappings from source (no live server needed) and mark live API validation steps as REAL FE.
6. Report the full results including API contract findings.

---

### Example 15 — Run API-Agent standalone to inspect a component's data contract

> You just want to understand how SalesByWeek gets its data before writing any tests.

```
Ask API-Agent to analyse the SalesByWeek component.
frontendRoot: /Users/timothy.collins/Documents/ikea work/gm-salesplanning-frontend
backendRoot: /Users/timothy.collins/Documents/ikea work/gm-salesplanning-backend
targetComponents:
  - name: SalesByWeek
```

API-Agent will produce a full contract report showing every endpoint, every field mapping, every transformation, and any backend field names that don't match what the frontend expects.

---

### Example 16 — Run Guide-Sync after agent definition edits

> You changed prompts/schemas under `component-poc/qa-agent/agents/` and want docs reconciled.

```
Ask guide-sync to run a full documentation sync.
runId: guide-sync-20260806
fullSync: true
```

---

### Example 17 — Run a security scan for a specific ticket

> You want to know the security posture of the SSPLAN-698 component changes only.

```
Ask Pablo to run a security scan for SSPLAN-698.
frontendRoot: /Users/timothy.collins/Documents/ikea work/gm-salesplanning-frontend
backendRoot: /Users/timothy.collins/Documents/ikea work/gm-salesplanning-backend
```

Security-QA will audit the full auth layer plus the files touched by SSPLAN-698, run npm audit, and report all findings with severity, attack chain, and remediation.

---

### Example 18 — Run a full project security scan

> You want a complete security audit of the entire codebase before a release.

```
Ask Pablo to run a full security scan across the entire project.
frontendRoot: /Users/timothy.collins/Documents/ikea work/gm-salesplanning-frontend
backendRoot: /Users/timothy.collins/Documents/ikea work/gm-salesplanning-backend
apiBaseUrl: http://localhost:8080
```

With `apiBaseUrl` provided, Security-QA will also check security headers on the live backend.

---

## Pablo Input Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `mode` | `"changed"` \| `"full"` \| `"components"` | No (default: `changed`) | Scope mode |
| `components` | `string[]` | Only for `components` mode | Explicit component paths |
| `targetRoot` | `string` | No | Root directory to scope the search |
| `runId` | `string` | No | Custom run identifier for artifact naming |
| `parallel` | `boolean` | No | Run Bob/Susan tasks concurrently |
| `dryRun` | `boolean` | No | Preview scope without invoking Susan |
| `skipSmoke` | `boolean` | No | Skip Smoke pre-flight (use only when build is known clean) |
| `abortOnSmokeFailure` | `boolean` | No (default: `true`) | Set `false` to continue despite smoke failures |
| `webhookUrl` | `string` | No | HTTP/S URL to POST a summary payload to on completion |
| `jiraProject` | `string` | No | Jira project key, e.g. `SSPLAN` |
| `jiraTicket` | `string` | No | Single Jira ticket key, e.g. `SSPLAN-698` |
| `jiraIssues` | `string[]` | No | Multiple Jira issue keys |
| `jiraBaseUrl` | `string` | No | Your Jira instance URL |
| `jiraUserEmail` | `string` | No | Jira account email (sanitised automatically) |
| `jiraApiToken` | `string` | No | Jira personal access token |
| `jiraAcFile` | `string` | No | Path to a local file containing acceptance criteria text |

---

## Output Artifacts

All run outputs live **outside** the agent folders, at the repo root alongside `component-poc`:

| Agent | Output location | Format |
|---|---|---|
| Pablo | `QA-Runs/` | `.md` + `.json` + optional `.xlsx` |
| API-Agent | `QA-Runs/` | `.md` + `.json` (includes `bobHandoff` + `susanHandoff`) |
| Bob | `QA-Tests/` | `.md` + `.json` (test plans, reused across runs) |
| Susan | `QA-Runs/` | `.md` + `.json` |
| Smoke / Regression / Accessibility / API Contract | `QA-Runs/` | `.md` + `.json` |
| Visual Diff | `QA-Runs/` + screenshots in `snapshotDir` | `.md` + `.json` |
| Guide-Sync | `QA-Runs/` | `.md` + `.json` sync report |

**Agent folders** (`component-poc/qa-agent/agents/<name>/`) contain only definitions: `AGENT.md`, `prompt.md`, `input.schema.json`, `output.schema.json`, and agent-specific templates. Output directories inside agent folders are kept with a `.gitkeep` for historical compatibility but are no longer used for new runs.

**Run file naming pattern:**

```
pablo-result-<TICKET>-<scope>-<YYYYMMDD-HHmmss>.md
<TICKET>__<component-path>.qa.md          (Bob test plans)
YYYYMMDD-HHMMSS-<run-id>.json             (specialist agents)
```

---

## Severity Model

| Severity | Meaning | Merge gate |
|---|---|---|
| **Critical** | Production-blocking failure, data loss, or security break | ❌ Must fix before merge |
| **High** | Core functionality broken or significant a11y/compliance issue | ❌ Must fix (waiver required to skip) |
| **Medium** | Behavioural mismatch or regression risk | ⚠️ Fix in current cycle |
| **Low** | Minor issue with limited user impact | 📋 Track and schedule |
| **Info** | Observation or optimisation suggestion | ✅ No immediate action |

---

## Adding a New Agent

1. Copy any existing folder from `agents/`.
2. Update `AGENT.md` (purpose, scope, pass criteria, output).
3. Update `prompt.md` (the agent's instructions).
4. Update `input.schema.json` and `output.schema.json`.
5. Register the new agent in `configs/qa-agent.config.json` (add to both `agents` array and `runOrder`).
6. Add an entry to `shared/command-catalog.md` with suggested execution entry points.
7. Follow the run artifact naming convention: `YYYYMMDD-HHMMSS-<run-id>.json`.
8. Document the new agent in this guide under [Agent Details](#agent-details).
