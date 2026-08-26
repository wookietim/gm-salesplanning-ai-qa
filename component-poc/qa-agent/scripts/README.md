# Scripts

Place automation entry points here.

Suggested scripts:

- run-all.sh: runs all enabled agents from config
- run-agent.sh <agent-id>: runs a single agent
- collect-report.sh: merges per-agent outputs into one summary
- run-bob.js: generates one human-readable QA test plan per component and
	records completion memory in a manifest; emits runtime execution profile and
	runtime assertions derived from source behavior
- run-susan.js: executes Bob tests and writes timestamped pass or fail
	results per test and overall, including runtime-signal alignment checks against
	the current source code
- run-pablo.js: orchestrates Bob, Susan, and E2E for changed, full, or component
	subset QA runs
- run-e2e.js: runs the target project's real Playwright suite and reports
	per-spec pass/fail with failure reasons, traces, and flaky detection
- run-guide-sync.js: reconciles AGENTS_GUIDE and README links when agent
	definitions change

Keep scripts deterministic and non-interactive.

## E2E usage

E2E resolves its target from `adapters/<id>/adapter.json` (`e2eRoot`,
`e2eCommand`, `e2eBrowsers`), so the common case needs no flags:

```bash
node component-poc/qa-agent/scripts/run-e2e.js
```

Useful flags:

- `--browsers chromium,firefox` — limit to specific Playwright projects
- `--grep "<pattern>"` — run only tests matching a title pattern
- `--specs e2e/home.spec.ts` — run specific spec files
- `--retries 1` — enable retries so flaky tests are detected
- `--e2e-root <path>` / `--e2e-command "<cmd>"` — override the adapter
- `--adapter <id>` — choose an adapter when several define `e2eRoot`
- `--install-browsers` — run `playwright install --with-deps` first
- `--timeout-seconds 1800` — wall-clock limit for the whole suite

Pablo runs E2E automatically. To control it there:

- `--skip-e2e` — skip the E2E step entirely
- `--browsers`, `--retries`, `--e2e-root`, `--e2e-command`, `--e2e-grep` — forwarded to run-e2e.js

A suite that cannot start reports `blocked`, never `pass`. A flaky test (passed
only on retry) makes the run `fail` — it is never counted as a pass.

## Guide-Sync usage

Run from repo root:

node component-poc/qa-agent/scripts/run-guide-sync.js

Behavior:
- Runs automatically from pre-commit when staged changes include:
  - `component-poc/qa-agent/agents/*/(AGENT.md|prompt.md|input.schema.json|output.schema.json)`
  - `component-poc/qa-agent/configs/qa-agent.config.json`
- Updates:
  - `component-poc/qa-agent/AGENTS_GUIDE.md` (last-updated stamp)
  - root `README.md` guide link (if missing)
  - `component-poc/qa-agent/README.md` guide link (if missing)
- Fails commit if enabled agents in config are not represented in AGENTS_GUIDE.

## Bob generator usage

Run from repo root:

node component-poc/qa-agent/scripts/run-bob.js

Optional flags:

- --root sp-monitor-dashboard/frontend/src
- --output component-poc/qa-agent/agents/bob/generated-tests
- --jira-ticket SSPLAN-656 (prefixes output filenames with the ticket key)
- --jira-project ABC
- --jira-issues ABC-123,ABC-456
- --jira-base-url https://jira.digital.ingka.com
- --jira-api-token <token> (or env JIRA_API_TOKEN)
- --ac-file path/to/acceptance-criteria.txt
- --overwrite true
- --components path/to/Component.tsx,ComponentName

Bob memory file:

- component-poc/qa-agent/agents/bob/generated-tests/.bob-memory.json

Bob uses this manifest to remember which component QA plans have already been
written and whether source components changed since the last generation.
When Jira credentials are provided for a ticketed run, Bob also stores Jira
story update metadata and regenerates a new plan file if the story has changed
since the prior plan.

Bob plan guarantees:

- Includes a Runtime Execution Profile section with explicit runtime signals.
- Includes Runtime assertion markers in happy and sad tests based on source behavior.

## Susan executor usage

Run from repo root:

node component-poc/qa-agent/scripts/run-susan.js

Optional flags:

- --bob-dir component-poc/qa-agent/agents/bob/generated-tests
- --results-dir component-poc/qa-agent/agents/susan/results
- --run-id susan-custom-run
- --components path/to/Component.tsx,ComponentName

Susan history artifacts:

- component-poc/qa-agent/agents/susan/results/susan-result-YYYYMMDD-HHMMSS.json
- component-poc/qa-agent/agents/susan/results/susan-result-YYYYMMDD-HHMMSS.md
- component-poc/qa-agent/agents/susan/results/latest.json

Susan execution guarantees:

- Validates Bob runtime signals against actual source runtime signals.
- Requires runtime assertion coverage per test ID (happy and sad paths).
- Fails when plan-runtime contract does not match how code is likely to run.

## Pablo orchestrator usage

Run from repo root:

node component-poc/qa-agent/scripts/run-pablo.js

Optional flags:

- --mode changed|full|components
- --components path/to/Component.tsx,ComponentName
- --root sp-monitor-dashboard/frontend/src
- --run-id pablo-custom-run
- --jira-ticket SSPLAN-674
- --jira-project SSPLAN
- --jira-issues SSPLAN-674,SSPLAN-700
- --jira-base-url https://your-org.atlassian.net
- --jira-user-email your.name@company.com
- --jira-api-token <token>
- --jira-ac-file path/to/acceptance-criteria.txt

Jira environment variable alternatives:

- JIRA_BASE_URL
- JIRA_USER_EMAIL
- JIRA_API_TOKEN

Pablo history artifacts:

- component-poc/qa-agent/agents/pablo/results/pablo-result-YYYYMMDD-HHMMSS.json
- component-poc/qa-agent/agents/pablo/results/pablo-result-YYYYMMDD-HHMMSS.md
- component-poc/qa-agent/agents/pablo/results/latest.json
