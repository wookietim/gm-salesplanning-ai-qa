# Command Catalog

Suggested execution entry points by agent type.

## pablo

- Orchestrate Bob and Susan with default scope set to changed or new components
- Support full project runs or specific component subsets
- Verify Bob plan existence and regenerate only when missing or stale
- Execute Susan on the same scope and report overall pass or fail with reasons

## bob

- Generate human-readable component test plans
- Derive acceptance criteria from Jira issue content when available
- Ensure each component has both happy path and sad path tests
- Include explicit data self-consistency validation steps in every component plan

## susan

- Execute each Bob test plan against project source
- Emit per-test pass or fail results
- Generate timestamped history artifacts for each run
- Publish overall pass or fail and failure reason list

## smoke

- TypeScript frontend: npx tsc -b && npm run lint && npm test && npm run build
- Java backend: mvn --no-transfer-progress verify

## regression

- Replay historical defect scenarios from QA_AGENT.md
- Recheck changed routes, shared components, and chart behavior

## accessibility

- Build with local auth bypass for a11y checks:
  VITE_DISABLE_AUTH=true npm run build
- Serve app and run pa11y:
  npx serve -s dist -l 4173
  npx pa11y-ci --config ../.pa11yci.json

## visual-diff

- Build with auth bypass:
  VITE_DISABLE_AUTH=true npm run build
- Serve app or start Storybook:
  npx serve -s dist -l 4173   (real-fe)
  npm run storybook -- --port 6006 --ci   (storybook)
- Capture screenshots for each target and compare to baselines in snapshotDir
- Pass/fail determined by diffThresholdPercent (default 0.1%)
- After a clean run with updateBaseline=true, overwrite baseline screenshots

## api-contract

- Validate live response schemas against API-Agent discovered fieldMappings
- For each endpoint/level, verify every rawField expected by frontend transformResponse exists and is correctly typed
- Report schema drift with response evidence and curl-equivalent repro commands

## api-agent

- Crawl `src/services/metrics/*/api.ts` files under frontendRoot
- Read each target component source to trace: component → hook → fetch → endpoint
- Extract all fieldMappings from transformResponse functions
- Cross-reference with backend row classes when backendRoot is provided
- Produces bobHandoff (API test cases for Bob) and susanHandoff (executable steps for Susan)
- No running server required for source-based discovery

## guide-sync

- Reconcile AGENTS_GUIDE.md with current agents, prompts, schemas, and config
- Ensure README links to AGENTS_GUIDE are present and correct
- Remove stale/duplicate guide content and align examples with current workflow

## unit-test-qa

- Write ephemeral Vitest unit tests for target source file(s)
- Run from project root: `npx vitest run __unit-test-qa-tmp__/ --reporter json`
- Temp dir created at `<projectRoot>/__unit-test-qa-tmp__/` and deleted after run
- No test files added to the project source
- Pass apiContractHints from API-Agent for transformation-correctness tests
- Report findings (test failures = confirmed production bugs) to QA-Runs/

## security-qa

- Audit frontend source for XSS, token storage, open redirect, console leaks, route param injection
- Audit backend source for CORS misconfiguration, CSRF scope, public swagger, error disclosure, JWT validation
- Run `npm audit --json` in frontendRoot for dependency CVEs
- Check security headers via HEAD request to apiBaseUrl (when provided)
- Always runs after Smoke in Pablo's pipeline; CRITICAL findings abort the run
- Produces bobHandoff (security test cases) and susanHandoff (source validation steps)
- Standalone: "Pablo, run a security scan for SSPLAN-698" or "Pablo, run a full security scan"
