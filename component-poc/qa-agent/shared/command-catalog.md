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

- TypeScript frontend: npm run lint && npm test && npm run build
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

## api-agent

- Crawl `src/services/metrics/*/api.ts` files under frontendRoot
- Read each target component source to trace: component → hook → fetch → endpoint
- Extract all fieldMappings from transformResponse functions
- Cross-reference with backend row classes when backendRoot is provided
- Produces bobHandoff (API test cases for Bob) and susanHandoff (executable steps for Susan)
- No running server required for source-based discovery
