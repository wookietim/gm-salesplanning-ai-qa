# QA Agents Scaffold

This directory contains a reusable scaffold for running multiple QA test agents
with consistent inputs, outputs, and reporting.

- Full guide: [`AGENTS_GUIDE.md`](AGENTS_GUIDE.md)

## Structure

- QA_AGENT.md: existing QA charter and governance guide
- configs/qa-agent.config.json: shared execution settings
- shared/: cross-agent templates and severity standards
- agents/: one folder per QA agent type (definitions only — prompts and schemas)

## Output directories (at repo root, alongside component-poc)

- `QA-Tests/`: Bob's generated test plans (reused across runs, organised by ticket)
- `QA-Runs/`: All timestamped run outputs — Pablo results, Susan results, specialist agent runs

## Included Agent Types

- pablo (manager and orchestrator)
- api-agent (API discovery and contract extraction)
- bob (component test creator)
- susan (component test executor)
- smoke (pre-flight build/compile/test checks)
- regression (historical defect replay)
- accessibility (WCAG / pa11y validation)
- api-contract (request/response schema validation)
- visual-diff (screenshot-based visual regression)
- e2e (runs the project's real Playwright browser suite)
- confluence-agent (publishes supplied content to Confluence pages)
- confluence-writer (upserts per-ticket QA summary table rows on Confluence)
- guide-sync (keeps `AGENTS_GUIDE.md` and README links synchronized with agent changes)

## How to Add Another Agent

1. Copy any folder from agents/.
2. Update AGENT.md and prompt.md.
3. Update input.schema.json and output.schema.json.
4. Add the new agent in configs/qa-agent.config.json.
5. Add an entry in shared/command-catalog.md.
6. Write all output to QA-Runs/ (run artifacts) or QA-Tests/ (test plans).

## Run Artifact Naming

Use this pattern for run files:

YYYYMMDD-HHMMSS-<run-id>.json
